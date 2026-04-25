-- ============================================================
-- ChattaChat: Realtime 復活のための RLS SELECT ポリシー
-- ============================================================
--
-- 背景:
--   全テーブルで RLS は有効化済み (enable-rls.sql) だが、ポリシー 0 件のため
--   anon/authenticated ロールからは何も SELECT できない状態。
--   Supabase Realtime (postgres_changes) は authenticated ロールで SELECT 権限が
--   必要なため、メッセージ・タスク・通知のリアルタイム配信が機能していなかった。
--
-- 設計方針:
--   1. Prisma 経由 (postgres ロール) は引き続き全権限でバイパス（変更なし）
--   2. authenticated ロールに必要最小限の SELECT 権限を付与
--   3. INSERT/UPDATE/DELETE のポリシーは作らない → REST API からの直接書き込みは引き続き遮断
--   4. anon ロールには何も付与しない → 未ログインからのアクセスは引き続き遮断
--   5. User.supabaseUserId 経由で auth.uid() と紐付け
--
-- 実行方法:
--   Supabase ダッシュボード → SQL Editor でこのファイルの内容を実行
--   ロールバック: disable-rls-policies.sql を実行
--
-- 影響テーブル:
--   Message / Task / TaskComment / GuestComment / Notification / ChannelMember
-- ============================================================

-- ------------------------------------------------------------
-- 0. ヘルパー関数: 現在の Supabase ユーザーに対応する Prisma User.id を返す
-- ------------------------------------------------------------
-- SECURITY DEFINER で User テーブルを RLS 無視で参照する。
-- これがないと、User テーブル自身に SELECT ポリシーが必要になり、
-- ポリシー側で「自分の User 行 → channelId → message」を順次解決するときに
-- 再帰的に自分自身を解決する循環が発生する。
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public."User" WHERE "supabaseUserId" = (SELECT auth.uid()::text) LIMIT 1;
$$;

-- 関数の実行権限を付与
GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_id() TO anon;

-- ------------------------------------------------------------
-- 1. Message: 自分が参加している Channel のメッセージのみ閲覧可
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "select_messages_in_my_channels" ON public."Message";

CREATE POLICY "select_messages_in_my_channels" ON public."Message"
FOR SELECT TO authenticated
USING (
  "channelId" IN (
    SELECT "channelId" FROM public."ChannelMember"
    WHERE "userId" = public.current_user_id()
  )
);

-- ------------------------------------------------------------
-- 2. Task: 自分が参加している Workspace のタスクのみ閲覧可
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "select_tasks_in_my_workspaces" ON public."Task";

CREATE POLICY "select_tasks_in_my_workspaces" ON public."Task"
FOR SELECT TO authenticated
USING (
  "workspaceId" IN (
    SELECT "workspaceId" FROM public."WorkspaceMember"
    WHERE "userId" = public.current_user_id()
  )
);

-- ------------------------------------------------------------
-- 3. TaskComment: 紐付く Task が閲覧可なら閲覧可
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "select_taskcomments_for_my_tasks" ON public."TaskComment";

CREATE POLICY "select_taskcomments_for_my_tasks" ON public."TaskComment"
FOR SELECT TO authenticated
USING (
  "taskId" IN (
    SELECT id FROM public."Task"
    WHERE "workspaceId" IN (
      SELECT "workspaceId" FROM public."WorkspaceMember"
      WHERE "userId" = public.current_user_id()
    )
  )
);

-- ------------------------------------------------------------
-- 4. GuestComment: 同上（紐付く Task が閲覧可なら閲覧可）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "select_guestcomments_for_my_tasks" ON public."GuestComment";

CREATE POLICY "select_guestcomments_for_my_tasks" ON public."GuestComment"
FOR SELECT TO authenticated
USING (
  "taskId" IN (
    SELECT id FROM public."Task"
    WHERE "workspaceId" IN (
      SELECT "workspaceId" FROM public."WorkspaceMember"
      WHERE "userId" = public.current_user_id()
    )
  )
);

-- ------------------------------------------------------------
-- 5. Notification: 自分宛 (userId) のみ閲覧可
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "select_my_notifications" ON public."Notification";

CREATE POLICY "select_my_notifications" ON public."Notification"
FOR SELECT TO authenticated
USING ("userId" = public.current_user_id());

-- ------------------------------------------------------------
-- 6. ChannelMember: 自分の所属レコードのみ閲覧可
-- ------------------------------------------------------------
-- 注: 他人のチャンネル参加状況を見せる必要があれば、別ポリシーで段階的に拡張可能。
-- ここでは Realtime で「自分が新しい channel に追加された」を検知できれば十分。
DROP POLICY IF EXISTS "select_my_channel_memberships" ON public."ChannelMember";

CREATE POLICY "select_my_channel_memberships" ON public."ChannelMember"
FOR SELECT TO authenticated
USING ("userId" = public.current_user_id());

-- ============================================================
-- 確認用クエリ
-- ============================================================
-- 適用後、以下を実行して 6 件のポリシーが存在することを確認:
--
-- SELECT schemaname, tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('Message', 'Task', 'TaskComment', 'GuestComment', 'Notification', 'ChannelMember')
-- ORDER BY tablename, policyname;
--
-- 自分以外の認証ユーザーで以下を実行して、自分のデータのみ返ることを確認:
-- (各 Workspace/Channel に複数ユーザーがいる前提)
--
-- SET LOCAL ROLE authenticated;
-- SET LOCAL request.jwt.claims TO '{"sub": "別ユーザーのsupabaseUserId"}';
-- SELECT count(*) FROM public."Message";  -- 自分のチャネル分のみ
-- RESET ROLE;
-- ============================================================
