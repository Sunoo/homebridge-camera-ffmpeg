module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  rules: {
    '@typescript-eslint/array-type': ['error', {default: 'generic'}],
    '@typescript-eslint/brace-style': 'error',
    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/comma-spacing': 'error',
    '@typescript-eslint/func-call-spacing': 'error',
    '@typescript-eslint/indent': ['error', 2],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-extra-parens': 'error',
    '@typescript-eslint/no-var-requires': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/quotes': ['error', 'single'],
    '@typescript-eslint/semi': ['error'],
    '@typescript-eslint/space-before-function-paren': ['error', 'never'],
    '@typescript-eslint/type-annotation-spacing': 'error',
    'comma-dangle': 'error',
    'no-lonely-if': 'error',
    'no-trailing-spaces': 'error',
    'no-unneeded-ternary': 'error',
    'one-var': ['error', 'never']
  }
}
