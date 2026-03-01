import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // 静的ファイルと API(auth callback) を除外
    "/((?!_next/static|_next/image|favicon.ico|api/auth/callback).*)",
  ],
}
