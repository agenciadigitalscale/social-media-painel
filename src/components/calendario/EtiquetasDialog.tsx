/**
 * Base GLOBAL de etiquetas: criar, renomear, mudar a cor e excluir. Renomear e
 * excluir valem nos cards também (quem chama aplica nos conteúdos) — senão a
 * etiqueta velha continuaria nos cards e voltaria a aparecer como "nova".
 */
import { useEffect, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Tooltip, Typography } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { DS, CORES_ETIQUETA } from '../../theme'
import { clickable } from '../../shared/a11y'
import { adicionarEtiqueta, limparNome, type Etiqueta } from '../../lib/etiquetas'

export default function EtiquetasDialog({ open, base, uso, onClose, onCriar, onEditar, onExcluir }: {
  open: boolean
  /** Base + as já usadas em cards (as de fora da base vêm com a cor neutra). */
  base: Etiqueta[]
  /** Quantos conteúdos usam cada etiqueta (pelo nome, minúsculo). */
  uso: Map<string, number>
  onClose: () => void
  onCriar: (e: Etiqueta) => void
  onEditar: (de: string, para: Etiqueta) => void
  onExcluir: (nome: string) => void
}) {
  const [nova, setNova] = useState('')
  const [corNova, setCorNova] = useState<string>(CORES_ETIQUETA[1])
  const [editando, setEditando] = useState<string | null>(null)
  const [nomeEd, setNomeEd] = useState('')
  useEffect(() => { if (open) { setNova(''); setEditando(null) } }, [open])
  const repetida = !!nova.trim() && adicionarEtiqueta(base, nova) === base

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800 }}>Etiquetas</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: DS.t2, mt: 0.3 }}>Uma base só para o painel inteiro. Renomear ou excluir vale em todos os conteúdos.</Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.6, pt: '12px !important' }}>
        <Box sx={{ p: 1.4, borderRadius: '11px', border: `1px dashed ${DS.borderHov}`, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField size="small" label="Nova etiqueta" value={nova} onChange={e => setNova(e.target.value)} sx={{ flex: 1 }}
              error={repetida} helperText={repetida ? 'Já existe.' : undefined} slotProps={{ inputLabel: { shrink: true } }}
              onKeyDown={e => { if (e.key === 'Enter' && nova.trim() && !repetida) { onCriar({ nome: limparNome(nova), cor: corNova }); setNova('') } }} />
            <Button variant="contained" disabled={!nova.trim() || repetida} onClick={() => { onCriar({ nome: limparNome(nova), cor: corNova }); setNova('') }} sx={{ height: 40 }}>Criar</Button>
          </Box>
          <Cores valor={corNova} onChange={setCorNova} />
        </Box>

        {base.length === 0 && <Typography sx={{ fontSize: '0.8rem', color: DS.t3, py: 2, textAlign: 'center' }}>Nenhuma etiqueta ainda.</Typography>}
        {base.map(e => {
          const n = uso.get(e.nome.toLowerCase()) ?? 0
          const ed = editando === e.nome
          return (
            <Box key={e.nome} sx={{ p: 1.1, borderRadius: '10px', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}`, display: 'flex', flexDirection: 'column', gap: 0.9 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: e.cor, flexShrink: 0 }} />
                {ed ? (
                  <TextField size="small" value={nomeEd} onChange={x => setNomeEd(x.target.value)} autoFocus sx={{ flex: 1 }}
                    onKeyDown={x => { if (x.key === 'Enter' && limparNome(nomeEd)) { onEditar(e.nome, { nome: limparNome(nomeEd), cor: e.cor }); setEditando(null) } }} />
                ) : (
                  <Typography sx={{ flex: 1, fontSize: '0.84rem', fontWeight: 700, color: DS.t1 }}>{e.nome}</Typography>
                )}
                <Typography sx={{ fontSize: '0.68rem', color: DS.t3, whiteSpace: 'nowrap' }}>{n} conteúdo{n !== 1 ? 's' : ''}</Typography>
                {ed ? (
                  <Button size="small" onClick={() => { if (limparNome(nomeEd)) onEditar(e.nome, { nome: limparNome(nomeEd), cor: e.cor }); setEditando(null) }}>OK</Button>
                ) : (
                  <Button size="small" onClick={() => { setEditando(e.nome); setNomeEd(e.nome) }} sx={{ fontSize: '0.7rem', color: DS.t2 }}>Renomear</Button>
                )}
                <Tooltip title={n ? `Excluir e tirar dos ${n} conteúdos` : 'Excluir'}>
                  <IconButton size="small" aria-label={`Excluir etiqueta ${e.nome}`} sx={{ color: DS.t3, '&:hover': { color: DS.red } }}
                    onClick={() => { if (window.confirm(n ? `Excluir "${e.nome}" e tirar dela dos ${n} conteúdos?` : `Excluir "${e.nome}"?`)) onExcluir(e.nome) }}>
                    <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Cores valor={e.cor} onChange={cor => onEditar(e.nome, { nome: e.nome, cor })} />
            </Box>
          )
        })}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">Pronto</Button>
      </DialogActions>
    </Dialog>
  )
}

function Cores({ valor, onChange }: { valor: string; onChange: (c: string) => void }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
      {CORES_ETIQUETA.map(c => (
        <Box key={c} {...clickable(() => onChange(c))} aria-label={`Cor ${c}`} aria-pressed={valor === c} sx={{
          width: 22, height: 22, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
          outline: valor === c ? `2px solid ${DS.t1}` : 'none', outlineOffset: 2,
        }} />
      ))}
    </Box>
  )
}
