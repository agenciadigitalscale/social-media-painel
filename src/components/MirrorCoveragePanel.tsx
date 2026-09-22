import { useCallback, useEffect, useState } from 'react'
import { Box, Typography, Paper, Button, Chip, Tooltip, LinearProgress } from '@mui/material'
import CloudDoneIcon from '@mui/icons-material/CloudDone'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { DS } from '../theme'
import BoltIcon from '@mui/icons-material/Bolt'
import {
  coverageTone, fetchCoverage, fmtBytes, hopelessFiles, mirrorPending, pendingFiles, streamPending,
  EMPTY_COVERAGE, type Coverage,
} from '../lib/mirrorCoverage'
import { EXPORT_PRESET, HEAVY_BYTES, weightTrend } from '../lib/exportWeight'

/**
 * "Os criativos que estão com o cliente saem da Cloudflare ou ainda dependem do
 * Google?" — a pergunta que o espelho nunca soube responder.
 *
 * Enquanto um criativo não está espelhado, o link do cliente continua preso ao
 * arquivo seguir na pasta Publicar: alguém mover a pasta e o link morre sem
 * aviso, e essa é a reclamação que não tem diagnóstico.
 */

interface Props {
  /** Recarrega junto com o resto da aba. */
  reloadKey?: number
}

