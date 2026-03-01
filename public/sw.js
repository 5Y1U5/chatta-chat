// chatta-chat Service Worker（最小構成）
// キャッシュ戦略は今後拡張予定

const CACHE_NAME = "chatta-v1"

// インストール時: 即座にアクティブ化
self.addEventListener("install", () => {
  self.skipWaiting()
})

// アクティベート時: 古いキャッシュを削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

// フェッチ: ネットワークファースト（現段階ではキャッシュしない）
// beforeinstallprompt 発火に fetch リスナー登録が必要
self.addEventListener("fetch", () => {
  // デフォルトのネットワークリクエストをそのまま使用
})
