import AppHeader from "@/app/components/AppHeader";

export default function StoryElementsLayout({ children }: { children: React.ReactNode }) {
  return <><AppHeader />{children}</>;
}
