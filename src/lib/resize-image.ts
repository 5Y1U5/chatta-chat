// 画像ファイルをクライアント側で自動リサイズする
//
// - 非画像・GIF（アニメ保全）・HEIC 等はそのまま返す
// - 500KB 以下の画像はリサイズしない（再エンコードロスを避ける）
// - 長辺が maxDimension を超える場合のみ縮小
// - PNG は透過保持のため PNG のまま再エンコード、それ以外は JPEG で再エンコード

type ResizeOptions = {
  maxDimension?: number // 既定: 1920px
  quality?: number // JPEG 品質 0-1。既定: 0.85
  skipThresholdBytes?: number // この値以下の画像はリサイズしない。既定: 500KB
}

export async function resizeImageFile(
  file: File,
  opts: ResizeOptions = {}
): Promise<File> {
  const maxDimension = opts.maxDimension ?? 1920
  const quality = opts.quality ?? 0.85
  const skipThreshold = opts.skipThresholdBytes ?? 500 * 1024

  // 非画像はスキップ
  if (!file.type.startsWith("image/")) return file
  // GIF はアニメ保全のためスキップ
  if (file.type === "image/gif") return file
  // HEIC 等、Canvas が対応していない形式はスキップ
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file
  // 十分小さい画像はスキップ
  if (file.size <= skipThreshold) return file

  const bitmap = await loadImageBitmap(file)
  const { width: w, height: h } = bitmap
  const longest = Math.max(w, h)

  // 小さい画像ならスキップ（長辺 <= maxDimension）
  if (longest <= maxDimension) {
    bitmap.close?.()
    return file
  }

  const scale = maxDimension / longest
  const targetW = Math.round(w * scale)
  const targetH = Math.round(h * scale)

  const canvas = document.createElement("canvas")
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    bitmap.close?.()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  bitmap.close?.()

  // PNG は透過保持のため PNG のまま、それ以外は JPEG に統一
  const outType = file.type === "image/png" ? "image/png" : "image/jpeg"
  const blob = await canvasToBlob(canvas, outType, quality)
  if (!blob) return file

  // ファイル名の拡張子を出力形式に合わせる
  const base = file.name.replace(/\.[^.]+$/, "")
  const ext = outType === "image/png" ? "png" : "jpg"
  return new File([blob], `${base}.${ext}`, { type: outType, lastModified: Date.now() })
}

async function loadImageBitmap(file: File): Promise<ImageBitmap & { close?: () => void }> {
  // createImageBitmap がある環境では優先（高速）
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file)
    } catch {
      // 一部ブラウザで HEIC 等が失敗するためフォールバック
    }
  }
  // フォールバック: Image + ObjectURL
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("画像の読み込みに失敗しました"))
      el.src = url
    })
    // HTMLImageElement を ImageBitmap 互換に見せかける
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    } as unknown as ImageBitmap & { close?: () => void }
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality)
  })
}
