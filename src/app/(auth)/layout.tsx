export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center overflow-auto bg-background">
      <div className="w-full max-w-md px-4 py-8">{children}</div>
    </div>
  )
}
