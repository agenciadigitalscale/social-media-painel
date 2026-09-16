/* FechamentoTab — fechar o mês da produção de artes (Julio, Jhones).

   No fim do mês a liderança trava o que foi feito: um snapshot que não muda mais
   se alguém mexer num card antigo. É a base de pagamento — por isso é congelada,
   não derivada ao vivo. Só Julio e Jhones (Kaique é gerente, fora). Sem valores:
   só a contagem; o pagamento a gestão calcula por fora.

   Enquanto o mês não é fechado, mostra o número AO VIVO (o que a aba de cada
   designer também mostra) com o botão "Fechar mês". Depois de fechado, mostra o
   número TRAVADO com quem/quando fechou e a opção de reabrir. */
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Paper, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip,
} from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import type { ContentItem, ItemState } from '../types'
import { artesDoDesigner, aprovadasDoMes } from '../lib/designerProducao'
import {
  carregarFechamentos, salvarFechamentos, construirFechamento, aplicarFechamento,
  reabrirMes, mesFechado, chaveMes, rotuloMes, DESIGNERS_FECHAMENTO,
  type FechamentosStore,
} from '../lib/designerFechamento'
import { carregarPaineis, carregarAtribuicoes } from '../lib/paineis'
import { getDisplayName, NAME_MAP } from '../lib/users'
import { DS } from '../theme'
import { clickable } from '../shared/a11y'

