'use strict'

const compareObject = require('./utils/compare-objects')
const echoBuilder = require('./builders/echo-builder')
const parser = require('../').default
const expect = require('chai').expect
const fs = require('fs')

process.chdir(__dirname)

function getOpts(test) {
  return Object.assign({ brackets: ['{', '}'] }, test && test.options)
}


describe('The Parser', function () {
  const theTests = require('./tparser')
  const titles = Object.keys(theTests)

  const _TDEBUG = 0

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i]

    it(title, function () {
      const test = theTests[title]

      if (_TDEBUG && title === _TDEBUG) debugger
      const _p = parser(getOpts(test), echoBuilder)

      if (test.throws) {
        expect(function () { _p.parse(test.data) }).throw(test.throws)

      } else {
        let result = _p.parse(test.data)
        let expected
        if (compareObject(result.output, test.expected)) {
          result = expected = 1
        } else {
          result   = JSON.stringify(result.output)
          expected = JSON.stringify(test.expected)
        }
        expect(result).to.be.equal(expected)
      }
    })

    if (_TDEBUG && title === _TDEBUG) break
  }

})


describe('Expressions', function () {

  const theTests = require('./texpr')
  const titles = Object.keys(theTests)

  const _TDEBUG = 0

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i]

    it(title, function () {
      const test = theTests[title]
      const _p = parser(getOpts(test), echoBuilder)

      if (_TDEBUG && title === _TDEBUG) debugger

      if (test.throws) {
        expect(function () { _p.parse(test.data) }).throw(test.throws)

      } else {
        let result = _p.parse(test.data)
        let expected
        if (compareObject(result.output, test.expected)) {
          result = expected = 1
        } else {
          result   = JSON.stringify(result.output)
          expected = JSON.stringify(test.expected)
        }
        expect(result).to.be.equal(expected)
      }
    })

    if (_TDEBUG && title === _TDEBUG) break
  }

})


describe('Tree Builder', function () {
  const path = require('path')

  function cat(dir, name) {
    return fs.readFileSync(path.join('.', dir, name), 'utf8')
  }

  const titles = fs.readdirSync('./fixtures')
  const _p = parser(getOpts())

  const _TDEBUG = 0
  const _TOSAVE = []

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i]
    const ext = path.extname(title)
    if (ext !== '.tag') {
      continue
    }
    const name = path.basename(title, ext)


    it(title, function () {
      const src = cat('fixtures', title)

      if (name === _TDEBUG) debugger
      const res = _p.parse(src)

      expect(res).to.be.an('object')
      expect(res.output).to.be.an('object')

      const tree = res.output

      const json = JSON.stringify(tree, null, '  ')

      if (_TOSAVE[0] === '*' || _TOSAVE.indexOf(name) !== -1) {
        fs.writeFile(path.join('.', 'expected', name + '_out.json'), json, function (err) {
          if (err) throw err
        })
      }
      expect(json.trim()).to.be.equal(cat('expected', name + '.json').trim())
    })

    if (_TDEBUG && title === _TDEBUG) break
  }

})


describe('HTML Builder', function () {

  const htmlBuilder = require('./builders/html-builder')
  const theTests = require('./thtmlbuilder')
  const titles = Object.keys(theTests)

  const _TDEBUG = 0//'Attributes: Single quoted values are converted to double quoted'

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i]

    it(title, function () {
      const test = theTests[title]
      const _p = parser(getOpts(test), echoBuilder)
      const builder = htmlBuilder(test.builderOptions)

      if (_TDEBUG && title === _TDEBUG) debugger

      if (test.throws) {
        expect(function () {
          builder.build(_p.parse(test.data))
        }).throw(test.throws)

      } else {
        const result = builder.build(_p.parse(test.data))
        expect(result).to.be.equal(test.expected)
      }
    })

    if (_TDEBUG && title === _TDEBUG) break
  }

  it('SVG Test', function () {
    const source = fs.readFileSync('fixtures/loop-svg-nodes.tag', 'utf8').trim()
    const _p = parser(getOpts(), echoBuilder)
    const builder = htmlBuilder({ compact: false })
    const expected = [
      '<loop-svg-nodes>',
      '  <svg>',
      '    <circle each="{ points }" riot-cx="{ x * 10 + 5 }" riot-cy="{ y * 10 + 5 }" r="2" fill="black"/>',
      '  </svg>',
      '  <p>Description</p>',
      '  <loop-svg-nodes></loop-svg-nodes>',
      '  <loop-svg-nodes></loop-svg-nodes>',
      '',
      '  <script>',
      "  this.points = [{'x': 1,'y': 0}, {'x': 9, 'y': 6}, {'x': 4, 'y': 7}]",
      '  </script>',
      '',
      '</loop-svg-nodes>'
    ].join('\n')

    const result = builder.build(_p.parse(source))
    expect(result).to.be.equal(expected)
  })

})
