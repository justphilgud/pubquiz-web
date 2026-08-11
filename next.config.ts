import type { NextConfig } from "next";
import { loadLocalEnvironment } from "./scripts/load-local-environment";

if (!process.env.VERCEL) {
  loadLocalEnvironment({ required: true });
}

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
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
