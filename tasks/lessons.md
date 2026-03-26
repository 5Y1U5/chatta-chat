# Lessons Learned

## 2026-03-26: Vercel Edge Runtime で Prisma は使用不可

**問題**: middleware.ts に `getPrisma()` を追加したところ、ローカルビルドは成功するが Vercel デプロイが全て失敗。数時間気づかなかった。

**原因**: Next.js の middleware は Vercel Edge Runtime で実行され、Node.js 専用モジュール（pg, fs, crypto等）が使用できない。

**ルール**: middleware.ts では Supabase Auth（Edge 対応）のみ使用する。DB アクセスは Server Component や API Route で行う。

## 2026-03-26: デプロイ成否の確認を怠らない

**問題**: PR マージ後にデプロイが失敗していたことに気づかず、「反映されない」と何度もやり取りした。

**ルール**: マージ後に必ず `gh api repos/.../deployments/.../statuses` でデプロイ成否を確認する。本番URLに curl して期待するコンテンツが返るかも確認する。

## 2026-03-26: ChattaChat の正しい Vercel URL

**問題**: `chatta-zeta.vercel.app` は古いプロジェクト。正しくは `chatta-chat.vercel.app`。

**ルール**: Vercel プロジェクト名は `chatta-chat`。URL は `https://chatta-chat.vercel.app`。

## 2026-03-26: Galaxy Z Fold は画面幅 768px 以上の可能性

**問題**: `useIsMobile()` の MOBILE_BREAKPOINT=768 では Galaxy Z Fold の開いた状態を「モバイル」と判定できない場合がある。

**ルール**: TaskDetailPanel のように `md:hidden` で戻るボタンを制御する場合、完了ボタン等も同じ `md:` ブレークポイントで統一する。`isMobile` と CSS `md:` を混在させない。
