# Open API Enforcer Multer

This package works along side the [multer](https://www.npmjs.com/package/multer) package and the [openapi-enforcer-middleware](https://www.npmjs.com/package/openapi-enforcer-middleware) package to make file uploads for your API simple.

- Works with Open API version 2.0 and 3.x.x.

- Works with multer storage options:

    - DiskStorage
    - MemoryStorage

**You should not use the multer uploads `single`, `array`, `fields` or other functions.** Those functions will automatically be set up for you based on your Open API document's specification.

# Installation

```bash
npm install openapi-enforcer-multer
```

# Usage

For a more thorough example, please see the demo directory included with this package. It provides a simple API for adding people with pictures, getting those people, and downloading the picture in base64 and binary formats.

## Open API Document Setup

For this middleware to identify which parts of the body are files you need to configure your Open API document appropriately.

### Open API 2.0

- Your document root or the [operation](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#operationObject) must define the `consumes` property to use `multipart/form-data`.
- You operation [parameters](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#parameterObject) `in` property must be set to `formData`.

**Example Path for Open API Specification 2.0**

```yml
paths:
  /people:
    post:
      summary: Add a person to the system.
      x-controller: people
      x-operation: add
      consumes:
        - multipart/form-data
      parameters:
        - in: formData
          name: name
          required: true
          type: string
        - in: formData
          name: picture
          required: true
          type: file
          format: byte
      responses:
        201:
          description: Added a person
```

### Open API 3.x.x

Your [operation request body](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#requestBodyObject) must define a content type of `multipart/form-data` with a schema that is an object with defined properties.

**Example Path for Open API Specification 3.x.x**

```yml
paths:
  /people:
    post:
      summary: Add a person to the system.
      x-controller: people
      x-operation: add
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                name:
                  type: string
                picture:
                  type: string
                  format: binary
              required:
                - name
                - picture
      responses:
        201:
          description: Added a person
```

## Server Setup 

```js
const express = require('express')
const Enforcer = require('openapi-enforcer-middleware')
const enforcerMulter = require('openapi-enforcer-multer')
const path = require('path')
const multer = require('multer')

const app = express()

// initialize the enforcer
const enforcer = Enforcer(path.resolve(__dirname, 'people-v2.yml'))
enforcer.controllers(path.resolve(__dirname, 'controllers'))
  .catch(console.error)

// initialize the multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200000 }
})

// add enforcer multer middleware
app.use(enforcerMulter(enforcer, upload))

// add the enforcer middleware runner to the express app
app.use(enforcer.middleware())

const listener = app.listen(3000, err => {
  if (err) return console.error(err.stack)
  console.log('Server listening on port ' + listener.address().port)
})
```

## Controller Setup

Within your controller the `req.body` will have the uploaded file buffer if multer's MemoryStorage is being used. In either case, you will still have access to the full multer file object through `req.files`.

```js
exports.add = async function (req, res, next) {
  const person = {
    id: id++,
    name: req.body.name,
    picture: req.files.picture
  }
  await savePersonToDatabase(person)
  res.status(201)
    .send({
        id: person.id,
        name: person.name,
        picture: person.picture.buffer
      })
}
```
