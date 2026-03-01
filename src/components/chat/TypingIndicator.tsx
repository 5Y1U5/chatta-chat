"use client"

type TypingUser = {
  userId: string
  displayName: string
}

type Props = {
  typingUsers: TypingUser[]
}

export function TypingIndicator({ typingUsers }: Props) {
  if (typingUsers.length === 0) return null

  const names = typingUsers.map((u) => u.displayName)
  let text: string

  if (names.length === 1) {
    text = `${names[0]} が入力中`
  } else if (names.length === 2) {
    text = `${names[0]} と ${names[1]} が入力中`
  } else {
    text = `${names[0]} 他${names.length - 1}人が入力中`
  }

  return (
    <div className="flex items-center gap-1.5 px-4 py-1 text-xs text-muted-foreground">
      <span className="flex gap-0.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
      </span>
      <span>{text}...</span>
    </div>
  )
}
