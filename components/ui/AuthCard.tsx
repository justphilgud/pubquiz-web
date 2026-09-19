import { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { APP_BRAND } from "@/app/branding/appBrand";
import { Card } from "./Card";

type AuthCardAppearance = "default" | "brand";

type BrandProperties = CSSProperties & {
  "--app-brand-yellow": string;
  "--app-brand-pink": string;
  "--app-brand-dark-surface": string;
};

const brandedContentClasses = [
  "text-slate-50",
  "[&_label]:text-slate-50",
  "[&_input]:border-slate-300",
  "[&_input]:bg-white",
  "[&_input]:text-slate-950",
  "[&_input::placeholder]:text-slate-500",
  "[&_input:focus]:border-[var(--app-brand-yellow)]",
  "[&_input:focus]:ring-[var(--app-brand-yellow)]",
  "[&_button[type=button]]:text-slate-600",
  "[&_button[type=button]:hover]:bg-slate-100",
  "[&_button[type=button]:hover]:text-slate-950",
  "[&_button[type=button]:focus-visible]:ring-[var(--app-brand-pink)]",
  "[&_button[type=submit]]:min-h-11",
  "[&_button[type=submit]]:w-full",
  "[&_button[type=submit]]:bg-[var(--app-brand-yellow)]",
  "[&_button[type=submit]]:text-base",
  "[&_button[type=submit]]:font-bold",
  "[&_button[type=submit]]:text-[var(--app-brand-dark-surface)]",
  "[&_button[type=submit]]:shadow-none",
  "[&_button[type=submit]:hover:not(:disabled)]:brightness-95",
  "[&_button[type=submit]:active:not(:disabled)]:brightness-90",
  "[&_button[type=submit]:focus-visible]:ring-4",
  "[&_button[type=submit]:focus-visible]:ring-[var(--app-brand-pink)]",
  "[&_button[type=submit]:focus-visible]:ring-offset-2",
  "[&_button[type=submit]:focus-visible]:ring-offset-black",
  "[&_button[type=submit]:disabled]:saturate-50",
].join(" ");

export function AuthCard({
  title,
  children,
  appearance = "default",
}: {
  title: string;
  children: ReactNode;
  appearance?: AuthCardAppearance;
}) {
  const isBrandAppearance = appearance === "brand";
  const brandProperties: BrandProperties | undefined = isBrandAppearance
    ? {
        "--app-brand-yellow": APP_BRAND.colors.yellow,
        "--app-brand-pink": APP_BRAND.colors.pink,
        "--app-brand-dark-surface": APP_BRAND.colors.darkSurface,
      }
    : undefined;

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-gray-50 p-6"
      style={brandProperties}
    >
      <Card
        className={`w-full max-w-md p-10 ${
          isBrandAppearance
            ? "border-white/15 bg-[var(--app-brand-dark-surface)] shadow-2xl shadow-slate-900/20"
            : "border-gray-300 bg-gray-50 shadow-lg"
        }`}
      >
        <div className="mb-2 flex justify-center">
          <Image
            src={APP_BRAND.assets.fullLogo}
            alt={APP_BRAND.name}
            width={862}
            height={1061}
            priority
            className="h-52 w-auto object-contain sm:h-56"
          />
        </div>

        <p
          className={`mb-8 text-center text-2xl font-normal ${
            isBrandAppearance ? "text-slate-50" : "text-gray-700"
          }`}
        >
          {title}
        </p>

        <div className={isBrandAppearance ? brandedContentClasses : undefined}>
          {children}
        </div>
      </Card>
    </main>
  );
}
