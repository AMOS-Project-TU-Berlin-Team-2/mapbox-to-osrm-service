const http = require('http')

http.createServer(onRequest).listen(3000)

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
      clientRes.write(JSON.stringify(translateResult(result)))
      clientRes.end('\n')
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
  return originalResult
}
