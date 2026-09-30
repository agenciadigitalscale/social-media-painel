/**
 * "Criar publicação" (aba Agendamento) — o post que não veio da esteira: o
 * Social escolhe cliente, tipo e nome e ANEXA o criativo final (só upload —
 * link do Drive saiu para não publicar arquivo errado). Continuar cria o card e
 * abre a mesma revisão de sempre
 * (descrição, redes, perfil, colab, dia e hora).
 */
import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material'
import type { ContentType } from '../../types'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import type { Anexo } from '../../lib/anexos'
import UploadMidia from './UploadMidia'

const TIPOS: { tp: ContentType; rotulo: string; dica: string }[] = [
  { tp: 'Reel', rotulo: 'Reel', dica: '1 vídeo vertical' },
  { tp: 'Post', rotulo: 'Post', dica: '1 arte (ou vídeo)' },
  { tp: 'Carrossel', rotulo: 'Carrossel', dica: '2 a 10 peças, na ordem' },
  { tp: 'Story', rotulo: 'Story', dica: '1 arte ou vídeo' },
]

export interface NovaPublicacao {
  cliente: string
  tipo: ContentType
  titulo: string
  anexos: Anexo[]
  legenda: string
}

export default function CriarPublicacaoDialog({ open, clientes, onClose, onContinuar }: {
  open: boolean
  clientes: string[]
  onClose: () => void
  onContinuar: (p: NovaPublicacao) => void
}) {
  const [cliente, setCliente] = useState('')
  const [tipo, setTipo] = useState<ContentType>('Post')
  const [titulo, setTitulo] = useState('')
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [enviando, setEnviando] = useState(false)
  const [legenda, setLegenda] = useState('')

  const limpar = () => { setCliente(''); setTipo('Post'); setTitulo(''); setAnexos([]); setLegenda('') }
  const fechar = () => { limpar(); onClose() }

  const temMidia = anexos.length > 0
  const avisoQtd = tipo === 'Carrossel' && anexos.length === 1 ? 'Carrossel precisa de pelo menos 2 peças — com 1 ele sai como post.'
    : tipo !== 'Carrossel' && anexos.length > 1 ? `Com ${anexos.length} peças ele sai como carrossel.` : null
  const pode = !!cliente && !!titulo.trim() && temMidia && !enviando

  return (
    <Dialog open={open} onClose={fechar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: DS.t1 }}>Criar publicação</Typography>
        <Typography sx={{ fontSize: '0.74rem', color: DS.t2 }}>Anexe o post e as informações. No próximo passo você revisa a descrição, as redes e o horário.</Typography>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.8, pt: '12px !important' }}>
        <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap' }}>
          <TextField select size="small" label="Cliente" value={cliente} onChange={e => setCliente(e.target.value)} sx={{ flex: 1, minWidth: 200 }}>
            {clientes.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Nome do conteúdo" value={titulo} onChange={e => setTitulo(e.target.value)}
            placeholder="Ex.: Promoção de sexta" sx={{ flex: 1, minWidth: 200 }} />
        </Box>

        <Box>
          <Typography sx={{ fontSize: '0.7rem', color: DS.t2, mb: 0.6 }}>Tipo</Typography>
          <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
            {TIPOS.map(t => (
              <Box key={t.tp} {...clickable(() => setTipo(t.tp))} aria-pressed={tipo === t.tp} sx={{
                px: 1.4, py: 0.7, borderRadius: '9px', cursor: 'pointer', minWidth: 110,
                border: `1px solid ${tipo === t.tp ? DS.accent : DS.border}`, bgcolor: tipo === t.tp ? `${DS.accent}14` : DS.surfaceAlt,
                transition: 'all 0.18s ease',
              }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: tipo === t.tp ? DS.accent : DS.t1 }}>{t.rotulo}</Typography>
                <Typography sx={{ fontSize: '0.64rem', color: DS.t3 }}>{t.dica}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box>
          <Typography sx={{ fontSize: '0.7rem', color: DS.t2, mb: 0.6 }}>Criativo final</Typography>
          <UploadMidia value={anexos} onChange={setAnexos} onEnviando={setEnviando} />
          {avisoQtd && <Typography sx={{ fontSize: '0.7rem', color: DS.amber, mt: 0.8 }}>{avisoQtd}</Typography>}

        </Box>

        <TextField multiline minRows={3} label="Descrição (opcional — dá para ajustar na revisão)" value={legenda}
          onChange={e => setLegenda(e.target.value)} sx={{ '& .MuiInputBase-root': { fontSize: '0.82rem' } }} />

        {enviando && <Alert severity="info" sx={{ fontSize: '0.74rem' }}>Enviando os arquivos… não feche esta janela.</Alert>}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={fechar} sx={{ color: DS.t2 }}>Cancelar</Button>
        <Button variant="contained" disabled={!pode}
          onClick={() => { onContinuar({ cliente, tipo, titulo: titulo.trim(), anexos, legenda }); limpar() }}>
          Continuar para revisão
        </Button>
      </DialogActions>
    </Dialog>
  )
}
