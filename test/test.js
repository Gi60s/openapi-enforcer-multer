const Builder = require('openapi-enforcer/src/definition-builder')
const Enforcer = require('openapi-enforcer-middleware')
const enforcerMulter = require('../index')
const expect = require('chai').expect
const express = require('express')
const multer = require('multer')
const request = require('request')

const contentMap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

describe('openapi-enforcer-multer', () => {

  it('can upload a file', async () => {

    const def = new Builder(2)
      .addParameter('/', 'post', {
        name: 'file',
        in: 'formData',
        type: 'string',
        format: 'binary'
      })
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
        file: createFile('file1.txt', 'text/plain', 100)
      }
    })

    expect(statusCode).to.equal(200)

  })

})

function createFile (fileName, contentType, fileSize) {
  const array = []
  for (let i = 0; i < fileSize; i++) {
    array.push(contentMap[Math.floor(Math.random() * 62)])
  }
  const buffer = Buffer.from(array)
  return {
    value: buffer,
    options: {
      fileName,
      contentType
    }
  }
}

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
  Object.keys(def.paths).forEach((key, index) => {
    const operationId = 'operation_' + index
    def.paths[key]['x-operation'] = operationId
    controllers[operationId] = function (req, res) {
      res.sendStatus(200)
    }
  })

  // set up enforcer middleware
  const enforcer = await Enforcer(def)
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
          uri: path
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
