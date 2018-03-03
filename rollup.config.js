import resolve from 'rollup-plugin-node-resolve'

export default {
  input: 'src/index.js',
  output: {
    name: 'parser',
    format: 'umd',
    file: './index.js'
  },
  plugins: [resolve()]
}