import type { MetadataRoute } from "next";
import { APP_BRAND } from "@/app/branding/appBrand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_BRAND.productName,
    short_name: "PubQuiz",
    description: APP_BRAND.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: APP_BRAND.colors.darkSurface,
    theme_color: APP_BRAND.colors.darkSurface,
    lang: "de-DE",
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
