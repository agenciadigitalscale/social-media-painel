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


/**
 * Status de destino quando uma peça é dada como finalizada — pelo botão do
 * Editor ou pela esteira que detecta o export na pasta Publicar. Os dois usam
 * esta função de propósito: destinos diferentes fariam o mesmo vídeo parar em
 * lugares distintos dependendo de quem chegou primeiro.
 */
export function destinoDaEntrega(_tp: ContentType): Status {
  // Esteira única (2026-09-28): TODA peça finalizada vai para a Revisão — quem
  // produz não aprova o próprio trabalho. Antes o Reel pulava direto para o 3.
  return 2
}

/** Rótulo da coluna de destino — para o texto do botão e da auditoria. */
export function nomeDoDestino(tp: ContentType): string {
  return destinoDaEntrega(tp) === 3 ? 'Aprovado' : 'Revisão'
}
