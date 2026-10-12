interface EmptyStateProps {
  /** What is missing, e.g. "No positions yet". */
  title: string;
  /** What to do about it. */
  hint?: string;
}

/** Fills a panel that has nothing to show, and tells the user how to fill it. */
export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1 px-4 py-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-64 text-xs text-muted">{hint}</p>}
    </div>
  );
}
