// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

// GitHub Pages: defina SITE_URL e BASE_PATH no workflow (veja README).
// Vercel ou domínio próprio: deixe BASE_PATH vazio.
const site = process.env.SITE_URL || 'http://localhost:4321';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [mdx(), react()],
  // Sem realce de sintaxe: os blocos de código são saídas de terminal (veja SaidaComentada).
  markdown: { syntaxHighlight: false },
});
