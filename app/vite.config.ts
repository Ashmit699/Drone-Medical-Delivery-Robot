import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createReadStream, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// CesiumJS loads its web workers, widgets CSS and assets at runtime from CESIUM_BASE_URL.
const cesiumBuild = join(dirname(createRequire(import.meta.url).resolve('cesium/package.json')), 'Build/Cesium');
const CESIUM_DIRS = ['ThirdParty', 'Workers', 'Assets', 'Widgets'];

const MIME: Record<string, string> = {
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.xml': 'application/xml',
};

/** Dev only: serve /cesium/* straight from node_modules (the build copies the files instead). */
function cesiumDevAssets(): Plugin {
  return {
    name: 'cesium-dev-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/cesium', (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? '').split('?')[0])).replace(/^[/\\]+/, '');
        const file = join(cesiumBuild, rel);
        if (!file.startsWith(cesiumBuild + sep) || !CESIUM_DIRS.includes(rel.split(/[/\\]/)[0])) return next();
        try {
          if (!statSync(file).isFile()) return next();
        } catch {
          return next();
        }
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
  };
}

// The dev server proxies the API + realtime socket to the backend, so phones on the same
// Wi-Fi only need the one address printed by `npm run dev`.
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    cesiumDevAssets(),
    command === 'build' &&
      viteStaticCopy({
        // Copy the folders to dist/cesium/<folder> (stripBase drops the long node_modules path).
        targets: CESIUM_DIRS.map((dir) => ({
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
}));
