import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';

/**
 * Custom rule overrides.
 * Separated for readability and easier maintenance.
 */
const customRules = {
  // Warn on usage of 'any', but don't block the build
  '@typescript-eslint/no-explicit-any': 'warn',

  // Warn on unused variables, but allow prefixing with '_' to indicate intentional ignoring
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
};

export default tseslint.config(
  // 1. Global Ignores
  // Placed at the top to apply globally to all files
  {
    ignores: ['node_modules/', 'dist/'],
  },

  // 2. Base Configurations
  // Applies standard JS and TypeScript rules
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 3. Prettier Integration & Custom Rules
  // Integrates Prettier as an ESLint rule and applies custom overrides
  {
    plugins: {
      prettier: prettier,
    },
    rules: {
      'prettier/prettier': 'error', // Treat Prettier issues as ESLint errors
      ...customRules,
    },
  },

  // 4. Prettier Disables
  // Must be last to turn off any rules that conflict with Prettier
  eslintConfigPrettier
);