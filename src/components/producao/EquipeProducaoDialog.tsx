/* EquipeProducaoDialog — Encarregados e Painéis, editados na tela (2026-10-29).

   Abre pelo ícone ao lado do filtro "Encarregado" da Produção (Social Media e
   sócios). A regra mora em lib/equipeProducao: cada função de produção do
   encarregado é a gaveta de sempre, então o que se muda aqui vale na hora para
   o board, a atribuição, a contagem e a "Minha esteira" — sem lista paralela. */
import { useMemo, useState } from 'react'
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Switch,
  Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { DS } from '../../theme'
import { NAME_MAP } from '../../lib/users'
import { donoDoCard } from '../../lib/access'
import { clickable } from '../../shared/a11y'
import type { ContentItem, ItemState } from '../../types'
import type { Atribuicoes, PaineisStore } from '../../lib/paineis'
import { useEquipe } from '../../lib/useEquipe'
import {
  FUNCOES, cardEhDoEncarregado, criarEncarregado, editarEncarregado, equipeAtual, gruposDoEncarregado,
  listaEncarregados, listaGrupos, moverGrupo, removerEncarregado, removerGrupo, salvarEquipe, salvarGrupo,
  type DadosEncarregado, type Encarregado, type Funcao, type GrupoPainel,
} from '../../lib/equipeProducao'

const rotuloFuncao = (f: Funcao) => FUNCOES.find(x => x.id === f)?.rotulo ?? f

function Pilula({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Box {...clickable(onClick)} sx={{
      px: 1.2, height: 28, display: 'inline-flex', alignItems: 'center', borderRadius: '999px', cursor: 'pointer',
      fontSize: { xs: '0.72rem', xl: '0.8rem' }, fontWeight: 700, whiteSpace: 'nowrap',
      bgcolor: ativo ? DS.accent : 'transparent', color: ativo ? DS.onAccent : DS.t2,
      border: `1px solid ${ativo ? DS.accent : DS.border}`, transition: 'all 0.15s ease',
      '&:hover': { borderColor: DS.accent },
    }}>{children}</Box>
  )
}

const Rotulo = ({ children }: { children: React.ReactNode }) => (
  <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DS.t3, mb: 0.6 }}>
    {children}
  </Typography>
)

