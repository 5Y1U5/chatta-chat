"use client"

import { useState, useRef, useEffect, type ReactNode } from "react"
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
  const refreshingRef = useRef(false)
  const pullDistanceRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      if (container.scrollTop > 0 || refreshingRef.current) return
      startYRef.current = e.touches[0].clientY
      pullingRef.current = true
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return
      if (container.scrollTop > 0) {
        pullingRef.current = false
        pullDistanceRef.current = 0
        setPullDistance(0)
        return
      }
      const diff = e.touches[0].clientY - startYRef.current
      if (diff > 0) {
        e.preventDefault()
        const distance = Math.min(diff * 0.4, 100)
        pullDistanceRef.current = distance
        setPullDistance(distance)
      }
    }

    const handleTouchEnd = async () => {
      if (!pullingRef.current) return
      pullingRef.current = false

      if (pullDistanceRef.current >= THRESHOLD) {
        refreshingRef.current = true
        setRefreshing(true)
        pullDistanceRef.current = 0
        setPullDistance(0)
        try {
          await onRefreshRef.current()
        } finally {
          refreshingRef.current = false
          setRefreshing(false)
        }
      } else {
        pullDistanceRef.current = 0
        setPullDistance(0)
      }
    }

    container.addEventListener("touchstart", handleTouchStart, { passive: true })
    container.addEventListener("touchmove", handleTouchMove, { passive: false })
    container.addEventListener("touchend", handleTouchEnd)

    return () => {
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchmove", handleTouchMove)
      container.removeEventListener("touchend", handleTouchEnd)
    }
  }, [])

  const showIndicator = pullDistance > 10 || refreshing

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
      style={{ overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}
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
