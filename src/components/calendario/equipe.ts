/* Peças comuns do Calendário: quem pode ser responsável e a ordem das etapas.
   As duas listas vêm das fontes do painel — cargo (lib/access) e status
   (STATUS_CONFIG) — para o Calendário nunca ter uma lista própria. */
import type { Status } from '../../types'
import { STATUS_CONFIG } from '../../types'
import { membrosDoCargo } from '../../lib/access'
import { NAME_MAP } from '../../lib/users'

/** Quem produz: editor, designers e sócios (os mesmos de "Trocar profissional" da Produção). */
export const RESPONSAVEIS: string[] = [...membrosDoCargo('editor'), ...membrosDoCargo('design'), ...membrosDoCargo('socio')]

export const nomeDe = (u: string) => NAME_MAP[u]?.fullName ?? u.charAt(0).toUpperCase() + u.slice(1)

/** As etapas da esteira, na ordem do fluxo (o 8 aposentado fica de fora). */
export const ETAPAS_CONTEUDO = [0, 1, 2, 6, 3, 4, 5, 9, 7].filter(s => STATUS_CONFIG[s as Status]) as Status[]
