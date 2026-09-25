import { describe, it, expect } from 'vitest'
import { notifToPayload, type PushNotification } from '../../notifications'

/**
 * O payload do impedimento — o que chega no celular. Trava o formato: título com
 * o cliente, corpo com o card + o motivo, tag por item (para o push novo do mesmo
 * card SUBSTITUIR o anterior em vez de empilhar), e a aba de Produções.
 */
const base = { id: 'x', clientName: 'Chalés Alto da Represa', itemId: 42, itemTitle: 'Tour pelos chalés', ts: 0 }

describe('notifToPayload — impedimento', () => {
  it('mostra cliente no título e card + motivo no corpo', () => {
    const p = notifToPayload({ ...base, type: 'impediment', note: 'sem material na pasta' } as PushNotification)
    expect(p.title).toContain('Chalés Alto da Represa')
    expect(p.body).toContain('Tour pelos chalés')
    expect(p.body).toContain('sem material na pasta')
    expect(p.tab).toBe(4)
  })

  it('tag por item — push do mesmo card substitui o anterior', () => {
    const p = notifToPayload({ ...base, type: 'impediment', note: 'x' } as PushNotification)
    expect(p.tag).toBe('impediment-42')
  })

  it('sem motivo, o corpo é só o título do card', () => {
    const p = notifToPayload({ ...base, type: 'impediment' } as PushNotification)
    expect(p.body).toBe('Tour pelos chalés')
  })
})
