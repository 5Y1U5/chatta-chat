import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // 静的ファイル、PWA関連、API(auth callback) を除外
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icons/|logo\\.webp|api/auth/callback).*)",
  ],
}
