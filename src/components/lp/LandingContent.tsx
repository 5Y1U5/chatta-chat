import Link from "next/link"

/* ---------- 共通パーツ ---------- */

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-bold">{children}</h2>
      {sub && <p className="mt-3 text-muted-foreground">{sub}</p>}
    </div>
  )
}

function StepCard({ number, title, description, icon }: { number: number; title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="relative rounded-lg border bg-card p-6 pt-10">
      <div className="absolute -top-5 left-6 flex size-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
        {number}
      </div>
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-3 flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function GrowthCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="flex gap-4 rounded-lg border bg-card p-6">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <h3 className="mb-1 font-semibold">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function SecurityItem({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="flex gap-4 rounded-lg border bg-card p-6">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
        {icon}
      </div>
      <div>
        <h3 className="mb-1 font-semibold">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

/* ---------- アイコン SVG ---------- */

function IconChat() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconSparkles() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
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

function IconUsers() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconArrowRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

function IconFileText() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  )
}

function IconDashboard() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
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

function IconDatabase() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  )
}

function IconCheckCircle() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary/70">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  )
}

function IconMic() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  )
}

/* ---------- 料金プラン ---------- */

const plans = [
  {
    id: "free",
    name: "フリー",
    price: 0,
    description: "まずは試してみたいチームに",
    features: [
      "5ユーザーまで",
      "AI機能 月50回",
      "グループチャット 3つまで",
      "ファイルアップロード 1GB",
      "メッセージ履歴 90日",
    ],
    cta: "無料で始める",
    highlighted: false,
  },
  {
    id: "standard",
    name: "スタンダード",
    price: 980,
    description: "AI機能をフル活用したいチームに",
    features: [
      "ユーザー数 無制限",
      "AI機能 無制限",
      "グループチャット 無制限",
      "ファイルアップロード 10GB",
      "メッセージ履歴 無制限",
      "会話要約 / 議事録生成",
      "AI返信候補",
      "重要事項の自動検出",
      "音声入力",
    ],
    cta: "無料トライアルを始める",
    highlighted: true,
  },
  {
    id: "pro",
    name: "プロ",
    price: 1680,
    description: "本格的にチーム運営したい組織に",
    features: [
      "スタンダードの全機能",
      "タスク管理 / プロジェクト管理",
      "ダッシュボード（タスク統計）",
      "ファイルアップロード 100GB",
      "優先サポート",
      "管理者権限の詳細設定",
    ],
    cta: "無料トライアルを始める",
    highlighted: false,
  },
]

/* ---------- メインコンポーネント ---------- */

