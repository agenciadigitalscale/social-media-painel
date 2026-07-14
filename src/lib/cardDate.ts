import type { ContentItem, ItemState } from '../types'

// Regra única da data exibida nos cards de Produção:
// mostra a data de ENTREGA (prazo interno) quando ela existe E o item ainda não
// foi aprovado pelo cliente (status 5) nem publicado (status 7). Nesses dois
// estados — e no Calendário — vale a data de POSTAGEM.
export function shouldShowDelivery(state?: Pick<ItemState, 'deliveryDate' | 'status'> | null): boolean {
  return !!state?.deliveryDate && state.status !== 5 && state.status !== 7
}

export function cardDisplayDate(item: ContentItem, state?: ItemState | null): Date {
  return shouldShowDelivery(state) ? new Date(state!.deliveryDate!) : new Date(item.dt)
}
