const methods = ['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace']

module.exports = function (enforcer, upload) {
  const map = new WeakMap()

  const promise = enforcer.promise
    .then(openapi => {
      if (openapi.paths) {
        Object.keys(openapi.paths).forEach(pathKey => {
          const path = openapi.paths[pathKey]
          if (path) {
            methods.forEach(method => {
              const operation = path[method]
              if (operation) {
                // v2
                const v2Body = operation.parameters.find(p => p.in === 'formData')
                if (v2Body) {
                  const { definition, root } = operation.enforcerData
                  const consumes = (definition.consumes || []).concat(root.definition.consumes || [])
                  if (consumes.indexOf('multipart/form-data') !== -1) {
                    const schema = { type: 'object', properties: {} }
                    operation.allParameters
                      .filter(param => param.in === 'formData')
                      .forEach(param => {
                        schema.properties[param.name] = param.schema
                      })
                    buildMulterFields(schema, operation, map, upload)
                  }

                // v3
                } else if (operation.requestBody) {
                  const schema = operation.requestBody.content &&
                    operation.requestBody.content['multipart/form-data'] &&
                    operation.requestBody.content['multipart/form-data'].schema
                  buildMulterFields(schema, operation, map, upload)
                }
              }
            })
          }
        })
      }
      return openapi
    })

  return function (req, res, next) {
    promise
      .then(openapi => {

        // get the x-multer property off the operation instance for the request
        const [ path ] = openapi.path(req.method, req.path)
        const operation = path.operation
        const multer = map.get(operation)

        // if there is no multer middleware
        if (!multer) {
          next()

        // there is a multer middleware
        } else {

          // run the multer middleware
          multer.middleware(req, res, function (err) {
            if (err) return next(err)

            // copy multer's "files" to body
            req.body = Object.assign({}, req.body)
            Object.keys(req.files).forEach(key => {
              const files = req.files[key]
              const prop = multer.schema.properties[key]
              if (prop.type === 'array') {
                req.body[key] = files.map(file => file.buffer || Buffer.allocUnsafe(file.size))
              } else if (files.length) {
                const file = files[files.length - 1]
                req.body[key] = file.buffer || Buffer.allocUnsafe(file.size)
                req.files[key] = file
              }
            })
            next()
          })
        }
      })
      .catch(next)
  }
}

function buildMulterFields (schema, operation, map, upload) {
  if (schema && schema.type === 'object' && schema.properties) {
    const fields = []
    Object.keys(schema.properties).forEach(key => {
      const item = schema.properties[key]
      if (item.type === 'array' && item.items && schemaIsFileType(item.items)) {
        const config = { name: key }
        if (item.hasOwnProperty('maxItems')) config.maxCount = item.maxItems
        fields.push(config)
      } else if (schemaIsFileType(item)) {
        fields.push({ name: key, maxCount: 1 })
      }
    })
    if (fields.length) {
      map.set(operation, {
        middleware: upload.fields(fields),
        schema
      })
    }
  }
}

function schemaIsFileType (schema) {
  return schema.type === 'string' && (schema.format === 'byte' || schema.format === 'binary')
}