export function LandingContent() {
  return (
    <div className="h-dvh overflow-y-auto bg-background text-foreground">
      {/* ヒーローアニメーション用CSS */}
      <style>{`
        @keyframes heroFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes heroFloatReverse {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(10px); }
        }
        @keyframes heroOrbPulse {
          0%, 100% { opacity: 0.03; transform: scale(1); }
          50% { opacity: 0.06; transform: scale(1.05); }
        }
        .hero-float { animation: heroFloat 6s ease-in-out infinite; }
        .hero-float-delay { animation: heroFloat 7s ease-in-out 1.5s infinite; }
        .hero-float-reverse { animation: heroFloatReverse 5s ease-in-out 0.5s infinite; }
        .hero-orb-pulse { animation: heroOrbPulse 8s ease-in-out infinite; }
      `}</style>

      {/* ========== ヘッダー ========== */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/lp" className="text-xl font-bold">
            chatta-chat
          </Link>
          <div className="flex items-center gap-3">
            <Link href="#pricing" className="hidden text-sm text-muted-foreground hover:text-foreground sm:block">
              料金
            </Link>
            <Link href="#security" className="hidden text-sm text-muted-foreground hover:text-foreground sm:block">
              セキュリティ
            </Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              ログイン
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </header>

      {/* ========== ヒーロー ========== */}
      <section className="relative overflow-hidden py-20 md:py-28 lg:py-32">
        {/* 背景デコレーション */}
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, hsl(0 0% 0% / 0.04) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="hero-orb-pulse pointer-events-none absolute -left-32 -top-32 size-[500px] rounded-full bg-primary/[0.03] blur-[100px]" />
        <div className="hero-orb-pulse pointer-events-none absolute -bottom-32 -right-32 size-[500px] rounded-full bg-primary/[0.03] blur-[100px]" />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
          {/* テキスト */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.04] px-4 py-1.5 text-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              14日間無料トライアル / いつでも解約可能
            </p>

            <h1 className="mt-6 text-[1.75rem] font-bold leading-[1.2] sm:text-3xl md:text-4xl lg:text-[2.75rem]" style={{ textWrap: "balance" } as React.CSSProperties}>
              AIが最初から入った、<br className="hidden sm:block" />
              <span className="text-primary">新しいチャットツール。</span>
            </h1>

            <p className="mt-4 max-w-lg text-base text-muted-foreground lg:text-lg">
              会話の要約、議事録の自動生成、返信候補の提案。<br />
              <strong className="text-foreground">AIがチームのコミュニケーションを加速する</strong>、<br className="hidden md:block" />
              これからのビジネスチャット。
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link
                href="/signup"
                className="group inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
              >
                無料で始める
                <IconArrowRight />
              </Link>
              <Link
                href="#features"
                className="inline-flex h-12 items-center rounded-lg border px-6 text-base font-medium hover:bg-muted/50 hover:text-foreground"
              >
                機能を見る
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground lg:justify-start">
              <span className="flex items-center gap-1.5"><IconCheckCircle />初期設定3分</span>
              <span className="flex items-center gap-1.5"><IconCheckCircle />クレジットカード不要</span>
              <span className="flex items-center gap-1.5"><IconCheckCircle />即日利用開始</span>
            </div>
          </div>

          {/* チャット UI モックアップ */}
          <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none">
            <div className="hero-float rounded-2xl border border-black/[0.06] bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)]">
              {/* ヘッダー */}
              <div className="flex items-center gap-3 rounded-t-2xl bg-primary px-5 py-3.5 text-primary-foreground">
                <div className="flex size-8 items-center justify-center rounded-lg bg-white/20">
                  <IconChat />
                </div>
                <div>
                  <p className="text-sm font-semibold">開発チーム</p>
                  <p className="flex items-center gap-1 text-xs opacity-80">
                    <span className="size-1.5 rounded-full bg-green-400" />
                    5人がオンライン
                  </p>
                </div>
              </div>
              {/* メッセージ */}
              <div className="space-y-3 p-4">
                <div className="flex gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">T</div>
                  <div className="rounded-2xl rounded-tl-md bg-gray-100 px-3.5 py-2 text-sm text-gray-800">
                    今日のミーティングの内容まとめてもらえる？
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs">
                    <IconSparkles />
                  </div>
                  <div className="rounded-2xl rounded-tl-md bg-gray-100 px-3.5 py-2 text-sm text-gray-800">
                    <p className="mb-1 text-xs font-semibold text-primary">AI アシスタント</p>
                    本日のミーティング要点です:<br />
                    <strong>1.</strong> リリース日を来週金曜に決定<br />
                    <strong>2.</strong> デザインレビューは明日まで<br />
                    <strong>3.</strong> API連携のテストを優先
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-tr-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                    ありがとう！タスクも作っておいて
                  </div>
                </div>
              </div>
              {/* 入力欄 */}
              <div className="flex items-center gap-2 rounded-b-2xl border-t px-4 py-3">
                <span className="flex-1 text-sm text-gray-400">メッセージを入力...</span>
                <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* フローティングバッジ */}
            <div className="hero-float-delay absolute -left-4 top-6 hidden items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-md lg:-left-10 lg:flex">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><IconSparkles /></div>
              <div>
                <p className="text-xs font-semibold">会話を自動要約</p>
                <p className="text-[10px] text-muted-foreground">長い会話も一目で把握</p>
              </div>
            </div>
            <div className="hero-float-reverse absolute -right-2 top-1/3 hidden items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-md lg:-right-8 lg:flex">
              <div className="flex size-8 items-center justify-center rounded-lg bg-green-500/10 text-green-500"><IconCheck /></div>
              <div>
                <p className="text-xs font-semibold">タスク自動生成</p>
                <p className="text-[10px] text-muted-foreground">会話からタスクを抽出</p>
              </div>
            </div>
            <div className="hero-float-delay absolute -bottom-2 left-6 hidden items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-md lg:left-2 lg:flex">
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500"><IconFileText /></div>
              <div>
                <p className="text-xs font-semibold">議事録を自動作成</p>
                <p className="text-[10px] text-muted-foreground">ワンクリックで生成</p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      </section>

      {/* ========== 導入ステップ ========== */}
      <section id="how-it-works" className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle sub="アカウント作成からチーム運用まで、最短3分で完了します。">
            3ステップで、すぐに使い始められる
          </SectionTitle>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            <StepCard
              number={1}
              title="アカウントを作成"
              description="メールアドレスまたはGoogleアカウントで登録。ワークスペースが自動で作成されます。"
              icon={<IconUsers />}
            />
            <StepCard
              number={2}
              title="チームメンバーを招待"
              description="招待リンクを共有するだけ。メンバーがリンクをクリックすれば、すぐにチームに参加できます。"
              icon={<IconChat />}
            />
            <StepCard
              number={3}
              title="AIと一緒にチャット開始"
              description="@AI でメンションするだけで、AIアシスタントが会話に参加。要約や議事録もワンクリック。"
              icon={<IconSparkles />}
            />
          </div>
        </div>
      </section>

      {/* ========== なぜ chatta-chat か ========== */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle sub="従来のチャットツールとの違いは、AIが最初から組み込まれていること。">
            なぜ chatta-chat なのか
          </SectionTitle>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <GrowthCard
              title="会話が長くても、一瞬で追いつける"
              description="AIが会話を自動で要約。休み明けやミーティング後でも、重要なポイントをすぐに把握できます。"
              icon={<IconSparkles />}
            />
            <GrowthCard
              title="議事録は、もう書かなくていい"
              description="グループチャットの内容から議事録をワンクリックで自動生成。決定事項、アクションアイテムを構造化してまとめます。"
              icon={<IconFileText />}
            />
            <GrowthCard
              title="返信に迷わない"
              description="AIが文脈を理解し、適切な返信候補を提案。丁寧な言い回しや簡潔な返答など、シーンに合わせた選択肢を提示します。"
              icon={<IconChat />}
            />
            <GrowthCard
              title="重要なことを見逃さない"
              description="決定事項、締め切り、アクションアイテムをAIが自動で検出・記録。後から「あの話どうなった？」がなくなります。"
              icon={<IconCheck />}
            />
          </div>
        </div>
      </section>

      {/* ========== 主な機能 ========== */}
      <section id="features" className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle sub="チャットに必要な機能はすべて揃っています。そこにAIが加わります。">
            主な機能
          </SectionTitle>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              title="AIチャットアシスタント"
              description="@AI でメンションするだけ。質問への回答、アイデア出し、文章の推敲など、何でも相談できます。"
              icon={<IconSparkles />}
            />
            <FeatureCard
              title="会話要約・議事録"
              description="長い会話をワンクリックで要約。議事録として構造化されたドキュメントも自動生成します。"
              icon={<IconFileText />}
            />
            <FeatureCard
              title="タスク管理"
              description="チャットの中でタスクを作成・管理。プロジェクト単位での整理、担当者の割り当て、期日設定まで。"
              icon={<IconCheck />}
            />
            <FeatureCard
              title="ダッシュボード"
              description="タスクの進捗状況、プロジェクトの全体像を可視化。チームの状況がひと目でわかります。"
              icon={<IconDashboard />}
            />
            <FeatureCard
              title="リアルタイムチャット"
              description="グループチャット、ダイレクトメッセージ、スレッド返信。リアルタイムで同期されるスムーズなコミュニケーション。"
              icon={<IconChat />}
            />
            <FeatureCard
              title="音声入力"
              description="マイクボタンを押して話すだけ。音声がテキストに変換され、ハンズフリーでメッセージを送信できます。"
              icon={<IconMic />}
            />
            <FeatureCard
              title="AI返信候補"
              description="会話の文脈を読んで、適切な返信候補をAIが提案。ワンクリックで入力、そのまま送信。"
              icon={<IconSparkles />}
            />
            <FeatureCard
              title="重要事項の自動検出"
              description="決定事項、締め切り、アクションアイテムをAIが自動検出。見逃しを防ぎ、チームの意思決定を記録します。"
              icon={<IconShield />}
            />
          </div>
        </div>
      </section>

      {/* ========== セキュリティ ========== */}
      <section id="security" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle sub="大切なチームの会話を、安全にお預かりします。">
            セキュリティへの取り組み
          </SectionTitle>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <SecurityItem
              title="通信の完全暗号化"
              description="すべての通信はTLS 1.3で暗号化。第三者による傍受や改ざんを防ぎます。"
              icon={<IconLock />}
            />
            <SecurityItem
              title="日本国内にデータ保管"
              description="チャットデータはAWS東京リージョンのサーバーに保管。海外へのデータ移転はありません。"
              icon={<IconServer />}
            />
            <SecurityItem
              title="保存データの暗号化"
              description="データベースに保存されるデータはAES-256で暗号化。万が一の場合もデータを保護します。"
              icon={<IconDatabase />}
            />
            <SecurityItem
              title="テナントデータの完全分離"
              description="ワークスペースごとにデータは完全に分離。他の組織のデータにアクセスすることはできません。"
              icon={<IconShield />}
            />
            <SecurityItem
              title="毎日の自動バックアップ"
              description="データは毎日自動でバックアップ。7日間保持されるため、万が一の障害時も復旧が可能です。"
              icon={<IconRefresh />}
            />
            <SecurityItem
              title="信頼性の高いインフラ"
              description="SOC2認証を取得済みのVercelとSupabase上で稼働。エンタープライズ水準のインフラを採用しています。"
              icon={<IconCheck />}
            />
          </div>

          <div className="mt-10 flex justify-center">
            <p className="rounded-full bg-muted/50 px-6 py-2 text-sm text-muted-foreground">
              届出電気通信事業者（総務省届出済み）
            </p>
          </div>
        </div>
      </section>

      {/* ========== 料金プラン ========== */}
      <section id="pricing" className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle sub="まずは無料で始めて、チームの成長に合わせてアップグレード。">
            料金プラン
          </SectionTitle>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border bg-card p-6 shadow-sm ${plan.highlighted ? "border-primary ring-1 ring-primary" : ""}`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                    おすすめ
                  </span>
                )}
                <div>
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <div className="mt-4">
                  {plan.price === 0 ? (
                    <span className="text-3xl font-bold">無料</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">&yen;{plan.price.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground"> /ユーザー/月（年払い）</span>
                    </>
                  )}
                </div>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-primary">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Link
                    href="/signup"
                    className={`flex h-10 w-full items-center justify-center rounded-md text-sm font-medium ${
                      plan.highlighted
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border hover:bg-muted"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 最終 CTA ========== */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-bold">
            チームのコミュニケーションを、<br />AIで加速しませんか？
          </h2>
          <p className="mt-4 text-muted-foreground">
            全機能を14日間無料でお試し。トライアル中はいつでも解約できます。
          </p>
          <div className="mt-8">
            <Link
              href="/signup"
              className="group inline-flex h-12 items-center gap-2 rounded-md bg-primary px-8 text-base font-medium text-primary-foreground hover:bg-primary/90"
            >
              無料で始める
              <IconArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* ========== フッター ========== */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
            <p>&copy; 2026 i-Style Inc.</p>
            <div className="flex gap-4">
              <Link href="/terms" className="hover:text-foreground">利用規約</Link>
              <Link href="/privacy" className="hover:text-foreground">プライバシーポリシー</Link>
              <Link href="/security" className="hover:text-foreground">セキュリティ</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
