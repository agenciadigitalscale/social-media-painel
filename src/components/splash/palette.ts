/* palette.ts — as cores da tela de acesso.

   Esta é a CAPA da agência, não o produto. O manual do DS HUB proíbe laranja
   como acento dentro do painel; aqui o laranja é a marca (o foguete), e vale a
   mesma exceção que valia para o `LoginGate` (removido em 2026-09-01, quando
   os dois portões viraram um). Não trocar por azul do
   sistema achando que é resíduo do redesign.

   2026-09-28: o fundo voltou ao GRAFITE — a mesma base do Painel de Tráfego e
   do painel inteiro, que adotou a identidade laranja. O parágrafo abaixo é
   histórico.

   Direção (2026-09-01): saiu o preto quase puro, entrou **azul petróleo**. O
   fundo preto lia como "tela de terminal"; o petróleo lê como ambiente de
   operação — e dá profundidade para as camadas (fundo → painel → card → CTA)
   existirem de verdade, em vez de tudo ser a mesma caixa escura.

   O laranja ficou RESERVADO: CTA principal, foco, hover e alerta. Espalhado,
   ele vira decoração e o botão que importa deixa de saltar.
*/
export const CAPA = {
  /** Fundo da página — grafite (o mesmo do Painel de Tráfego). */
  fundo:        '#090A0D',
  /** Segundo tom do gradiente de fundo, um passo mais claro. */
  fundoAlto:    '#0E1015',
  /** Superfície do painel principal. */
  painel:       '#101217',
  /** Superfícies internas: cards, blocos do rodapé. */
  superficie:   '#15181F',
  /** Um passo acima, para o avatar dentro do card. */
  superficieAlt:'#1B1F27',

  t1:           '#F7F7F5',
  t2:           '#A2A8B2',
  /** Texto de apoio — usar só em rótulo curto, nunca em frase longa. */
  t3:           '#8A909C',

  borda:        'rgba(146,152,165,0.16)',
  bordaForte:   'rgba(146,152,165,0.28)',

  /** CTA, foco, hover, alerta — e nada mais. */
  laranja:      '#FF7A00',
  laranjaFundo: 'rgba(255,122,0,0.10)',
  laranjaBorda: 'rgba(255,122,0,0.32)',
  /** Segundo acento da marca (rastro do foguete). Detalhe, nunca área. */
  amarelo:      '#FFD400',
  /** Online, sucesso, sincronizado. */
  verde:        '#2ECC71',
  /** Luz ambiente do canto inferior direito (âmbar escuro; nome legado). Nunca vira cor de componente. */
  roxoAmbiente: '#5A3208',
} as const

/* Ruído fino em SVG, embutido como data URI: dá granulação sem requisição e
   sem canvas. `baseFrequency` alto = grão pequeno; opacidade baixa no CSS
   impede que vire textura de papel. */
export const RUIDO_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")"
