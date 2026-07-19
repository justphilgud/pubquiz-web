import type { NextConfig } from "next";
import { loadLocalEnvironment } from "./scripts/load-local-environment";

if (!process.env.VERCEL) {
  loadLocalEnvironment({ required: true });
}

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static", "sharp"],
  outputFileTracingIncludes: {
    "/api/question-generator": [
      "./node_modules/ffmpeg-static/ffmpeg*",
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