export default function FechamentoTab({ items, states, now, currentUser }: {
  items: ContentItem[]
  states: Record<number, ItemState>
  now: Date
  currentUser: string
}) {
  const [store, setStore] = useState<FechamentosStore>(() => carregarFechamentos())
  const [mesRef, setMesRef] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [confirmar, setConfirmar] = useState<null | 'fechar' | 'reabrir'>(null)

  // O fechamento sincroniza; um fechamento feito noutro aparelho chega pelo poll.
  useEffect(() => {
    const recarregar = () => setStore(carregarFechamentos())
    window.addEventListener('ds:designerFechamento', recarregar)
    return () => window.removeEventListener('ds:designerFechamento', recarregar)
  }, [])

  const paineis = useMemo(() => carregarPaineis(), [])
  const atrib = useMemo(() => carregarAtribuicoes(), [])

  // Artes aprovadas NO MÊS selecionado, por designer (ao vivo).
  const refMes = useMemo(() => new Date(mesRef.getFullYear(), mesRef.getMonth(), 15), [mesRef])
  const porDesigner = useMemo(
    () => DESIGNERS_FECHAMENTO.map(designer => {
      const artes = artesDoDesigner(items, states, atrib, paineis, designer)
      return { designer, artesDoMes: aprovadasDoMes(artes, refMes) }
    }),
    [items, states, atrib, paineis, refMes],
  )

  const mes = chaveMes(mesRef)
  const fechado = mesFechado(store, mes)
  const mesAtual = chaveMes(now)
  const ehFuturo = mes > mesAtual
  const podeAvancar = mes < mesAtual

  const persistir = (novo: FechamentosStore) => {
    setStore(novo)
    salvarFechamentos(novo)
  }

  const fecharMes = () => {
    persistir(aplicarFechamento(store, construirFechamento(mes, porDesigner, currentUser)))
    setConfirmar(null)
  }
  const reabrir = () => {
    persistir(reabrirMes(store, mes))
    setConfirmar(null)
  }

  const totalAoVivo = porDesigner.reduce((s, d) => s + d.artesDoMes.length, 0)
  const nomeMes = mesRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto', px: { xs: 0, md: 1 }, py: { xs: 0.5, md: 1.5 } }}>
      {/* Cabeçalho + navegação de mês */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.6 }}>
        <EventAvailableIcon sx={{ fontSize: 20, color: DS.accent }} />
        <Typography sx={{ fontSize: { xs: '1rem', md: '1.15rem' }, fontWeight: 800, color: DS.t1, letterSpacing: '-0.02em' }}>
          Fechamento do mês
        </Typography>
      </Box>
      <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, color: DS.t2, mb: 1.6 }}>
        Trava a produção de artes (Julio e Jhones) no fim do mês para pagamento — o número congela e
        não muda mais se um card antigo for alterado. Só contagem, sem valores.
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.4 }}>
        <Box {...clickable(() => setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() - 1, 1)))} aria-label="Mês anterior" sx={{
          width: 30, height: 30, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: DS.t2, border: `1px solid ${DS.border}`, bgcolor: DS.field,
          '&:hover': { color: DS.t1, borderColor: DS.borderHov },
        }}>‹</Box>
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: DS.t1, textTransform: 'capitalize' }}>{nomeMes}</Typography>
        <Box {...clickable(() => podeAvancar && setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 1)))} aria-label="Próximo mês" sx={{
          width: 30, height: 30, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: podeAvancar ? 'pointer' : 'default', color: podeAvancar ? DS.t2 : DS.t4,
          border: `1px solid ${DS.border}`, bgcolor: DS.field,
          '&:hover': podeAvancar ? { color: DS.t1, borderColor: DS.borderHov } : undefined,
        }}>›</Box>
      </Box>

      {/* Estado do mês */}
      <Paper sx={{ p: { xs: 1.8, md: 2.3 }, borderRadius: 3, mb: 2, border: `1px solid ${fechado ? `${DS.green}44` : DS.border}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.6 }}>
          {fechado
            ? <LockIcon sx={{ fontSize: 17, color: DS.green }} />
            : <LockOpenIcon sx={{ fontSize: 17, color: DS.amber }} />}
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: fechado ? DS.green : DS.amber, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {fechado ? 'Mês fechado' : ehFuturo ? 'Mês futuro' : 'Mês aberto — números ao vivo'}
          </Typography>
          {fechado && (
            <Typography sx={{ fontSize: '0.62rem', color: DS.t3, ml: 'auto' }}>
              travado em {new Date(fechado.fechadoEm).toLocaleDateString('pt-BR')} por {getDisplayName(fechado.fechadoPor)}
            </Typography>
          )}
        </Box>

        {/* Números por designer */}
        <Box sx={{ display: 'flex', gap: { xs: 2, md: 4 }, flexWrap: 'wrap', mb: 2 }}>
          {DESIGNERS_FECHAMENTO.map(designer => {
            const total = fechado
              ? (fechado.designers.find(d => d.designer === designer)?.total ?? 0)
              : (porDesigner.find(d => d.designer === designer)?.artesDoMes.length ?? 0)
            const cor = NAME_MAP[designer]?.color && NAME_MAP[designer].color !== '#9CA3AF' ? NAME_MAP[designer].color : DS.purpleSoft
            return (
              <Box key={designer}>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: DS.t2, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                  {NAME_MAP[designer]?.emoji} {getDisplayName(designer)}
                </Typography>
                <Typography sx={{ fontSize: { xs: '2.2rem', md: '2.6rem' }, fontWeight: 900, lineHeight: 1, color: cor, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                  {total}
                </Typography>
                <Typography sx={{ fontSize: '0.62rem', color: DS.t3, mt: 0.3 }}>{total === 1 ? 'arte' : 'artes'}</Typography>
              </Box>
            )
          })}
        </Box>

        {/* Ação */}
        {fechado ? (
          <Button size="small" startIcon={<LockOpenIcon sx={{ fontSize: 15 }} />} onClick={() => setConfirmar('reabrir')}
            sx={{ color: DS.t2, border: `1px solid ${DS.border}`, '&:hover': { borderColor: DS.borderHov } }}>
            Reabrir mês
          </Button>
        ) : (
          <Tooltip title={ehFuturo ? 'Não dá para fechar um mês que ainda não chegou' : ''}>
            <span>
              <Button size="small" variant="contained" disabled={ehFuturo} startIcon={<LockIcon sx={{ fontSize: 15 }} />}
                onClick={() => setConfirmar('fechar')}>
                Fechar mês ({totalAoVivo} {totalAoVivo === 1 ? 'arte' : 'artes'})
              </Button>
            </span>
          </Tooltip>
        )}
      </Paper>

      {/* Histórico de meses fechados */}
      <MesesFechados store={store} atualMes={mes} onAbrir={m => {
        const [ano, mm] = m.split('-').map(Number)
        setMesRef(new Date(ano, mm - 1, 1))
      }} />

      {/* Confirmações */}
      <Dialog open={confirmar !== null} onClose={() => setConfirmar(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 800 }}>
          {confirmar === 'fechar' ? `Fechar ${nomeMes}?` : `Reabrir ${nomeMes}?`}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.78rem', color: DS.t2 }}>
            {confirmar === 'fechar'
              ? `Vai travar Julio ${porDesigner[0]?.artesDoMes.length ?? 0} e Jhones ${porDesigner[1]?.artesDoMes.length ?? 0}. Depois disso o número não muda mais, mesmo que um card seja alterado. Dá para reabrir se precisar.`
              : 'O mês volta a contar ao vivo. O número travado é descartado — se fechar de novo, ele reflete o estado atual dos cards.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button size="small" onClick={() => setConfirmar(null)} sx={{ color: DS.t3 }}>Cancelar</Button>
          <Button size="small" variant="contained" color={confirmar === 'reabrir' ? 'warning' : 'primary'}
            onClick={confirmar === 'fechar' ? fecharMes : reabrir}>
            {confirmar === 'fechar' ? 'Fechar mês' : 'Reabrir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function MesesFechados({ store, atualMes, onAbrir }: {
  store: FechamentosStore; atualMes: string; onAbrir: (mes: string) => void
}) {
  const meses = useMemo(() => Object.values(store).sort((a, b) => b.mes.localeCompare(a.mes)), [store])
  if (meses.length === 0) return null
  return (
    <Box>
      <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.8 }}>
        Meses fechados
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
        {meses.map(f => {
          const total = f.designers.reduce((s, d) => s + d.total, 0)
          return (
            <Box key={f.mes} {...clickable(() => onAbrir(f.mes))} sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.4, py: 0.9, cursor: 'pointer',
              borderRadius: '9px', bgcolor: f.mes === atualMes ? `${DS.accent}12` : DS.field,
              border: `1px solid ${f.mes === atualMes ? `${DS.accent}44` : DS.border}`,
              '&:hover': { borderColor: DS.borderHov },
            }}>
              <LockIcon sx={{ fontSize: 14, color: DS.green, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: DS.t1, textTransform: 'capitalize', minWidth: 0 }} noWrap>
                {rotuloMes(f.mes)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.2, ml: 'auto', flexShrink: 0 }}>
                {f.designers.map(d => (
                  <Typography key={d.designer} sx={{ fontSize: '0.66rem', color: DS.t2 }}>
                    {getDisplayName(d.designer)} <b style={{ color: DS.t1 }}>{d.total}</b>
                  </Typography>
                ))}
                <Typography sx={{ fontSize: '0.66rem', color: DS.t3 }}>· total <b style={{ color: DS.t1 }}>{total}</b></Typography>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
