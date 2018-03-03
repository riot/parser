import resolve from 'rollup-plugin-node-resolve'

export default {
  input: 'src/index.js',
  output: {
    name: 'parser',
    format: 'cjs',
    file: './index.js'
  },
  plugins: [resolve()]
}