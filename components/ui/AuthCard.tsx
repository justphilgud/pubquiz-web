import { ReactNode } from "react";
import { Card } from "./Card";

export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <Card className="w-full max-w-md border-gray-300 bg-gray-50 p-10 shadow-lg">
        <div className="mb-2 flex justify-center">
          <img
            src="/logo_transparent.png"
            alt="ungegoogelt"
            className="h-44 w-auto object-contain"
          />
        </div>

        <p className="mb-8 text-center text-2xl font-normal text-gray-700">
          {title}
        </p>

        {children}
      </Card>
    </main>
  );
}
