'use strict';

module.exports = [
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'writable', process: 'readonly', console: 'readonly',
                 __dirname: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', fetch: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'no-undef': 'error',
      eqeqeq: ['warn', 'smart'],
    },
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: { window: 'readonly', document: 'readonly', localStorage: 'readonly', fetch: 'readonly',
                 api: 'readonly', probeVideo: 'readonly', location: 'readonly', history: 'readonly',
                 navigator: 'readonly', setTimeout: 'readonly', URL: 'readonly', Float32Array: 'readonly',
                 Promise: 'readonly', IntersectionObserver: 'readonly', Number: 'readonly', console: 'readonly',
                 clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly' },
    },
    rules: { 'no-unused-vars': 'warn', 'no-undef': 'error' },
  },
];
