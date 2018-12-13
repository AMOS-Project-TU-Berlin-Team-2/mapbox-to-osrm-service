#!/usr/bin/env node

const http = require('http')
const geolib = require('geolib')
const fetch = require('node-fetch')
const polyline = require('@mapbox/polyline')

const baseUrl = 'http://localhost:5000'
const intersectionDist = 200

http.createServer(onRequest).listen(3000)

/**
 * Catch all incoming request in order to translate them.
 * @param {Object} clientReq
 * @param {Object} clientRes
 */
function onRequest (clientReq, clientRes) {
  let osrmPath = translatePath(clientReq.url)

  fetch(`${baseUrl}${osrmPath}`)
    .then(res => res.json())
    .then(result => {
      console.log(`Path ${clientReq.url} translated to ${osrmPath}`)

      let translatedResult = translateResult(result)
      let destination = getDestination(clientReq.url)
      let intersections = fetchIntersections(result.routes[0])

      let alternativeRoutePromises = intersections.map(intersection => {
        return getAlternativeRoutes(intersection, destination)
      })

      Promise.all(alternativeRoutePromises).then(alternativeRoutes => {
        alternativeRoutes.forEach(alternativeRoute => {
          if (alternativeRoute.length > 0) {
            let strippedRoute = stripAlternativeRoute(alternativeRoute[0].routes[0])
            let types = ['heavy', 'moderate']
            strippedRoute.legs[1].annotation = {
              congestion: new Array(polyline.decode(strippedRoute.geometry).length - 1).fill(types[Math.floor(Math.random() * 2)])
            }
            translatedResult.routes.push(strippedRoute)
          }
        })
        clientRes.write(JSON.stringify(translatedResult))
        clientRes.end('\n')
      })
    })
}

/**
 * Make sure that the directions endpoint is mapped to the routing endpoint.
 * Strip all GET params and append some needed params.
 * @param {String} originalPath
 * @return {String} translatedPath
 */
function translatePath (originalPath) {
  return originalPath.replace('directions/v5/mapbox', 'route/v1').split('?')[0] + '?steps=true&geometries=polyline6'
}

/**
 * Return an array of every intersection along the route
 * @param {Object} route
 * @return {Array} intersections
 */
function fetchIntersections (route) {
  let intersections = []
  route.legs.forEach(leg => {
    leg.steps.forEach(step => {
      step.intersections.forEach(intersection => {
        intersections.push(intersection)
      })
    })
  })
  return intersections
}

/**
 * Get the destination by parsing the url in url format.
 * @param {String} url
 * @return {Geopoint} destination
 */
function getDestination (url) {
  return toGeopoint(url.split('/')[5].split(';')[1].split('?')[0])
}

/**
 * The mapbox sdk needs a uuid, crashes otherwise. So append one here.
 * @param {Object} originalResult
 * @return {Object} translatedResult
 */
function translateResult (originalResult) {
  let translatedResult = Object.assign({}, originalResult)
  translatedResult.uuid = 1
  return translatedResult
}

/**
 * Calculate the points around the intersection.
 * These points are intersectionDist meters away from the intersection
 * on every unused road.
 * @param {Object} intersection
 * @return {Array} viaPoints
 */
function getViaPoints (intersection) {
  let initialPoint = toGeopoint(intersection.location)
  let otherBearings = intersection.bearings

  // Remove bearings of current primary route
  otherBearings.splice(intersection.in, 1)
  otherBearings.splice(intersection.out, 1)

  var viaPoints = otherBearings.map(bearing => {
    return geolib.computeDestinationPoint(initialPoint, intersectionDist, bearing)
  })
  return viaPoints
}

/**
 * Get alternative routes via every viapoint from the intersection.
 * @param {Object} intersection
 * @param {Geopoint} destination
 * @return {Promise[]|routes} alternative routes
 */
function getAlternativeRoutes (intersection, destination) {
  return new Promise((resolve, reject) => {
    let start = toGeopoint(intersection.location)
    let viaPoints = getViaPoints(intersection)
    let alternativeRoutes = viaPoints.map(viaPoint => {
      return getRoute([
        start,
        viaPoint,
        destination
      ])
    })
    Promise.all(alternativeRoutes).then(resolve)
  })
}

/**
 * Fetch an alternative route from OSRM service.
 * @param {Array} points
 * @return {Promse|Route}
 */
function getRoute (waypoints) {
  let coordinates = toCoordinateString(waypoints)
  return fetch(`${baseUrl}/route/v1/driving/${coordinates}?steps=true&geometries=polyline6`)
    .then(res => res.json())
}

/**
 * Only keep the first two steps of the route.
 * @param {Object} alternativeRoute
 * @return {Object} alternativeRoute
 */
function stripAlternativeRoute (alternativeRoute) {
  alternativeRoute.geometry = polyline.encode(polyline.decode(alternativeRoute.legs[0].steps[0].geometry).concat(polyline.decode(alternativeRoute.legs[0].steps[1].geometry)))
  return alternativeRoute
}

/**
 * Convert geopoints to the format OSRM understands
 * @param {Array} waypoints
 * @return {String} coordinate string
 */
function toCoordinateString (waypoints) {
  return waypoints
    .map(waypoint => {
      if (waypoint.longitude) {
        waypoint.lon = waypoint.longitude
        waypoint.lat = waypoint.latitude
      }
      return `${waypoint.lon},${waypoint.lat}`
    }).join(';')
}

/**
 * Convert coordinate string or array to the generic geopoint format.
 * @param {String} coordinateString
 * @return {Geopoint} geopoint
 */
function toGeopoint (waypoint) {
  let coordinates = (typeof waypoint === 'string') ? waypoint.split(',') : waypoint
  return {
    lon: coordinates[0],
    lat: coordinates[1]
  }
}
