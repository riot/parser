'use strict'

const tagParser = require('../')
const fs = require('fs')
const opts = {
  brackets: ['{', '}']
}

process.chdir(__dirname)

;(function () {
  console.log('Tree Builder')
  console.log('------------')

  const parser  = tagParser(opts)
  const source  = fs.readFileSync('fixtures/box.tag', 'utf8').trim()
  const result  = parser.parse(source).output

  console.dir(result, { depth: 12, colors: true })
  console.log()
})()

;(function () {
  console.log('------------------')
  console.log('Tree Builder (svg)')
  console.log('------------------')

  const parser  = tagParser(opts)
  const source  = fs.readFileSync('fixtures/loop-svg-nodes.tag', 'utf8').trim()
  debugger
  const result  = parser.parse(source).output

  console.dir(result, { depth: 12, colors: true })
  console.log()
})()
