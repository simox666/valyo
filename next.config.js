const createNextIntlPlugin = require("next-intl/plugin");
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets a phone on the same local network load dev assets without a
  // cross-origin warning (used to test the camera capture flow on a real
  // iPhone). This IP changes with the network (Wi-Fi vs. Personal Hotspot,
  // etc.) — update it to whatever `next dev` prints as "Network:" when it
  // no longer matches. Dev-only; irrelevant in production.
  allowedDevOrigins: ["192.168.0.105", "172.20.10.4", "10.243.2.17"],
};

module.exports = withNextIntl(nextConfig);
