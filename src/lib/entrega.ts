/* lib/entrega.ts — para onde vai o card que acabou de ser finalizado.

   Quando o editor termina o vídeo, o trabalho seguinte é de Social Media:
   programar e enviar ao cliente. Até 2026-09-01 o card parava em "Revisão
   interna" (2) — uma etapa de aprovação da agência que, para vídeo, ninguém
   usava: o card sentava ali esperando um gesto que não vinha, e ainda exigia
   checklist antes de sair. Hoje o Reel vai direto para "Pronto p/ enviar" (3),
   que é a fila do board Social.

   Por que a regra olha o TIPO, em vez de valer para todo mundo: os boards
   Design e Feed não têm a coluna 3 (as colunas deles são [0,1,2,6,4,5,7]).
   Mandar uma arte para o status 3 a faria sumir do quadro de quem a produziu,
   sem aviso nenhum. Só o Reel — que é o que o board Vídeo mostra — tem para
   onde ir, porque o Social aceita qualquer tipo nas colunas dele.
*/
import type { ContentType, Status } from '../types'

/** Tipos cujo próximo dono, ao terminar, é o Social — e não a revisão interna. */
const VAI_PARA_O_SOCIAL: ContentType[] = ['Reel']

/**
 * Status de destino quando uma peça é dada como finalizada — pelo botão do
 * Editor ou pela esteira que detecta o export na pasta Publicar. Os dois usam
 * esta função de propósito: destinos diferentes fariam o mesmo vídeo parar em
 * lugares distintos dependendo de quem chegou primeiro.
 */
export function destinoDaEntrega(tp: ContentType): Status {
  return VAI_PARA_O_SOCIAL.includes(tp) ? 3 : 2
}

/** Rótulo da coluna de destino — para o texto do botão e da auditoria. */
export function nomeDoDestino(tp: ContentType): string {
  return destinoDaEntrega(tp) === 3 ? 'Pronto p/ enviar' : 'Revisão interna'
}
