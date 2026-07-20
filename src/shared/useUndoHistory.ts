import { useCallback, useEffect, useRef } from 'react'
import { syncToCloud } from '../lib/storage'

// Desfazer/refazer universal por snapshot: cada campo é um pedaço do estado global
// (states, customItems, deletedIds…). O hook observa as referências a cada render e,
// quando uma delas muda por ação do usuário, empilha o estado ANTERIOR. Ctrl+Z restaura.
//
// Escritas vindas do servidor (applyRemoteSync) NÃO devem virar passo de undo — por isso
// o App chama markExternal() antes de aplicar dados remotos: o próximo diff é ignorado.

export interface UndoField {
  key: string                                   // chave de localStorage
  value: unknown                                // valor React atual (referência)
  set: (v: never) => void                       // setter React
  serialize?: (v: never) => unknown             // transformação antes de gravar (ex.: datas)
}

type Snapshot = Record<string, unknown>

interface Options {
  limit?: number
  onUndo?: () => void
  onRedo?: () => void
  onNothing?: () => void   // pilha vazia — nada a desfazer/refazer
}

export function useUndoHistory(fields: UndoField[], opts: Options = {}) {
  const limit = opts.limit ?? 60
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields
  const optsRef = useRef(opts)
  optsRef.current = opts

  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])
  const baseline = useRef<Snapshot | null>(null)
  const skipNext = useRef(false)

  const snap = (): Snapshot => {
    const s: Snapshot = {}
    for (const f of fieldsRef.current) s[f.key] = f.value
    return s
  }

  // Grava histórico. Sem deps: roda a cada render, só faz comparações de referência (barato).
  useEffect(() => {
    const current = snap()
    if (baseline.current === null) { baseline.current = current; return }
    const changed = fieldsRef.current.some(f => baseline.current![f.key] !== f.value)
    if (!changed) { if (skipNext.current) skipNext.current = false; return }
    if (skipNext.current) { skipNext.current = false; baseline.current = current; return }
    undoStack.current.push(baseline.current)
    if (undoStack.current.length > limit) undoStack.current.shift()
    redoStack.current = []
    baseline.current = current
  })

  const apply = useCallback((target: Snapshot) => {
    skipNext.current = true
    for (const f of fieldsRef.current) {
      const v = target[f.key]
      f.set(v as never)
      const toStore = f.serialize ? f.serialize(v as never) : v
      try { localStorage.setItem(f.key, JSON.stringify(toStore)) } catch { /* quota */ }
      syncToCloud(f.key, toStore)
    }
    // baseline é atualizado pelo effect (que consome skipNext) — não mexer aqui.
  }, [])

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) { optsRef.current.onNothing?.(); return false }
    redoStack.current.push(snap())
    apply(undoStack.current.pop()!)
    optsRef.current.onUndo?.()
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply])

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) { optsRef.current.onNothing?.(); return false }
    undoStack.current.push(snap())
    apply(redoStack.current.pop()!)
    optsRef.current.onRedo?.()
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply])

  // Marca que a próxima mudança de estado veio de fora (sync do servidor / poll) e não
  // deve virar passo de undo. O setTimeout é uma rede de segurança: se a mudança externa
  // for um no-op (setState que devolve o mesmo estado, sem re-render), o effect nunca roda
  // e a flag ficaria pendurada, engolindo a PRÓXIMA ação real do usuário. O timeout zera a
  // flag no fim do ciclo — os passive effects rodam antes dele, então o skip legítimo ainda
  // acontece; o pior caso é uma mudança de fundo virar undo (inócuo), nunca perder uma ação.
  const markExternal = useCallback(() => {
    skipNext.current = true
    setTimeout(() => { skipNext.current = false }, 0)
  }, [])

  return { undo, redo, markExternal }
}
