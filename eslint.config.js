import { defineConfig } from 'eslint/config'
import riotEslintConfig from 'eslint-config-riot'

export default defineConfig([
  { extends: [riotEslintConfig] },
  {
    rules: {
      'fp/no-mutating-methods': 0,
      'fp/no-let': 0,
      'fp/no-loops': 0,
      'fp/no-delete': 0,
      'fp/no-rest-parameters': 0,
    },
  },
])
