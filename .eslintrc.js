module.exports = {
  'env': {
    'browser': true,
    'es2021': true
  },
  'extends': 'eslint:recommended',
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
      'error',
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
      'warn',
      {
        'vars': 'all',
        'args': 'after-used'
      }
    ],
    'max-len': [
      'error',
      [120, 2, {ignorePattern: '/^.*<svg.*$/'}]
    ]
  }
};
