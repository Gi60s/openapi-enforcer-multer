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
