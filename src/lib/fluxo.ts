/**
 * A esteira única (2026-09-28) — quem pode mover o card de qual etapa para qual.
 *
 * Uma demanda = um card = um histórico. Os quadros são VISÕES do mesmo card:
 *
 *   Produção:    A fazer (0) → Em produção (1) → Revisão (2) ⇄ Ajuste (6) → Aprovado (3)
 *   Programação: Aprovado (3) → Enviado ao cliente (4) → Aprovado pelo cliente (5)
 *                → Programado (9) → Publicado (7)
 *
 * Quem produz (Editor, Designer) leva o card até a Revisão e trabalha os
 * Ajustes — mas NÃO aprova o próprio trabalho nem pula etapa. Revisão,
 * Programação e publicação são de Social Media e Sócios.
 *
 * Usado pela tela (App.setStatus, que toda mudança de status atravessa) e pelo
 * servidor (_lib/access-policy), para a regra não depender só do navegador.
 * Sem efeito colateral: só importa o cargo.
 */
import type { Status } from '../types'
import { cargoDe } from './access'

/** Movimentos permitidos a quem produz: `de → [para]`. */
const MOVIMENTOS_DE_QUEM_PRODUZ: Partial<Record<Status, Status[]>> = {
  0: [1],          // pegar para produzir
  1: [0, 2],       // devolver para "a fazer" ou enviar para Revisão
  6: [1, 2],       // trabalhar o ajuste e devolver para Revisão
  8: [2],          // "Pronto" aposentado — só pode seguir para a Revisão
}

/**
 * Este usuário pode mover o card de `de` para `para`?
 *
 * Sem usuário (automação, página pública) não há regra de cargo a aplicar:
 * quem barra esses caminhos é o servidor de cada um.
 */
export function podeMover(user: string | null | undefined, de: Status, para: Status): boolean {
  if (de === para) return true
  if (!user) return true
  const cargo = cargoDe(user)
  if (cargo === 'socio' || cargo === 'social') return true
  if (cargo === 'editor' || cargo === 'design') return (MOVIMENTOS_DE_QUEM_PRODUZ[de] ?? []).includes(para)
  return false
}

/** Por que não pode — a frase que aparece para a pessoa, em vez de "nada acontece". */
export function motivoDoBloqueio(user: string | null | undefined, de: Status, para: Status): string {
  const cargo = cargoDe(user)
  if (cargo === 'copy') return 'A movimentação dos cards é do Social Media — sua esteira é a de Roteiros.'
  if (de === 2) return 'O card está em Revisão: agora quem aprova ou pede ajuste é a revisão.'
  if (para === 3 || para === 6) return 'Só a revisão (Social Media) aprova ou devolve para ajuste.'
  if (para === 4 || para === 5 || para === 9 || para === 7) return 'Programar, enviar ao cliente e publicar é com o Social Media.'
  return 'Essa etapa é do Social Media.'
}
