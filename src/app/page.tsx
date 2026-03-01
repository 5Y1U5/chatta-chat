import { redirect } from "next/navigation"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import { getAuthContext } from "@/lib/auth"

export default async function Home() {
  try {
    const auth = await getAuthContext()

    if (!auth) {
      redirect("/login")
    }

    redirect(`/${auth.workspaceId}`)
  } catch (error) {
    // redirect() は例外として動作するので再スロー
    if (isRedirectError(error)) {
      throw error
    }
    // DB 接続エラー等はログインページへフォールバック
    console.error("ホームページエラー:", error)
    redirect("/login")
  }
}
