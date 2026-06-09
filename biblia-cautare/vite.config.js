import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base: './' => căi relative, ca să meargă deschis ca fișier local (file://).
// viteSingleFile => inline-uiește tot (JS + CSS + JSON) într-un singur index.html.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    // Inline TOATE asset-urile (inclusiv logo-ul) ca base64 => un singur fișier, offline.
    assetsInlineLimit: 100_000_000,
  },
});
