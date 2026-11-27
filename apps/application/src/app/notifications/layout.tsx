

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-dvh max-w-(--app-width) bg-surface px-(--page-gutter) py-4 text-surface-foreground [&_.freud-icon]:text-current [&_.freud-icon]:filter-none">{children}</div>;
}
