import { useEffect } from 'react'
import type { ContentItem, ItemState, Status } from '../types'

export function useDriveAutoLink(_args: {
  videos: unknown[]
  items: ContentItem[]
  states: Record<number, ItemState>
  enabled: boolean
  onStatusChange: (id: number, status: Status) => void
  onUpdateState: (id: number, patch: Partial<ItemState>) => void
  onAppendHistory: (id: number, entry: string) => void
  onLinked: (info: { itemId: number; clientName: string; itemName: string; filename: string; movedToReview: boolean }) => void
}) {
  useEffect(() => {
    // stub: auto-link behavior not available in this build
    return undefined
  }, [_args])
}
