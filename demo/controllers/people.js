
const people = []
let id = 0

exports.add = function (req, res, next) {
  const person = {
    id: id++,
    name: req.body.name,
    picture: req.body.picture
  }
  people.push(person)
  res.status(201).send({
    id: person.id,
    name: person.name,
    picture: person.picture
  })
}

exports.delete = function (req, res, next) {
  const index = people.findIndex(p => p.id === id)
  if (index !== -1) people.splice(index, 1)
  res.sendStatus(204)
}

exports.get = function (req, res, next) {
  const person = people.find(p => p.id === id)
  if (!person) {
    res.sendStatus(404)
  } else {
    res.send({
      id: person.id,
      name: person.name,
      picture: person.picture
    })
  }
}

exports.getPicture = function (req, res, next) {

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

exports.update = function (req, res, next) {
  const person = people.find(p => p.id === id)
  if (!person) {
    res.sendStatus(404)
  } else {
    person.name = req.body.name
    person.picture = req.body.picture
  }
}
