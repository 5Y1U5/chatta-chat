import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// chatta-chat の認証パス判定
const AUTH_REQUIRED = /^\/[^/]+\/(channel|tasks|inbox|dashboard|projects)(\/|$)/
const AUTH_PAGE = /^\/(login|signup)(\/|$)/

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 認証チェックが不要なパスはスキップ
  const needsAuth = pathname === "/" || AUTH_REQUIRED.test(pathname) || AUTH_PAGE.test(pathname)
  if (!needsAuth) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // セッションのリフレッシュ
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ルート "/" → ログイン済みならそのまま通す（page.tsx でリダイレクト）、未ログインならログインへ
  if (pathname === "/") {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // 未認証で認証必要ページにアクセス → ログインへ
  if (!user && AUTH_REQUIRED.test(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // 認証済みで認証ページにアクセス → そのまま通す
  if (user && AUTH_PAGE.test(pathname)) {
    return supabaseResponse
  }

  return supabaseResponse
}
