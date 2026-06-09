/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows the self-updater to build into a separate directory (.next.new)
  // while the running server keeps serving the current .next untouched.
  distDir: process.env.NEXT_DIST_DIR || ".next",
}

export default nextConfig
