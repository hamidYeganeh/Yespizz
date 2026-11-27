import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.YESPIZ_NATIVE_EXPORT === "1" && {
    output: "export",
    images: { unoptimized: true },
    skipTrailingSlashRedirect: true,
  }),
  experimental: {
    agentFeedback: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default createNextIntlPlugin()(nextConfig);
