import { useState } from 'react'
import {
  Box, Typography, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Tooltip, IconButton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { DS } from '../../theme'
import { clickable, clickableStop } from '../../shared/a11y'
import { NAME_MAP, getDisplayName } from '../../lib/users'
import { CORES_PAINEL, type ContagemPainel, type Painel, type PainelArea } from '../../lib/paineis'

/**
 * A fileira de gavetas do board: uma por pessoa, criada e batizada na tela.
 *
 * Fica acima do kanban porque é a primeira pergunta de quem chega ("o que é
 * meu?"), e não um filtro escondido atrás de um menu — a versão anterior disso
 * era o painel "Carga", que só filtrava pelos 7 nomes fixos do código e vivia
 * fechado atrás de um toggle.
 */

export type PainelSelecionado = 'todos' | 'sem' | string

interface Props {
  area: PainelArea
  paineis: Painel[]
  contagem: ContagemPainel
  ativo: PainelSelecionado
  onSelecionar: (v: PainelSelecionado) => void
  onCriar: (nome: string, membro?: string) => void
  onEditar: (id: string, patch: { nome?: string; cor?: string; membro?: string }) => void
  onRemover: (id: string) => void
  onReordenar: (id: string, direcao: -1 | 1) => void
}

const ROTULO: Record<PainelArea, string> = { vid: 'editor', des: 'designer' }

export default function PaineisBar({
  area, paineis, contagem, ativo, onSelecionar, onCriar, onEditar, onRemover, onReordenar,
}: Props) {
  const [menu, setMenu]       = useState<{ el: HTMLElement; painel: Painel } | null>(null)
  const [editando, setEditando] = useState<Painel | null>(null)
  const [criando, setCriando] = useState(false)
  const [nome, setNome]       = useState('')
  const [membro, setMembro]   = useState('')
  const [cor, setCor]         = useState<string>(CORES_PAINEL[0])
  const [confirmar, setConfirmar] = useState<Painel | null>(null)

  const abrirEdicao = (p: Painel) => {
    setEditando(p); setNome(p.nome); setMembro(p.membro ?? ''); setCor(p.cor); setMenu(null)
  }
  const abrirCriacao = () => {
    setCriando(true); setNome(''); setMembro(''); setCor(CORES_PAINEL[paineis.length % CORES_PAINEL.length])
  }
  const fechar = () => { setEditando(null); setCriando(false) }

  const salvar = () => {
    if (criando) onCriar(nome, membro || undefined)
    else if (editando) onEditar(editando.id, { nome, cor, membro })
    fechar()
  }

  const pilula = (
    chave: PainelSelecionado,
    rotulo: string,
    n: number,
    corPilula: string,
    extra?: React.ReactNode,
  ) => {
    const on = ativo === chave
    return (
      <Box
        key={chave}
        {...clickable(() => onSelecionar(chave))}
        aria-pressed={on}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.7, flexShrink: 0,
          px: 1.2, minHeight: 34, borderRadius: '10px', cursor: 'pointer',
          bgcolor: on ? `${corPilula}1f` : 'rgba(244,247,255,0.04)',
          border: `1px solid ${on ? `${corPilula}66` : 'rgba(244,247,255,0.08)'}`,
          transition: 'all 0.18s ease',
          '&:hover': { bgcolor: on ? `${corPilula}26` : 'rgba(244,247,255,0.07)' },
        }}
      >
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: corPilula, flexShrink: 0 }} />
        <Typography sx={{
          fontSize: '0.72rem', fontWeight: on ? 700 : 600, lineHeight: 1,
          color: on ? DS.t1 : 'rgba(244,247,255,0.62)', whiteSpace: 'nowrap',
        }}>
          {rotulo}
        </Typography>
        <Typography sx={{
          fontSize: '0.66rem', fontWeight: 800, lineHeight: 1,
          color: on ? corPilula : 'rgba(244,247,255,0.35)', fontVariantNumeric: 'tabular-nums',
        }}>
          {n}
        </Typography>
        {extra}
      </Box>
    )
  }

  return (
    <>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.8, px: 2, py: 1,
        overflowX: 'auto', flexShrink: 0,
        borderBottom: '1px solid rgba(244,247,255,0.04)',
        '&::-webkit-scrollbar': { height: 0 },
      }}>
        <Typography sx={{
          fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          color: 'rgba(244,247,255,0.28)', mr: 0.2, flexShrink: 0,
        }}>
          Painéis:
        </Typography>

        {pilula('todos', 'Todos', contagem.total, DS.neutral)}

        {paineis.map(p => pilula(
          p.id,
          p.nome,
          contagem.porPainel[p.id] ?? 0,
          p.cor,
          <IconButton
            size="small"
            {...clickableStop(() => {})}
            onClick={e => { e.stopPropagation(); setMenu({ el: e.currentTarget, painel: p }) }}
            aria-label={`Opções do painel ${p.nome}`}
            sx={{ p: 0.2, ml: 0.1, color: 'rgba(244,247,255,0.3)', '&:hover': { color: DS.t1 } }}
          >
            <MoreVertIcon sx={{ fontSize: 14 }} />
          </IconButton>,
        ))}

        {/* "Sem painel" só existe quando há o que mostrar nele — senão vira uma
            gaveta vazia permanente ocupando a fileira. */}
        {contagem.semPainel > 0 && pilula('sem', 'Sem painel', contagem.semPainel, DS.t4)}

        <Tooltip title={`Novo painel de ${ROTULO[area]}`}>
          <Box
            {...clickable(abrirCriacao)}
            aria-label={`Criar painel de ${ROTULO[area]}`}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.4, flexShrink: 0,
              px: 1, minHeight: 34, borderRadius: '10px', cursor: 'pointer',
              border: '1px dashed rgba(244,247,255,0.18)', color: 'rgba(244,247,255,0.5)',
              transition: 'all 0.18s ease',
              '&:hover': { borderColor: DS.accent, color: DS.accent, bgcolor: 'rgba(59,130,246,0.06)' },
            }}
          >
            <AddIcon sx={{ fontSize: 15 }} />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, lineHeight: 1 }}>Painel</Typography>
          </Box>
        </Tooltip>
      </Box>

      {/* Medido em 2026-08-31: 260 dos 263 cards abertos não têm responsável
          nenhum. Então as gavetas nascem vazias com o board cheio, e sem uma
          linha explicando o que fazer o recurso parece quebrado. A dica some
          sozinha assim que a primeira atribuição acontece. */}
      {paineis.length > 0 && contagem.semPainel > 0 && Object.keys(contagem.porPainel).length === 0 && (
        <Box sx={{
          px: 2, py: 0.7, display: 'flex', alignItems: 'center', gap: 0.8, flexShrink: 0,
          borderBottom: '1px solid rgba(244,247,255,0.04)', bgcolor: 'rgba(245,158,11,0.05)',
        }}>
          <Typography sx={{ fontSize: '0.68rem', color: DS.amber, lineHeight: 1.5 }}>
            Os painéis ainda estão vazios. Toque em <strong>Selecionar</strong>, marque os cards
            de cada pessoa e use <strong>👤 Atribuir a painel</strong> — dá para fazer em lote.
          </Typography>
        </Box>
      )}

      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => menu && abrirEdicao(menu.painel)}>✏️ Renomear / vincular</MenuItem>
        <MenuItem onClick={() => { if (menu) onReordenar(menu.painel.id, -1); setMenu(null) }}>← Mover para a esquerda</MenuItem>
        <MenuItem onClick={() => { if (menu) onReordenar(menu.painel.id, 1); setMenu(null) }}>→ Mover para a direita</MenuItem>
        <MenuItem
          onClick={() => { if (menu) setConfirmar(menu.painel); setMenu(null) }}
          sx={{ color: DS.redSoft }}
        >
          🗑️ Excluir painel
        </MenuItem>
      </Menu>

      {/* Criar / editar */}
      <Dialog open={criando || !!editando} onClose={fechar} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 800 }}>
          {criando ? `Novo painel de ${ROTULO[area]}` : 'Editar painel'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField
            autoFocus
            size="small"
            label="Nome do painel"
            placeholder={area === 'vid' ? 'Kaique' : 'Diones'}
            value={nome}
            onChange={e => setNome(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && nome.trim()) salvar() }}
          />

          <TextField
            select
            size="small"
            label="Vincular a um membro da equipe (opcional)"
            value={membro}
            onChange={e => setMembro(e.target.value)}
            helperText="Vinculando, o painel já mostra tudo que está atribuído a essa pessoa."
          >
            <MenuItem value="">Sem vínculo</MenuItem>
            {Object.keys(NAME_MAP).map(k => (
              <MenuItem key={k} value={k}>{NAME_MAP[k].emoji} {getDisplayName(k)} — {NAME_MAP[k].role}</MenuItem>
            ))}
          </TextField>

          {!criando && (
            <Box>
              <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mb: 0.8 }}>Cor</Typography>
              <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                {CORES_PAINEL.map(c => (
                  <Box
                    key={c}
                    {...clickable(() => setCor(c))}
                    aria-label={`Usar a cor ${c}`}
                    sx={{
                      width: 26, height: 26, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                      border: cor === c ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: cor === c ? `0 0 0 2px ${c}` : 'none',
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={fechar} sx={{ color: 'text.secondary' }}>Cancelar</Button>
          <Button variant="contained" onClick={salvar} disabled={!nome.trim()}>
            {criando ? 'Criar painel' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Excluir */}
      <Dialog open={!!confirmar} onClose={() => setConfirmar(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 800 }}>Excluir “{confirmar?.nome}”?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.84rem', color: 'text.secondary', lineHeight: 1.7 }}>
            Os cards deste painel <strong>não são apagados</strong> — eles voltam para “Sem painel”
            e continuam no board, no mesmo lugar.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmar(null)} sx={{ color: 'text.secondary' }}>Cancelar</Button>
          <Button
            onClick={() => { if (confirmar) onRemover(confirmar.id); setConfirmar(null) }}
            sx={{ color: DS.red, fontWeight: 700 }}
          >
            Excluir painel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
