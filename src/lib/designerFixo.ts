import type { ContentType } from '../types'

/*
  Designer fixo por cliente (2026-11-03, pedido do dono: "fenix, aventur e
  katia só o julio faz"). Card NOVO que não é vídeo, desses clientes, nasce na
  gaveta de Design do designer — sem ninguém precisar escolher. Escolha feita na
  criação (responsável ou gaveta) vence: quem escolhe está corrigindo a regra.
  Não mexe em card que já existe.
*/
const DESIGNER_DO_CLIENTE: { padrao: RegExp; designer: string }[] = [
  { padrao: /f[eê]nix/i,    designer: 'julio' },
  { padrao: /aventur/i,     designer: 'julio' },
  { padrao: /k[aá]tia/i,    designer: 'julio' },
]

export function designerFixo(cliente: string, tipo: ContentType): string | null {
  if (tipo === 'Reel') return null
  return DESIGNER_DO_CLIENTE.find(r => r.padrao.test(cliente))?.designer ?? null
}
