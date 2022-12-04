module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig-editor.json'],
    tsconfigRootDir: __dirname,
    extraFileExtensions: ['.cjs', '.mjs'],
  },
  root: true,
  ignorePatterns: [
    'terraform/',
    'node_modules/',
    'dist/',
    '.terraform-deploy/',
    'scripts/',
  ]
};
