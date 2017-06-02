'use strict'

const parser = require('../')
const fs = require('fs')

process.chdir(__dirname)

;(function () {
  console.log('Tree Builder')
  console.log('------------')

  const parse   = parser().parse
  const builder = require('./builders/tree-builder')()
  const source  = fs.readFileSync('fixtures/box.tag', 'utf8').trim()
  const result  = builder.build(parse(source))

  console.log(result)
  console.log()
})()

;(function () {
  console.log('Riot Builder')
  console.log('------------')

  const parse   = parser().parse
  const builder = require('./builders/riot-builder')({ compact: true })
  const source  = fs.readFileSync('fixtures/box.tag', 'utf8').trim()
  const result  = builder.build(parse(source))

  console.log(result)
})()
