/* MinhaProducaoDesigner — o painel de produção APROVADA no Meu Dia.

   Mostra SÓ os números da pessoa logada: quantas peças ela teve aprovadas hoje,
   na semana e no mês, mais o que está aguardando aprovação e em correção. Nada
   de comparação nem de outra pessoa — a conta é feita só sobre as peças dela
   (`artesDoDesigner(currentUser)`), então não há como um ver o do outro.

   Serve dois perfis com o MESMO formato e a MESMA conta:
     • design → "artes aprovadas" (Julio, Jhones)
     • vídeo  → "vídeos aprovados" (Kaique, editores)
   O que muda é só a palavra e o ícone; a lib `designerProducao` conta peças
   aprovadas de qualquer autor. Assim o Kaique tem o formato dos designers, e o
   número que ele vê é o mesmo que a gestão fecharia.

   O botão Relatório monta o texto dos aprovados (dia/mês) para mandar no grupo —
   consistente com os números da tela, porque sai da mesma lib.
*/
import { useMemo, useState } from 'react'
import {
  Box, Paper, Typography, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material'
import PaletteIcon from '@mui/icons-material/Palette'
import MovieCreationIcon from '@mui/icons-material/MovieCreation'
import SummarizeIcon from '@mui/icons-material/Summarize'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import type { ContentItem, ItemState } from '../types'
import { STATUS_CONFIG } from '../types'
import {
  artesDoDesigner, resumoDesigner, aprovadasPorClienteMes, aprovadasDoMes,
  relatorioAprovadasDia, relatorioAprovadasMes, type ArteDesigner, type RelatorioProd,
} from '../lib/designerProducao'
import { carregarPaineis, carregarAtribuicoes } from '../lib/paineis'
import { NAME_MAP, getDisplayName } from '../lib/users'
import { DS } from '../theme'
import { clickable } from '../shared/a11y'

type PerfilKey = 'design' | 'video'

interface PerfilCfg {
  Icone: typeof PaletteIcon
  legenda: string            // "suas artes aprovadas"
  subst: string              // "arte" | "vídeo"
  singular: string           // "1 arte aprovada"
  plural: string             // "N aprovadas"
  recentes: string           // "Aprovadas recentes"
  vazio: string
}

const PERFIS: Record<PerfilKey, PerfilCfg> = {
  design: {
    Icone: PaletteIcon, legenda: 'suas artes aprovadas', subst: 'arte',
    singular: '1 arte aprovada', plural: 'aprovadas', recentes: 'Aprovadas recentes',
    vazio: 'Nenhuma arte aprovada ainda. Quando o cliente aprovar suas artes, elas aparecem aqui.',
  },
  video: {
    Icone: MovieCreationIcon, legenda: 'seus vídeos aprovados', subst: 'vídeo',
    singular: '1 vídeo aprovado', plural: 'aprovados', recentes: 'Aprovados recentes',
    vazio: 'Nenhum vídeo aprovado ainda. Quando o cliente aprovar seus vídeos, eles aparecem aqui.',
  },
}

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  currentUser: string
  now: Date
  /** design (padrão) muda a palavra para "artes"; video para "vídeos". */
  perfil?: PerfilKey
}

function Numero({ valor, cor }: { valor: number; cor: string }) {
  return (
    <Typography key={valor} sx={{
      fontWeight: 900, lineHeight: 1, color: cor,
      fontSize: { xs: '2rem', md: '2.4rem', xl: '2.8rem' },
      letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
      animation: 'countUp 0.45s cubic-bezier(0.16,1,0.3,1) both',
    }}>
      {valor}
    </Typography>
  )
}

function Metrica({ rotulo, valor, cor, detalhe }: { rotulo: string; valor: number; cor: string; detalhe?: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: { xs: 92, sm: 110 } }}>
      <Typography sx={{
        fontSize: { xs: '0.55rem', xl: '0.62rem' }, color: DS.t2, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.5,
      }}>
        {rotulo}
      </Typography>
      <Numero valor={valor} cor={cor} />
      {detalhe && (
        <Typography sx={{ fontSize: { xs: '0.58rem', xl: '0.65rem' }, color: DS.t3, mt: 0.35 }}>{detalhe}</Typography>
      )}
    </Box>
  )
}

