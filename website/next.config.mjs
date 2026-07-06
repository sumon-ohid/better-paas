import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // Static export is for production (Cloudflare Pages). In dev, dynamic [slug]
  // routes (blog posts, SEO pages) need a normal server — export mode 404s them.
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  distDir: 'dist',
  reactStrictMode: true,
};

export default withMDX(config);
