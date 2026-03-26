import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getPrisma } from "@/lib/prisma"

// chatta-chat の認証パス判定
const AUTH_REQUIRED = /^\/[^/]+\/(channel|tasks|inbox|dashboard|projects)(\/|$)/
const AUTH_PAGE = /^\/(login|signup)(\/|$)/
const WORKSPACE_ROOT = /^\/[^/]+\/?$/

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 認証チェックが不要なパスはスキップ
  const needsAuth = pathname === "/" || AUTH_REQUIRED.test(pathname) || AUTH_PAGE.test(pathname) || WORKSPACE_ROOT.test(pathname)
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

  // ルート "/" またはワークスペースルート "/:wsId" → 認証済みなら直接最終ページへリダイレクト
  if (pathname === "/" || WORKSPACE_ROOT.test(pathname)) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }

    try {
      const prisma = getPrisma()

      // ワークスペースIDを解決（ルートの場合はDBから取得）
      let workspaceId: string | null = null
      if (pathname === "/") {
        const dbUser = await prisma.user.findUnique({
          where: { supabaseUserId: user.id },
          select: {
            workspaceMembers: {
              select: { workspaceId: true },
              take: 1,
            },
          },
        })
        workspaceId = dbUser?.workspaceMembers[0]?.workspaceId || null
      } else {
        // /:workspaceId のパスからIDを取得
        workspaceId = pathname.replace(/^\//, "").replace(/\/$/, "")
      }

      if (!workspaceId) {
        const url = request.nextUrl.clone()
        url.pathname = "/login"
        return NextResponse.redirect(url)
      }

      // デフォルトチャネルを1クエリで取得（マイチャット優先、なければ最古のチャネル）
      const channel = await prisma.channel.findFirst({
        where: { workspaceId },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      })

      if (channel) {
        // マイチャットを優先して探す
        let targetChannelId = channel.id
        if (channel.name !== "マイチャット") {
          const myChat = await prisma.channel.findFirst({
            where: { workspaceId, name: "マイチャット", type: "public" },
            select: { id: true },
          })
          if (myChat) targetChannelId = myChat.id
        }

        const url = request.nextUrl.clone()
        url.pathname = `/${workspaceId}/channel/${targetChannelId}`
        return NextResponse.redirect(url)
      }

      // チャネルがない場合はワークスペースのタスクページへ
      const url = request.nextUrl.clone()
      url.pathname = `/${workspaceId}/tasks`
      return NextResponse.redirect(url)
    } catch (error) {
      console.error("middleware リダイレクト解決エラー:", error)
      // フォールバック: 従来通り page.tsx に任せる
      return supabaseResponse
    }
  }

  // 未認証で認証必要ページにアクセス → ログインへ
  if (!user && AUTH_REQUIRED.test(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // 認証済みで認証ページにアクセス → そのまま通す（page.tsx でワークスペースにリダイレクト）
  if (user && AUTH_PAGE.test(pathname)) {
    return supabaseResponse
  }

  return supabaseResponse
}
