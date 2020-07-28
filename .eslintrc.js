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
    '@typescript-eslint/comma-spacing': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/func-call-spacing': 'error',
    '@typescript-eslint/indent': ['error', 2],
    '@typescript-eslint/lines-between-class-members': ['error', {"exceptAfterSingleLine": true}],
    '@typescript-eslint/no-base-to-string': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-extra-parens': 'error',
    '@typescript-eslint/no-unnecessary-boolean-literal-compare': ['error', {"allowComparingNullableBooleansToTrue": false, "allowComparingNullableBooleansToFalse": false}],
    '@typescript-eslint/no-var-requires': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/quotes': ['error', 'single', {"allowTemplateLiterals": false}],
    '@typescript-eslint/semi': ['error'],
    '@typescript-eslint/space-before-function-paren': ['error', 'never'],
    '@typescript-eslint/type-annotation-spacing': 'error',
    'comma-dangle': 'error',
    'no-confusing-arrow': 'error',
    'no-lonely-if': 'error',
    'no-trailing-spaces': 'error',
    'no-unneeded-ternary': 'error',
    'one-var': ['error', 'never']
  }
}
