/**
 * "Aprovar e programar" — a revisão antes de o post ir para o calendário, no
 * espírito do compositor do Meta Business Suite: o criativo final, a
 * descrição, em quais redes e em QUAL perfil/Página, colab no Instagram, e
 * o dia e a hora.
 *
 * O criativo é SEMPRE anexado aqui pelo Social (pedido do dono, 2026-09-30):
 * o que vem da esteira pode ser a versão errada, e é o que a pessoa anexa que
 * vai ao ar. Sem criativo anexado, não programa. A prévia das redes vem do
 * servidor, pela mesma regra que vai publicar.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Typography,
} from '@mui/material'
import InstagramIcon from '@mui/icons-material/Instagram'
import FacebookIcon from '@mui/icons-material/Facebook'
import type { ContentItem, ItemState } from '../../types'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { horaDe, horaValida } from '../../lib/programacao'
import { descreverTipo, NOME_REDE, previaPublicacao, REDES, type OpcoesPublicacao, type Previa, type Rede } from '../../lib/instagram'
import type { Anexo } from '../../lib/anexos'
import UploadMidia from './UploadMidia'
import LinkDoMaterial from './LinkDoMaterial'
import EscolherQuando, { dataInput } from './EscolherQuando'
import { nomeDoCliente } from '../../lib/clientes'
import PreviaPost from '../agendamento/PreviaPost'

const MAX_LEGENDA_IG = 2200
const MAX_HASHTAGS_IG = 30
const MAX_COLAB = 3

const pad = (n: number) => String(n).padStart(2, '0')
const SEMANA_LONGA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

export interface ConfirmacaoPost extends OpcoesPublicacao { quando: number }

function descreverDia(ts: number): string {
  const d = new Date(ts)
  const hoje = new Date()
  const amanha = new Date(); amanha.setDate(hoje.getDate() + 1)
  const mesmo = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const dm = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
  if (mesmo(d, hoje)) return `hoje, ${dm},`
  if (mesmo(d, amanha)) return `amanhã, ${dm},`
  return `${SEMANA_LONGA[d.getDay()]}, ${dm},`
}

export default function ProgramarPostDialog({ item, state, onClose, onConfirm }: {
  /** `null` = fechado. */
  item: ContentItem | null
  state?: ItemState
  onClose: () => void
  onConfirm: (c: ConfirmacaoPost) => void
}) {
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [erroPrevia, setErroPrevia] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [redes, setRedes] = useState<Record<Rede, boolean>>({ instagram: false, facebook: false })
  const [legenda, setLegenda] = useState('')
  const [colabs, setColabs] = useState<string[]>([])
  const [colabDigitado, setColabDigitado] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('18:00')
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [enviandoMidia, setEnviandoMidia] = useState(false)
  /** A prévia atual foi calculada com os anexos (e não só para saber as contas). */
  const [previaDaMidia, setPreviaDaMidia] = useState(false)

  const carregarPrevia = (lista: Anexo[]) => {
    if (!item) return () => {}
    setCarregando(true); setErroPrevia(null)
    let vivo = true
    previaPublicacao(item.i, lista.length ? lista : undefined).then(p => {
      if (!vivo) return
      setCarregando(false)
      if (!p.ok) { setErroPrevia((p as { error?: string }).error ?? 'Não deu para montar a prévia.'); return }
      const pv = p as Previa
      setPrevia(pv)
      setPreviaDaMidia(lista.length > 0)
      // Marca o que pode publicar sozinho; o resto fica desmarcado com o porquê.
      setRedes(lista.length ? { instagram: pv.instagram.ok, facebook: pv.facebook.ok } : { instagram: false, facebook: false })
    })
    return () => { vivo = false }
  }

  // Abrir: dia/hora do card. Anexo só vem preenchido se foi o Social que anexou
  // (criado no "Criar publicação" ou programado antes); criativo da esteira, não.
  useEffect(() => {
    if (!item) return
    const base = state?.status === 9 && state.programadoPara ? new Date(state.programadoPara) : new Date(item.dt)
    // Dia da pauta que já passou não serve para agendar: abre em hoje.
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    setData(dataInput(base < hoje ? new Date() : base))
    setHora(state?.status === 9 && state.programadoPara ? horaDe(state.programadoPara) : (horaValida(state?.horaPostagem) ? state!.horaPostagem! : '18:00'))
    setLegenda(state?.caption ?? '')
    setColabs([]); setColabDigitado('')
    setAnexos(state?.anexos ?? []); setEnviandoMidia(false)
    setPrevia(null); setPreviaDaMidia(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reabre só quando troca o card
  }, [item?.i])

  // Anexos mudaram (e já subiram): refaz a prévia — sem anexo, só as contas.
  useEffect(() => {
    if (!item || enviandoMidia) return
    return carregarPrevia(anexos)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refaz quando a lista muda
  }, [item?.i, anexos, enviandoMidia])

  const quando = data && horaValida(hora) ? new Date(`${data}T${hora}:00`).getTime() : NaN
  const passou = Number.isFinite(quando) && quando <= Date.now()
  const escolhidas = REDES.filter(r => redes[r])
  const ehStory = item?.tp === 'Story'
  const hashtags = (legenda.match(/#[\p{L}\p{N}_]+/gu) ?? []).length
  const legendaLonga = redes.instagram && legenda.length > MAX_LEGENDA_IG
  const hashtagsDemais = redes.instagram && hashtags > MAX_HASHTAGS_IG
  const temMidia = anexos.length > 0

  const addColab = () => {
    const u = colabDigitado.trim().replace(/^@+/, '').toLowerCase()
    if (!u || !/^[a-z0-9._]{1,30}$/.test(u) || colabs.includes(u) || colabs.length >= MAX_COLAB) return
    setColabs([...colabs, u]); setColabDigitado('')
  }

  const resumo = useMemo(() => {
    if (!temMidia) return 'Anexe o criativo final para programar.'
    if (!previa) return ''
    const alvos = escolhidas.map(r => r === 'instagram' ? `no Instagram ${previa.instagram.destino}` : `na Página ${previa.facebook.destino}`)
    if (alvos.length === 0) return 'Nenhuma rede marcada: fica programado no calendário para publicação manual.'
    return `O painel publica sozinho ${alvos.join(' e ')}.`
  }, [previa, escolhidas, temMidia])

  const podeConfirmar = temMidia && !enviandoMidia && previaDaMidia && !carregando
    && Number.isFinite(quando) && !passou && !legendaLonga

  const quandoTexto = Number.isFinite(quando) && !passou ? `${descreverDia(quando).replace(/,$/, '')} às ${hora}` : ''

  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="lg" fullWidth
      slotProps={{ paper: { sx: { height: { md: '92vh' }, display: 'flex', flexDirection: 'column' } } }}>
      <DialogTitle sx={{ pb: 1, borderBottom: `1px solid ${DS.border}` }}>
        <Typography sx={{ fontFamily: DS.fontDisplay, textTransform: 'uppercase', fontSize: { xs: '1.15rem', xl: '1.4rem' }, color: DS.t1, lineHeight: 1.1 }}>
          {state?.status === 9 ? 'Revisar agendamento' : 'Revisar e programar'}
        </Typography>
        {item && (
          <Typography sx={{ fontSize: '0.76rem', color: DS.t2 }}>
            {nomeDoCliente(item.c)} · {item.tp} — {state?.title || item.n}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(380px, 560px) 1fr' }, minHeight: 0, overflow: { md: 'hidden' } }}>
        {/* Esquerda: o formulário em cartões, como o compositor da Meta */}
        <Box sx={{ overflowY: { md: 'auto' }, p: { xs: 1.5, md: 2 }, display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: DS.bg, borderRight: { md: `1px solid ${DS.border}` } }}>
          <Secao titulo="Postar em" subtitulo="Marque as redes. O painel publica sozinho no perfil e na Página conectados.">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
              {REDES.map(r => {
                const p = previa?.[r]
                const pode = temMidia && previaDaMidia && !!p?.ok
                const marcado = redes[r] && pode
                const Icone = r === 'instagram' ? InstagramIcon : FacebookIcon
                const situacao = !previa || carregando ? '…'
                  : !p?.conectado ? 'sem conexão — publicação manual'
                  : !temMidia ? 'anexe a mídia para ver como sai'
                  : p.ok ? `sai como ${descreverTipo(p.tipo, p.pecas)}` : p.motivo
                return (
                  <Box key={r} {...clickable(() => pode && setRedes(v => ({ ...v, [r]: !v[r] })))}
                    aria-pressed={marcado} aria-disabled={!pode}
                    sx={{
                      p: 1.2, borderRadius: '10px', cursor: pode ? 'pointer' : 'default',
                      border: `1px solid ${marcado ? DS.accent : DS.border}`, bgcolor: marcado ? `${DS.accent}10` : DS.surfaceAlt,
                      opacity: pode ? 1 : 0.8, transition: 'all 0.18s ease',
                    }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Checkbox size="small" checked={marcado} disabled={!pode} tabIndex={-1} sx={{ p: 0 }} />
                      <Icone sx={{ fontSize: 18, color: marcado ? DS.t1 : DS.t2 }} />
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: DS.t1 }}>{NOME_REDE[r]}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: p?.conectado ? DS.t1 : DS.t3, mt: 0.6 }}>
                      {p?.conectado ? (p.destino || (r === 'instagram' ? 'perfil conectado' : 'Página conectada')) : 'não conectado'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: pode || !temMidia ? DS.t2 : DS.redSoft, mt: 0.2 }}>{situacao}</Typography>
                  </Box>
                )
              })}
            </Box>
          </Secao>

          <Secao titulo="Mídia" subtitulo="O arquivo final do post. Os posts do Instagram não podem ter mais de 10 peças.">
            <Box sx={{ mb: 1 }}><LinkDoMaterial st={state} /></Box>
            <UploadMidia value={anexos} onChange={setAnexos} onEnviando={setEnviandoMidia} compacto />
            <Typography sx={{ fontSize: '0.66rem', color: temMidia ? DS.t3 : DS.amber, mt: 0.8 }}>
              {temMidia
                ? 'É exatamente isto que vai ao ar. Carrossel: a ordem acima é a ordem do post.'
                : 'Anexe o arquivo final do post (vídeo ou arte). Sem ele não dá para programar.'}
            </Typography>
            {erroPrevia && <Alert severity="warning" sx={{ fontSize: '0.74rem', mt: 1 }}>{erroPrevia}</Alert>}
          </Secao>

          <Secao titulo="Detalhes do post" direita={
            <Typography sx={{ fontSize: '0.66rem', color: legendaLonga ? DS.red : DS.t3 }}>
              {legenda.length}/{MAX_LEGENDA_IG} · {hashtags} hashtag{hashtags !== 1 ? 's' : ''}
            </Typography>
          }>
            <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: DS.t2, mb: 0.6 }}>Texto</Typography>
            <TextField multiline minRows={5} maxRows={12} fullWidth value={legenda} onChange={e => setLegenda(e.target.value)}
              placeholder={ehStory ? 'Story não tem legenda.' : 'Escreva a descrição que vai no post…'}
              disabled={ehStory}
              sx={{ '& .MuiInputBase-root': { fontSize: '0.82rem', lineHeight: 1.55 } }} />
            {!legenda.trim() && !ehStory && <Typography sx={{ fontSize: '0.68rem', color: DS.amber, mt: 0.5 }}>O post vai sair sem descrição.</Typography>}
            {legendaLonga && <Typography sx={{ fontSize: '0.68rem', color: DS.red, mt: 0.5 }}>O Instagram aceita até {MAX_LEGENDA_IG} caracteres.</Typography>}
            {hashtagsDemais && <Typography sx={{ fontSize: '0.68rem', color: DS.amber, mt: 0.5 }}>Mais de {MAX_HASHTAGS_IG} hashtags — o Instagram costuma recusar.</Typography>}
          </Secao>

          <Secao titulo="Programar" subtitulo="Dia e horário em que o post vai ao ar.">
            <EscolherQuando data={data} hora={hora} onData={setData} onHora={setHora} />
            {Number.isFinite(quando) && (
              <Typography sx={{ fontSize: '0.86rem', fontWeight: 800, color: passou ? DS.red : DS.t1, mt: 1.2 }}>
                {passou ? 'Esse horário já passou — escolha outro.' : `Vai ao ar ${descreverDia(quando)} às ${hora}`}
              </Typography>
            )}
          </Secao>

          <Secao titulo="Colaborador" subtitulo={ehStory ? 'Story não aceita colab.' : `Até ${MAX_COLAB} perfis do Instagram. Cada um recebe o convite e o post aparece nos dois perfis quando aceitar.`}>
            <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', alignItems: 'center' }}>
              {colabs.map(c => <Chip key={c} size="small" label={`@${c}`} onDelete={() => setColabs(colabs.filter(x => x !== c))} />)}
              {colabs.length < MAX_COLAB && (
                <TextField size="small" value={colabDigitado} placeholder="Insira o @perfil e Enter"
                  disabled={!redes.instagram || ehStory}
                  onChange={e => setColabDigitado(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addColab() } }}
                  onBlur={addColab}
                  sx={{ flex: 1, minWidth: 200, '& .MuiInputBase-root': { fontSize: '0.78rem' } }} />
              )}
            </Box>
          </Secao>
        </Box>

        {/* Direita: a prévia do post */}
        <Box sx={{ overflowY: { md: 'auto' }, p: { xs: 1.5, md: 3 }, bgcolor: DS.surface }}>
          {item && (
            <PreviaPost anexos={anexos} legenda={ehStory ? '' : legenda}
              perfil={previa?.instagram.conectado ? previa.instagram.destino : ''}
              pagina={previa?.facebook.conectado ? previa.facebook.destino : ''}
              nomeCliente={nomeDoCliente(item.c)} quando={quandoTexto}
              redesDisponiveis={escolhidas.length ? escolhidas : undefined} />
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.6, gap: 1, flexWrap: 'wrap', borderTop: `1px solid ${DS.border}` }}>
        <Typography sx={{ fontSize: '0.74rem', color: temMidia ? DS.t2 : DS.amber, flex: 1, minWidth: 220 }}>{resumo}</Typography>
        <Button variant="outlined" onClick={onClose} sx={{ color: DS.t1, borderColor: DS.border }}>Cancelar</Button>
        <Button variant="contained" disabled={!podeConfirmar}
          onClick={() => onConfirm({ quando, redes: escolhidas, legenda, colaboradores: redes.instagram && !ehStory ? colabs : [], anexos })}>
          {state?.status === 9 ? 'Salvar agendamento' : 'Programar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Um cartão do compositor — como as seções "Postar em", "Mídia", "Detalhes do post" da Meta. */
function Secao({ titulo, subtitulo, direita, children }: { titulo: string; subtitulo?: string; direita?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ p: { xs: 1.5, xl: 2 }, borderRadius: '12px', bgcolor: DS.surface, border: `1px solid ${DS.border}` }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: subtitulo ? 0.3 : 1 }}>
        <Typography sx={{ fontSize: { xs: '0.92rem', xl: '1rem' }, fontWeight: 800, color: DS.t1 }}>{titulo}</Typography>
        <Box sx={{ flex: 1 }} />
        {direita}
      </Box>
      {subtitulo && <Typography sx={{ fontSize: '0.72rem', color: DS.t2, mb: 1.2 }}>{subtitulo}</Typography>}
      {children}
    </Box>
  )
}
