type Props = {
  title?: string;
  children?: React.ReactNode;
};

export default function SlideNotes({
  title = "Moderationsnotizen",
  children,
}: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>

      {children ? (
        <div className="text-zinc-300">{children}</div>
      ) : (
        <p className="text-zinc-400">Noch keine Notizen angebunden.</p>
      )}
    </div>
  );
}
