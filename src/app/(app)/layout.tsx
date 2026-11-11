// App pages (create, pay, dashboard) sit in a centered column; the landing page is full-width.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-5 py-8">{children}</div>;
}
