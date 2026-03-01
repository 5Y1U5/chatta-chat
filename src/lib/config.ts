// 環境変数の一元管理
// 必須変数が未設定の場合は実行時にエラーを投げる

function getEnvVar(key: string, required = true): string {
  const value = process.env[key]?.trim()
  if (!value && required) {
    throw new Error(`環境変数 ${key} が設定されていません`)
  }
  return value ?? ""
}

// Supabase
export const supabaseUrl = () => getEnvVar("NEXT_PUBLIC_SUPABASE_URL")
export const supabaseAnonKey = () => getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY")
export const supabaseServiceRoleKey = () =>
  getEnvVar("SUPABASE_SERVICE_ROLE_KEY")

// App
export const appUrl = () =>
  getEnvVar("NEXT_PUBLIC_APP_URL", false) || "http://localhost:3000"
