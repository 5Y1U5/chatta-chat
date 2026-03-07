import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "セキュリティへの取り組み - chatta-chat",
}

function SecurityCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  )
}

function IconLock() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function IconServer() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  )
}

function IconEye() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

function IconBuilding() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  )
}

export default function SecurityPage() {
  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-3">セキュリティへの取り組み</h1>
        <p className="text-muted-foreground leading-relaxed">
          chatta-chatは、チームの大切な会話やデータを安全に保管・処理するために、
          複数のセキュリティ対策を実施しています。
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SecurityCard icon={<IconLock />} title="通信の暗号化">
          <p>
            すべての通信はTLS 1.3により暗号化されています。
            お客様のブラウザとサーバー間、サーバーとデータベース間のデータ転送は、
            第三者に傍受されることなく安全に行われます。
          </p>
        </SecurityCard>

        <SecurityCard icon={<IconServer />} title="データ保管">
          <p>
            データベースは日本国内（AWS東京リージョン）のサーバーに保管されます。
            保存データはAES-256で暗号化されており、不正なアクセスからデータを保護しています。
            データは毎日自動でバックアップされ、7日間保持されます。
          </p>
        </SecurityCard>

        <SecurityCard icon={<IconShield />} title="ワークスペース分離">
          <p>
            ワークスペースごとにデータが完全に分離されています。
            他の組織のチャット・タスク・ファイルにアクセスすることは
            システム設計上不可能です。すべてのデータベースクエリにワークスペースIDによるフィルタが適用されます。
          </p>
        </SecurityCard>

        <SecurityCard icon={<IconEye />} title="AI処理のプライバシー">
          <p>
            会話要約、議事録生成、返信候補提案等のAI機能にはAnthropicのClaude APIを使用していますが、
            お客様のデータがAIの学習データとして利用されることはありません。
            AIへのデータ送信は各機能の提供目的にのみ使用されます。
          </p>
        </SecurityCard>

        <SecurityCard icon={<IconTrash />} title="データ削除">
          <p>
            アカウント削除時には、登録されたすべてのデータ（チャットメッセージ、ファイル、タスク、プロジェクト）が
            完全に削除されます。バックアップからも所定の期間内に消去されます。
          </p>
        </SecurityCard>

        <SecurityCard icon={<IconBuilding />} title="認証・アクセス制御">
          <p>
            パスワードはハッシュ化して保管され、平文で保存されることはありません。
            ログインにはメール認証またはGoogleアカウント認証が必要です。
            ワークスペースへの参加は招待リンク経由に限定されています。
          </p>
        </SecurityCard>
      </div>

      <div className="mt-10 rounded-lg border bg-muted/30 p-6">
        <h2 className="text-lg font-semibold mb-4">利用インフラの安全性</h2>
        <p className="text-sm text-muted-foreground mb-4">
          chatta-chatは、セキュリティ認証を取得した信頼性の高いインフラサービスを利用しています。
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-md border bg-background p-4">
            <p className="font-medium text-sm">Supabase</p>
            <p className="text-xs text-muted-foreground mt-1">
              データベース・認証・ファイル保管を担当。SOC 2 Type II認証取得済み。
              データは日本（東京リージョン）に保管されます。
            </p>
          </div>
          <div className="rounded-md border bg-background p-4">
            <p className="font-medium text-sm">Vercel</p>
            <p className="text-xs text-muted-foreground mt-1">
              アプリケーションホスティングを担当。SOC 2 Type II認証取得済み。
              エッジネットワークにより高速かつ安全にサービスを提供します。
            </p>
          </div>
          <div className="rounded-md border bg-background p-4">
            <p className="font-medium text-sm">Anthropic</p>
            <p className="text-xs text-muted-foreground mt-1">
              AI応答生成・会話要約・議事録生成を担当。SOC 2 Type II認証取得済み。
              お客様のデータはAIモデルの学習には使用されません。
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 text-sm text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground mb-3">お問い合わせ</h2>
        <p>
          セキュリティに関するご質問・ご懸念がございましたら、お気軽にご連絡ください。
        </p>
        <p className="mt-2">
          株式会社i-Style<br />
          メール: <a href="mailto:support@i-styleinc.com" className="text-primary underline">support@i-styleinc.com</a>
        </p>
      </div>
    </div>
  )
}
