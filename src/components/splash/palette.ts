/* palette.ts — as cores da tela de acesso.

   Esta é a CAPA da agência, não o produto. O manual do DS HUB proíbe laranja
   como acento dentro do painel; aqui o laranja é a marca (o foguete), e vale a
   mesma exceção que valia para o `LoginGate` (removido em 2026-09-01, quando
   os dois portões viraram um). Não trocar por azul do
   sistema achando que é resíduo do redesign.

   Direção (2026-09-01): saiu o preto quase puro, entrou **azul petróleo**. O
   fundo preto lia como "tela de terminal"; o petróleo lê como ambiente de
   operação — e dá profundidade para as camadas (fundo → painel → card → CTA)
   existirem de verdade, em vez de tudo ser a mesma caixa escura.

   O laranja ficou RESERVADO: CTA principal, foco, hover e alerta. Espalhado,
   ele vira decoração e o botão que importa deixa de saltar.
*/
export const CAPA = {
  /** Fundo da página — azul petróleo profundo. */
  fundo:        '#071522',
  /** Segundo tom do gradiente de fundo, um passo mais claro. */
  fundoAlto:    '#0A1D2B',
  /** Superfície do painel principal. */
  painel:       '#111C2A',
  /** Superfícies internas: cards, blocos do rodapé. */
  superficie:   '#162333',
  /** Um passo acima, para o avatar dentro do card. */
  superficieAlt:'#1C2C3E',

  t1:           '#F4F7FB',
  t2:           '#A9B6C9',
  /** Texto de apoio — usar só em rótulo curto, nunca em frase longa. */
  t3:           '#7C8CA3',

  borda:        'rgba(169,182,201,0.14)',
  bordaForte:   'rgba(169,182,201,0.24)',

  /** CTA, foco, hover, alerta — e nada mais. */
  laranja:      '#FF7A00',
  laranjaFundo: 'rgba(255,122,0,0.10)',
  laranjaBorda: 'rgba(255,122,0,0.32)',
  /** Segundo acento da marca (rastro do foguete). Detalhe, nunca área. */
  amarelo:      '#FFD54D',
  /** Online, sucesso, sincronizado. */
  verde:        '#2ECC71',
  /** Luz ambiente do canto inferior direito. Nunca vira cor de componente. */
  roxoAmbiente: '#4C4A9E',
} as const

/* Ruído fino em SVG, embutido como data URI: dá granulação sem requisição e
   sem canvas. `baseFrequency` alto = grão pequeno; opacidade baixa no CSS
   impede que vire textura de papel. */
export const RUIDO_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")"
