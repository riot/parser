
const fn = require('../')
const _T = fn().nodeTypes

module.exports = {

  'must preserve inner spaces': {
    data: '<p>{ 0 }</p>',
    expected: [
      { type: _T.TAG, name: 'p', start: 0, end: 3 },
      {
        type: _T.TEXT, start: 3, end: 8, expressions: [
          { text: ' 0 ', start: 3, end: 8 }
        ]
      },
      { type: _T.TAG, name: '/p', start: 8, end: 12 }
    ]
  },

  'must preserve inner spaces #2': {
    data: '<p>{\n\t0\n}</p>',
    expected: [
      { type: _T.TAG, name: 'p', start: 0, end: 3 },
      {
        type: _T.TEXT, start: 3, end: 9, expressions: [
          { text: '\n\t0\n', start: 3, end: 9 }
        ]
      },
      { type: _T.TAG, name: '/p', start: 9, end: 13 }
    ]
  },

  'must preserve inner spaces #3': {
    data: '<p>{\n0\n+\n1 }</p>',
    expected: [
      { type: _T.TAG, name: 'p', start: 0, end: 3 },
      {
        type: _T.TEXT, start: 3, end: 12, expressions: [
          { text: '\n0\n+\n1 ', start: 3, end: 12 }
        ]
      },
      { type: _T.TAG, name: '/p', start: 12, end: 16 }
    ]
  },

  'must handle double quotes inside unquoted expression': {
    data: '<p>foo {"<a>"}</p>',
    expected: [
      { type: _T.TAG, name: 'p', start: 0, end: 3 },
      {
        type: _T.TEXT, start: 3, end: 14, expressions: [
          { text: '"<a>"', start: 7, end: 14 }
        ]
      },
      { type: _T.TAG, name: '/p', start: 14, end: 18 }
    ]
  },

  'must handle double quotes inside double quoted expression': {
    data: '<p>foo "{"<a>"}"</p>',
    expected: [
      { type: _T.TAG, name: 'p', start: 0, end: 3 },
      {
        type: _T.TEXT, start: 3, end: 16, expressions: [
          { text: '"<a>"', start: 8, end: 15 }
        ]
      },
      { type: _T.TAG, name: '/p', start: 16, end: 20 }
    ]
  },

  'must handle single quotes inside single quoted expression': {
    data: "<p>foo '{'<a>'}'</p>",
    expected: [
      { type: _T.TAG, name: 'p', start: 0, end: 3 },
      {
        type: _T.TEXT, start: 3, end: 16, expressions: [
          { text: "'<a>'", start: 8, end: 15 }
        ]
      },
      { type: _T.TAG, name: '/p', start: 16, end: 20 }
    ]
  },

  'text inside tag, simple expression': {
    data: '<div>foo & { 0 }</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TEXT, start: 5, end: 16, expressions: [
          { text: ' 0 ', start: 11, end: 16 }
      ] },
      { type: _T.TAG, name: '/div', start: 16, end: 22 }
    ]
  },

  'text inside tag, expression with embeded brackets': {
    data: '<div>foo & { "{" }</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TEXT, start: 5, end: 18, expressions: [
        { text: ' "{" ', start: 11, end: 18 }
      ] },
      { type: _T.TAG, name: '/div', start: 18, end: 24 }
    ]
  },

  'text inside tag, ternary with embeded brackets': {
    data: "<div>foo & { s === \"{\" ? '' : '}' }</div>",
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TEXT, start: 5, end: 35, expressions: [
        { text: " s === \"{\" ? '' : '}' ", start: 11, end: 35 }
      ] },
      { type: _T.TAG, name: '/div', start: 35, end: 41 }
    ]
  },

  'text inside tag, literal regex in expression': {
    data: '<a>{ s: /}/ }</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 13, expressions: [
        { text: ' s: /}/ ', start: 3, end: 13 }
      ] },
      { type: _T.TAG, name: '/a', start: 13, end: 17 }
    ]
  },

  'text inside tag, like-regex sequence in expression': {
    data: '<a>{ a++ /5}{0/ -1 }</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 20, expressions: [
        { text: ' a++ /5', start: 3, end: 12 },
        { text: '0/ -1 ', start: 12, end: 20 }
      ] },
      { type: _T.TAG, name: '/a', start: 20, end: 24 }
    ]
  },

  'text inside tag, tricky regex': {
    data: '<a>{ a-++/}/i.lastIndex }</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 25, expressions: [
        { text: ' a-++/}/i.lastIndex ', start: 3, end: 25 }
      ] },
      { type: _T.TAG, name: '/a', start: 25, end: 29 }
    ]
  },

  'text inside tag, regex with tags inside': {
    data: '<a> { a + /<g></g> b } </a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 23, expressions: [
        { text: ' a + /<g></g> b ', start: 4, end: 22 }
      ] },
      { type: _T.TAG, name: '/a', start: 23, end: 27 }
    ]
  },

  'text inside tag, shortcut': {
    data: '<a>{ a: 1, "b": fn(a,b) }</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 25, expressions: [
        { text: ' a: 1, "b": fn(a,b) ', start: 3, end: 25 }
      ] },
      { type: _T.TAG, name: '/a', start: 25, end: 29 }
    ]
  },

  'attr: simple expression': {
    data: '<a foo="{e}"/>',
    expected: [
      {
        type: _T.TAG, name: 'a', start: 0, end: 14, selfclose: true, attributes: [
          { name: 'foo', value: '{e}', start: 3, end: 12, valueStart: 8, expressions: [
            { text: 'e', start: 8, end: 11 }
          ] }
        ]
      }
    ]
  },

  'attr: expression in unquoted value, spaces inside expression': {
    data: '<a foo={ e }/>',
    expected: [
      {
        type: _T.TAG, name: 'a', start: 0, end: 14, selfclose: true, attributes: [
          { name: 'foo', value: '{ e }', start: 3, end: 12, valueStart: 7, expressions: [
            { text: ' e ', start: 7, end: 12 }
          ] }
        ]
      }
    ]
  },

  'Shortcuts in attributes': {
    data: '<div foo= "{ s: "}", c: \'{\', d: /}/ }"/>',
    expected: [
      {
        type: _T.TAG, name: 'div', start: 0, end: 40, selfclose: true, attributes: [
          { name: 'foo', value: '{ s: "}", c: \'{\', d: /}/ }', start: 5, end: 38, valueStart: 11, expressions: [
            { text: ' s: "}", c: \'{\', d: /}/ ', start: 11, end: 37 }
          ] }
        ]
      }
    ]
  },

  'single quoted expr inside double quoted attribute value': {
    data: '<a foo="{\'e\'}"/>',
    expected: [
      {
        type: _T.TAG, name: 'a', start: 0, end: 16, selfclose: true, attributes: [
          { name: 'foo', value: "{'e'}", start: 3, end: 14, valueStart: 8, expressions: [
            { text: "'e'", start: 8, end: 13 }
          ] }
        ]
      }
    ]
  },

  'single quoted expr inside single quoted attribute value': {
    data: "<a foo='{'e'}'/>",
    expected: [
      {
        type: _T.TAG, name: 'a', start: 0, end: 16, selfclose: true, attributes: [
          { name: 'foo', value: "{'e'}", start: 3, end: 14, valueStart: 8, expressions: [
            { text: "'e'", start: 8, end: 13 }
          ] }
        ]
      }
    ]
  },

  'double quoted expr inside single quoted attribute value': {
    data: '<a foo=\'{"e"}\'/>',
    expected: [
      {
        type: _T.TAG, name: 'a', start: 0, end: 16, selfclose: true, attributes: [
          { name: 'foo', value: '{"e"}', start: 3, end: 14, valueStart: 8, expressions: [
            { text: '"e"', start: 8, end: 13 }
          ] }
        ]
      }
    ]
  },

  'double quoted expr inside double quoted attribute value': {
    data: '<a foo="{"e"}"/>',
    expected: [
      {
        type: _T.TAG, name: 'a', start: 0, end: 16, selfclose: true, attributes: [
          { name: 'foo', value: '{"e"}', start: 3, end: 14, valueStart: 8, expressions: [
            { text: '"e"', start: 8, end: 13 }
          ] }
        ]
      }
    ]
  },

  'multiline string (using "\\") inside attribute value': {
    data: '<a data-templ={\n"<div>\\\n\t<a></a>\\\n</div>"\n}/>',
    expected: [
      {
        type: _T.TAG, name: 'a', start: 0, end: 45, selfclose: true, attributes: [
          { name: 'data-templ', value: '{\n"<div>\\\n\t<a></a>\\\n</div>"\n}', start: 3, end: 43, valueStart: 14,
            expressions: [{ text: '\n"<div>\\\n\t<a></a>\\\n</div>"\n', start: 14, end: 43 }]
          }
        ]
      }
    ]
  },

  'multiline string (using "\\") inside text node': {
    data: '<a>data-templ={\n"<div>\\\n\t<a></a>\\\n</div>"\n}</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 43,
        expressions: [{ text: '\n"<div>\\\n\t<a></a>\\\n</div>"\n', start: 14, end: 43 }]
      },
      { type: _T.TAG, name: '/a', start: 43, end: 47 }
    ]
  },

  'escaped left bracket generates a `replace` property w/bracket as value': {
    data: '<a foo="\\{{e}"/>',
    expected: [
      {
        type: _T.TAG, name: 'a', start: 0, end: 16, selfclose: true, attributes: [
          {
            name: 'foo', value: '\\{{e}', start: 3, end: 14, valueStart: 8, replace: '{',
            expressions: [
              { text: 'e', start: 10, end: 13 }
            ]
          }
        ]
      }
    ]
  },

  'escaped left bracket generates a `replace` property w/bracket as value #2': {
    data: '<a foo="\\{\\{}"/>',
    expected: [
      {
        type: _T.TAG, name: 'a', start: 0, end: 16, selfclose: true, attributes: [
          {
            name: 'foo', value: '\\{\\{}', start: 3, end: 14, valueStart: 8, replace: '{'
          }
        ]
      }
    ]
  },

  'escaped left bracket generates a `replace` property w/bracket as value #3': {
    data: '<a>foo="\\{\\{}"</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 14, replace: '{' },
      { type: _T.TAG, name: '/a', start: 14, end: 18 }
    ]
  },

  // =========================================================================
  // ES6
  // =========================================================================


  'ES6 expression inside tag': {
    data: '<div>foo & { `bar${baz}` }</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TEXT, start: 5, end: 26, expressions: [
        { text: ' `bar${baz}` ', start: 11, end: 26 }
      ] },
      { type: _T.TAG, name: '/div', start: 26, end: 32 }
    ]
  },

  'ES6 with ES6 backquote inside': {
    data: '<div>foo & { `bar${`}`}` }</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TEXT, start: 5, end: 26, expressions: [
        { text: ' `bar${`}`}` ', start: 11, end: 26 }
      ] },
      { type: _T.TAG, name: '/div', start: 26, end: 32 }
    ]
  },

  'ES6 with ternary inside': {
    data: '<div>foo & { `bar${ a?"<a>":\'}\' }` }</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TEXT, start: 5, end: 36, expressions: [
        { text: ' `bar${ a?"<a>":\'}\' }` ', start: 11, end: 36 }
      ] },
      { type: _T.TAG, name: '/div', start: 36, end: 42 }
    ]
  },

  'Expression inside tag with multiline ES6': {
    data: '<div>foo & { `\nbar${\n\t`}`}\n` }</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TEXT, start: 5, end: 30, expressions: [
        { text: ' `\nbar${\n\t`}`}\n` ', start: 11, end: 30 }
      ] },
      { type: _T.TAG, name: '/div', start: 30, end: 36 }
    ]
  },

  'Expression inside tag with multiline ES6 #2': {
    data: '<div>foo & {\n`\nbar\n${\t`}`}`\n }</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TEXT, start: 5, end: 30, expressions: [
        { text: '\n`\nbar\n${\t`}`}`\n ', start: 11, end: 30 }
      ] },
      { type: _T.TAG, name: '/div', start: 30, end: 36 }
    ]
  },

  'ES6 with ES6 backquote inside #2': {
    data: '<div>foo & { `bar${``}` }</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TEXT, start: 5, end: 25, expressions: [
        { text: ' `bar${``}` ', start: 11, end: 25 }
      ] },
      { type: _T.TAG, name: '/div', start: 25, end: 31 }
    ]
  },

  'ES6 with double quotes inside': {
    data: '<div>foo & "{ `bar${ "a" + `b${""}` }` }"</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TEXT, start: 5, end: 41, expressions: [
        { text: ' `bar${ "a" + `b${""}` }` ', start: 12, end: 40 }
      ] },
      { type: _T.TAG, name: '/div', start: 41, end: 47 }
    ]
  },

  'ES6 with double quotes inside #2': {
    data: '<div>foo & "{ `"bar${ "a" + `b${""}` }"` }"</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TEXT, start: 5, end: 43, expressions: [
        { text: ' `"bar${ "a" + `b${""}` }"` ', start: 12, end: 42 }
      ] },
      { type: _T.TAG, name: '/div', start: 43, end: 49 }
    ]
  },

  'ES6 with ES6 backquote and closing bracket inside': {
    data: '<div>foo & { `bar${ "a" + `b${a + "}"}` }` }</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TEXT, start: 5, end: 44, expressions: [
        { text: ' `bar${ "a" + `b${a + "}"}` }` ', start: 11, end: 44 }
      ] },
      { type: _T.TAG, name: '/div', start: 44, end: 50 }
    ]
  },

  // =========================================================================
  // Custom brackets
  // =========================================================================

  'Custom brackets `[ ]`': {
    options: { brackets: ['[', ']'] },
    data: '<a>[1+2]</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 8, expressions: [
        { text: '1+2', start: 3, end: 8 }
      ] },
      { type: _T.TAG, name: '/a', start: 8, end: 12 }
    ]
  },

  'Custom brackets `[ ]` w/nested brackets': {
    options: { brackets: ['[', ']'] },
    data: '<a>[a[1]]</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 9, expressions: [
        { text: 'a[1]', start: 3, end: 9 }
      ] },
      { type: _T.TAG, name: '/a', start: 9, end: 13 }
    ]
  },

  'Custom brackets `[[ ]]` w/nested brackets': {
    options: { brackets: ['[[', ']]'] },
    data: '<a>[[a[1]]]</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 11, expressions: [
        { text: 'a[1]', start: 3, end: 11 }
      ] },
      { type: _T.TAG, name: '/a', start: 11, end: 15 }
    ]
  },

  'Custom brackets `[ ]` w/preceding escaped bracket': {
    options: { brackets: ['[', ']'] },
    data: '<a>\\[[1+2]</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 10, replace: '[', expressions: [
        { text: '1+2', start: 5, end: 10 }
      ] },
      { type: _T.TAG, name: '/a', start: 10, end: 14 }
    ]
  },

  'Custom brackets `( )` w/nested brackets': {
    options: { brackets: ['(', ')'] },
    data: '<a>(a(1))</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 9, expressions: [
        { text: 'a(1)', start: 3, end: 9 }
      ] },
      { type: _T.TAG, name: '/a', start: 9, end: 13 }
    ]
  },

  'Custom brackets `( )` preceding by escaped bracket': {
    options: { brackets: ['(', ')'] },
    data: '<a>\\((1+2)</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 10, replace: '(', expressions: [
        { text: '1+2', start: 5, end: 10 }
      ] },
      { type: _T.TAG, name: '/a', start: 10, end: 14 }
    ]
  },

  'Custom brackets `([ ])` w/nested brackets': {
    options: { brackets: ['([', '])'] },
    data: '<a>([a([1])])</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 13, expressions: [
        { text: 'a([1])', start: 3, end: 13 }
      ] },
      { type: _T.TAG, name: '/a', start: 13, end: 17 }
    ]
  },

  'Custom brackets `{{ }` w/nested brackets': {
    options: { brackets: ['{{', '}'] },
    data: '<a>{{{}}</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 8, expressions: [
        { text: '{}', start: 3, end: 8 }
      ] },
      { type: _T.TAG, name: '/a', start: 8, end: 12 }
    ]
  },

  'Custom brackets `{ }}` w/nested brackets': {
    options: { brackets: ['{', '}}'] },
    data: '<a>{{}}}</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 8, expressions: [
        { text: '{}', start: 3, end: 8 }
      ] },
      { type: _T.TAG, name: '/a', start: 8, end: 12 }
    ]
  },

  'Custom brackets `${ }` w/ES6 inside': {
    options: { brackets: ['${', '}'] },
    data: '<a>${`a${0}`}</a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 13, expressions: [
        { text: '`a${0}`', start: 3, end: 13 }
      ] },
      { type: _T.TAG, name: '/a', start: 13, end: 17 }
    ]
  },

  'Custom brackets `${ }` w/ES6 inside in quoted attr': {
    options: { brackets: ['${', '}'] },
    data: '<a b="${ `a${0}` }" />',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 22, attributes: [
        { name: 'b', value: '${ `a${0}` }', start: 3, end: 19, valueStart: 6,
          expressions: [
            { text: ' `a${0}` ', start: 6, end: 18 }
          ]
        }
      ], selfclose: true }
    ]
  },

  'Custom brackets `${ }` w/ES6 inside in unquoted attr': {
    options: { brackets: ['${', '}'] },
    data: '<a b=${ `a${0}` } />',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 20, attributes: [
        { name: 'b', value: '${ `a${0}` }', start: 3, end: 17, valueStart: 5,
          expressions: [
            { text: ' `a${0}` ', start: 5, end: 17 }
          ]
        }
      ], selfclose: true }
    ]
  },

  'Custom brackets `${ }` preceding by escaped bracket in attr': {
    options: { brackets: ['${', '}'] },
    data: '<a b="\\${${{}}}" />',
    expected: [
      {
        type: _T.TAG,
        name: 'a',
        start: 0,
        end: 19,
        attributes: [
          {
            name: 'b',
            value: '\\${${{}}}',
            start: 3,
            end: 16,
            replace: '${',
            valueStart: 6,
            expressions: [
              { text: '{}', start: 9, end: 14 }
            ]
          }
        ],
        selfclose: true
      }
    ]
  },

}
