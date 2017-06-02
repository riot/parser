
import jscc    from 'rollup-plugin-jscc'
import buble   from 'rollup-plugin-buble'
import cleanup from 'rollup-plugin-cleanup'
import types   from './src/node-types'

const external = ['fs', 'path']

export default {
  entry: 'src/parser.js',
  plugins: [
    jscc({ values: { _T: types } }),
    buble({ firefox: 45, ie: 10, node: 4 }),
    cleanup()
  ],
  external: external,
  targets: [
    { dest: 'dist/tag-parser.js', format: 'cjs' },
    { dest: 'dist/tag-parser.es.js', format: 'es' }
  ]
}
