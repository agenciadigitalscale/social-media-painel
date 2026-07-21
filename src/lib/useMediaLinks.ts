import { useSyncExternalStore } from 'react'
import { getMediaLinks, subscribeMediaLinks, type MediaLinkMap } from './mediaLinks'

/**
 * Assina o registro de vínculos. Qualquer mudança de etapa (arquivo entrou ou
 * saiu da pasta Publicar, vínculo desfeito) repinta os cards sem recarregar.
 */
export function useMediaLinks(): MediaLinkMap {
  return useSyncExternalStore(subscribeMediaLinks, getMediaLinks, getMediaLinks)
}
