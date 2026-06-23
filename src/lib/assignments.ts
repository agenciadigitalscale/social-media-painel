// Fila de atribuições pendentes — persiste em localStorage por usuário

export interface PendingAssignment {
  id: string
  for: string        // username key (ex: 'arthur')
  from: string       // quem atribuiu (ex: 'kaique')
  itemId: number
  itemTitle: string
  clientName: string
  itemType: string
  timestamp: number
}

const KEY = 'sm_pending_assignments'

function load(): PendingAssignment[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function save(list: PendingAssignment[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function addAssignment(a: PendingAssignment) {
  const current = load()
  // Evita duplicatas para o mesmo item + usuário
  const deduped = current.filter(x => !(x.for === a.for && x.itemId === a.itemId))
  save([...deduped, a])
}

export function getAssignmentsForUser(username: string): PendingAssignment[] {
  return load().filter(a => a.for === username.toLowerCase())
}

export function dismissAssignment(id: string) {
  save(load().filter(a => a.id !== id))
}

export function dismissAllForUser(username: string) {
  save(load().filter(a => a.for !== username.toLowerCase()))
}
