/* StreamPlayer — o player adaptativo do Cloudflare Stream.

   ── Por que existe ────────────────────────────────────────────────────
   Medido em 01/09/2026: o Android travou em 15 de 42 reproduções (36%),
   contra 7% no iOS. O cliente recebia o arquivo de edição — média de 87 MB,
   ~9 Mbps num Reel — e a conexão dele não sustenta isso. Não é buffer curto,
   é aritmética: o vídeo não baixa na velocidade em que toca.

   O mesmo vídeo transcodificado sai em cinco rendições, de 4,96 Mbps a
   **0,69 Mbps** (medido no primeiro arquivo real). Quando a conexão piora, o
   player cai de rendição e CONTINUA tocando em vez de travar.

   De quebra resolve o `.mov` — metade dos exports dos últimos 30 dias —, que
   o Android recusa antes de decodificar: o Stream entrega tudo em H.264/AAC
   via HLS, e o contêiner de origem deixa de importar.

   ── Por que o iframe e não um <video> com HLS ─────────────────────────
   Safari toca HLS nativo; Chrome e Firefox não. Um `<video src=manifest>`
   funcionaria só no iPhone — justamente o aparelho que NÃO tem o problema.
   Cobrir o resto exigiria hls.js, uma dependência de ~150 KB, e o manual do
   projeto pede para evitar biblioteca pesada.

   ── O que este componente protege ─────────────────────────────────────
   O `<video>` nativo alimentava três coisas que a tela precisa: as notas por
   segundo (comentário fixado no playhead), a liberação dos botões de decisão
   e o registro de travamentos. Um iframe cru mataria as três em silêncio.
   O SDK do Stream expõe os mesmos eventos, e é por isso que ele é carregado
   — não é enfeite.
*/
import { useEffect, useRef } from 'react'
import { Box } from '@mui/material'

interface JanelaStream {
  Stream?: (el: HTMLIFrameElement) => PlayerStream
}

interface PlayerStream {
  addEventListener: (evento: string, fn: () => void) => void
  removeEventListener: (evento: string, fn: () => void) => void
  play: () => Promise<void> | void
  pause: () => void
  currentTime: number
  readonly duration: number
}

const SDK_SRC = 'https://embed.cloudflarestream.com/embed/sdk.latest.js'

let carregandoSdk: Promise<void> | null = null

/** Carrega o SDK uma vez só, mesmo com vários players na mesma página. */
function carregarSdk(): Promise<void> {
  if ((window as unknown as JanelaStream).Stream) return Promise.resolve()
  if (carregandoSdk) return carregandoSdk
  carregandoSdk = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SDK_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { carregandoSdk = null; reject(new Error('SDK do Stream não carregou')) }
    document.head.appendChild(s)
  })
  return carregandoSdk
}

export interface StreamPlayerHandle {
  /** Playhead atual — é o ponto onde a próxima nota do cliente vai cair. */
  tempoAtual: () => number
  pausar: () => void
  irPara: (t: number) => void
}

interface Props {
  uid: string
  onPlaying?: () => void
  onTimeUpdate?: (atual: number, duracao: number) => void
  onEnded?: () => void
  onStalled?: () => void
  /** O player não conseguiu tocar — a tela cai no arquivo original. */
  onError?: () => void
  /** Entregue no mount para a tela poder ler o playhead e comandar o player. */
  aoMontar?: (h: StreamPlayerHandle) => void
}

export default function StreamPlayer({
  uid, onPlaying, onTimeUpdate, onEnded, onStalled, onError, aoMontar,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Os callbacks entram por ref para o efeito não reassinar os eventos a cada
  // render da tela — o viewer re-renderiza a cada `timeupdate`, e reassinar ali
  // desligaria e religaria os listeners 4 vezes por segundo.
  const cbs = useRef({ onPlaying, onTimeUpdate, onEnded, onStalled, onError, aoMontar })
  // Atualizado DEPOIS do render, não durante: mexer em `.current` no corpo do
  // componente é o que o React desaconselha, e o lint acusa.
  useEffect(() => {
    cbs.current = { onPlaying, onTimeUpdate, onEnded, onStalled, onError, aoMontar }
  })

  useEffect(() => {
    let vivo = true
    let player: PlayerStream | null = null
    const ouvintes: [string, () => void][] = []

    carregarSdk()
      .then(() => {
        if (!vivo || !iframeRef.current) return
        const api = (window as unknown as JanelaStream).Stream
        if (!api) { cbs.current.onError?.(); return }

        player = api(iframeRef.current)

        const liga = (evento: string, fn: () => void) => {
          player?.addEventListener(evento, fn)
          ouvintes.push([evento, fn])
        }

        liga('playing', () => cbs.current.onPlaying?.())
        liga('timeupdate', () => {
          if (player) cbs.current.onTimeUpdate?.(player.currentTime, player.duration || 0)
        })
        liga('ended', () => cbs.current.onEnded?.())
        // `waiting` é o mesmo evento que o <video> nativo usa para travamento.
        liga('waiting', () => cbs.current.onStalled?.())
        liga('error', () => cbs.current.onError?.())

        cbs.current.aoMontar?.({
          tempoAtual: () => player?.currentTime ?? 0,
          pausar: () => player?.pause(),
          irPara: (t: number) => { if (player) player.currentTime = t },
        })
      })
      .catch(() => { if (vivo) cbs.current.onError?.() })

    return () => {
      vivo = false
      for (const [evento, fn] of ouvintes) {
        try { player?.removeEventListener(evento, fn) } catch { /* iframe já foi */ }
      }
    }
  }, [uid])

  return (
    <Box
      component="iframe"
      ref={iframeRef}
      /* SEM `poster`. O parâmetro exige URL ABSOLUTA — passar a relativa
         `/api/thumb?...` fazia o player abrir com "poster value should be a
         valid encoded URL" em vez do vídeo, e só apareceu ao olhar a tela.
         Montar a absoluta seria possível, mas desnecessário: o Stream gera a
         própria miniatura do vídeo, que é a mesma imagem sem uma volta ao
         nosso servidor. */
      src={`https://iframe.cloudflarestream.com/${uid}?preload=metadata`}
      title="Criativo"
      allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
      allowFullScreen
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
    />
  )
}
