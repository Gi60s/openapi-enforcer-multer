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

//
// function foo () {
//   if (req.hasOwnProperty('body')) {
//     let value = req.body;
//
//     // v2 parameter in body
//     if (parameters.body) {
//       const parameter = getBodyParameter(parameters);
//       value = primitiveBodyDeserialization(value, parameter.schema);
//       deserializeAndValidate(exception.nest('In body'), parameter.schema, { value }, value => {
//         result.body = Value.extract(value);
//       });
//
//       // v3 requestBody
//     } else if (this.requestBody) {
//       const contentType = req.header.hasOwnProperty('content-type') ? req.header['content-type'].split(';')[0].trim() : '*/*';
//       const content = this.requestBody.content;
//       const mediaTypes = Object.keys(content);
//       const matches = util.findMediaMatch(contentType, mediaTypes);
//       const length = matches.length;
//
//       // one or more potential matches
//       if (length) {
//         const child = new Exception('In body');
//
//         // find the first media type that matches the request body
//         let passed = false;
//         for (let i = 0; i < length; i++) {
//           const mediaType = matches[i];
//           const media = content[mediaType];
//           if (media.schema) {
//             value = primitiveBodyDeserialization(value, media.schema);
//             deserializeAndValidate(child.nest('For Content-Type ' + mediaType), media.schema, { value }, value => {
//               result.body = Value.extract(value);
//               passed = true;
//             });
//           }
//
//           // if the media type was an exact match or if the schema passed then stop executing
//           if (contentType === mediaType || passed) break;
//         }
//
//         // if nothing passed then add all exceptions
//         if (!passed) exception.push(child);
//
//       } else {
//         exception.message('Content-Type not accepted');
//       }
//
//     } else if (!parameters.formData) {
//       exception.message('Body is not allowed');
//     }
// }
