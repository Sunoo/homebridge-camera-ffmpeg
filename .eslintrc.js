module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/array-type': [
      'error',
      { default: 'generic' }
    ],
    '@typescript-eslint/camelcase': ['off'],
    '@typescript-eslint/no-explicit-any': ['off'],
<<<<<<< HEAD
=======
    '@typescript-eslint/no-this-alias': ['off'],
>>>>>>> c03bdafc63a198a046f6330fea055ca003b56004
  },
}
