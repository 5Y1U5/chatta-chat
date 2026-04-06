import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@supabase/supabase-js"

const BUCKET_NAME = "chat-files"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// アップロード許可する MIME タイプ（SVG/HTML 等の XSS リスクのある形式を除外）
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
])

// ファイルアップロード（Supabase Storage）
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが指定されていません" },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ファイルサイズは10MB以下にしてください" },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "許可されていないファイル形式です" },
        { status: 400 }
      )
    }

    // service_role キーで Storage 操作
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ユニークなファイルパス生成
    const ext = file.name.split(".").pop() || "bin"
    const path = `${auth.userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("Storage アップロードエラー:", uploadError)
      return NextResponse.json(
        { error: "ファイルのアップロードに失敗しました" },
        { status: 500 }
      )
    }

    // 公開 URL を取得
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path)

    return NextResponse.json({
      fileUrl: urlData.publicUrl,
      fileName: file.name,
      fileType: file.type,
    })
  } catch (error) {
    console.error("アップロードエラー:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
