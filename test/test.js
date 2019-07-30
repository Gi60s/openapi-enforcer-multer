const Builder = require('openapi-enforcer/src/definition-builder')
const Enforcer = require('openapi-enforcer-middleware')
const enforcerMulter = require('../index')
const expect = require('chai').expect
const express = require('express')
const fs = require('fs')
const multer = require('multer')
const path = require('path')
const request = require('request')
const tempDir = require('temp-dir')

const files = {
  image: path.resolve(__dirname, 'files', 'image.jpg'),
  sound: path.resolve(__dirname, 'files', 'sound.mp3'),
  text: path.resolve(__dirname, 'files', 'text.txt'),
  video: path.resolve(__dirname, 'files', 'video.mp4')
}

const fileSavePath = path.resolve(tempDir, 'openapi-enforcer-multer-test')
try {
  fs.mkdirSync(fileSavePath)
} catch (e) {}

const v2Parameter = {
  name: 'textFile',
  in: 'formData',
  type: 'file',
  format: 'byte'
}

const v2Response = {
  description: 'Response',
  schema: {
    type: 'array',
    items: { type: 'string' }
  }
}

describe('openapi-enforcer-multer', () => {

  describe('memory store', () => {
    it('can upload a file', async () => {

      const def = new Builder(2)
        .addParameter('/', 'post', v2Parameter)
        .addResponse('/', 'post', 200, v2Response)
        .build()

      // initialize the multer
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 200000 }
      })

      const { body, statusCode } = await server.once(def, upload, false, {
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

  describe('file store', () => {

    it('can upload a file', async () => {

      const def = new Builder(2)
        .addParameter('/', 'post', v2Parameter)
        .addResponse('/', 'post', 200, v2Response)
        .build()

      // initialize the multer
      const upload = multer({
        storage: multer.diskStorage({
          destination: function (req, file, cb) {
            cb(null, fileSavePath)
          },
          filename: function (req, file, cb) {
            cb(null, file.fieldname + '-' + Date.now())
          }
        }),
        limits: { fileSize: 200000 }
      })

      const { body, statusCode } = await server.once(def, upload, { directedUploads: true }, {
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

  describe('multi store', () => {

    it.only('can upload a file', async () => {
      const savedFileNames = []

      const def = new Builder(2)
        .addParameter('/mem', 'post', v2Parameter)
        .addResponse('/mem', 'post', 200, v2Response)
        .addParameter('/files/{id}', 'post', v2Parameter)
        .addParameter('/files/{id}', 'post', {
          name: 'id',
          in: 'path',
          required: true,
          type: 'integer'
        })
        .addResponse('/files/{id}', 'post', 200, v2Response)
        .build()
      def.paths['/mem']['x-multer-key'] = 'mem'
      def.paths['/files/{id}'].post['x-multer-key'] = 'files'

      // initialize the multer
      const uploadMemory = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 200000 }
      })

      // initialize the multer
      const uploadFileSystem = multer({
        storage: multer.diskStorage({
          destination: function (req, file, cb) {
            cb(null, fileSavePath)
          },
          filename: function (req, file, cb) {
            const name = file.fieldname + '-' + Date.now()
            savedFileNames.push(name)
            cb(null, name)
          }
        }),
        limits: { fileSize: 200000 }
      })

      const s = await server(def, { mem: uploadMemory, files: uploadFileSystem }, { directedUploads: true })

      const result1 = await s.request({
        method: 'post',
        path: '/mem',
        body: {
          textFile: fs.createReadStream(files.text)
        }
      })
      expect(result1.body).to.deep.equal(['textFile'])
      expect(result1.statusCode).to.equal(200)
      expect(() => {
        fs.statSync(path.resolve(fileSavePath, savedFileNames[0]))
      }).to.throw(Error)


      const result2 = await s.request({
        method: 'post',
        path: '/files/1234',
        body: {
          textFile: fs.createReadStream(files.text)
        }
      })
      expect(result2.body).to.deep.equal(['textFile'])
      expect(result2.statusCode).to.equal(200)
      expect(savedFileNames.length).to.equal(1)

      // if file does not exist an error will be thrown
      fs.statSync(path.resolve(fileSavePath, savedFileNames[0]))
    })
  })

})

/**
 *
 * @param def
 * @param upload
 * @param options
 * @returns {Promise<{request({method?: *, path?: *, body?: *}): *, end(): *}>}
 */
async function server (def, upload, options) {
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
  app.use(enforcerMulter(enforcer, upload, options))
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

server.once = async function (def, upload, options, { method = 'get', path = '/', body }) {
  const s = await server(def, upload, options)
  const res = await s.request({ method, path, body })
  s.end()
  return res
}
