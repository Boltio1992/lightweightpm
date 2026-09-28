export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-x flex flex-wrap items-start justify-between gap-3 border-b border-line bg-surface py-4 sm:py-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-5 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-none items-center gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}
