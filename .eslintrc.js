module.exports = {
  'env': {
    'browser': true,
    'es2021': true,
    'node': true
  },
  'extends': [
    'eslint:recommended',
    'plugin:jsdoc/recommended'
  ],
  'overrides': [
  ],
  'parserOptions': {
    'ecmaVersion': 'latest'
  },
  'rules': {
    'indent': [
      'error',
      2
    ],
    'linebreak-style': [
      'off',
      'windows'
    ],
    'quotes': [
      'error',
      'single'
    ],
    'semi': [
      'error',
      'always'
    ],
    'no-unused-vars': [
      'error',
      {
        'vars': 'all',
        'args': 'after-used'
      }
    ],
    'max-len': [
      'error', {
        'code': 120,
        'tabWidth': 2,
        'ignorePattern': '^.*<svg.*$'
      }
    ]
  },
  'plugins': [
    'jsdoc'
  ]
};
