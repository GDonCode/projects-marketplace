/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing code above ...
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // default is 1mb — too small for photo uploads
    },
  },
  // ... existing code below ...
};


module.exports = nextConfig;