export default function MirrorCoveragePanel({ reloadKey = 0 }: Props) {
  const [cov, setCov]         = useState<Coverage>(EMPTY_COVERAGE)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult]   = useState<string>('')
  const [runStr, setRunStr]   = useState(false)
  const [progStr, setProgStr] = useState({ done: 0, total: 0 })
  const [resStr, setResStr]   = useState<string>('')

  // Estado só depois do await: mexer nele de forma síncrona dentro do efeito
  // dispara renderização em cascata.
  useEffect(() => {
    let alive = true
    void (async () => {
      const next = await fetchCoverage()
      if (!alive) return
      setCov(next)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [reloadKey])

  const pending  = pendingFiles(cov)
  const hopeless = hopelessFiles(cov)
  const tone     = coverageTone(cov)
  const trend    = weightTrend(cov.files.map(f => f.bytes))
  const stream   = cov.stream
  const strPend  = streamPending(cov)

  const runStream = useCallback(async () => {
    setRunStr(true)
    setResStr('')
    setProgStr({ done: 0, total: strPend.length })
    // A mesma rota do espelho: POST /api/mirror por arquivo dispara a
    // transcodificação (mandarParaStream) tanto no já-espelhado quanto no novo.
    const { done, failed } = await mirrorPending(strPend, (d, t) => setProgStr({ done: d, total: t }))
    const fresh = await fetchCoverage()
    setCov(fresh)
    setRunStr(false)
    setResStr(
      failed === 0
        ? `${done} ${done === 1 ? 'vídeo enviado' : 'vídeos enviados'} para transcodificar — a versão leve fica pronta em alguns minutos.`
        : `${done} enviados, ${failed} não deram.`,
    )
  }, [strPend])

  const run = useCallback(async () => {
    setRunning(true)
    setResult('')
    setProgress({ done: 0, total: pending.length })

    const { done, failed } = await mirrorPending(pending, (d, t) => setProgress({ done: d, total: t }))

    const fresh = await fetchCoverage()
    setCov(fresh)
    setRunning(false)
    setResult(
      failed === 0
        ? `${done} ${done === 1 ? 'criativo espelhado' : 'criativos espelhados'}.`
        : `${done} espelhados, ${failed} não deram — veja o que sobrou na lista.`,
    )
  }, [pending])

  if (loading) return null

  if (tone === 'off') {
    return (
      <Paper sx={{ p: 1.8, border: `1px solid ${DS.borderSoft}` }}>
        <Typography sx={{ fontSize: '0.74rem', color: DS.t2 }}>
          O espelho não está configurado neste ambiente — todo criativo sai do Drive.
        </Typography>
      </Paper>
    )
  }

  if (cov.error) {
    return (
      <Paper sx={{ p: 1.8, border: '1px solid rgba(239,68,68,0.28)', bgcolor: 'rgba(239,68,68,0.06)' }}>
        <Typography sx={{ fontSize: '0.76rem', color: DS.redSoft, fontWeight: 700 }}>
          Não consegui conferir o espelho.
        </Typography>
        <Typography sx={{ fontSize: '0.66rem', color: DS.t2, mt: 0.3 }}>
          {cov.error} — isto não diz que os criativos estão fora, diz que não deu para perguntar.
        </Typography>
      </Paper>
    )
  }

  if (tone === 'empty') {
    return (
      <Paper sx={{ p: 1.8, border: `1px solid ${DS.borderSoft}` }}>
        <Typography sx={{ fontSize: '0.74rem', color: DS.t2 }}>
          Nenhum criativo com o cliente no momento — nada para espelhar.
        </Typography>
      </Paper>
    )
  }

  const accent = tone === 'full' ? DS.green : tone === 'none' ? DS.red : DS.amber
  const icon   = tone === 'full'
    ? <CloudDoneIcon sx={{ fontSize: 20, color: accent }} />
    : <CloudOffIcon sx={{ fontSize: 20, color: accent }} />

  return (
    <Paper sx={{
      p: { xs: 1.6, md: 2 },
      border: `1px solid ${accent}38`,
      bgcolor: `${accent}0d`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
        {icon}
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontSize: { xs: '0.8rem', xl: '0.9rem' }, fontWeight: 800, color: DS.t1 }}>
            Espelho · {cov.mirrored} de {cov.total} criativos no ar estão na Cloudflare
          </Typography>
          <Typography sx={{ fontSize: { xs: '0.64rem', xl: '0.7rem' }, color: DS.t2, mt: 0.2 }}>
            {tone === 'full'
              ? 'Nenhum depende do Drive — mover ou apagar a pasta não derruba link nenhum.'
              : `${pending.length + hopeless.length} ainda ${pending.length + hopeless.length === 1 ? 'depende' : 'dependem'} do Drive: se o arquivo sair da pasta Publicar, o link do cliente morre.`}
          </Typography>
        </Box>

        {pending.length > 0 && (
          <Button
            variant="contained" size="small" onClick={() => void run()} disabled={running}
            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
          >
            {running ? `Espelhando ${progress.done}/${progress.total}…` : 'Espelhar agora'}
          </Button>
        )}
      </Box>

      {running && (
        <LinearProgress
          variant={progress.total ? 'determinate' : 'indeterminate'}
          value={progress.total ? (progress.done / progress.total) * 100 : 0}
          sx={{ mt: 1.2, height: 4, borderRadius: 2 }}
        />
      )}

      {result && (
        <Typography sx={{ fontSize: '0.68rem', color: DS.t2, mt: 1 }}>{result}</Typography>
      )}

      {/* Versão leve (Cloudflare Stream): é o que impede o vídeo de travar no
          4G do cliente e faz o .mov abrir no Android. Só aparece quando há vídeo
          com o cliente. */}
      {stream && cov.total > 0 && (
        <Box sx={{ mt: 1.4, pt: 1.2, borderTop: `1px solid ${DS.borderSoft}` }}>
          {!stream.configurado ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BoltIcon sx={{ fontSize: 18, color: DS.t3 }} />
              <Typography sx={{ fontSize: '0.66rem', color: DS.t2, lineHeight: 1.5 }}>
                <strong style={{ color: DS.amber }}>Versão leve desligada.</strong> Configure o
                {' '}<code>STREAM_API_TOKEN</code> para os vídeos pararem de travar no cliente
                (e o <code>.mov</code> abrir no Android). Enquanto isso, todos saem no arquivo pesado.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
              <BoltIcon sx={{ fontSize: 18, color: DS.green }} />
              <Box sx={{ flex: 1, minWidth: 180 }}>
                <Typography sx={{ fontSize: { xs: '0.72rem', xl: '0.8rem' }, fontWeight: 800, color: DS.t1 }}>
                  Versão leve · {stream.ready} de {cov.total} vídeos prontos (não travam)
                </Typography>
                <Typography sx={{ fontSize: '0.62rem', color: DS.t2, mt: 0.2 }}>
                  {stream.inprogress > 0 && `${stream.inprogress} transcodificando · `}
                  {stream.erro > 0 && `${stream.erro} com erro · `}
                  {stream.semStream > 0
                    ? `${stream.semStream} ainda no arquivo pesado.`
                    : 'todos os que dão já têm a versão leve.'}
                </Typography>
              </Box>
              {stream.semStream > 0 && (
                <Button
                  variant="outlined" size="small" onClick={() => void runStream()} disabled={runStr}
                  startIcon={<BoltIcon sx={{ fontSize: 14 }} />}
                  sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                >
                  {runStr ? `Enviando ${progStr.done}/${progStr.total}…` : 'Transcodificar'}
                </Button>
              )}
            </Box>
          )}
          {runStr && (
            <LinearProgress
              variant={progStr.total ? 'determinate' : 'indeterminate'}
              value={progStr.total ? (progStr.done / progStr.total) * 100 : 0}
              sx={{ mt: 1, height: 4, borderRadius: 2, '& .MuiLinearProgress-bar': { bgcolor: DS.green } }}
            />
          )}
          {resStr && <Typography sx={{ fontSize: '0.66rem', color: DS.t2, mt: 0.8 }}>{resStr}</Typography>}
        </Box>
      )}

      {/* O peso dos exports que estão com o cliente. Serve para ver a mediana
          CAINDO depois de mudar o preset — sem isso, "mudamos o export" fica
          sendo afirmação sem prova. */}
      {trend.sample > 0 && trend.median !== null && (
        <Tooltip title={
          trend.onTarget
            ? `No alvo. Preset: ${EXPORT_PRESET}.`
            : `${trend.heavy} de ${trend.sample} passam de ${fmtBytes(HEAVY_BYTES)}. O Instagram recomprime tudo, `
              + `então esse peso não melhora o post — só a conta de dados do cliente. Preset: ${EXPORT_PRESET}.`
        }>
          <Typography sx={{
            fontSize: '0.64rem', mt: 1.2, pt: 1.1,
            borderTop: `1px solid ${DS.borderSoft}`,
            color: trend.onTarget ? DS.t2 : DS.alert,
            fontWeight: trend.onTarget ? 400 : 700,
          }}>
            Peso mediano dos exports no ar: {fmtBytes(trend.median)}
            {!trend.onTarget && ` · ${trend.heavy} acima de ${fmtBytes(HEAVY_BYTES)}`}
          </Typography>
        </Tooltip>
      )}

      {(pending.length > 0 || hopeless.length > 0) && !running && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, mt: 1.4 }}>
          {[...pending, ...hopeless].slice(0, 12).map(f => (
            <Box key={f.fileId} sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: 1.1, py: 0.7, borderRadius: '9px',
              bgcolor: 'rgba(148,163,184,0.05)', border: `1px solid ${DS.borderSoft}`,
            }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: { xs: '0.7rem', xl: '0.78rem' }, fontWeight: 700, color: DS.t1 }} noWrap>
                  {f.filename}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: DS.t2 }} noWrap>{f.client}</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.62rem', color: DS.t3, flexShrink: 0 }}>
                {fmtBytes(f.bytes)}
              </Typography>
              {f.tooBig && (
                <Tooltip title="Acima do teto de 600 MB do espelho. Insistir não resolve — este precisa de um export menor.">
                  <Chip
                    size="small" icon={<WarningAmberIcon sx={{ fontSize: 12 }} />} label="grande demais"
                    sx={{
                      height: 19, fontSize: '0.56rem', fontWeight: 700,
                      bgcolor: 'rgba(249,115,22,0.14)', color: DS.alert,
                      border: '1px solid rgba(249,115,22,0.3)',
                      '& .MuiChip-icon': { color: DS.alert },
                    }}
                  />
                </Tooltip>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  )
}
