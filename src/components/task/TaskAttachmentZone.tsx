"use client"

import { useCallback, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { resizeImageFile } from "@/lib/resize-image"
import type { TaskAttachmentInfo } from "@/types/chat"

type Props = {
  taskId: string
  attachments: TaskAttachmentInfo[]
  currentUserId: string
  taskCreatorId: string
  onChange: (attachments: TaskAttachmentInfo[]) => void
}

// 人間可読なファイルサイズ
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// タスク添付ファイル領域
// - ドラッグ&ドロップでアップロード
// - 「ファイルを追加」ボタンでアップロード
// - 画像は自動リサイズ（長辺 1920px、500KB 以下はスキップ）
// - 画像サムネイル / その他はファイル名+アイコン、hover で削除ボタン
export function TaskAttachmentZone({
  taskId,
  attachments,
  currentUserId,
  taskCreatorId,
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const uploadOne = useCallback(
    async (rawFile: File) => {
      setErrorMessage(null)

      // 画像は自動リサイズ（非画像や十分小さいものはそのまま）
      let file = rawFile
      try {
        file = await resizeImageFile(rawFile)
      } catch (e) {
        console.error("画像リサイズ失敗、元ファイルでアップロードします:", e)
      }

      // Supabase Storage にアップロード
      const form = new FormData()
      form.append("file", file)
      const uploadRes = await fetch("/api/internal/upload", { method: "POST", body: form })
      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => null)
        throw new Error(data?.error || "アップロードに失敗しました")
      }
      const uploaded = (await uploadRes.json()) as {
        fileUrl: string
        fileName: string
        fileType: string
      }

      // DB に添付ファイルレコードを作成
      const createRes = await fetch("/api/internal/tasks/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          fileUrl: uploaded.fileUrl,
          fileName: uploaded.fileName,
          fileType: uploaded.fileType,
          fileSize: file.size,
        }),
      })
      if (!createRes.ok) {
        const data = await createRes.json().catch(() => null)
        throw new Error(data?.error || "添付ファイルの登録に失敗しました")
      }
      const attachment = (await createRes.json()) as TaskAttachmentInfo
      return attachment
    },
    [taskId]
  )

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
      if (list.length === 0) return

      setUploading(true)
      try {
        const created: TaskAttachmentInfo[] = []
        for (const f of list) {
          try {
            const att = await uploadOne(f)
            created.push(att)
          } catch (e) {
            console.error(e)
            setErrorMessage(e instanceof Error ? e.message : "アップロードに失敗しました")
          }
        }
        if (created.length > 0) {
          onChange([...attachments, ...created])
        }
      } finally {
        setUploading(false)
      }
    },
    [attachments, onChange, uploadOne]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDelete = useCallback(
    async (attachmentId: string) => {
      if (!confirm("この添付ファイルを削除しますか？")) return
      // 楽観的に除去
      const prev = attachments
      onChange(attachments.filter((a) => a.id !== attachmentId))
      const res = await fetch(`/api/internal/tasks/attachments?id=${attachmentId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        // ロールバック
        const data = await res.json().catch(() => null)
        setErrorMessage(data?.error || "削除に失敗しました")
        onChange(prev)
      }
    },
    [attachments, onChange]
  )

  return (
    <div className="space-y-2">
      {/* ドラッグ&ドロップ領域 */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "rounded-md border-2 border-dashed p-4 text-center text-sm transition-colors",
          isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30",
          uploading && "opacity-60"
        )}
      >
        <p className="text-muted-foreground">
          {isDragOver ? "ここにドロップ" : "ここにファイルをドラッグ&ドロップ"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          画像は自動で最適なサイズに調整されます（長辺 1920px）
        </p>

        {/* アップロードボタン */}
        <div className="mt-2 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            {uploading ? "アップロード中…" : "ファイルを追加"}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                handleFiles(e.target.files)
                // 同じファイルを連続で選べるようにリセット
                e.target.value = ""
              }
            }}
          />
        </div>
      </div>

      {errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}

      {/* 添付ファイル一覧 */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachments.map((att) => {
            const isImage = att.fileType.startsWith("image/")
            const canDelete =
              att.uploaderId === currentUserId || taskCreatorId === currentUserId
            return (
              <div
                key={att.id}
                className="group relative overflow-hidden rounded-md border bg-muted/30"
              >
                {isImage ? (
                  <a
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={att.fileUrl}
                      alt={att.fileName}
                      className="aspect-square w-full object-cover"
                    />
                  </a>
                ) : (
                  <a
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex aspect-square w-full flex-col items-center justify-center gap-1 p-2 text-center hover:bg-muted transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="line-clamp-2 text-xs break-all text-primary">
                      {att.fileName}
                    </span>
                  </a>
                )}
                {/* ファイル名 + サイズ */}
                <div className="border-t bg-background/90 px-2 py-1 text-[10px] text-muted-foreground">
                  <div className="truncate" title={att.fileName}>{att.fileName}</div>
                  <div>{formatFileSize(att.fileSize)}</div>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(att.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                    aria-label="添付ファイルを削除"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
