export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-subtle px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-sm font-semibold text-white">
            L
          </div>
          <span className="text-lg font-semibold text-ink">LightPM</span>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </div>
  );
}
