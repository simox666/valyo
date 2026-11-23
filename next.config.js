/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PGlite (base locale embarquée) charge un binaire WASM au runtime : il doit
  // rester un module Node externe, pas être empaqueté par Next.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "web-push"],
};

module.exports = nextConfig;
