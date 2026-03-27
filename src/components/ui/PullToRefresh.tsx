"use client"

import { useState, useRef, useCallback, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type Props = {
  onRefresh: () => Promise<void>
  children: ReactNode
  className?: string
}

const THRESHOLD = 60

export function PullToRefresh({ onRefresh, children, className }: Props) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(0)
  const pullingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current
    if (!container || container.scrollTop > 0) return
    startYRef.current = e.touches[0].clientY
    pullingRef.current = true
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullingRef.current || refreshing) return
    const container = containerRef.current
    if (!container || container.scrollTop > 0) {
      pullingRef.current = false
      setPullDistance(0)
      return
    }
    const diff = e.touches[0].clientY - startYRef.current
    if (diff > 0) {
      // 減衰効果
      setPullDistance(Math.min(diff * 0.4, 100))
    }
  }, [refreshing])

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return
    pullingRef.current = false

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
      }
    }
    setPullDistance(0)
  }, [pullDistance, onRefresh])

  const showIndicator = pullDistance > 10 || refreshing

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {showIndicator && (
        <div
          className="flex items-center justify-center transition-opacity duration-200"
          style={{ height: refreshing ? 40 : pullDistance * 0.6 }}
        >
          <svg
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              refreshing && "animate-spin",
              pullDistance >= THRESHOLD && !refreshing && "text-primary"
            )}
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: refreshing ? undefined : `rotate(${pullDistance * 3}deg)`,
            }}
          >
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </div>
      )}
      {children}
    </div>
  )
}
