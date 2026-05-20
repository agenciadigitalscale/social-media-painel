import type { ContentItem, ContentType, ItemState, Roteiro } from '../types'

export function getWorkdays(year: number, month: number): Date[] {
  const days: Date[] = []
  const count = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= count; d++) {
    const date = new Date(year, month, d)
    if (date.getDay() !== 0) days.push(date)
  }
  return days
}

export function buildDistribution(
  clientName: string,
  roteiroList: Roteiro[],
  _existingCustomItems: ContentItem[],
  year: number,
  month: number,
): { newItems: ContentItem[]; newStates: Record<number, ItemState> } {
  if (!roteiroList.length) return { newItems: [], newStates: {} }

  const workdays = getWorkdays(year, month)
  const step = workdays.length / roteiroList.length
  const base = Date.now()

  const newItems: ContentItem[] = roteiroList.map((r, idx) => ({
    i: base + idx * 10_000,
    c: clientName,
    dt: new Date(workdays[Math.min(Math.floor(idx * step), workdays.length - 1)]),
    tp: r.type as ContentType,
    n: r.title,
    s: 0,
    custom: true,
  }))

  const newStates: Record<number, ItemState> = {}
  newItems.forEach((item, idx) => {
    newStates[item.i] = {
      status: 0,
      title: item.n,
      link: roteiroList[idx].driveLink ?? '',
      caption: '',
      notes: roteiroList[idx].notes ?? '',
    }
  })

  return { newItems, newStates }
}
