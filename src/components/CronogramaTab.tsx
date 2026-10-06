/**
 * Cronograma de postagens (aba 36, 2026-10-06): o "Relatório de postagens" do
 * cliente no mês, no layout da arte da agência — para conferir e para mandar ao
 * cliente (baixa como imagem 1600×900).
 *
 * Interligado ao Calendário de postagem: lê os MESMOS cards (lib/cronograma), então
 * conteúdo que cai, muda de dia ou sai do calendário aparece aqui na hora.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import DownloadIcon from '@mui/icons-material/Download'
import { toPng } from 'html-to-image'
import type { ContentItem, ContentType, ItemState } from '../types'
import { DS } from '../theme'
import { clickable } from '../shared/a11y'
import { cronogramaDoMes } from '../lib/cronograma'
import { COR_TIPO, corDoConteudo, tipoDoPadrao } from '../lib/padraoEditorial'
import { ativoNoMes, carregarCarteira } from '../lib/planejamentoMes'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const LARGURA = 1600
const ALTURA = 900
const pad = (n: number) => String(n).padStart(2, '0')

function IconeTipo({ tp, tamanho }: { tp: ContentType; tamanho: number }) {
  const t = tipoDoPadrao(tp)
  const sx = { fontSize: tamanho }
  if (t === 'Reel' || tp === 'Story') return <PlayArrowRoundedIcon sx={sx} />
  if (t === 'Feed') return <LayersOutlinedIcon sx={sx} />
  return <ImageOutlinedIcon sx={sx} />
}

export default function CronogramaTab({ items, states, clients, now }: {
  items: ContentItem[]
  states: Record<number, ItemState>
  clients: string[]
  now: Date
}) {
  const [ano, setAno] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth())
  const [soPublicados, setSoPublicados] = useState(false)
  const carteira = useMemo(() => carregarCarteira(), [])
  const doMes = useMemo(() => clients.filter(c => ativoNoMes(carteira, c, ano, mes)).sort((a, b) => a.localeCompare(b)), [clients, carteira, ano, mes])
  const [cliente, setCliente] = useState('')
  useEffect(() => { if (!cliente && doMes.length) setCliente(doMes[0]) }, [doMes, cliente])

  const { linhas, resumo } = useMemo(
    () => cliente ? cronogramaDoMes({ items, states, cliente, ano, mes, soPublicados }) : { linhas: [], resumo: { reels: 0, design: 0, feed: 0, outros: 0, total: 0 } },
    [items, states, cliente, ano, mes, soPublicados],
  )

  // A arte tem tamanho fixo (1600×900, como a peça da agência) e escala para caber na tela.
  const caixa = useRef<HTMLDivElement>(null)
  const arte = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(0.6)
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const medir = () => setEscala(Math.min(1, el.clientWidth / LARGURA))
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [baixando, setBaixando] = useState(false)
  const baixar = async () => {
    if (!arte.current) return
    setBaixando(true)
    try {
      const url = await toPng(arte.current, { pixelRatio: 1, width: LARGURA, height: alturaArte, cacheBust: true })
      const a = document.createElement('a')
      a.href = url
      a.download = `Cronograma ${cliente} - ${MESES[mes]} ${ano}.png`
      a.click()
    } finally { setBaixando(false) }
  }

  const andarMes = (d: -1 | 1) => {
    const n = new Date(ano, mes + d, 1)
    setAno(n.getFullYear()); setMes(n.getMonth())
  }

  // Até 14 linhas cabem em 900px; com mais, a linha encolhe até um mínimo e a arte cresce.
  const AREA_LINHAS = 690
  const alturaLinha = Math.max(38, Math.min(49, linhas.length ? Math.floor(AREA_LINHAS / linhas.length) : 49))
  const alturaArte = Math.max(ALTURA, 210 + linhas.length * alturaLinha)
  const fonteLinha = alturaLinha >= 46 ? 24 : alturaLinha >= 42 ? 21 : 19

  const blocosResumo = [
    { rotulo: 'Reels', n: resumo.reels, cor: COR_TIPO.Reel, tp: 'Reel' as ContentType },
    { rotulo: 'Design', n: resumo.design, cor: COR_TIPO.Post, tp: 'Post' as ContentType },
    ...(resumo.feed ? [{ rotulo: 'Feed', n: resumo.feed, cor: COR_TIPO.Feed, tp: 'Feed' as ContentType }] : []),
  ]

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, width: '100%', boxSizing: 'border-box', maxWidth: { xl: 1800 }, mx: 'auto' }}>
      {/* Filtros */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.2, flexWrap: 'wrap', mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: DS.t2, mb: 0.5 }}>Cliente</Typography>
          <TextField select size="small" value={cliente} onChange={e => setCliente(e.target.value)} sx={{ width: { xs: 200, xl: 260 } }}
            slotProps={{ select: { displayEmpty: true } }}>
            {doMes.length === 0 && <MenuItem value="" sx={{ fontSize: '0.8rem' }}>Nenhum cliente na carteira</MenuItem>}
            {[...new Set([...doMes, ...(cliente ? [cliente] : [])])].map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>)}
          </TextField>
        </Box>
        <Box>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: DS.t2, mb: 0.5 }}>Mês</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Button size="small" onClick={() => andarMes(-1)} aria-label="Mês anterior" sx={{ minWidth: 38, height: 40, color: DS.t1, border: `1px solid ${DS.border}` }}>←</Button>
            <Typography sx={{ minWidth: 150, textAlign: 'center', fontWeight: 800, color: DS.t1, fontSize: { xs: '0.9rem', xl: '1rem' } }}>{MESES[mes]} de {ano}</Typography>
            <Button size="small" onClick={() => andarMes(1)} aria-label="Próximo mês" sx={{ minWidth: 38, height: 40, color: DS.t1, border: `1px solid ${DS.border}` }}>→</Button>
          </Box>
        </Box>
        <Box {...clickable(() => setSoPublicados(v => !v))} aria-pressed={soPublicados} sx={{
          height: 40, px: 1.6, display: 'flex', alignItems: 'center', borderRadius: '10px', cursor: 'pointer',
          fontSize: '0.78rem', fontWeight: 700, border: `1px solid ${soPublicados ? DS.accent : DS.border}`,
          color: soPublicados ? DS.accent : DS.t2, transition: 'all 0.18s ease',
        }}>
          {soPublicados ? 'Só publicados' : 'Todo o cronograma'}
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<DownloadIcon />} disabled={!cliente || baixando} onClick={baixar} sx={{ height: 40, fontWeight: 800 }}>
          {baixando ? 'Gerando…' : 'Baixar imagem'}
        </Button>
      </Box>

      {/* A arte */}
      <Box ref={caixa} sx={{ position: 'relative', width: '100%', minWidth: 0, height: alturaArte * escala, overflow: 'hidden', borderRadius: '14px', border: `1px solid ${DS.border}` }}>
        {/* Absoluta: a arte de 1600px não pode empurrar a largura da página (a escala seria sempre 1). */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, width: LARGURA, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
          <Box ref={arte} sx={{
            width: LARGURA, height: alturaArte, position: 'relative', overflow: 'hidden', bgcolor: '#000',
            fontFamily: '"Inter", sans-serif', color: '#F4F1EC',
            backgroundImage: `radial-gradient(ellipse 40% 55% at 0% 0%, ${DS.accent}38, transparent 70%),
              radial-gradient(ellipse 35% 50% at 100% 100%, ${DS.accent}33, transparent 70%),
              radial-gradient(ellipse 30% 40% at 100% 0%, ${DS.accent}22, transparent 70%)`,
          }}>
            {/* Coluna da esquerda */}
            <Box sx={{ position: 'absolute', left: 48, top: 28, width: 510, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* logotipo.png é a marca com fundo transparente (1920×1080); o recorte mostra só a marca. */}
              <Box sx={{ width: 330, height: 112, overflow: 'hidden', position: 'relative' }}>
                <Box component="img" src="/logotipo.png" alt="Digital Scale"
                  sx={{ position: 'absolute', width: 660, height: 371, left: -162, top: -110, maxWidth: 'none' }} />
              </Box>
              <Typography sx={{ mt: 1, fontSize: 28, letterSpacing: '0.42em', fontWeight: 400, color: '#F4F1EC', fontFamily: 'inherit' }}>RELATÓRIO DE</Typography>
              <Typography sx={{ fontFamily: DS.fontDisplay, fontSize: 118, lineHeight: 1, color: '#FFFFFF', letterSpacing: '-0.01em', mt: 0.5 }}>POSTAGENS</Typography>
              <Box sx={{ mt: 1.5, width: '100%', bgcolor: DS.accent, borderRadius: '6px', py: 1.2, textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 900, fontSize: cliente.length > 18 ? 36 : 48, color: DS.onAccent, letterSpacing: '0.02em', textTransform: 'uppercase', lineHeight: 1.1, px: 2 }}>
                  {cliente || '—'}
                </Typography>
              </Box>
              <Typography sx={{ mt: 1.8, alignSelf: 'flex-start', fontSize: 21, lineHeight: 1.4, color: '#E8E3DC', letterSpacing: '0.04em' }}>
                Confira abaixo todas as publicações {soPublicados ? 'realizadas' : 'programadas'} em{' '}
                <Box component="span" sx={{ color: DS.accent, fontWeight: 900 }}>{MESES[mes].toUpperCase()}</Box>, com seus respectivos formatos e temas.
              </Typography>
              <Box sx={{ mt: 2.2, width: '100%', border: `2px solid ${DS.accent}`, borderRadius: '22px', px: 3, py: 2.4, bgcolor: 'rgba(14,12,10,0.85)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.4 }}>
                  <Box sx={{ width: 5, height: 30, bgcolor: DS.accent, borderRadius: '2px' }} />
                  <Typography sx={{ fontSize: 24, letterSpacing: '0.3em', color: '#F4F1EC' }}>RESUMO DO MÊS</Typography>
                </Box>
                {[...blocosResumo, { rotulo: 'Total', n: resumo.total, cor: '#A78BFA', tp: 'Feed' as ContentType, total: true }].map(b => (
                  <Box key={b.rotulo} sx={{ display: 'flex', alignItems: 'center', gap: 3, px: 3, height: blocosResumo.length > 2 ? 50 : 58, mb: 0.8, borderRadius: '14px', bgcolor: 'rgba(255,255,255,0.04)' }}>
                    <Box sx={{ width: 50, height: 50, borderRadius: '10px', bgcolor: 'total' in b ? '#A78BFA' : b.cor, color: '#0B0A09', display: 'grid', placeItems: 'center' }}>
                      {'total' in b ? <LayersOutlinedIcon sx={{ fontSize: 30 }} /> : <IconeTipo tp={b.tp} tamanho={30} />}
                    </Box>
                    <Typography sx={{ width: 110, fontSize: 26, color: '#E8E3DC' }}>{b.rotulo}:</Typography>
                    <Box sx={{ width: 2, height: 32, bgcolor: 'rgba(255,255,255,0.35)' }} />
                    <Typography sx={{ fontSize: 'total' in b ? 46 : 40, fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
                      {b.n}{'total' in b && <Box component="span" sx={{ fontSize: 24, fontWeight: 800, ml: 1.2 }}>publicaç{b.n === 1 ? 'ão' : 'ões'}</Box>}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Painel da direita */}
            <Box sx={{ position: 'absolute', left: 580, top: 52, right: 40, bottom: 22, border: `2px solid ${DS.accent}`, borderRadius: '28px', bgcolor: 'rgba(14,12,10,0.88)', px: 3, pt: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 1.5 }}>
                <Box sx={{ width: 108, height: 90, borderRadius: '16px', border: `3px solid ${DS.accent}`, display: 'grid', placeItems: 'center', color: DS.accent }}>
                  <CalendarMonthOutlinedIcon sx={{ fontSize: 66 }} />
                </Box>
                <Box sx={{ bgcolor: DS.accent, px: 3.5, py: 0.6, transform: 'rotate(-2deg)', borderRadius: '6px' }}>
                  <Typography sx={{ fontFamily: DS.fontDisplay, fontSize: 70, lineHeight: 1.05, color: DS.onAccent }}>{MESES[mes].toUpperCase()}</Typography>
                </Box>
                <Box sx={{ ml: 'auto', mr: 1, textAlign: 'right' }}>
                  <Typography sx={{ fontSize: 28, letterSpacing: '0.32em', color: '#F4F1EC', pb: 1, borderBottom: `4px solid ${DS.accent}` }}>
                    {resumo.total} PUBLICAÇ{resumo.total === 1 ? 'ÃO' : 'ÕES'}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${Math.max(4, alturaLinha - 44)}px` }}>
                {linhas.length === 0 && (
                  <Typography sx={{ fontSize: 26, color: '#A8A09A', textAlign: 'center', mt: 12 }}>
                    {cliente ? `Nada ${soPublicados ? 'publicado' : 'no calendário'} em ${MESES[mes].toLowerCase()}.` : 'Escolha um cliente.'}
                  </Typography>
                )}
                {linhas.map(l => {
                  const cor = corDoConteudo(l.tp)
                  return (
                    <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', gap: 2.2, height: Math.min(44, alturaLinha - 4), px: 1.2, borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.025)' }}>
                      <Box sx={{ width: 110, height: '84%', borderRadius: '8px', bgcolor: DS.accent, display: 'grid', placeItems: 'center' }}>
                        <Typography sx={{ fontWeight: 900, fontSize: fonteLinha + 2, color: DS.onAccent }}>{pad(l.data.getDate())}/{pad(l.data.getMonth() + 1)}</Typography>
                      </Box>
                      <Box sx={{ width: 2, height: '60%', bgcolor: 'rgba(255,255,255,0.4)' }} />
                      <Box sx={{ width: 118, height: '84%', borderRadius: '8px', bgcolor: cor, color: '#0B0A09', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8 }}>
                        <IconeTipo tp={l.tp} tamanho={fonteLinha} />
                        <Typography sx={{ fontWeight: 800, fontSize: fonteLinha - 4, color: '#0B0A09' }}>{l.tipo}</Typography>
                      </Box>
                      <Box sx={{ width: 2, height: '60%', bgcolor: 'rgba(255,255,255,0.4)' }} />
                      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: fonteLinha, color: '#F4F1EC' }}>{l.titulo}</Typography>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
      <Typography sx={{ mt: 1.2, fontSize: '0.72rem', color: DS.t3 }}>
        Interligado ao Calendário de postagem: conteúdo novo, remarcado ou excluído lá aparece aqui na hora.
      </Typography>
    </Box>
  )
}
