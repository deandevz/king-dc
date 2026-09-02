import { Manrope } from 'next/font/google';
import type { JSX, ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'King DC',
  description: 'Servidor privado de voz e tela compartilhada.',
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body>
        <div className="kd-halo" aria-hidden="true" />
        <div className="kd-grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
