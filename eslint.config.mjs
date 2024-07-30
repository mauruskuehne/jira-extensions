import globals from "globals";
import pluginJs from "@eslint/js";
import jsdoc from 'eslint-plugin-jsdoc';


export default [
  jsdoc.configs['flat/recommended'],
  {
    files: ["**/*.js"], plugins: { jsdoc, }, languageOptions: { sourceType: "script", globals: globals.browser },
    rules: {
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
          'ignorePattern': '^.*(<svg|data:image/svg[+]xml).*$'
        }
      ]
    },
  },
  pluginJs.configs.recommended,
];
