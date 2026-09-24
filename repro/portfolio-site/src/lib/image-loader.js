// next/image loader for the static export: every image under public/images is pre-rendered by
// scripts/generate-assets.mjs at each width in next.config.mjs (deviceSizes + imageSizes),
// named `<name>-<width>.<ext>`. Paths stay relative so the site works from any sub-folder.
export default function imageLoader({ src, width }) {
  const dot = src.lastIndexOf('.');
  return `${src.slice(0, dot)}-${width}${src.slice(dot)}`;
}
