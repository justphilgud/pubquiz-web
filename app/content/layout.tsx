import AppHeader from "@/app/components/AppHeader";

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return <><AppHeader />{children}</>;
}
