import AppHeader from "@/app/components/AppHeader";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <><AppHeader />{children}</>;
}