export default function EquipeProducaoDialog({ open, onClose, items, states, atribuicoes, paineis }: {
  open: boolean
  onClose: () => void
  items: ContentItem[]
  states: Record<number, ItemState>
  atribuicoes: Atribuicoes
  paineis: PaineisStore
}) {
  const equipe = useEquipe()
  const [aba, setAba] = useState(0)
  const [form, setForm] = useState<{ id?: string; dados: DadosEncarregado } | null>(null)
  const [grupoForm, setGrupoForm] = useState<{ id?: string; nome: string; membros: string[] } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Cards em aberto de cada encarregado — pela MESMA regra de dono do board.
  const abertos = useMemo(() => {
    const out: Record<string, number> = {}
    const lista = listaEncarregados(equipe, { incluirInativos: true })
    for (const it of items) {
      const st = states[it.i]
      if (!st || st.status === 7) continue
      const dono = donoDoCard(it.i, st, atribuicoes, paineis)
      const e = lista.find(x => cardEhDoEncarregado(dono, x))
      if (e) out[e.id] = (out[e.id] ?? 0) + 1
    }
    return out
  }, [equipe, items, states, atribuicoes, paineis])

  const gravar = (fn: (eq: ReturnType<typeof equipeAtual>) => ReturnType<typeof equipeAtual>) => salvarEquipe(fn(equipeAtual()))

  const perfisLivres = (id?: string) => Object.keys(NAME_MAP).filter(p =>
    !listaEncarregados(equipe, { incluirInativos: true }).some(e => e.perfil === p && e.id !== id))

  const abrirNovo = () => setForm({ dados: { nome: '', funcoes: [], ativo: true, grupos: [] } })
  const abrirEdicao = (e: Encarregado) => setForm({
    id: e.id,
    dados: { nome: e.nome, funcoes: e.funcoes, perfil: e.perfil, ativo: e.ativo, grupos: gruposDoEncarregado(equipe, e.id).map(g => g.id) },
  })

  const salvarForm = () => {
    if (!form) return
    const d = form.dados
    if (!d.nome.trim()) { setAviso('Dê um nome ao encarregado.'); return }
    if (!d.funcoes.length) { setAviso('Escolha ao menos uma função.'); return }
    const agora = Date.now()
    gravar(eq => form.id ? editarEncarregado(eq, form.id, d, agora) : criarEncarregado(eq, d, agora).eq)
    setForm(null); setAviso(null)
  }

  const apagar = (e: Encarregado) => {
    if (abertos[e.id]) { setAviso(`${e.nome} tem ${abertos[e.id]} card(s) em aberto — desative em vez de apagar (os cards e a contagem ficam).`); return }
    if (!window.confirm(`Apagar ${e.nome} do cadastro? Nenhum card é apagado.`)) return
    gravar(eq => removerEncarregado(eq, e.id))
  }

  const alternarAtivo = (e: Encarregado) => gravar(eq => editarEncarregado(eq, e.id, {
    nome: e.nome, funcoes: e.funcoes, perfil: e.perfil, ativo: !e.ativo, grupos: gruposDoEncarregado(eq, e.id).map(g => g.id),
  }, Date.now()))

  const salvarGrupoForm = () => {
    if (!grupoForm) return
    if (!grupoForm.nome.trim()) { setAviso('Dê um nome ao painel.'); return }
    gravar(eq => salvarGrupo(eq, grupoForm, Date.now()))
    setGrupoForm(null); setAviso(null)
  }

  const encarregados = listaEncarregados(equipe, { incluirInativos: true })
  const ativos = listaEncarregados(equipe)
  const grupos = listaGrupos(equipe)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: { xs: '1rem', xl: '1.15rem' }, fontWeight: 800 }}>Encarregados e painéis</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: DS.t3, mt: 0.3 }}>
          Quem produz, com quais funções e em quais painéis. Vale na hora para a Produção, a atribuição dos cards e a esteira de cada um.
        </Typography>
      </DialogTitle>
      <Tabs value={aba} onChange={(_, v) => { setAba(v); setForm(null); setGrupoForm(null); setAviso(null) }} sx={{ px: 3 }}>
        <Tab label={`Encarregados (${ativos.length})`} />
        <Tab label={`Painéis (${grupos.length})`} />
      </Tabs>
      <DialogContent dividers sx={{ minHeight: 360 }}>
        {aviso && (
          <Box sx={{ mb: 1.5, px: 1.5, py: 1, borderRadius: 2, bgcolor: 'rgba(255,95,109,0.08)', border: `1px solid ${DS.alert}55`, fontSize: '0.75rem', color: DS.redSoft }}>
            {aviso}
          </Box>
        )}

        {aba === 0 && !form && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {encarregados.map(e => (
              <Box key={e.id} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, p: 1.2, borderRadius: '12px',
                border: `1px solid ${DS.border}`, bgcolor: DS.surface, opacity: e.ativo ? 1 : 0.55,
              }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: e.cor, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: { xs: '0.85rem', xl: '0.95rem' }, fontWeight: 700 }}>
                    {e.nome}{!e.ativo && <Box component="span" sx={{ ml: 1, fontSize: '0.65rem', color: DS.t3 }}>INATIVO</Box>}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: DS.t3 }}>
                    {e.funcoes.map(rotuloFuncao).join(' · ')}
                    {' · '}{e.perfil ? `perfil: ${NAME_MAP[e.perfil]?.fullName ?? e.perfil}` : 'sem perfil'}
                    {gruposDoEncarregado(equipe, e.id).length > 0 && ` · painéis: ${gruposDoEncarregado(equipe, e.id).map(g => g.nome).join(', ')}`}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.7rem', color: DS.t2, whiteSpace: 'nowrap' }}>
                  {abertos[e.id] ?? 0} em aberto
                </Typography>
                <Tooltip title={e.ativo ? 'Desativar (some das escolhas; os cards ficam)' : 'Ativar'}>
                  <Switch size="small" checked={e.ativo} onChange={() => alternarAtivo(e)} />
                </Tooltip>
                <IconButton size="small" aria-label={`Editar ${e.nome}`} onClick={() => abrirEdicao(e)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                <IconButton size="small" aria-label={`Apagar ${e.nome}`} onClick={() => apagar(e)} sx={{ '&:hover': { color: DS.red } }}>
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ))}
            <Button startIcon={<AddIcon />} onClick={abrirNovo} sx={{ alignSelf: 'flex-start', mt: 0.5 }}>Adicionar encarregado</Button>
          </Box>
        )}

        {aba === 0 && form && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 560 }}>
            <TextField label="Nome" size="small" autoFocus value={form.dados.nome}
              onChange={ev => setForm({ ...form, dados: { ...form.dados, nome: ev.target.value } })} />
            <Box>
              <Rotulo>Funções (uma ou mais)</Rotulo>
              <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                {FUNCOES.map(f => (
                  <Pilula key={f.id} ativo={form.dados.funcoes.includes(f.id)} onClick={() => setForm({
                    ...form,
                    dados: { ...form.dados, funcoes: form.dados.funcoes.includes(f.id) ? form.dados.funcoes.filter(x => x !== f.id) : [...form.dados.funcoes, f.id] },
                  })}>{f.rotulo}</Pilula>
                ))}
              </Box>
              <Typography sx={{ fontSize: '0.68rem', color: DS.t3, mt: 0.6 }}>
                Editor aparece onde se escolhe quem edita o vídeo; Designer, onde se escolhe quem cria a arte.
              </Typography>
            </Box>
            <TextField select label="Perfil do DS HUB (opcional)" size="small" value={form.dados.perfil ?? ''}
              onChange={ev => setForm({ ...form, dados: { ...form.dados, perfil: ev.target.value || undefined } })}
              helperText="Com perfil, a pessoa vê a esteira dela com só os cards dela ao entrar no sistema.">
              <MenuItem value="">Sem perfil</MenuItem>
              {perfisLivres(form.id).map(p => <MenuItem key={p} value={p}>{NAME_MAP[p].fullName} · {NAME_MAP[p].role}</MenuItem>)}
            </TextField>
            {grupos.length > 0 && (
              <Box>
                <Rotulo>Painéis de que participa</Rotulo>
                <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                  {grupos.map(g => (
                    <Pilula key={g.id} ativo={form.dados.grupos.includes(g.id)} onClick={() => setForm({
                      ...form,
                      dados: { ...form.dados, grupos: form.dados.grupos.includes(g.id) ? form.dados.grupos.filter(x => x !== g.id) : [...form.dados.grupos, g.id] },
                    })}>{g.nome}</Pilula>
                  ))}
                </Box>
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch checked={form.dados.ativo} onChange={ev => setForm({ ...form, dados: { ...form.dados, ativo: ev.target.checked } })} />
              <Typography sx={{ fontSize: '0.8rem' }}>Ativo</Typography>
            </Box>
          </Box>
        )}

        {aba === 1 && !grupoForm && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {grupos.map((g: GrupoPainel, i) => (
              <Box key={g.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.2, borderRadius: '12px', border: `1px solid ${DS.border}`, bgcolor: DS.surface }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: { xs: '0.85rem', xl: '0.95rem' }, fontWeight: 700 }}>{g.nome}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: DS.t3 }}>
                    {g.membros.map(id => equipe.encarregados[id]?.nome).filter(Boolean).join(' + ') || 'ninguém ainda'}
                  </Typography>
                </Box>
                <IconButton size="small" aria-label="Subir" disabled={i === 0} onClick={() => gravar(eq => moverGrupo(eq, g.id, -1))}><ArrowUpwardIcon sx={{ fontSize: 15 }} /></IconButton>
                <IconButton size="small" aria-label="Descer" disabled={i === grupos.length - 1} onClick={() => gravar(eq => moverGrupo(eq, g.id, 1))}><ArrowDownwardIcon sx={{ fontSize: 15 }} /></IconButton>
                <IconButton size="small" aria-label={`Editar ${g.nome}`} onClick={() => setGrupoForm({ id: g.id, nome: g.nome, membros: g.membros })}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                <IconButton size="small" aria-label={`Apagar ${g.nome}`} sx={{ '&:hover': { color: DS.red } }}
                  onClick={() => { if (window.confirm(`Apagar o painel ${g.nome}? Ninguém sai do cadastro e nenhum card muda.`)) gravar(eq => removerGrupo(eq, g.id)) }}>
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ))}
            <Button startIcon={<AddIcon />} onClick={() => setGrupoForm({ nome: '', membros: [] })} sx={{ alignSelf: 'flex-start', mt: 0.5 }}>Novo painel</Button>
          </Box>
        )}

        {aba === 1 && grupoForm && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 560 }}>
            <TextField label="Nome do painel" size="small" autoFocus value={grupoForm.nome}
              onChange={ev => setGrupoForm({ ...grupoForm, nome: ev.target.value })} />
            <Box>
              <Rotulo>Encarregados do painel</Rotulo>
              <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                {ativos.map(e => (
                  <Pilula key={e.id} ativo={grupoForm.membros.includes(e.id)} onClick={() => setGrupoForm({
                    ...grupoForm,
                    membros: grupoForm.membros.includes(e.id) ? grupoForm.membros.filter(x => x !== e.id) : [...grupoForm.membros, e.id],
                  })}>{e.nome}</Pilula>
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {form || grupoForm ? (
          <>
            <Button onClick={() => { setForm(null); setGrupoForm(null); setAviso(null) }}>Voltar</Button>
            <Button variant="contained" onClick={form ? salvarForm : salvarGrupoForm}>Salvar</Button>
          </>
        ) : (
          <Button onClick={onClose}>Fechar</Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
