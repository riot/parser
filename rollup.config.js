/*
  This config will output this files:

  ./dist/tag-parser.js  -> Factory for TagParser (the default export)
  ./dist/skip-es6-tl    -> skipES6TL function
  ./dist/skip-regex     -> skipRegex function
  ./nodeTypes           -> the NodeTypes enum

*/
import alias   from 'rollup-plugin-alias'
import cleanup from 'rollup-plugin-cleanup'

export default [
  {
    entry: 'lib/node-types.js',
    dest: './nodeTypes.js',
    format: 'cjs'
  },
  {
    entry: 'lib/skip-es6-tl.js',
    dest: './dist/skip-es6-tl.js',
    format: 'cjs',
    plugins: [
      cleanup()
    ]
  },
  {
    entry: 'lib/tag-parser.js',
    dest: 'dist/tag-parser.js',
    format: 'cjs',
    interop: false,
    plugins: [
      alias({
        resolve: ['.js'],
        './skip-es6-tl': './../src/proxys/skip-es6-tl.js',
        './skip-regex': './../src/proxys/skip-regex.js'
      }),
      cleanup()
    ],
    globals: {
      'skip-es6-tl': 'skipES6TL',
      'skip-regex': 'skipRegex'
    }
  }
]
