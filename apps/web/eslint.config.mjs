import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import base from '../../eslint.base.mjs';

// `eslint-config-next` ainda depende do eslint-plugin-react 7.x, que quebra no ESLint 10.
// Montamos o equivalente com os plugins que já suportam a versão nova.
export default [
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...base,
  reactHooks.configs.flat['recommended-latest'],
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
];
