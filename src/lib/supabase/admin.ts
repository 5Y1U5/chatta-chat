import { createClient } from "@supabase/supabase-js"
import { supabaseUrl, supabaseServiceRoleKey } from "@/lib/config"

// サービスロールキーを使用する管理用Supabaseクライアント
// RLSをバイパスする必要がある場合に使用
let adminClient: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient(supabaseUrl(), supabaseServiceRoleKey())
  }
  return adminClient
}