export default function MinhaProducaoDesigner({ items, states, currentUser, now, perfil = 'design' }: Props) {
  const cfg = PERFIS[perfil]
  const { Icone } = cfg
  const [relatorioAberto, setRelatorioAberto] = useState(false)

  const paineis = useMemo(() => carregarPaineis(), [])
  const atrib = useMemo(() => carregarAtribuicoes(), [])

  const artes = useMemo(
    () => artesDoDesigner(items, states, atrib, paineis, currentUser),
    [items, states, atrib, paineis, currentUser],
  )
  const resumo = useMemo(() => resumoDesigner(artes, now), [artes, now])
  const porCliente = useMemo(() => aprovadasPorClienteMes(artes, now), [artes, now])
  const recentes = useMemo(() => aprovadasDoMes(artes, now).slice(0, 8), [artes, now])

  const cor = NAME_MAP[currentUser]?.color && NAME_MAP[currentUser].color !== '#9CA3AF'
    ? NAME_MAP[currentUser].color : DS.purpleSoft
  const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long' })

  return (
    <Paper sx={{
      position: 'relative', overflow: 'hidden', mb: 2.25,
      px: { xs: 2, md: 2.5, xl: 3 }, py: { xs: 1.7, md: 2, xl: 2.3 },
      background: `linear-gradient(115deg, ${cor}12 0%, ${DS.surface} 52%, ${DS.surfaceAlt} 100%)`,
      border: `1px solid ${cor}2e`, borderRadius: 3,
      animation: 'fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
    }}>
      {/* ── Cabeçalho ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, mb: 1.6 }}>
        <Box sx={{
          width: { xs: 34, md: 38 }, height: { xs: 34, md: 38 }, borderRadius: '11px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${cor}1c`, border: `1px solid ${cor}45`, color: cor,
        }}>
          <Icone sx={{ fontSize: 19 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{
            fontWeight: 800, color: DS.t1, letterSpacing: '-0.02em', lineHeight: 1.15,
            fontSize: { xs: '0.95rem', md: '1.05rem', xl: '1.2rem' },
          }}>
            Minha Produção
          </Typography>
          <Typography sx={{ fontSize: { xs: '0.63rem', xl: '0.72rem' }, color: DS.t3 }}>
            {NAME_MAP[currentUser]?.emoji} {getDisplayName(currentUser)} — {cfg.legenda}
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', flexShrink: 0 }}>
          <BotaoRelatorio onClick={() => setRelatorioAberto(true)} />
        </Box>
      </Box>

      {/* ── Os números que importam ── */}
      <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 2.5 }, flexWrap: 'wrap', mb: porCliente.length > 0 || recentes.length > 0 ? 2 : 0 }}>
        <Metrica rotulo="Hoje" valor={resumo.aprovadasHoje} cor={resumo.aprovadasHoje > 0 ? DS.green : DS.t3}
          detalhe={resumo.aprovadasHoje === 1 ? cfg.singular : `${resumo.aprovadasHoje} ${cfg.plural}`} />
        <Metrica rotulo="Esta semana" valor={resumo.aprovadasSemana} cor={cor} />
        <Metrica rotulo={`Em ${mesLabel}`} valor={resumo.aprovadasMes} cor={cor} />
        <Metrica rotulo="Aguardando" valor={resumo.aguardando} cor={resumo.aguardando > 0 ? DS.amber : DS.t3} />
        <Metrica rotulo="Em correção" valor={resumo.correcao} cor={resumo.correcao > 0 ? DS.red : DS.t3} />
      </Box>

      {/* ── Por cliente, no mês ── */}
      {porCliente.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap', mb: recentes.length > 0 ? 1.6 : 0 }}>
          {porCliente.slice(0, 6).map(c => (
            <Box key={c.cliente} sx={{
              px: 1, py: 0.4, borderRadius: '7px', bgcolor: `${cor}0f`, border: `1px solid ${cor}2e`,
              display: 'flex', alignItems: 'center', gap: 0.6,
            }}>
              <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.68rem' }, color: DS.t2, fontWeight: 600 }} noWrap>{c.cliente}</Typography>
              <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.68rem' }, color: cor, fontWeight: 800 }}>{c.n}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* ── Produção recente (só as próprias peças) ── */}
      {recentes.length > 0 && (
        <Box sx={{ pt: 1.2, borderTop: `1px solid ${cor}1a` }}>
          <Typography sx={{
            fontSize: { xs: '0.55rem', xl: '0.62rem' }, color: DS.t3, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.8,
          }}>
            {cfg.recentes}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {recentes.map(a => {
              const scfg = STATUS_CONFIG[a.status]
              return (
                <Box key={a.itemId} sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 1, py: 0.6, borderRadius: '8px', bgcolor: DS.field, border: `1px solid ${DS.border}`,
                }}>
                  <Typography sx={{ fontSize: '0.6rem', color: DS.t3, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {a.aprovadaEm ? new Date(a.aprovadaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}
                  </Typography>
                  <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, color: DS.t1, fontWeight: 600, minWidth: 0 }} noWrap>
                    {a.titulo}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: DS.t3, ml: 'auto', flexShrink: 0 }} noWrap>{a.cliente}</Typography>
                  <Tooltip title={scfg?.label ?? ''}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: scfg?.color, flexShrink: 0 }} />
                  </Tooltip>
                </Box>
              )
            })}
          </Box>
        </Box>
      )}

      {/* Nada ainda: a tela não some, orienta. */}
      {resumo.aprovadasTotal === 0 && resumo.aguardando === 0 && resumo.correcao === 0 && (
        <Typography sx={{ fontSize: '0.72rem', color: DS.t3, mt: 0.5 }}>{cfg.vazio}</Typography>
      )}

      <DialogRelatorio
        aberto={relatorioAberto}
        onFechar={() => setRelatorioAberto(false)}
        artes={artes}
        now={now}
        quem={getDisplayName(currentUser)}
        subst={cfg.subst}
      />
    </Paper>
  )
}

