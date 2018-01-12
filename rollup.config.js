import resolve from 'rollup-plugin-node-resolve'

export default {
  input: 'src/index.js',
  name: 'parser',
  output: {
    format: 'umd',
    file: './index.js'
  },
  plugins: [resolve()]
}