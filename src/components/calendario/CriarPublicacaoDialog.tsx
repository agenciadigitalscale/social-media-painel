/**
 * "Criar publicação" (aba Agendamento) — o post que não veio da esteira: o
 * Social escolhe cliente, tipo e nome e ANEXA o criativo final (só upload —
 * link do Drive saiu para não publicar arquivo errado). Continuar cria o card e
 * abre a mesma revisão de sempre (descrição, redes, perfil, colab, dia e hora).
 *
 * 2026-10-19: no formato do compositor do Meta Business Suite — cartões à
 * esquerda, prévia do post à direita — e abre no tipo escolhido no menu "Criar".
 */
import { useEffect, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material'
import type { ContentType } from '../../types'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import type { Anexo } from '../../lib/anexos'
import type { IgConta } from '../../lib/instagram'
import UploadMidia from './UploadMidia'
import { nomeDoCliente } from '../../lib/clientes'
import PreviaPost from '../agendamento/PreviaPost'

export const TIPOS_PUBLICACAO: { tp: ContentType; rotulo: string; dica: string }[] = [
  { tp: 'Post', rotulo: 'Post', dica: '1 arte (ou vídeo)' },
  { tp: 'Reel', rotulo: 'Reel', dica: '1 vídeo vertical' },
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

export default function CriarPublicacaoDialog({ open, clientes, tipoInicial = 'Post', contas = [], onClose, onContinuar }: {
  open: boolean
  clientes: string[]
  /** Tipo escolhido no menu "Criar". */
  tipoInicial?: ContentType
  /** Contas conectadas — a prévia mostra o @perfil e a Página do cliente. */
  contas?: IgConta[]
  onClose: () => void
  onContinuar: (p: NovaPublicacao) => void
}) {
  const [cliente, setCliente] = useState('')
  const [tipo, setTipo] = useState<ContentType>(tipoInicial)
  const [titulo, setTitulo] = useState('')
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [enviando, setEnviando] = useState(false)
  const [legenda, setLegenda] = useState('')

  useEffect(() => { if (open) setTipo(tipoInicial) }, [open, tipoInicial])

  const limpar = () => { setCliente(''); setTipo(tipoInicial); setTitulo(''); setAnexos([]); setLegenda('') }
  const fechar = () => { limpar(); onClose() }

  const temMidia = anexos.length > 0
  const avisoQtd = tipo === 'Carrossel' && anexos.length === 1 ? 'Carrossel precisa de pelo menos 2 peças — com 1 ele sai como post.'
    : tipo !== 'Carrossel' && anexos.length > 1 ? `Com ${anexos.length} peças ele sai como carrossel.` : null
  const pode = !!cliente && !!titulo.trim() && temMidia && !enviando
  const conta = contas.find(c => c.clientName === cliente)

  return (
    <Dialog open={open} onClose={fechar} maxWidth="lg" fullWidth
      slotProps={{ paper: { sx: { height: { md: '92vh' }, display: 'flex', flexDirection: 'column' } } }}>
      <DialogTitle sx={{ pb: 1, borderBottom: `1px solid ${DS.border}` }}>
        <Typography sx={{ fontFamily: DS.fontDisplay, textTransform: 'uppercase', fontSize: { xs: '1.15rem', xl: '1.4rem' }, color: DS.t1, lineHeight: 1.1 }}>
          Criar {TIPOS_PUBLICACAO.find(t => t.tp === tipo)?.rotulo.toLowerCase() ?? 'publicação'}
        </Typography>
        <Typography sx={{ fontSize: '0.76rem', color: DS.t2 }}>Anexe o post e as informações. No próximo passo você escolhe as redes, o horário e o colab.</Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(380px, 560px) 1fr' }, minHeight: 0, overflow: { md: 'hidden' } }}>
        <Box sx={{ overflowY: { md: 'auto' }, p: { xs: 1.5, md: 2 }, display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: DS.bg, borderRight: { md: `1px solid ${DS.border}` } }}>
          <Secao titulo="Postar em" subtitulo="O cliente do post. As redes conectadas dele aparecem na prévia.">
            <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap' }}>
              <TextField select size="small" label="Cliente" value={cliente} onChange={e => setCliente(e.target.value)} sx={{ flex: 1, minWidth: 200 }}>
                {clientes.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{nomeDoCliente(c)}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Nome do conteúdo" value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="Ex.: Promoção de sexta" sx={{ flex: 1, minWidth: 200 }} />
            </Box>
          </Secao>

          <Secao titulo="Formato">
            <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
              {TIPOS_PUBLICACAO.map(t => (
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
          </Secao>

          <Secao titulo="Mídia" subtitulo="Compartilhe fotos e vídeos. Os posts do Instagram não podem ter mais de 10 peças.">
            <UploadMidia value={anexos} onChange={setAnexos} onEnviando={setEnviando} />
            {avisoQtd && <Typography sx={{ fontSize: '0.7rem', color: DS.amber, mt: 0.8 }}>{avisoQtd}</Typography>}
            {enviando && <Alert severity="info" sx={{ fontSize: '0.74rem', mt: 1 }}>Enviando os arquivos… não feche esta janela.</Alert>}
          </Secao>

          <Secao titulo="Detalhes do post" subtitulo="Opcional aqui — dá para ajustar na revisão.">
            <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: DS.t2, mb: 0.6 }}>Texto</Typography>
            <TextField multiline minRows={4} fullWidth value={legenda} placeholder={tipo === 'Story' ? 'Story não tem legenda.' : 'Escreva a descrição do post…'}
              disabled={tipo === 'Story'} onChange={e => setLegenda(e.target.value)} sx={{ '& .MuiInputBase-root': { fontSize: '0.82rem' } }} />
          </Secao>
        </Box>

        <Box sx={{ overflowY: { md: 'auto' }, p: { xs: 1.5, md: 3 }, bgcolor: DS.surface }}>
          <PreviaPost anexos={anexos} legenda={tipo === 'Story' ? '' : legenda}
            perfil={conta?.perfil ?? ''} pagina={conta?.pagina ?? ''}
            nomeCliente={cliente ? nomeDoCliente(cliente) : 'Cliente'} />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.6, gap: 1, borderTop: `1px solid ${DS.border}` }}>
        <Button variant="outlined" onClick={fechar} sx={{ color: DS.t1, borderColor: DS.border }}>Cancelar</Button>
        <Button variant="contained" disabled={!pode}
          onClick={() => { onContinuar({ cliente, tipo, titulo: titulo.trim(), anexos, legenda }); limpar() }}>
          Continuar para revisão
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Secao({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ p: { xs: 1.5, xl: 2 }, borderRadius: '12px', bgcolor: DS.surface, border: `1px solid ${DS.border}` }}>
      <Typography sx={{ fontSize: { xs: '0.92rem', xl: '1rem' }, fontWeight: 800, color: DS.t1, mb: subtitulo ? 0.3 : 1 }}>{titulo}</Typography>
      {subtitulo && <Typography sx={{ fontSize: '0.72rem', color: DS.t2, mb: 1.2 }}>{subtitulo}</Typography>}
      {children}
    </Box>
  )
}
