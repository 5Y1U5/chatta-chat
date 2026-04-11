import { Suspense } from "react"
import { requireAuth } from "@/lib/auth"
import { SidebarData } from "@/components/chat/SidebarData"
import { ChannelListData } from "@/components/chat/ChannelListData"

import { MobileHeaderData } from "@/components/chat/MobileHeaderData"
import { MobileBottomNavData } from "@/components/chat/MobileBottomNavData"
import { MobileBottomNav } from "@/components/chat/MobileBottomNav"
import { InstallBanner } from "@/components/pwa/InstallBanner"

export default async function ChatLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId?: string }>
}) {
  // 認証のみ同期で実行（軽量: cache() でメモ化済み）
  const auth = await requireAuth()
  const { workspaceId } = await params
  const activeWorkspaceId = workspaceId || auth.workspaceId

  // DBクエリは全て Suspense 内の Server Component に委譲
  // → children（ページ本体）がDBクエリ完了を待たず即座にレンダリング開始
  return (
    <div className="flex h-dvh overflow-hidden">
      {/* PC サイドバー: workspace情報 + 通知数 + メンバー数 */}
      <Suspense fallback={
        <div className="hidden w-16 flex-col border-r bg-sidebar md:flex" />
      }>
        <SidebarData workspaceId={activeWorkspaceId} userId={auth.userId} />
      </Suspense>

      {/* PC第2カラム: チャット時は ChannelList */}
      <Suspense fallback={null}>
        <ChannelListData workspaceId={activeWorkspaceId} userId={auth.userId} />
      </Suspense>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <InstallBanner />
        {/* モバイルヘッダー */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:hidden">
          <Suspense fallback={
            <div className="flex items-center gap-2 flex-1">
              <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
              <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            </div>
          }>
            <MobileHeaderData workspaceId={activeWorkspaceId} userId={auth.userId} />
          </Suspense>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-14 md:pb-0">
          {children}
        </div>
        {/* モバイル下部ナビ: 未読数はストリーミングで反映 */}
        <Suspense fallback={
          <MobileBottomNav workspaceId={activeWorkspaceId} unreadNotificationCount={0} />
        }>
          <MobileBottomNavData workspaceId={activeWorkspaceId} userId={auth.userId} />
        </Suspense>
      </main>
    </div>
  )
}
