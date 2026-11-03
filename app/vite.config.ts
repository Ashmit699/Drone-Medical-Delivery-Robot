import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// CesiumJS loads its web workers, widgets CSS and assets at runtime from CESIUM_BASE_URL.
const cesiumBuild = join(dirname(createRequire(import.meta.url).resolve('cesium/package.json')), 'Build/Cesium');

// The dev server proxies the API + realtime socket to the backend, so phones on the same
// Wi-Fi only need the one address printed by `npm run dev`.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      // Copy the four folders to /cesium/<folder> (stripBase drops the long node_modules path).
      targets: ['ThirdParty', 'Workers', 'Assets', 'Widgets'].map((dir) => ({
        src: `${join(cesiumBuild, dir).replaceAll('\\', '/')}/**/*`,
        dest: `cesium/${dir}`,
        rename: { stripBase: join(cesiumBuild, dir).split(/[\\/]/).filter(Boolean).length },
      })),
    }),
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium'),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
