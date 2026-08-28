import type { NextConfig } from "next";
import { loadLocalEnvironment } from "./scripts/load-local-environment";

if (!process.env.VERCEL) {
  loadLocalEnvironment({ required: true });
}

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [
      { source: "/fragen/editor", destination: "/content/questions/new", permanent: true },
      { source: "/fragen/editor/:questionId", destination: "/content/questions/:questionId", permanent: true },
      { source: "/story-elemente/new", destination: "/content/story-elements/new", permanent: true },
      { source: "/story-elemente/:storyElementId", destination: "/content/story-elements/:storyElementId", permanent: true },
      { source: "/content/new", destination: "/content", permanent: true },
    ];
  },
  serverExternalPackages: ["ffmpeg-static", "sharp"],
  outputFileTracingIncludes: {
    "/hilfe": ["./docs/user-guide/**/*", "./docs/admin-guide/**/*.md"],
    "/hilfe/screenshots/[name]": ["./docs/user-guide/screenshots/*.jpg"],
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
