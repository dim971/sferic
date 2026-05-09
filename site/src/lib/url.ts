const RAW = import.meta.env.BASE_URL;
const NORMALIZED = RAW.endsWith('/') ? RAW.slice(0, -1) : RAW;

/**
 * Joins the deployment base path (e.g. "/sferic") with a public asset
 * path so it works whether Astro emits BASE_URL with or without a
 * trailing slash. Use for everything in /public/.
 */
export function asset(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${NORMALIZED}${clean}`;
}
