import { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, Button, TextField, CircularProgress,
  Alert, ThemeProvider, CssBaseline, Paper, Chip,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import theme, { typeColor, DS } from '../theme'
import { DATA, DATA_JULHO } from '../data'
import type { ContentItem, ItemState, ContentType } from '../types'
import { classifyCreativeLink, isVideoFile, type CreativeFile } from '../lib/creativeLink'
import { CreativeCarousel, CreativeImage } from '../shared/ui/CreativeMedia'
import StreamPlayer, { type StreamPlayerHandle } from '../shared/ui/StreamPlayer'

type VideoSource =
  | { type: 'drive';      fileId: string;  embedUrl: string; thumbUrl: string }
  | { type: 'streamable'; videoId: string; embedUrl: string; thumbUrl: string }
  | { type: 'none' }

/**
 * De onde sai o que o cliente vê.
 *
 * A classificação do link virou uma só (`lib/creativeLink`), compartilhada com
 * a revisão interna e com a conferência de envio: havia três cópias de
 * `extractDriveFileId` e nenhuma delas conhecia link de PASTA — que é como a
 * agência entrega carrossel. Pasta cai no `type: 'none'` aqui de propósito; o
 * conteúdo dela é resolvido pelo `/api/creative-set`, que sabe olhar dentro.
 */
function resolveVideoSource(link: string): VideoSource {
  const c = classifyCreativeLink(link)
  if (c.kind === 'streamable' && c.id) return {
    type: 'streamable',
    videoId: c.id,
    embedUrl: `https://streamable.com/e/${c.id}`,
    thumbUrl: `https://cdn-cf-east.streamable.com/image/${c.id}.jpg`,
  }
  if (c.kind === 'file' && c.id) return {
    type: 'drive',
    fileId: c.id,
    embedUrl: `https://drive.google.com/file/d/${c.id}/preview`,
    thumbUrl: `https://drive.google.com/thumbnail?id=${c.id}&sz=w800`,
  }
  return { type: 'none' }
}

/**
 * Por que a pasta do criativo não abriu. Cada um pede uma frase diferente na
 * tela do cliente — e, mais importante, uma AÇÃO diferente da agência:
 * `vazia` é reanexar, `ilegivel` é compartilhar a pasta, `rede` é tentar de novo.
 */
type MotivoPasta = 'vazia' | 'ilegivel' | 'rede'

/** Conteúdo do calendário — já vem no bundle, não custa rede. */
const SEEDED_ITEMS: ContentItem[] = [...DATA, ...DATA_JULHO]

/**
 * Registra o que aconteceu na tela do cliente. Silencioso: nunca atrapalha.
 *
 * O `player` diz qual dos dois gerou o evento, e sem ele o registro não
 * respondia a pergunta que importa: a transcodificação ajudou? Os dois contam
 * "travou" de formas diferentes — o `<video>` nativo quando o download não
 * acompanha, o HLS a cada troca de rendição, que é o mecanismo que EVITA a
 * parada. Comparar os dois como a mesma coisa fazia o player adaptativo
 * parecer pior justamente quando estava funcionando.
 */
function logViewer(
  token: string,
  itemId: number,
  event: 'opened' | 'playing' | 'stalled' | 'error' | 'fallback' | 'download' | 'ended',
  detail?: string,
  player?: 'stream' | 'arquivo',
) {
  try {
    fetch('/api/viewer-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, itemId, event, detail, player, platform: navigator.userAgent }),
      keepalive: true,
    }).catch(() => {})
  } catch { /* nunca quebrar a tela por causa de log */ }
}

// Segundos → "M:SS" para ancorar o ajuste no ponto do vídeo.
function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

// Imagem de Post/Feed/Story/Carrossel: tenta várias fontes do Drive em cadeia
// (a thumbnail w1600 falha bastante e deixava a tela preta), com carregando,
// fallback claro e toque pra ampliar/ler o post.
interface Props {
  token: string
  itemId: number
}

