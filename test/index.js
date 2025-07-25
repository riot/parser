import compareObject from './utils/compare-objects.js'
import echoBuilder from './builders/echo-builder.js'
import parser from '../index.js'
import { expect } from 'chai'
import path from 'node:path'
import fs from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import parserTests from './tparser.js'
import expressionTests from './texpr.js'
import htmlBuilder from './builders/html-builder.js'
import htmlBuilderTests from './thtmlbuilder.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

process.chdir(__dirname)

function getOpts(test) {
  return Object.assign({ brackets: ['{', '}'] }, test && test.options)
}

function cat(dir, name) {
  return fs.readFileSync(path.join('.', dir, name), 'utf8')
}

function throwException(test) {
  const _p = parser(getOpts(test))
  return expect(function () {
    _p.parse(test.data)
  }).throw(test.throws)
}

describe('The Parser', function () {
  Object.keys(parserTests).forEach((title) => {
    it(title, function () {
      const test = parserTests[title]
      const _p = parser(getOpts(test), echoBuilder)

      if (test.throws) {
        throwException(test)
      } else {
        let result = _p.parse(test.data)
        let expected
        if (compareObject(result.output, test.expected)) {
          result = expected = 1
        } else {
          result = JSON.stringify(result.output)
          expected = JSON.stringify(test.expected)
        }
        expect(result).to.be.equal(expected)
      }
    })
  })
})

describe('Expressions', function () {
  Object.keys(expressionTests).forEach((title) => {
    it(title, function () {
      const test = expressionTests[title]
      const _p = parser(getOpts(test), echoBuilder)

      if (test.throws) {
        throwException(test)
      } else {
        let result = _p.parse(test.data)
        let expected
        if (compareObject(result.output, test.expected)) {
          result = expected = 1
        } else {
          result = JSON.stringify(result.output)
          expected = JSON.stringify(test.expected)
        }
        expect(result).to.be.equal(expected)
      }
    })
  })
})

describe('Tree Builder', function () {
  const titles = fs.readdirSync('./fixtures')
  const _p = parser(
    getOpts({
      options: {
        comments: true,
      },
    }),
  )

  const _TDEBUG = 0
  const _TOSAVE = ['*']

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i]
    const ext = path.extname(title)
    if (ext !== '.riot') {
      continue
    }
    const name = path.basename(title, ext)

    it(title, function () {
      const src = cat('fixtures', title)

      // eslint-disable-next-line no-debugger
      if (name === _TDEBUG) debugger
      const res = _p.parse(src)

      expect(res).to.be.an('object')
      expect(res.output).to.be.an('object')

      const tree = res.output

      const json = JSON.stringify(tree, null, '  ')

      if (_TOSAVE[0] === '*' || _TOSAVE.indexOf(name) !== -1) {
        fs.writeFile(
          path.join('.', 'expected', `${name}_out.json`),
          json,
          function (err) {
            if (err) throw err
          },
        )
      }
      expect(json.trim()).to.be.equal(cat('expected', `${name}.json`).trim())
    })

    if (_TDEBUG && title === _TDEBUG) break
  }
})

describe('HTML Builder', function () {
  const titles = Object.keys(htmlBuilderTests)

  const _TDEBUG = 0 //'Attributes: Single quoted values are converted to double quoted'

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i]

    it(title, function () {
      const test = htmlBuilderTests[title]
      const _p = parser(getOpts(test), echoBuilder)
      const builder = htmlBuilder(test.builderOptions)

      // eslint-disable-next-line no-debugger
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
    const source = fs
      .readFileSync('fixtures/loop-svg-nodes.riot', 'utf8')
      .trim()
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
      '</loop-svg-nodes>',
    ].join('\n')

    const result = builder.build(_p.parse(source))
    expect(result).to.be.equal(expected)
  })
})
