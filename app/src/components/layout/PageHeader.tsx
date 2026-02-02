import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: string;
  extraNote?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, extraNote, actions }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 -mx-4 -mt-6 bg-background px-4 py-4">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">{title}</h1>
          {subtitle != null && <p className="text-muted-foreground">{subtitle}</p>}
          {extraNote != null && (
            <p className="mt-1 text-xs text-muted-foreground">{extraNote}</p>
          )}
        </div>
        {actions != null && <div className="flex flex-wrap items-end gap-4">{actions}</div>}
      </div>
    </header>
  );
}
