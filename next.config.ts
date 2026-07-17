import type { NextConfig } from "next";
import { loadLocalEnvironment } from "./scripts/load-local-environment";

loadLocalEnvironment({ required: true });

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
