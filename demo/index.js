'use strict'
const express = require('express')
const Enforcer = require('openapi-enforcer-middleware')
const enforcerMulter = require('../index')
const path = require('path')
const multer = require('multer')
const statuses = require('statuses')

const app = express()

// initialize the enforcer
const enforcer = Enforcer(path.resolve(__dirname, 'people-v2.yml')) // you can try people-v3.yml if you want (it does the same thing)
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

// add custom error handling middleware
app.use((err, req, res, next) => {
  if (err.statusCode >= 400 && err.statusCode < 500 && err.exception) {
    res.status(err.statusCode)
    res.json({
      message: err.message,
      statusCode: err.statusCode
    })
  } else {
    const statusCode = err.statusCode || 500
    console.error(err.stack)
    res.json({
      message: statuses[statusCode],
      statusCode: statusCode
    })
  }
})

const listener = app.listen(3000, err => {
  if (err) return console.error(err.stack)
  console.log('Server listening on port ' + listener.address().port)
})
