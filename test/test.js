const Builder = require('openapi-enforcer/src/definition-builder')
const Enforcer = require('openapi-enforcer-middleware')
const enforcerMulter = require('../index')
const expect = require('chai').expect
const express = require('express')
const fs = require('fs')
const multer = require('multer')
const path = require('path')
const request = require('request')

const files = {
  image: path.resolve(__dirname, 'files', 'image.jpg'),
  sound: path.resolve(__dirname, 'files', 'sound.mp3'),
  text: path.resolve(__dirname, 'files', 'text.txt'),
  video: path.resolve(__dirname, 'files', 'video.mp4')
}

const v2Response = {
  description: 'Response',
  schema: {
    type: 'array',
    items: { type: 'string' }
  }
}

const v3Response = {
  description: 'Response',
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  }
}

describe('openapi-enforcer-multer', () => {

  describe('memory store', () => {
    it('can upload a file', async () => {

      const def = new Builder(2)
        .addParameter('/', 'post', {
          name: 'textFile',
          in: 'formData',
          type: 'file',
          format: 'byte'
        })
        .addResponse('/', 'post', 200, v2Response)
        .build()

      // initialize the multer
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 200000 }
      })

      const { body, statusCode } = await server.once(def, upload, {
        method: 'post',
        path: '/',
        body: {
          textFile: fs.createReadStream(files.text)
        }
      })

      expect(body).to.deep.equal(['textFile'])
      expect(statusCode).to.equal(200)
    })
  })

})

/**
 *
 * @param def
 * @param upload
 * @returns {Promise<{request({method?: *, path?: *, body?: *}): *, end(): *}>}
 */
async function server (def, upload) {
  const app = express()

  // if v2 then add consumes
  if (def.swagger) def.consumes = ['multipart/form-data']

  // link definition to controllers
  const controllers = {}
  def['x-controller'] = 'main'
  let operationIndex = 0
  Object.keys(def.paths).forEach(key => {
    const opKeys = Object.keys(def.paths[key])
      .filter(v => ['get', 'post', 'put', 'delete'].includes(v))
    opKeys.forEach(op => {
      const operationId = 'operation_' + operationIndex++
      def.paths[key][op]['x-operation'] = operationId
      controllers[operationId] = function (req, res) {
        res.status(200).send(Object.keys(req.body))
      }
    })
  })

  // set up enforcer middleware
  const enforcer = Enforcer(def)
  await enforcer.controllers({ main: controllers })

  // apply middlewares
  app.use(enforcerMulter(enforcer, upload))
  app.use(enforcer.middleware())

  const deferred = {}
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve
    deferred.reject = reject
  })

  const listener = app.listen(err => {
    if (err) deferred.reject()
    deferred.resolve()
  })
  await deferred.promise

  const port = listener.address().port

  return {
    end () {
      return new Promise((resolve, reject) => {
        listener.close(err => {
          if (err) return reject(err)
          resolve()
        })
      })
    },
    request ({ method = 'get', path = '/', body }) {
      return new Promise((resolve, reject) => {
        const options = {
          method,
          baseUrl: 'http://localhost:' + port,
          uri: path,
          json: true
        }
        if (body !== undefined) {
          options.formData = body
          options.headers = {
            'content-type': 'multipart/form-data'
          }
        }
        request(options, (err, res) => {
          if (err) return reject(err)
          resolve(res)
        })
      })
    }
  }
}

server.once = async function (def, upload, { method = 'get', path = '/', body }) {
  const s = await server(def, upload)
  const res = await s.request({ method, path, body })
  s.end()
  return res
}
