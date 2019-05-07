
const people = []
let id = 0

exports.add = function (req, res, next) {
  const person = {
    id: id++,
    name: req.body.name,
    picture: req.files.picture
  }
  people.push(person)
  res.status(201).send({
    id: person.id,
    name: person.name,
    picture: person.picture.buffer
  })
}

exports.get = function (req, res, next) {
  const id = req.params.id
  const person = people.find(p => p.id === id)
  if (!person) {
    res.sendStatus(404)
  } else {
    res.send({
      id: person.id,
      name: person.name,
      picture: person.picture.buffer
    })
  }
}

exports.getPicture = function (req, res, next) {
  const id = req.params.id
  const person = people.find(p => p.id === id)
  if (!person) {
    res.sendStatus(404)
  } else {
    res.set('Content-Disposition', 'attachment; filename="' + person.picture.originalname + '"')
    res.set('Content-Type', person.picture.mimeType)
    res.write(person.picture.buffer)
    res.end()
  }
}

exports.list = function (req, res, next) {
  const list = people.map(p => {
    return {
      id: p.id,
      name: p.name
    }
  })
  res.send(list)
}
