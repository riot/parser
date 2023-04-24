import tagParser from '../index.js'
import fs from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const opts = {
  brackets: ['{', '}'],
}

process.chdir(__dirname)
;(function () {
  console.log('Tree Builder')
  console.log('------------')

  const parser = tagParser(opts)
  const source = fs.readFileSync('fixtures/box.riot', 'utf8').trim()
  const result = parser.parse(source).output

  console.dir(result, { depth: 12, colors: true })
  console.log()
})()
;(function () {
  console.log('Tree Builder')
  console.log('------------')

  const parser = tagParser(opts)
  const source = fs
    .readFileSync('fixtures/es6-nested-regex.riot', 'utf8')
    .trim()
  const result = parser.parse(source).output

  console.dir(result, { depth: 12, colors: true })
  console.log()
})()
;(function () {
  console.log('------------------')
  console.log('Tree Builder (svg)')
  console.log('------------------')

  const parser = tagParser(opts)
  const source = fs.readFileSync('fixtures/loop-svg-nodes.riot', 'utf8').trim()
  const result = parser.parse(source).output

  console.dir(result, { depth: 12, colors: true })
  console.log()
})()
;(function () {
  console.log('------------------')
  console.log('History Router APP')
  console.log('------------------')

  const parser = tagParser(opts)
  const source = fs
    .readFileSync('fixtures/history-router-app.riot', 'utf8')
    .trim()
  const result = parser.parse(source).output

  console.dir(result, { depth: 12, colors: true })
  console.log()
})()
