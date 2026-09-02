import base from '../../eslint.base.mjs';

export default [
  ...base,
  {
    files: ['test/**/*.ts', 'prisma/seed.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
