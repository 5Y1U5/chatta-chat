-- ============================================================
-- ChattaChat: enable-rls-policies.sql のロールバック
-- ============================================================
--
-- 緊急時にこのファイルを実行すると、RLS ポリシーをすべて削除して
-- 「RLS 有効・ポリシー 0 件」状態（適用前）に戻る。
-- Realtime は再び動かなくなるが、データ漏洩リスクは消滅する。
--
-- 実行方法:
--   Supabase ダッシュボード → SQL Editor でこのファイルの内容を実行
-- ============================================================

DROP POLICY IF EXISTS "select_messages_in_my_channels" ON public."Message";
DROP POLICY IF EXISTS "select_tasks_in_my_workspaces" ON public."Task";
DROP POLICY IF EXISTS "select_taskcomments_for_my_tasks" ON public."TaskComment";
DROP POLICY IF EXISTS "select_guestcomments_for_my_tasks" ON public."GuestComment";
DROP POLICY IF EXISTS "select_my_notifications" ON public."Notification";
DROP POLICY IF EXISTS "select_my_channel_memberships" ON public."ChannelMember";

-- ヘルパー関数も削除
DROP FUNCTION IF EXISTS public.current_user_id();

-- ------------------------------------------------------------
-- 確認用: 残ポリシー数が 0 であること
-- ------------------------------------------------------------
-- SELECT count(*) FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('Message', 'Task', 'TaskComment', 'GuestComment', 'Notification', 'ChannelMember');
-- → 0 が期待値
