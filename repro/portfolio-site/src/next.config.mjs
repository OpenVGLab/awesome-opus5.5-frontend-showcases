import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// Three.js is never bundled: the browser resolves `three` and `three/addons/*` through the
// import map in pages/_document.jsx, which points at the shared vendored copy (r186).
function threeExternals({ request }, callback) {
  if (request === 'three') return callback(null, 'import three');
  const addon = request && request.match(/^three\/(?:examples\/jsm|addons)\/(.+)$/);
  if (addon) return callback(null, `import three/addons/${addon[1]}`);
  return callback();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: false,
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: {
    loader: 'custom',
    loaderFile: './lib/image-loader.js',
    deviceSizes: [480, 800, 1200, 1600],
    imageSizes: [256],
  },
  transpilePackages: ['react-custom-cursor'],
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.SITE_URL || 'https://maraellison.dev',
  },
  webpack(config, { isServer }) {
    // three-globe only touches WebGPU/TSL for GPU heatmaps and the optional WebGPU renderer,
    // neither of which this site uses, so those entry points resolve to tiny stubs.
    config.resolve.alias['three/webgpu'] = path.join(root, 'lib/shims/three-webgpu.cjs');
    config.resolve.alias['three/tsl'] = path.join(root, 'lib/shims/three-tsl.cjs');
    if (!isServer) {
      const current = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean);
      config.externals = [...current, threeExternals];
      config.output.environment = { ...config.output.environment, dynamicImport: true, asyncFunction: true };
    }
    return config;
  },
};

export default nextConfig;
