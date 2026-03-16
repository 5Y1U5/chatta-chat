import { Button } from "@/components/ui/button"

type Props = {
  icon: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground page-enter">
      <div className="mb-4 opacity-30">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-xs mt-1 text-muted-foreground/60 text-center max-w-xs">{description}</p>
      )}
      {action && (
        <Button variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