export default function CreativeViewer({ token, itemId }: Props) {
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [clientName, setClientName] = useState('')
  const [item, setItem]         = useState<ContentItem | null>(null)
  const [link, setLink]         = useState('')
  const [title, setTitle]       = useState('')
  const [caption, setCaption]   = useState('')
  const [capExpanded, setCapExpanded] = useState(false)
  const [existingFeedback, setExistingFeedback] = useState<{ approved: boolean; text: string } | null>(null)

  const [rejectMode, setRejectMode]   = useState(false)
  const [rejectText, setRejectText]   = useState('')
  const [rejectError, setRejectError] = useState('')
  // Comentários ancorados no segundo do vídeo (estilo Frame.io). O ponto do
  // próximo comentário é sempre o playhead atual (videoCurrent).
  const [notes, setNotes] = useState<{ t: number; text: string }[]>([])
  const [submitting, setSubmitting]   = useState(false)
  const [done, setDone]               = useState(false)
  const [doneApproved, setDoneApproved] = useState(false)
  const [btnPressed, setBtnPressed]   = useState<'approve' | 'reject' | null>(null)
  const [videoNativeError, setVideoNativeError] = useState(false)
  // Muda a key do <video> para forçar um carregamento novo no "tentar de novo" —
  // sem isso o elemento fica com o erro anterior grudado e nada acontece.
  const [videoRetry, setVideoRetry] = useState(0)
  /** Chegou ao fim: hora de oferecer o arquivo, não antes. */
  const [videoFinished, setVideoFinished] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Resolvido cedo para que o timer possa usar videoSource.type
  const videoSource = resolveVideoSource(link)
  // Somente Reels têm vídeo — Posts/Feed/Story/Carrossel são imagens
  const isVideo = item?.tp === 'Reel'

  // ── Pasta do Drive: o link sozinho não diz o que tem dentro ──────────────
  // Quem olha dentro é o `/api/creative-set`, com a conta de serviço e a
  // validação de dono. Sem isto o carrossel não abria de jeito nenhum: eram
  // 40 das 47 falhas registradas na última semana.
  const linkKind = classifyCreativeLink(link).kind
  /* O MOTIVO da falha viaja junto, e não é detalhe.
     O registro já separava "pasta vazia" de "pasta ilegível" — mas a TELA DO
     CLIENTE mostrava a mesma frase para os dois, e ela era "O criativo ainda
     não foi anexado". No caso da pasta esvaziada depois de publicar isso é
     mentira: o criativo foi anexado, entregue e aprovado; a pasta é que foi
     arquivada. O cliente lia que a agência não tinha feito o trabalho e ligava
     cobrando algo que já estava pronto. */
  const [pasta, setPasta] = useState<{
    estado: 'vazio' | 'carregando' | 'ok' | 'falhou'
    files: CreativeFile[]
    motivo?: MotivoPasta
  }>({ estado: 'vazio', files: [] })
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    if (linkKind !== 'folder') { setPasta({ estado: 'vazio', files: [] }); return }
    let vivo = true
    setPasta({ estado: 'carregando', files: [] })
    setSlide(0)

    fetch(`/api/creative-set?token=${encodeURIComponent(token)}&itemId=${itemId}`)
      .then(r => r.json())
      .then((r: { ok?: boolean; files?: CreativeFile[]; error?: string }) => {
        if (!vivo) return
        if (r.ok && r.files && r.files.length > 0) {
          setPasta({ estado: 'ok', files: r.files })
          return
        }
        setPasta({ estado: 'falhou', files: [], motivo: r.ok ? 'vazia' : 'ilegivel' })
        // Detalhe separado de propósito: "pasta vazia" é problema de quem
        // montou a entrega; "pasta ilegível" é permissão do Drive. As duas
        // pedem ações diferentes, e a aba Entregas mostra o texto cru.
        logViewer(token, itemId, 'error', r.ok
          ? 'pasta do Drive sem criativo dentro'
          : 'pasta do Drive ilegível pela agência')
      })
      .catch(() => {
        if (!vivo) return
        setPasta({ estado: 'falhou', files: [], motivo: 'rede' })
        logViewer(token, itemId, 'error', 'pasta do Drive: falha de rede ao listar')
      })

    return () => { vivo = false }
  }, [linkKind, token, itemId])

  /**
   * O que vai para a tela, decidido pelo ARQUIVO e não pelo tipo do card.
   *
   * Numa pasta o tipo do card ("POST", "VIDEO") é palpite: quem sabe se é vídeo
   * ou carrossel é o conteúdo. Fora dela o comportamento antigo continua —
   * arquivo único de Reel é vídeo, o resto é imagem.
   */
  const midia = (():
    | { tipo: 'video'; fileId: string }
    | { tipo: 'imagens'; arquivos: CreativeFile[] }
    | { tipo: 'streamable' }
    | { tipo: 'carregando' }
    | { tipo: 'nenhum'; motivo?: MotivoPasta } => {
    if (videoSource.type === 'streamable') return { tipo: 'streamable' }

    if (linkKind === 'folder') {
      if (pasta.estado === 'carregando') return { tipo: 'carregando' }
      const videos  = pasta.files.filter(isVideoFile)
      const imagens = pasta.files.filter(f => !isVideoFile(f))
      // Pasta com imagens é carrossel, mesmo tendo um vídeo de bastidor junto.
      if (imagens.length > 0 && !(isVideo && videos.length > 0)) return { tipo: 'imagens', arquivos: imagens }
      if (videos.length > 0) return { tipo: 'video', fileId: videos[0].id }
      if (imagens.length > 0) return { tipo: 'imagens', arquivos: imagens }
      return { tipo: 'nenhum', motivo: pasta.motivo }
    }

    if (videoSource.type === 'drive') {
      return isVideo
        ? { tipo: 'video', fileId: videoSource.fileId }
        : { tipo: 'imagens', arquivos: [{ id: videoSource.fileId, name: title, mimeType: '' }] }
    }

    // Link de fora do Drive (ou nenhum): o `PostImage` sabe tentar o link cru e
    // avisar direito quando não há nada anexado.
    return isVideo ? { tipo: 'nenhum' } : { tipo: 'imagens', arquivos: [] }
  })()

  /** O arquivo que o botão "baixar" deve entregar — a lâmina que está na tela. */
  const arquivoAtual = midia.tipo === 'video'
    ? { id: midia.fileId, kind: 'video' as const }
    : midia.tipo === 'imagens' && midia.arquivos.length > 0
      ? { id: (midia.arquivos[Math.min(slide, midia.arquivos.length - 1)]).id, kind: 'image' as const }
      : null

  // ── Lock — botões de decisão liberam quando o cliente já viu o essencial ──
  // Não exigimos o vídeo inteiro (num Reel de 60s prender o dedo por 60s irrita
  // no celular): libera a 90% OU 15s, o que vier primeiro. Vídeo nativo (Drive)
  // reflete a duração real na barra; streamable/iframe (sem evento) cai no timer.
  const UNLOCK_AFTER = 15
  const [watchSeconds,    setWatchSeconds]    = useState(0)
  const [videoCurrent,    setVideoCurrent]    = useState(0)
  const [videoDuration,   setVideoDuration]   = useState(0)
  const [buttonsUnlocked, setButtonsUnlocked] = useState(false)
  const [justUnlocked,    setJustUnlocked]    = useState(false)
  const videoElRef = useRef<HTMLVideoElement>(null)
  /* UID do Cloudflare Stream, quando o vídeo já foi transcodificado. Vem do
     /api/portal, que só o devolve com o estado 'ready' — entregar o player de
     um vídeo ainda em transcodificação mostraria tela preta, que é pior que o
     arquivo original pesado. */
  const [streamUid, setStreamUid] = useState<string | null>(null)
  const streamRef = useRef<StreamPlayerHandle | null>(null)
  /* O player do Stream vive num iframe de outra origem: não dá para ler o
     playhead direto do elemento. O tempo chega pelo evento e mora aqui. */
  const streamTimeRef = useRef(0)

  /**
   * Engasgo do vídeo — o sinal que faltava.
   *
   * Uma cliente reclamou que "nunca carrega" e o registro mostrava `opened` +
   * `playing`, sem erro nenhum: o vídeo começava e travava por falta de dados
   * (83,6 MB para 46 s ≈ 15 Mbps). Como nada falhava, o painel a marcava como
   * quem assistiu — verde, enquanto ela sofria.
   *
   * Duas travas, e as duas são necessárias:
   *  - **`played`**: o `waiting` dispara também no buffer inicial, antes do
   *    primeiro quadro. Isso não é engasgo, é o vídeo começando.
   *  - **teto e intervalo**: o registro é uma fila de 300 eventos para TODOS os
   *    clientes. Um vídeo travando de segundo em segundo despejaria dezenas de
   *    eventos e apagaria o histórico de todo mundo — justamente no dia em que
   *    ele seria mais útil.
   */
  const stallRef = useRef({ played: false, count: 0, lastAt: 0 })
  const MAX_STALLS = 3
  const STALL_GAP_MS = 10_000

  const noteStall = () => {
    const s = stallRef.current
    if (!s.played) return
    if (s.count >= MAX_STALLS) return
    const now = Date.now()
    if (now - s.lastAt < STALL_GAP_MS) return
    s.count += 1
    s.lastAt = now
    logViewer(token, itemId, 'stalled', `travou ${s.count}x`, playerAtual())
  }

  const unlockButtons = () => {
    setButtonsUnlocked(true)
    setJustUnlocked(true)
    setTimeout(() => setJustUnlocked(false), 1200)
  }

  /**
   * Assistiu até o fim.
   *
   * É o momento em que o cliente decidiu que gostou — e é aí que ele quer o
   * arquivo para publicar. Antes disso a oferta de download é ruído: ele ainda
   * está avaliando. O botão continua existindo o tempo todo logo abaixo; o que
   * muda aqui é ele deixar de ser discreto.
   */
  const handleVideoEnded = () => {
    unlockButtons()
    if (!videoFinished) {
      setVideoFinished(true)
      logViewer(token, itemId, 'ended', undefined, playerAtual())
    }
  }

  // Fallback por tempo — só quando não há evento de tempo confiável (Streamable/iframe):
  // conta desde que a tela abre (o vídeo aparece direto, sem abertura).
  const needsTimerFallback = videoSource.type === 'streamable' || videoNativeError
  useEffect(() => {
    if (!needsTimerFallback || buttonsUnlocked) return
    const id = setInterval(() => {
      setWatchSeconds(s => {
        const next = s + 1
        if (next >= UNLOCK_AFTER) { clearInterval(id); unlockButtons() }
        return Math.min(next, UNLOCK_AFTER)
      })
    }, 1000)
    return () => clearInterval(id)
  }, [needsTimerFallback, buttonsUnlocked])

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget
    if (v.duration && !videoDuration) setVideoDuration(v.duration)
    setVideoCurrent(v.currentTime)
    if (buttonsUnlocked) return
    // Viu o essencial: 90% do vídeo ou 15s (o que vier primeiro).
    if (v.duration && (v.currentTime >= v.duration * 0.9 || v.currentTime >= UNLOCK_AFTER)) unlockButtons()
  }


  useEffect(() => {
    const load = async () => {
      try {
        // Um pedido, só deste criativo. Antes eram dois — e o segundo era o
        // `/api/sync` inteiro: 748 KB com o estado de TODOS os clientes, o
        // financeiro e as inscrições de push, baixados no 4G do cliente antes de
        // qualquer pixel aparecer. Lento onde a conexão é ruim e vazando o resto.
        const res = await fetch(`/api/portal?token=${token}&itemId=${itemId}`)
        const portalRes = await res.json() as {
          ok: boolean
          error?: string
          clientName?: string
          item?: { id: number; title: string; caption: string; link: string; type: string | null; date: string | null; known: boolean; streamUid?: string | null }
          feedback?: { approved: boolean; text: string } | null
        }

        if (!portalRes.ok || !portalRes.item) {
          setError(portalRes.error === 'Deleted'
            ? 'Este conteúdo não está mais disponível. Fale com a agência.'
            : 'Link inválido ou expirado. Solicite um novo link à agência.')
          setLoading(false)
          return
        }

        const { item: remote } = portalRes
        setClientName(portalRes.clientName ?? '')
        setLink(remote.link)
        setCaption(remote.caption)
        if (portalRes.feedback) setExistingFeedback(portalRes.feedback)

        // Conteúdo do calendário já vem no bundle desta página — não precisa de rede.
        const seeded = SEEDED_ITEMS.find(i => i.i === itemId)
        const base: ContentItem | null = seeded ?? (remote.known ? {
          i: itemId,
          c: portalRes.clientName ?? '',
          dt: remote.date ? new Date(remote.date) : new Date(),
          tp: (remote.type as ContentType) ?? 'Post',
          n: remote.title,
          s: 0,
        } : null)

        if (!base) {
          setError('Conteúdo não encontrado.')
          setLoading(false)
          return
        }

        setItem({
          ...base,
          ...(remote.type ? { tp: remote.type as ContentType } : {}),
          ...(remote.title ? { n: remote.title } : {}),
          dt: remote.date ? new Date(remote.date) : base.dt,
        })
        setTitle(remote.title || base.n)
        setStreamUid(portalRes.item.streamUid ?? null)
        /* O player sai da RESPOSTA, não do estado: `setStreamUid` ainda não
           re-renderizou aqui, então `playerAtual()` responderia sobre a tela
           anterior. */
        logViewer(token, itemId, 'opened', undefined,
          portalRes.item.streamUid ? 'stream' : 'arquivo')

      } catch {
        setError('Erro de conexão. Verifique sua internet.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, itemId])

  /* Está tocando pelo Stream? Se sim, o `<video>` nem existe na árvore. */
  const usandoStream = () => midia.tipo === 'video' && !!streamUid && !videoNativeError

  /* Qual player o cliente está usando NESTE momento. Sai da mesma condição que
     decide o que é renderizado — derivar de outro lugar deixaria o registro
     discordar da tela, e um registro que discorda da tela é pior que nenhum.
     Vazio quando não é vídeo: em imagem "player" não quer dizer nada. */
  const playerAtual = (): 'stream' | 'arquivo' | undefined =>
    midia.tipo !== 'video' ? undefined : usandoStream() ? 'stream' : 'arquivo'

  const hasNativeVideo = () => {
    const v = videoElRef.current
    return !!(v && midia.tipo === 'video' && !videoNativeError && Number.isFinite(v.currentTime))
  }

  /* Dá para marcar comentário no tempo? Vale para os DOIS players.
     Sem isto, ligar o Stream desligaria as notas por segundo em silêncio —
     o comentário passaria a cair sempre no 0:00 e ninguém entenderia. */
  const temPlayhead = () => usandoStream() || hasNativeVideo()

  // Ponto onde o próximo comentário vai cair = playhead atual.
  const pointNow = () => {
    if (usandoStream()) return streamRef.current?.tempoAtual() ?? streamTimeRef.current
    return hasNativeVideo() ? (videoElRef.current?.currentTime ?? 0) : 0
  }

  // Pedir ajuste: pausa o vídeo (o ponto fica fixo enquanto escreve).
  const enterRejectMode = () => {
    if (usandoStream()) streamRef.current?.pausar()
    else if (hasNativeVideo()) videoElRef.current?.pause()
    setRejectMode(true)
  }

  // Pula o vídeo para um ponto já comentado.
  const seekTo = (t: number) => {
    if (usandoStream()) {
      streamRef.current?.irPara(t)
      streamRef.current?.pausar()
      setVideoCurrent(t)
      return
    }
    const v = videoElRef.current
    if (hasNativeVideo() && v) { v.currentTime = t; setVideoCurrent(t); v.pause() }
  }

  // Fixa o comentário atual no playhead e limpa o campo pra comentar em outro ponto.
  const addNote = () => {
    const text = rejectText.trim()
    if (!text) return
    setNotes(prev => [...prev, { t: pointNow(), text }].sort((a, b) => a.t - b.t))
    setRejectText('')
  }

  const submitFeedback = async (approved: boolean) => {
    if (!approved && notes.length === 0 && !rejectText.trim()) {
      setRejectError('Descreva o que deve ser alterado para enviar a solicitação.')
      return
    }
    setSubmitting(true)
    // Junta os comentários fixados + o rascunho ainda no campo, cada um no seu ponto.
    const all = [...notes]
    const draft = rejectText.trim()
    if (draft) all.push({ t: pointNow(), text: draft })
    all.sort((a, b) => a.t - b.t)
    const anchored = approved ? '' : all
      .map(n => n.t > 0 ? `⏱️ ${fmtTime(n.t)} · ${n.text}` : n.text)
      .join('\n')
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feedback', token, itemId, approved, text: anchored }),
      }).then(r => r.json())
      if (res.ok) {
        setDone(true)
        setDoneApproved(approved)
      } else {
        setRejectError('Erro ao enviar. Tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fileId = videoSource.type === 'drive' ? videoSource.fileId : null

  if (loading) return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: 'background.default', flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="primary" size={36} />
        <Typography color="text.secondary" sx={{ fontSize: '0.8rem' }}>Carregando criativo...</Typography>
      </Box>
    </ThemeProvider>
  )

  if (error || !item) return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: 'background.default', p: 3, flexDirection: 'column', gap: 3 }}>
        <Box component="img" src="/logotipo.png" sx={{ height: 40, opacity: 0.8 }} />
        <Alert severity="error" sx={{ maxWidth: 420, width: '100%' }}>{error || 'Conteúdo não encontrado.'}</Alert>
      </Box>
    </ThemeProvider>
  )

  if (done) {
    const accent  = doneApproved ? DS.green : DS.red
    const accent2 = doneApproved ? '#00ff99' : DS.redSoft
    const bgGrad  = doneApproved
      ? 'radial-gradient(ellipse at 50% 30%, #021a0e 0%, #030f08 35%, #020810 55%, #05030d 80%, #010203 100%)'
      : 'radial-gradient(ellipse at 50% 30%, #1a0202 0%, #0f0303 35%, #100208 55%, #0d0305 80%, #020101 100%)'

    const smokeItems = [
      { left: '18%', size: 52, delay: 0,    dur: 3.2 },
      { left: '32%', size: 36, delay: 0.6,  dur: 2.8 },
      { left: '48%', size: 60, delay: 1.1,  dur: 3.6 },
      { left: '62%', size: 40, delay: 0.3,  dur: 3.0 },
      { left: '76%', size: 48, delay: 0.9,  dur: 2.6 },
      { left: '25%', size: 28, delay: 1.5,  dur: 4.0 },
      { left: '70%', size: 32, delay: 1.8,  dur: 3.4 },
    ]

    return (
      <ThemeProvider theme={theme}><CssBaseline />
        <Box sx={{
          position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', flexDirection: 'column', gap: 2.5, textAlign: 'center',
          px: 3,
          background: bgGrad,

          '@keyframes floatLogo': {
            '0%,100%': { transform: 'translateY(0px) rotateY(0deg) rotateX(0deg)' },
            '25%':     { transform: 'translateY(-14px) rotateY(6deg) rotateX(3deg)' },
            '75%':     { transform: 'translateY(-8px) rotateY(-6deg) rotateX(-3deg)' },
          },
          '@keyframes smokeUp': {
            '0%':   { transform: 'translateY(0) scale(0.6)', opacity: 0.55 },
            '100%': { transform: 'translateY(-280px) scale(2.5)', opacity: 0 },
          },
          '@keyframes glowPulse': {
            '0%,100%': { opacity: 0.5 },
            '50%':     { opacity: 1 },
          },
          '@keyframes checkPop': {
            '0%':   { transform: 'scale(0) rotate(-20deg)', opacity: 0 },
            '65%':  { transform: 'scale(1.25) rotate(5deg)' },
            '82%':  { transform: 'scale(0.92) rotate(-2deg)' },
            '100%': { transform: 'scale(1) rotate(0deg)', opacity: 1 },
          },
          '@keyframes textAppear': {
            '0%':   { opacity: 0, transform: 'translateY(20px)' },
            '100%': { opacity: 1, transform: 'translateY(0)' },
          },
          '@keyframes ringPulse': {
            '0%':   { transform: 'scale(0.85)', opacity: 0.7 },
            '50%':  { transform: 'scale(1.15)', opacity: 0.25 },
            '100%': { transform: 'scale(0.85)', opacity: 0.7 },
          },
          '@keyframes gridScroll': {
            '0%':   { backgroundPosition: '0 0' },
            '100%': { backgroundPosition: '0 60px' },
          },
        }}>

          <Box sx={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `linear-gradient(${accent}14 1px, transparent 1px), linear-gradient(90deg, ${accent}14 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            animation: 'gridScroll 4s linear infinite',
          }} />

          <Box sx={{
            position: 'absolute', top: '15%', left: '50%',
            transform: 'translateX(-50%)',
            width: 400, height: 400, borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}28 0%, transparent 70%)`,
            animation: 'glowPulse 2.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {[1, 2, 3].map(i => (
            <Box key={i} sx={{
              position: 'absolute', top: '30%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 120 + i * 80, height: 120 + i * 80, borderRadius: '50%',
              border: `1px solid ${accent}`,
              animation: `ringPulse ${1.8 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
              pointerEvents: 'none',
            }} />
          ))}

          {smokeItems.map((s, i) => (
            <Box key={i} sx={{
              position: 'absolute', bottom: '30%', left: s.left,
              width: s.size, height: s.size, borderRadius: '50%',
              background: `radial-gradient(circle, ${accent}50 0%, transparent 70%)`,
              filter: 'blur(10px)',
              animation: `smokeUp ${s.dur}s ease-out infinite`,
              animationDelay: `${s.delay}s`,
              pointerEvents: 'none',
            }} />
          ))}

          <Box sx={{ position: 'relative', zIndex: 2 }}>
            <Box component="img" src="/logotipo.png" sx={{
              height: { xs: 110, sm: 140 },
              objectFit: 'contain',
              animation: 'floatLogo 4s ease-in-out infinite',
              filter: `drop-shadow(0 0 24px ${accent}99) drop-shadow(0 0 60px ${accent}44) drop-shadow(0 24px 48px rgba(0,0,0,0.9))`,
              transformStyle: 'preserve-3d',
            }} />
          </Box>

          <Box sx={{ position: 'relative', zIndex: 2 }}>
            {doneApproved
              ? <CheckCircleIcon sx={{ fontSize: 80, color: accent, filter: `drop-shadow(0 0 16px ${accent}cc)`, animation: 'checkPop 0.7s cubic-bezier(0.34,1.56,0.64,1) both' }} />
              : <CancelIcon      sx={{ fontSize: 80, color: accent, filter: `drop-shadow(0 0 16px ${accent}cc)`, animation: 'checkPop 0.7s cubic-bezier(0.34,1.56,0.64,1) both' }} />
            }
          </Box>

          <Typography variant="h4" fontWeight={900} sx={{
            color: accent2, zIndex: 2, letterSpacing: '-0.01em',
            textShadow: `0 0 30px ${accent}99, 0 0 60px ${accent}44`,
            animation: 'textAppear 0.5s ease 0.4s both',
          }}>
            {doneApproved ? 'Conteúdo aprovado!' : 'Alteração solicitada'}
          </Typography>

          <Typography sx={{
            color: 'rgba(244,247,255,0.55)', maxWidth: 340, lineHeight: 1.7, zIndex: 2,
            fontSize: '0.95rem', animation: 'textAppear 0.5s ease 0.65s both',
          }}>
            {doneApproved
              ? 'A Digital Scale foi notificada e publicará o conteúdo conforme o calendário. Obrigado!'
              : 'Sua solicitação foi enviada à equipe. Faremos os ajustes e entraremos em contato em breve.'}
          </Typography>

          {!doneApproved && rejectText && (
            <Paper sx={{
              p: 2, borderRadius: 2, maxWidth: 420, width: '100%', textAlign: 'left', zIndex: 2,
              bgcolor: 'rgba(239,68,68,0.07)', border: `1px solid ${accent}44`,
              animation: 'textAppear 0.5s ease 0.8s both',
            }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.35)', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                Sua solicitação:
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: DS.redSoft, fontStyle: 'italic', lineHeight: 1.5 }}>
                "{rejectText}"
              </Typography>
            </Paper>
          )}
        </Box>
      </ThemeProvider>
    )
  }

  const tc = typeColor(item.tp)

  const kf = {
    '@keyframes floatBtn': {
      '0%,100%': { transform: 'translateY(0px) perspective(500px) rotateX(-2deg)' },
      '50%':     { transform: 'translateY(5px) perspective(500px) rotateX(1deg)' },
    },
    '@keyframes floatBtnB': {
      '0%,100%': { transform: 'translateY(4px) perspective(500px) rotateX(-2deg)' },
      '50%':     { transform: 'translateY(-1px) perspective(500px) rotateX(1deg)' },
    },
    '@keyframes bouncePress': {
      '0%':   { transform: 'scale(1) translateY(0)' },
      '25%':  { transform: 'scale(0.89) translateY(3px)' },
      '60%':  { transform: 'scale(1.07) translateY(-5px)' },
      '80%':  { transform: 'scale(0.97) translateY(-1px)' },
      '100%': { transform: 'scale(1) translateY(0)' },
    },
    '@keyframes neonPulseRed': {
      '0%,100%': { boxShadow: `0 0 8px ${DS.red}, 0 0 22px #FF454555, 0 4px 0 #8B0000, inset 0 1px 0 rgba(255,180,180,0.25)` },
      '50%':     { boxShadow: `0 0 18px ${DS.red}, 0 0 48px #FF454588, 0 4px 0 #8B0000, inset 0 1px 0 rgba(255,180,180,0.45)` },
    },
    '@keyframes neonPulseGreen': {
      '0%,100%': { boxShadow: `0 0 8px ${DS.green}, 0 0 22px #00C47A55, 0 4px 0 #005C38, inset 0 1px 0 rgba(100,255,180,0.25)` },
      '50%':     { boxShadow: `0 0 18px ${DS.green}, 0 0 48px #00C47A88, 0 4px 0 #005C38, inset 0 1px 0 rgba(100,255,180,0.45)` },
    },
    '@keyframes unlockFlash': {
      '0%':   { boxShadow: `0 0 0px ${DS.green}` },
      '40%':  { boxShadow: '0 0 60px 20px #00C47A88' },
      '100%': { boxShadow: `0 0 8px ${DS.green}, 0 0 22px #00C47A55, 0 4px 0 #005C38` },
    },
    '@keyframes approveGrow': {
      '0%':   { transform: 'scale(0.92)', opacity: 0.4 },
      '60%':  { transform: 'scale(1.04)' },
      '100%': { transform: 'scale(1)',    opacity: 1 },
    },
    '@keyframes progressPulse': {
      '0%,100%': { opacity: 0.8 },
      '50%':     { opacity: 1 },
    },
  }

  return (
    <ThemeProvider theme={theme}><CssBaseline />
      <Box sx={{
        height: ['100vh', '100dvh'], width: '100vw', overflow: 'hidden', bgcolor: '#000',
        display: 'flex', flexDirection: { xs: 'column', md: 'row' },
        ...kf,
      }}>

        {/* ── COLUNA ESQUERDA (desktop): o criativo. No mobile, display:contents
            faz o wrapper sumir — o layout vertical fica idêntico ao de hoje. ── */}
        <Box sx={{
          display: { xs: 'contents', md: 'flex' }, flexDirection: 'column',
          width: { md: '46%' }, minWidth: 0, height: { md: '100%' },
          borderRight: { md: `1px solid ${DS.border}` },
        }}>

        {/* ── TOPO: info do criativo (sem botões) ── */}
        <Box sx={{
          flexShrink: 0,
          pt: 'max(env(safe-area-inset-top), 8px)',
          px: 1.5, pb: 1,
          bgcolor: '#000',
          borderBottom: '1px solid rgba(244,247,255,0.08)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="img" src="/logotipo.png" sx={{ height: 20, objectFit: 'contain', flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.44rem', color: 'rgba(244,247,255,0.32)', textTransform: 'uppercase', letterSpacing: 1.2, lineHeight: 1 }}>
                {clientName}
              </Typography>
              <Typography fontWeight={800} sx={{ fontSize: '0.68rem', color: '#fff', lineHeight: 1.2 }} noWrap>
                {title}
              </Typography>
            </Box>
            <Chip label={item.tp} size="small" sx={{ height: 15, fontSize: '0.43rem', color: tc, bgcolor: `${tc}20`, border: `1px solid ${tc}44`, flexShrink: 0 }} />
          </Box>
        </Box>

        {/* Banner feedback já enviado */}
        {existingFeedback && (
          <Box sx={{
            flexShrink: 0,
            pt: 'max(env(safe-area-inset-top), 8px)',
            px: 2, pb: 1,
            display: 'flex', alignItems: 'center', gap: 1,
            bgcolor: existingFeedback.approved ? 'rgba(0,25,14,0.99)' : 'rgba(25,0,0,0.99)',
            borderBottom: `1px solid ${existingFeedback.approved ? 'rgba(49,209,124,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            {existingFeedback.approved
              ? <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18, flexShrink: 0 }} />
              : <CancelIcon sx={{ color: 'error.main', fontSize: 18, flexShrink: 0 }} />
            }
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                {existingFeedback.approved ? 'Você aprovou este conteúdo.' : 'Você solicitou alteração.'}
              </Typography>
              {existingFeedback.text && (
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(244,247,255,0.45)', fontStyle: 'italic' }} noWrap>
                  "{existingFeedback.text}"
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* ── ÁREA CENTRAL ── */}
        <Box sx={{
          flex: 1, minHeight: 0, position: 'relative', bgcolor: '#000', overflow: 'hidden',
        }}>

          {/* Drive: player nativo <video> via proxy /api/stream (toca inline + seek no
              celular, controles nativos do iOS/Android, fullscreen real).

              ⚠️ `preload` é METADATA de propósito, não `auto`. Medido em produção
              (2026-08-06, 100 vídeos rastreados): a MEDIANA de um export é 91 MB,
              p90 é 142 MB, e o maior tem 1,5 GB. Com `auto`, o celular do cliente
              começava a baixar 91 MB no instante em que a página abre — antes de
              ele tocar em play, e sem nunca ter pedido. Na franquia de dados de um
              cliente no 4G isso é dinheiro, e boa parte nem chega a assistir.

              O ganho que o `auto` prometia era menor do que parecia: o vídeo é
              servido com Range e toca progressivamente de qualquer jeito, então a
              diferença é um ou dois segundos depois do toque — e o iOS ignora
              `preload` em rede celular há anos, então quem pagava a conta era só o
              cliente de Android. O poster vem do /api/thumb e a tela nunca fica
              preta esperando.

              Proxy falhou → painel honesto (não iframe do Drive). */}
          {midia.tipo === 'video' && (
            videoNativeError ? (
              // O plano B era um iframe do Drive. Em pasta privada — o padrão —
              // isso entrega ao cliente a tela de login do Google: um beco sem
              // saída com cara de erro nosso. Melhor dizer a verdade e oferecer
              // as saídas que existem.
              <Box sx={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 1.6, px: 3, textAlign: 'center',
              }}>
                <Box component="img" src="/logotipo.png" sx={{ height: 30, opacity: 0.55 }} />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(244,247,255,0.85)' }}>
                  O vídeo não abriu neste aparelho
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.45)', lineHeight: 1.6, maxWidth: 290 }}>
                  Já avisamos a agência automaticamente. Você pode tentar de novo ou
                  abrir o arquivo direto.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', mt: 0.5 }}>
                  <Button
                    variant="contained" size="small"
                    onClick={() => { setVideoRetry(n => n + 1); setVideoNativeError(false) }}
                    sx={{ fontWeight: 700 }}
                  >
                    Tentar de novo
                  </Button>
                  <Button
                    variant="outlined" size="small"
                    href={`https://drive.google.com/file/d/${midia.fileId}/view`}
                    target="_blank" rel="noopener"
                    sx={{ borderColor: 'rgba(148,163,184,0.4)', color: 'rgba(244,247,255,0.7)', fontWeight: 700 }}
                  >
                    Abrir no Drive
                  </Button>
                </Box>
              </Box>
            ) : streamUid ? (
              /* Transcodificado: player adaptativo. Ele cai de rendição quando
                 a conexão piora e CONTINUA tocando — é a resposta para os 36%
                 de travamento no Android. Os eventos são os mesmos do <video>,
                 então notas por segundo, liberação dos botões e registro de
                 travada seguem funcionando. */
              <StreamPlayer
                uid={streamUid}
                aoMontar={h => { streamRef.current = h }}
                onPlaying={() => { stallRef.current.played = true; logViewer(token, itemId, 'playing', undefined, 'stream') }}
                onStalled={noteStall}
                onEnded={handleVideoEnded}
                onTimeUpdate={(atual, duracao) => {
                  streamTimeRef.current = atual
                  setVideoCurrent(atual)
                  if (duracao > 0) setVideoDuration(duracao)
                  if (!buttonsUnlocked && (atual >= UNLOCK_AFTER || (duracao > 0 && atual / duracao >= 0.9))) {
                    unlockButtons()
                  }
                }}
                /* O player falhou: cai no arquivo original, que é o
                   comportamento de antes do Stream existir. Nunca deixar o
                   cliente numa tela preta por causa de uma melhoria. */
                /* O tipo 'fallback' existia no registro e nunca era emitido.
                   Sem ele, o player adaptativo podia estar falhando para TODO
                   mundo e a aba Entregas mostraria só sucesso no <video> de
                   reserva — que é justamente o arquivo pesado que o Stream
                   existe para evitar. */
                onError={() => { logViewer(token, itemId, 'fallback', 'stream falhou; caiu no arquivo original', 'stream'); setStreamUid(null) }}
              />
            ) : (
              <video
                key={videoRetry}
                ref={videoElRef}
                src={`/api/stream?id=${midia.fileId}&kind=video`}
                // O /api/thumb limita em 400px: acima disso o Drive devolve o
                // quadro em resolução cheia (871 KB medidos), que competiria com
                // o próprio vídeo no 4G. Pedir 1200 aqui só mentia sobre o que
                // chega.
                poster={`/api/thumb?id=${midia.fileId}&sz=400`}
                controls
                playsInline
                preload="metadata"
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={handleVideoEnded}
                onPlaying={() => { stallRef.current.played = true; logViewer(token, itemId, 'playing', undefined, 'arquivo') }}
                onWaiting={noteStall}
                onLoadedMetadata={e => setVideoDuration(e.currentTarget.duration || 0)}
                onError={e => {
                  const code = e.currentTarget.error?.code
                  logViewer(token, itemId, 'error', `video code=${code ?? '?'}`, 'arquivo')
                  setVideoNativeError(true)
                }}
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  width: '100%', height: '100%',
                  objectFit: 'contain', border: 'none', display: 'block', background: '#000',
                }}
              />
            )
          )}

          {/* Post/Feed/Story: imagem única, com fallback em cadeia.
              Carrossel (pasta do Drive com várias artes): vira o carrossel. */}
          {midia.tipo === 'imagens' && (
            midia.arquivos.length > 1 ? (
              <CreativeCarousel
                imagens={midia.arquivos}
                title={title}
                i={Math.min(slide, midia.arquivos.length - 1)}
                setI={setSlide}
                onExhausted={detail => logViewer(token, itemId, 'error', detail)}
              />
            ) : (
              <CreativeImage
                fileId={midia.arquivos[0]?.id ?? null}
                rawLink={link}
                title={title}
                onExhausted={detail => logViewer(token, itemId, 'error', detail)}
              />
            )
          )}

          {/* Pasta sendo lida: o cliente vê que ALGO está vindo. Antes o
              carrossel ficava preto enquanto o Drive respondia. */}
          {midia.tipo === 'carregando' && (
            <Box sx={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 1.4,
            }}>
              <CircularProgress size={26} sx={{ color: DS.accent }} />
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.45)' }}>
                Carregando o criativo…
              </Typography>
            </Box>
          )}

          {/* Streamable: iframe mantido */}
          {videoSource.type === 'streamable' && (
            <Box
              ref={iframeRef}
              component="iframe"
              src={videoSource.embedUrl}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              sx={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                border: 'none', display: 'block',
              }}
            />
          )}

          {/* Sem criativo na tela — e a frase muda com o MOTIVO.
              Uma frase só para os três casos fazia a tela mentir no mais comum:
              pasta arquivada depois de publicar virava "não foi anexado", e o
              cliente cobrava um trabalho que já estava entregue.
              "A agência já foi avisada" é verdade, não conforto: estes três
              caminhos gravam um evento de erro no /api/viewer-log, que dispara
              Web Push para a equipe. */}
          {midia.tipo === 'nenhum' && (() => {
            const texto =
              midia.motivo === 'vazia'
                ? { titulo: 'Este criativo foi movido do local original.',
                    sub: 'Ele já foi produzido — o arquivo saiu da pasta de entrega. A agência já foi avisada e vai reenviar.' }
              : midia.motivo === 'ilegivel'
                ? { titulo: 'Não conseguimos abrir a pasta deste criativo.',
                    sub: 'É uma permissão do nosso lado, não do seu. A agência já foi avisada.' }
              : midia.motivo === 'rede'
                ? { titulo: 'Não deu para carregar o criativo agora.',
                    sub: 'Pode ser a conexão. Tente abrir de novo em instantes.' }
                : { titulo: 'O criativo ainda não foi anexado.',
                    sub: 'Entre em contato com a agência.' }
            return (
              <Box sx={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 1.2, px: 3, textAlign: 'center',
              }}>
                <Box component="img" src="/logotipo.png" sx={{ height: 30, opacity: 0.5 }} />
                <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: 'rgba(244,247,255,0.72)', lineHeight: 1.5, maxWidth: 280 }}>
                  {texto.titulo}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.4)', lineHeight: 1.6, maxWidth: 280 }}>
                  {texto.sub}
                </Typography>
              </Box>
            )
          })()}

        </Box>

        {/* ── TRILHA de marcadores — pontos comentados sobre a duração do vídeo.
            Toque num marcador pula o vídeo pra aquele segundo. ── */}
        {temPlayhead() && videoDuration > 0 && (notes.length > 0 || rejectMode) && (
          <Box sx={{ flexShrink: 0, bgcolor: '#000', px: 2, pt: 0.8 }}>
            <Box sx={{ position: 'relative', height: 16, display: 'flex', alignItems: 'center' }}>
              <Box sx={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 3, bgcolor: 'rgba(148,163,184,0.18)' }} />
              <Box sx={{ position: 'absolute', left: 0, height: 4, borderRadius: 3, width: `${Math.min(videoCurrent / videoDuration * 100, 100)}%`, bgcolor: 'rgba(59,130,246,0.5)' }} />
              <Box sx={{ position: 'absolute', left: `${Math.min(videoCurrent / videoDuration * 100, 100)}%`, transform: 'translateX(-50%)', width: 9, height: 9, borderRadius: '50%', bgcolor: '#fff', boxShadow: '0 0 4px rgba(0,0,0,0.6)' }} />
              {notes.map((n, i) => (
                <Box key={i} onClick={() => seekTo(n.t)} title={`${fmtTime(n.t)} · ${n.text}`} sx={{
                  position: 'absolute', left: `${Math.min(n.t / videoDuration * 100, 100)}%`,
                  transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%',
                  bgcolor: DS.amber, border: '2px solid #000', cursor: 'pointer',
                  transition: 'transform 0.15s', '&:hover': { transform: 'translateX(-50%) scale(1.25)' },
                }} />
              ))}
            </Box>
          </Box>
        )}

        {/* ── BAIXAR O ORIGINAL ──────────────────────────────────────────────
            Aprovar e publicar são trabalhos diferentes, e o link só servia ao
            primeiro. O cliente que queria o arquivo pedia "manda aberto" ou
            "manda em documento" no WhatsApp, e alguém da equipe ia atrás na
            mão. Agora ele se serve.

            Fica DEPOIS do player de propósito: quem só vai aprovar não precisa
            tomar decisão nenhuma, e quem quer o arquivo acha sem perguntar. */}
        {arquivoAtual && (
          <Box sx={{
            flexShrink: 0, px: 2, py: videoFinished ? 1.6 : 1.2,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8,
            // A faixa só ganha corpo depois que o vídeo termina. Antes disso é
            // uma linha discreta — o cliente ainda está avaliando, e oferecer
            // download no meio da avaliação disputa atenção com o que importa.
            ...(videoFinished && {
              background: 'linear-gradient(180deg, rgba(59,130,246,0.10), rgba(59,130,246,0.02))',
              borderTop: '1px solid rgba(59,130,246,0.22)',
            }),
            transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
          }}>
            {videoFinished && (
              <Typography sx={{
                fontSize: '0.72rem', color: DS.t1, fontWeight: 600, textAlign: 'center',
                animation: 'fadeInUp 0.35s cubic-bezier(0.16,1,0.3,1) both',
              }}>
                Quer publicar esse criativo?
                <Box component="span" sx={{ display: 'block', fontSize: '0.66rem', color: DS.t2, fontWeight: 400, mt: 0.2 }}>
                  Baixe o arquivo original e use onde quiser.
                </Box>
              </Typography>
            )}
            <Button
              component="a"
              href={`/api/stream?id=${arquivoAtual.id}&kind=${arquivoAtual.kind}&dl=1`}
              // Mesma origem + Content-Disposition: attachment = o navegador
              // salva. No iPhone abre a folha de compartilhamento, que é onde
              // o cliente escolhe "Salvar em Fotos" — o que ele queria.
              download
              size="small"
              onClick={() => logViewer(token, itemId, 'download', videoFinished ? 'apos assistir' : undefined, playerAtual())}
              sx={{
                fontSize: videoFinished ? '0.76rem' : '0.7rem',
                fontWeight: videoFinished ? 700 : 600,
                textTransform: 'none', borderRadius: 2, px: videoFinished ? 2.4 : 1.6, py: 0.5,
                ...(videoFinished
                  ? {
                    color: '#FFFFFF',
                    background: `linear-gradient(90deg, ${DS.accent}, ${DS.cyan})`,
                    boxShadow: '0 4px 16px rgba(59,130,246,0.28)',
                    '&:hover': { filter: 'brightness(1.06)', boxShadow: '0 6px 22px rgba(59,130,246,0.4)' },
                  }
                  : {
                    color: DS.t2, border: `1px solid ${DS.border}`,
                    '&:hover': { color: DS.t1, borderColor: 'rgba(59,130,246,0.4)', bgcolor: 'rgba(59,130,246,0.06)' },
                  }),
                transition: 'all 0.25s ease',
              }}
            >
              {/* Num carrossel o botão baixa a lâmina que está na tela, e diz
                  qual é: "baixar a imagem" numa pasta de sete artes deixaria o
                  cliente sem saber o que veio. */}
              ⬇ Baixar {arquivoAtual.kind === 'video'
                ? 'o vídeo'
                : midia.tipo === 'imagens' && midia.arquivos.length > 1
                  ? `a imagem ${Math.min(slide, midia.arquivos.length - 1) + 1} de ${midia.arquivos.length}`
                  : 'a imagem'} em alta
            </Button>
          </Box>
        )}

        </Box>{/* fim COLUNA ESQUERDA */}

        {/* ── COLUNA DIREITA (desktop): legenda + ação. No mobile, display:contents. ── */}
        <Box sx={{
          display: { xs: 'contents', md: 'flex' }, flexDirection: 'column',
          flex: { md: 1 }, minWidth: 0, height: { md: '100%' },
          overflowY: { md: 'auto' }, justifyContent: { md: 'center' },
        }}>

        {/* ── LEGENDA que vai no post — o cliente aprova o pacote real, não só o vídeo ── */}
        {caption.trim() && !rejectMode && (
          <Box sx={{ flexShrink: 0, bgcolor: '#000', px: 1.5, pt: 1 }}>
            <Box
              onClick={() => setCapExpanded(v => !v)}
              sx={{
                bgcolor: DS.surface, border: `1px solid ${DS.border}`, borderRadius: '12px',
                px: 1.4, py: 1, cursor: 'pointer', userSelect: 'none',
                transition: 'border-color 0.2s',
                '&:active': { borderColor: 'rgba(6,182,212,0.4)' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 0.5 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: DS.cyan, boxShadow: `0 0 6px ${DS.cyan}` }} />
                <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, color: DS.cyan, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Legenda que vai no post
                </Typography>
                <Typography sx={{ ml: 'auto', fontSize: '0.55rem', fontWeight: 700, color: 'rgba(244,247,255,0.4)' }}>
                  {capExpanded ? 'ver menos ▲' : 'ver tudo ▼'}
                </Typography>
              </Box>
              <Typography sx={{
                fontSize: '0.72rem', color: DS.t1, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                ...(capExpanded
                  ? { maxHeight: '26dvh', overflowY: 'auto' }
                  : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
              }}>
                {caption}
              </Typography>
            </Box>
          </Box>
        )}

        {/* ── RODAPÉ: barra de progresso + botões ── */}
        {!rejectMode && !existingFeedback && (() => {
          const hasVideo    = videoSource.type !== 'none' && isVideo
          const isLocked    = hasVideo && !buttonsUnlocked
          const useNative   = videoSource.type === 'drive' && !videoNativeError && videoDuration > 0
          // A barra enche até o ponto de liberação (90% ou 15s), não até o fim —
          // senão marcaria "40s" num vídeo que libera aos 15.
          const unlockAt    = useNative ? Math.min(videoDuration * 0.9, UNLOCK_AFTER) : UNLOCK_AFTER
          const watched     = useNative ? videoCurrent : watchSeconds
          const pct         = Math.min((watched / unlockAt) * 100, 100)
          const remaining   = Math.max(Math.ceil(unlockAt - watched), 0)
          return (
            <Box sx={{
              flexShrink: 0,
              bgcolor: '#000',
              borderTop: isLocked ? '1px solid rgba(59,130,246,0.18)' : '1px solid rgba(244,247,255,0.07)',
              transition: 'border-color 0.4s',
            }}>

              {/* ── Barra de progresso (só enquanto assistindo) ── */}
              {isLocked && (
                <Box sx={{ px: 1.5, pt: 1, pb: 0.4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: DS.accent, letterSpacing: '0.04em' }}>
                      🎬 Assista o vídeo para liberar sua decisão
                    </Typography>
                    <Box sx={{ ml: 'auto', minWidth: 24, textAlign: 'right' }}>
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: 'rgba(59,130,246,0.7)', fontVariantNumeric: 'tabular-nums' }}>
                        {remaining}s
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ height: 4, borderRadius: 4, bgcolor: 'rgba(244,247,255,0.07)', overflow: 'hidden' }}>
                    <Box sx={{
                      height: '100%', borderRadius: 4,
                      background: `linear-gradient(90deg, ${DS.accent}, ${DS.cyan})`,
                      width: `${pct}%`,
                      transition: 'width 0.9s linear',
                      animation: 'progressPulse 1.4s ease-in-out infinite',
                      boxShadow: '0 0 8px rgba(59,130,246,0.6)',
                    }} />
                  </Box>
                </Box>
              )}

              {/* ── Instrução (quando desbloqueado ou sem vídeo) ── */}
              {!isLocked && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mx: 1.5, mt: 1, mb: 0.4 }}>
                  <Box sx={{ flex: 1, height: '1px', bgcolor: justUnlocked ? 'rgba(49,209,124,0.3)' : 'rgba(244,247,255,0.06)' }} />
                  <Typography sx={{
                    fontSize: '0.58rem', fontWeight: 700, whiteSpace: 'nowrap',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: justUnlocked ? DS.green : 'rgba(244,247,255,0.3)',
                    transition: 'color 0.5s',
                  }}>
                    {justUnlocked ? '✅ Pronto — o que achou?' : 'O que achou do criativo?'}
                  </Typography>
                  <Box sx={{ flex: 1, height: '1px', bgcolor: justUnlocked ? 'rgba(49,209,124,0.3)' : 'rgba(244,247,255,0.06)' }} />
                </Box>
              )}

              {/* ── Botões ── */}
              <Box sx={{
                display: 'flex', gap: 0.8, px: 1.5,
                pt: isLocked ? 0.6 : 0.2,
                pb: 'max(env(safe-area-inset-bottom), 14px)',
              }}>

                {/* SOLICITAR ALTERAÇÃO — secundário, menor */}
                <Box
                  onClick={() => {
                    if (isLocked) return
                    setBtnPressed('reject')
                    setTimeout(() => { setBtnPressed(null); enterRejectMode() }, 260)
                  }}
                  sx={{
                    flex: 1, borderRadius: '10px',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    py: 0.9, px: 0.8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
                    background: isLocked
                      ? 'rgba(255,68,68,0.07)'
                      : 'linear-gradient(180deg, #FF4444 0%, #BB0000 100%)',
                    border: `1px solid ${isLocked ? 'rgba(255,68,68,0.15)' : 'rgba(255,100,100,0.4)'}`,
                    opacity: isLocked ? 0.3 : 1,
                    transition: 'all 0.5s ease',
                    userSelect: 'none',
                    animation: isLocked ? 'none'
                      : btnPressed === 'reject'
                        ? 'bouncePress 0.28s cubic-bezier(0.34,1.56,0.64,1) both'
                        : 'neonPulseRed 2.2s ease-in-out infinite',
                  }}
                >
                  <CancelIcon sx={{ fontSize: 12, color: isLocked ? 'rgba(255,80,80,0.4)' : '#fff', flexShrink: 0 }} />
                  <Typography sx={{
                    fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.02em', lineHeight: 1,
                    color: isLocked ? 'rgba(255,80,80,0.4)' : '#fff',
                  }}>
                    SOLICITAR ALTERAÇÃO
                  </Typography>
                </Box>

                {/* APROVAR — primário, maior, mais vibrante */}
                <Box
                  onClick={() => {
                    if (submitting || isLocked) return
                    setBtnPressed('approve')
                    setTimeout(() => { setBtnPressed(null); submitFeedback(true) }, 260)
                  }}
                  sx={{
                    flex: 1.7, borderRadius: '10px',
                    cursor: (submitting || isLocked) ? 'default' : 'pointer',
                    py: 1.1, px: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.7,
                    background: isLocked
                      ? 'rgba(49,209,124,0.08)'
                      : 'linear-gradient(160deg, #00E080 0%, #00A855 50%, #007A40 100%)',
                    border: `1px solid ${isLocked ? 'rgba(49,209,124,0.15)' : 'rgba(0,220,130,0.5)'}`,
                    opacity: isLocked ? 0.3 : submitting ? 0.7 : 1,
                    transition: 'all 0.5s ease',
                    userSelect: 'none',
                    animation: isLocked ? 'none'
                      : justUnlocked ? 'approveGrow 0.6s cubic-bezier(0.34,1.56,0.64,1) both, unlockFlash 0.8s ease both'
                      : btnPressed === 'approve'
                        ? 'bouncePress 0.28s cubic-bezier(0.34,1.56,0.64,1) both'
                        : 'floatBtnB 3s ease-in-out infinite, neonPulseGreen 2.2s ease-in-out infinite',
                    animationDelay: (isLocked || justUnlocked || btnPressed === 'approve') ? '0s' : '0.5s, 0.5s',
                    boxShadow: isLocked ? 'none' : undefined,
                  }}
                >
                  {submitting
                    ? <CircularProgress size={16} sx={{ color: '#fff', flexShrink: 0 }} />
                    : <CheckCircleIcon sx={{
                        fontSize: isLocked ? 14 : 18,
                        color: isLocked ? 'rgba(49,209,124,0.4)' : '#fff',
                        filter: isLocked ? 'none' : 'drop-shadow(0 0 4px rgba(0,255,140,0.8))',
                        flexShrink: 0,
                        transition: 'font-size 0.4s',
                      }} />
                  }
                  <Typography sx={{
                    fontSize: isLocked ? '0.68rem' : '0.85rem',
                    fontWeight: 900,
                    letterSpacing: '0.03em',
                    lineHeight: 1,
                    color: isLocked ? 'rgba(49,209,124,0.4)' : '#fff',
                    textShadow: isLocked ? 'none' : '0 0 8px rgba(0,255,140,0.6)',
                    transition: 'font-size 0.4s, color 0.4s',
                  }}>
                    {submitting ? 'ENVIANDO...' : 'APROVAR ✓'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )
        })()}

        {/* Input de motivo de reprovação */}
        {rejectMode && !existingFeedback && (
          <Box sx={{
            position: { xs: 'fixed', md: 'static' },
            bottom: { xs: 0, md: 'auto' },
            left:   { xs: 0, md: 'auto' },
            right:  { xs: 0, md: 'auto' },
            zIndex: { xs: 20, md: 'auto' },
            flexShrink: { xs: undefined, md: 0 },
            borderTop: '1px solid rgba(239,68,68,0.35)',
            px: 2, pt: 1.2, pb: 'max(env(safe-area-inset-bottom), 14px)',
            bgcolor: 'rgba(6,0,0,0.99)',
          }}>
            {/* Comentários já fixados */}
            {notes.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                {notes.map((n, i) => (
                  <Box key={i} sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 0.7,
                    px: 0.9, py: 0.6, borderRadius: '9px',
                    bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)',
                  }}>
                    <Box onClick={() => seekTo(n.t)} sx={{
                      flexShrink: 0, mt: 0.1, px: 0.7, py: 0.15, borderRadius: '6px', cursor: 'pointer',
                      bgcolor: 'rgba(245,158,11,0.16)', border: '1px solid rgba(245,158,11,0.4)',
                    }}>
                      <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: DS.amber, fontVariantNumeric: 'tabular-nums' }}>
                        ⏱️ {fmtTime(n.t)}
                      </Typography>
                    </Box>
                    <Typography sx={{ flex: 1, fontSize: '0.68rem', color: DS.t1, lineHeight: 1.4 }}>{n.text}</Typography>
                    <Typography onClick={() => setNotes(prev => prev.filter((_, j) => j !== i))} sx={{
                      flexShrink: 0, fontSize: '0.7rem', color: 'rgba(244,247,255,0.35)', cursor: 'pointer',
                      px: 0.4, '&:hover': { color: DS.red },
                    }}>✕</Typography>
                  </Box>
                ))}
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'error.main' }}>
                {notes.length > 0 ? 'Outro ajuste?' : <>O que deve ser alterado? <span style={{ color: DS.red }}>*</span></>}
              </Typography>
              {temPlayhead() && (
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.4,
                  px: 0.8, py: 0.2, borderRadius: '6px',
                  bgcolor: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)',
                }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: DS.amber, fontVariantNumeric: 'tabular-nums' }}>
                    ⏱️ {fmtTime(videoCurrent)}
                  </Typography>
                </Box>
              )}
            </Box>
            <Typography sx={{ fontSize: '0.54rem', color: 'rgba(244,247,255,0.22)', mb: 0.8 }}>
              {temPlayhead()
                ? 'Cai neste ponto do vídeo — a agência vê exatamente onde. Avance e marque outro se precisar.'
                : 'Obrigatório — sem descrição, o conteúdo será publicado como está.'}
            </Typography>
            <TextField
              autoFocus fullWidth multiline minRows={2} maxRows={4} size="small"
              placeholder="Ex: Mudar a cor do texto, trocar a foto, ajustar o título..."
              value={rejectText}
              onChange={e => { setRejectText(e.target.value); setRejectError('') }}
              error={!!rejectError} helperText={rejectError}
              sx={{ mb: 1 }}
            />
            {temPlayhead() && rejectText.trim() && (
              <Box onClick={addNote} sx={{
                mb: 1, py: 0.7, borderRadius: '9px', textAlign: 'center', cursor: 'pointer',
                bgcolor: 'rgba(245,158,11,0.1)', border: '1px dashed rgba(245,158,11,0.4)',
                color: DS.amber, fontSize: '0.65rem', fontWeight: 800,
                '&:hover': { bgcolor: 'rgba(245,158,11,0.16)' },
              }}>
                + Marcar em ⏱️ {fmtTime(videoCurrent)} e apontar outro ponto
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={() => { setRejectMode(false); setRejectText(''); setRejectError(''); setNotes([]) }}
                sx={{ color: 'rgba(244,247,255,0.35)' }}>Cancelar</Button>
              <Button size="small" variant="contained" color="error"
                disabled={submitting || (notes.length === 0 && !rejectText.trim())}
                onClick={() => submitFeedback(false)}
                sx={{ flex: 1, fontWeight: 700 }}>
                {submitting ? 'Enviando...'
                  : `Enviar ${notes.length + (rejectText.trim() ? 1 : 0)} ajuste${notes.length + (rejectText.trim() ? 1 : 0) > 1 ? 's' : ''}`}
              </Button>
            </Box>
          </Box>
        )}

        </Box>{/* fim COLUNA DIREITA */}

      </Box>
    </ThemeProvider>
  )
}
