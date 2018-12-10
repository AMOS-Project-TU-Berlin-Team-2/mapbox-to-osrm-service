#!/usr/bin/env node
const http = require('http')
const geolib = require('geolib')
const fetch = require('node-fetch')
const baseUrl = 'http://localhost:5000'
const intersectionDist = 100

http.createServer(onRequest).listen(3001)

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
      let intersections = fetchIntersections(result.route[0])
      let alternativeRoutePromises = intersections.map(intersection => {
        return getAlternativeRoutes(intersection, destination)
      })

      Promise.all(alternativeRoutePromises).then(alternativeRoutes => {
        translatedResult.routes.concat(alternativeRoutes)
      })

      clientRes.write(JSON.stringify(translatedResult))
      clientRes.end('\n')
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
  return route.legs.reduce((acc, leg) => {
    return acc.concat(leg.steps.map(step => {
      return step.intersections
    }), [])
  })
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

function getViaPoints (intersection) {
  let initialPoint = toGeopoint(intersection.location)
  let otherBearings = intersection.bearings

  // Remove bearings of current primary route
  otherBearings.splice(intersection.in, 1)
  otherBearings.splice(intersection.out, 1)

  var viaPoints = otherBearings.map(bearing => {
    var geoPoint = geolib.computeDestinationPoint(initialPoint, intersectionDist, bearing)
    return geoPoint.longitude + ',' + geoPoint.latitude
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
 * Convert geopoints to the format OSRM understands
 * @param {Array} waypoints
 * @return {String} coordinate string
 */
function toCoordinateString (waypoints) {
  return waypoints
    .map(waypoint => {
      return `${waypoint.longtitude},${waypoint.latitude}`
    }).join(';')
}

/**
 * Convert coordinate string or array to the generic geopoint format.
 * @param {String} coordinateString
 * @return {Geopoint} geopoint
 */
function toGeopoint (waypoint) {
  if (typeof coordinateString === 'string') {
    return {
      longtitude: waypoint.split(',')[0],
      latitude: waypoint.split(',')[1]
    }
  } else {
    return {
      longtitude: waypoint[0],
      latitude: waypoint[1]
    }
  }
}
