import type { NextConfig } from "next";
import { loadLocalEnvironment } from "./scripts/load-local-environment";

if (!process.env.VERCEL) {
  loadLocalEnvironment({ required: true });
}

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Explicit loopback-only hosts keep role sessions separate during local browser QA.
  allowedDevOrigins: ["127.0.0.1", "manager.navigation.localhost", "editor.navigation.localhost", "global.navigation.localhost", "settings.navigation.localhost", "none.navigation.localhost"],
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
  // The archive reads local image sources. Dynamic fs tracing otherwise adds every
  // public video/audio asset to all actions; these files are served as static media.
  outputFileTracingExcludes: {
    "/*": ["./public/medien/**/*.{mp4,webm,mov,mp3,wav,ogg,m4a,flac}"],
  },
  outputFileTracingIncludes: {
    "/*": ["./assets/fonts/arimo/Arimo.ttf"],
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
