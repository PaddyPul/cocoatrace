import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/private-evidence/**',
      '**/uploads/**',
      '**/*test-results/**',
      '**/playwright-report/**',
      '.demo-preview/**',
      'api/src/migrations/**',
      'api/test/integration/baselines/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      // Legacy debt is explicit; strict rules below protect migrated feature modules.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    },
  },
  {
    files: [
      'api/src/modules/trace/**/*.ts',
      'api/src/services/tradeNextAction*.ts',
      'api/src/modules/tradeActions/**/*.ts',
      'api/src/services/tradeActionRepository*.ts',
      'api/src/modules/security/**/*.ts',
      'api/src/modules/mfa/**/*.ts',
      'api/src/modules/accessControls/**/*.ts',
      'api/src/modules/transport/**/*.ts',
      'api/src/modules/payments/**/*.ts',
      'api/src/modules/delivery/**/*.ts',
      'api/src/modules/cancellation/**/*.ts',
      'api/src/modules/fees/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
);
