import type { MetadataRoute } from "next";
import { APP_BRAND } from "@/app/branding/appBrand";

export function buildManifest(
  vercelEnvironment = process.env.VERCEL_ENV,
): MetadataRoute.Manifest {
  const isPreview = vercelEnvironment === "preview";
  const appName = isPreview ? "PubQuiz Preview" : APP_BRAND.productName;
  const shortName = isPreview ? "PubQuiz Preview" : "PubQuiz";
  const iconPrefix = isPreview ? "preview-icon" : "icon";

  return {
    name: appName,
    short_name: shortName,
    description: APP_BRAND.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: APP_BRAND.colors.darkSurface,
    theme_color: APP_BRAND.colors.darkSurface,
    lang: "de-DE",
    icons: [
      {
        src: `/pwa/${iconPrefix}-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/pwa/${iconPrefix}-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `/pwa/${iconPrefix}-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/pwa/${iconPrefix}-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

export default function manifest(): MetadataRoute.Manifest {
  return buildManifest();
}
