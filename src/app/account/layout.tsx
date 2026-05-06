export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="max-w-md mx-auto">{children}</div>
    </div>
  );
}
