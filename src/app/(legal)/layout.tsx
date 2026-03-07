import Link from "next/link"

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-6">
          <Link href="/lp">
            <img src="/logo.webp" alt="ChattaChat" className="h-14 w-auto" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">
        {children}
      </main>
      <footer className="border-t py-8">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/lp" className="hover:text-foreground">トップページ</Link>
            <Link href="/security" className="hover:text-foreground">セキュリティ</Link>
            <Link href="/privacy" className="hover:text-foreground">プライバシーポリシー</Link>
            <Link href="/terms" className="hover:text-foreground">利用規約</Link>
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            &copy; 2026 i-Style Inc.
          </p>
        </div>
      </footer>
    </div>
  )
}
