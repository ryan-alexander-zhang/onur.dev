import nextVitals from 'eslint-config-next/core-web-vitals'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import simpleImportSort from 'eslint-plugin-simple-import-sort'

const config = [
  ...nextVitals,
  prettierRecommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    plugins: {
      'simple-import-sort': simpleImportSort
    },
    settings: {
      next: {
        rootDir: '.'
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.mjs'],
          paths: ['src']
        },
        alias: {
          map: [['@', './src']],
          extensions: ['.js', '.jsx', '.mjs']
        }
      }
    },
    rules: {
      'no-console': ['error', { allow: ['error', 'info'] }],
      'react/no-unescaped-entities': 'off',
      'react/prop-types': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      '@next/next/no-img-element': 'off',
      'import/no-named-as-default': 'off'
    }
  },
  {
    files: ['*.mjs'],
    rules: {
      'import/no-anonymous-default-export': 'off'
    }
  }
]

export default config
