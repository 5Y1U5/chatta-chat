-- ============================================================
-- ChattaChat: Realtime DELETE イベントに必要な REPLICA IDENTITY 設定
-- ============================================================
--
-- 背景:
--   Supabase Realtime の postgres_changes で DELETE イベントを購読する場合、
--   old レコード（削除前のデータ）を受信するには REPLICA IDENTITY FULL が必要。
--   デフォルト (DEFAULT) では主キーのみ送信され、workspaceId 等でのフィルタができない。
--
-- 対象テーブル:
--   Task — タスク削除のリアルタイム反映に必要
--
-- 実行方法:
--   Supabase ダッシュボード → SQL Editor でこのファイルの内容を実行
-- ============================================================

ALTER TABLE "Task" REPLICA IDENTITY FULL;
