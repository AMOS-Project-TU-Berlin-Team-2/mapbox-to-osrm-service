#!/usr/bin/env node
const http = require('http')
const polyline = require('@mapbox/polyline')
const geolib = require('geolib')

http.createServer(onRequest).listen(3001)

/**
 * Catch all incoming request in order to translate them.
 * @param {Object} clientReq
 * @param {Object} clientRes
 */
function onRequest (clientReq, clientRes) {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: translatePath(clientReq.url),
    method: 'GET'
  }

  const req = http.request(options, (res) => {
    console.log(`Path ${clientReq.url} translated to ${options.path}`)

    let data = ''
    res.on('data', d => {
      data += d
    })

    res.on('end', () => {
      let result = JSON.parse(data)

      let destination = clientReq.url.split('/')[5].split(';')[1].split('?')[0]
      let viaPoints = getViaPoints(result.routes[0].legs[0].steps[5].intersections[0], options.path)
      console.log(destination)
      getAlternativeRoutes(result.routes[0].legs[0].steps[5].intersections[0], viaPoints, destination, function (route) {
        let translatedResult = translateResult(result)
        translatedResult.routes.push(route.routes[0])
        
        console.log(translatedResult)
        clientRes.write(JSON.stringify(translatedResult))
        clientRes.end('\n')
      })

    })
  })

  req.on('error', (error) => {
    console.error(error)
  })

  req.end()
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
  var initialPoint = {lat: intersection.location[1], lon: intersection.location[0]}
  var dist = 100;
  var otherBearings = intersection.bearings

  // Remove bearings of current primary route
  otherBearings.splice(intersection.in, 1)
  otherBearings.splice(intersection.out, 1)
  
  var viaPoints = otherBearings.map(bearing => {
    var geoPoint = geolib.computeDestinationPoint(initialPoint, dist, bearing)
    return geoPoint.longitude + ',' + geoPoint.latitude
  })
  return viaPoints
}

function getAlternativeRoutes (intersection, viaPoints, destination, cb) {
  getRoute(intersection.location[0] + ',' + intersection.location[1] + ';' + viaPoints[0] + ';' + destination, cb)
}

function getRoute (points, cb) {
  console.log(points)
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/route/v1/driving/' + points + '?steps=true&geometries=polyline6',
    method: 'GET'
  }

  const req = http.request(options, (res) => {
    let data = ''
    res.on('data', d => {
      data += d
    })

    res.on('end', () => {
      let result = JSON.parse(data)
      cb(result)
    })
  })

  req.on('error', (error) => {
    console.error(error)
  })

  req.end()
}
