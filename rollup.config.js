import resolve from 'rollup-plugin-node-resolve';

export default {
  input: 'lib/src/index.js',
  dest: './index.js',
  format: 'cjs',
  plugins: [resolve()]
}