function BotaoRelatorio({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip title="Relatório dos aprovados, pronto para enviar">
      <Box
        {...clickable(onClick)}
        aria-label="Abrir relatório de produção"
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.4,
          px: 1, py: 0.5, borderRadius: '9px', cursor: 'pointer',
          border: `1px solid ${DS.border}`, bgcolor: DS.field,
          transition: 'all 0.18s ease', '&:hover': { borderColor: DS.borderHov, bgcolor: DS.surfaceAlt },
        }}
      >
        <SummarizeIcon sx={{ fontSize: 14, color: DS.t2 }} />
        <Typography sx={{ fontSize: '0.63rem', fontWeight: 700, color: DS.t2, whiteSpace: 'nowrap' }}>Relatório</Typography>
      </Box>
    </Tooltip>
  )
}

function DialogRelatorio({ aberto, onFechar, artes, now, quem, subst }: {
  aberto: boolean; onFechar: () => void; artes: ArteDesigner[]; now: Date; quem: string; subst: string
}) {
  const [aba, setAba] = useState<'dia' | 'mes'>('dia')
  const [copiado, setCopiado] = useState(false)

  const r: RelatorioProd = useMemo(
    () => (aba === 'dia'
      ? relatorioAprovadasDia(artes, now, quem, subst, now)
      : relatorioAprovadasMes(artes, now, quem, subst)),
    [aba, artes, now, quem, subst],
  )

  const copiar = () => {
    navigator.clipboard.writeText(r.texto).then(() => {
      setCopiado(true); setTimeout(() => setCopiado(false), 1800)
    }).catch(() => { /* sem permissão: o texto está na tela */ })
  }

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: DS.t1 }}>Relatório de produção</Typography>
        <Box sx={{ display: 'flex', gap: 0.8, mt: 1.2 }}>
          {([['dia', 'Hoje'], ['mes', 'Este mês']] as const).map(([k, rotulo]) => (
            <Box key={k} {...clickable(() => setAba(k))} sx={{
              px: 1.4, py: 0.5, borderRadius: '8px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 800,
              color: aba === k ? DS.t1 : DS.t3, bgcolor: aba === k ? DS.surfaceAlt : 'transparent',
              border: `1px solid ${aba === k ? DS.border : 'transparent'}`, transition: 'all 0.18s ease',
            }}>
              {rotulo}
            </Box>
          ))}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ p: 1.4, borderRadius: '10px', bgcolor: DS.field, border: `1px solid ${DS.border}`, maxHeight: 280, overflow: 'auto' }}>
          <Typography component="pre" sx={{
            m: 0, fontSize: '0.72rem', lineHeight: 1.7, color: r.vazio ? DS.t3 : DS.t1,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit',
          }}>
            {r.texto}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button size="small" onClick={onFechar} sx={{ color: DS.t3 }}>Fechar</Button>
        <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />} onClick={copiar} disabled={r.vazio} sx={{ color: DS.t2 }}>
          {copiado ? 'Copiado' : 'Copiar'}
        </Button>
        <Button size="small" variant="contained" startIcon={<WhatsAppIcon sx={{ fontSize: 15 }} />} disabled={r.vazio}
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(r.texto)}`, '_blank', 'noopener')}>
          WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  )
}
