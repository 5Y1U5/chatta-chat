// chatta-chat Service Worker — キャッシュ戦略付き

const CACHE_NAME = "chatta-v2"

// キャッシュ対象の静的アセットパターン
const STATIC_CACHE_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icons\//,
  /^\/manifest\.json$/,
  /^\/favicon\.ico$/,
]

// キャッシュしないパターン
const NO_CACHE_PATTERNS = [
  /^\/api\//,
  /^\/sw\.js$/,
  /^\/_next\/data\//,
]

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

// フェッチ: 3層キャッシュ戦略
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 同一オリジンのみ処理
  if (url.origin !== self.location.origin) return

  const pathname = url.pathname

  // API やキャッシュ不可パスはスキップ（ネットワークのみ）
  if (NO_CACHE_PATTERNS.some((p) => p.test(pathname))) return

  // 静的アセット → Cache First（高速）
  if (STATIC_CACHE_PATTERNS.some((p) => p.test(pathname))) {
    event.respondWith(cacheFirst(request))
    return
  }

  // ナビゲーション（HTML ページ）→ Network First
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request))
    return
  }

  // その他（フォント等）→ Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request))
})

// Cache First: キャッシュにあればそれを返す。なければネットワークから取得してキャッシュ
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response("", { status: 503 })
  }
}

// Network First: ネットワークを優先。失敗時はキャッシュから返す
async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached || new Response("オフラインです", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
}

// Stale While Revalidate: キャッシュを即座に返しつつ、バックグラウンドで更新
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
      }
      return response
    })
    .catch(() => cached)

  return cached || fetchPromise
}
