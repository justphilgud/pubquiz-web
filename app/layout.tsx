import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Lora,
  Montserrat,
  Nunito,
  Oswald,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Roboto_Slab,
  Source_Sans_3,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import "./rendering/presentation/kommOnePresentation.css";
import { APP_BRAND } from "@/app/branding/appBrand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({ variable: "--font-source-sans-3", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"] });
const robotoSlab = Roboto_Slab({ variable: "--font-roboto-slab", subsets: ["latin"] });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"] });
const playfairDisplay = Playfair_Display({ variable: "--font-playfair-display", subsets: ["latin"] });
const plusJakartaSans = Plus_Jakarta_Sans({ variable: "--font-plus-jakarta-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: APP_BRAND.productName,
    template: `%s | ${APP_BRAND.name}`,
  },
  applicationName: APP_BRAND.name,
  description: APP_BRAND.description,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PubQuiz",
  },
};

export const viewport: Viewport = {
  themeColor: APP_BRAND.colors.darkSurface,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSans.variable} ${spaceGrotesk.variable} ${montserrat.variable} ${nunito.variable} ${oswald.variable} ${robotoSlab.variable} ${lora.variable} ${playfairDisplay.variable} ${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
