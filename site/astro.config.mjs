import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves project sites under /<repo>/. Update if you ever
// rename the repository or move to a custom domain.
export default defineConfig({
  site: 'https://dim971.github.io',
  base: '/sferic',
  trailingSlash: 'ignore',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
