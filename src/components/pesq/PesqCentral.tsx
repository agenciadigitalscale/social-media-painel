import { useCallback, useMemo, useRef, useState } from 'react'
import { Box, Dialog, GlobalStyles, InputBase, Tooltip } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { PESQ, pesqKeyframes } from '../../lib/pesq/brand'
import { getDisplayName, getUserInfo } from '../../lib/users'
import { usePesq } from '../../lib/pesq/usePesq'
import {
  conexaoWhatsapp, PESQ_STATUS,
  type NovaPublicacao, type PesqPublicacao, type PesqStatus,
} from '../../lib/pesq/publicacoes'
import PesqBackdrop from './PesqBackdrop'
import PesqLogo, { PesqWatermark } from './PesqLogo'
import { PesqBotao, PesqDot } from './PesqUI'
import PesqIndicadores from './PesqIndicadores'
import PesqLembretes from './PesqLembretes'
import PesqPubCard from './PesqPubCard'
import PesqDetalhes from './PesqDetalhes'
import PesqPubDialog from './PesqPubDialog'
import PesqConfigDialog from './PesqConfigDialog'
import { PesqSkeleton, PesqVazio } from './PesqEstados'
import { PesqSucesso, PesqToast, type PesqAviso, type PesqSucessoInfo } from './PesqFeedback'

/**
 * Central de Publicações PESQ.
 *
 * Ambiente de marca dentro do DS HUB: tudo aqui é verde PESQ, e nada disso
 * escapa para as outras abas — os outros clientes continuam no azul do painel.
 *
 * O trabalho que esta tela resolve: conteúdo que a agência não consegue
 * publicar sozinha (Reels finalizado no Instagram Edits, carrossel que o
 * cliente sobe) fica esperando alguém lembrar. Aqui ele fica visível, com
 * relógio, e o lembrete sai pelo WhatsApp — assistido, ver `mensagens.ts`.
 */

type Filtro = 'ativas' | 'todas' | PesqStatus

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'ativas',     label: 'Na fila' },
  { key: 'publicado',  label: 'Publicados' },
  { key: 'pausado',    label: 'Pausados' },
  { key: 'cancelado',  label: 'Cancelados' },
  { key: 'todas',      label: 'Tudo' },
]

interface Props {
  currentUser: string
  /** Sobe quando o App restaura estas chaves do D1 (outro aparelho, cache limpo) */
  syncVersion?: number
  /** O App está restaurando o banco — mostra esqueleto em vez de "fila vazia" */
  restaurando?: boolean
}

export default function PesqCentral({ currentUser, syncVersion = 0, restaurando = false }: Props) {
  const api = usePesq(currentUser || 'sistema', syncVersion, restaurando)
  const { pubs, config, agora, carregando, resumo, fila } = api

  const [filtro, setFiltro]         = useState<Filtro>('ativas')
  const [busca, setBusca]           = useState('')
  const [abertoId, setAbertoId]     = useState<string | null>(null)
  const [editando, setEditando]     = useState<PesqPublicacao | null>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [configAberta, setConfigAberta] = useState(false)
  const [aviso, setAviso]           = useState<PesqAviso | null>(null)
  const [sucesso, setSucesso]       = useState<PesqSucessoInfo | null>(null)
  const [excluir, setExcluir]       = useState<PesqPublicacao | null>(null)

  const filaRef = useRef<HTMLDivElement | null>(null)

  const conexao = conexaoWhatsapp(config)
  const dono    = getUserInfo(config.responsavelPadrao)

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return pubs
      .filter(p => {
        if (filtro === 'ativas') return PESQ_STATUS[p.status].ativo
        if (filtro !== 'todas' && p.status !== filtro) return false
        return true
      })
      .filter(p => !termo
        || p.titulo.toLowerCase().includes(termo)
        || p.codigo.toLowerCase().includes(termo)
        || p.formato.toLowerCase().includes(termo))
      .sort((a, b) => {
        // Quem a fila ainda persegue vem primeiro, do mais antigo para o mais
        // novo (o atrasado no topo); o que já saiu do ar desce, do mais
        // recente para o mais velho.
        const ativoA = PESQ_STATUS[a.status].ativo ? 0 : 1
        const ativoB = PESQ_STATUS[b.status].ativo ? 0 : 1
        if (ativoA !== ativoB) return ativoA - ativoB
        return ativoA === 0
          ? a.agendadoPara - b.agendadoPara
          : (b.publicadoEm ?? b.atualizadoEm) - (a.publicadoEm ?? a.atualizadoEm)
      })
  }, [pubs, filtro, busca])

  const contarFiltro = useCallback((key: Filtro) => {
    if (key === 'todas')  return pubs.length
    if (key === 'ativas') return pubs.filter(p => PESQ_STATUS[p.status].ativo).length
    return pubs.filter(p => p.status === key).length
  }, [pubs])

  const aberta = abertoId ? pubs.find(p => p.id === abertoId) ?? null : null

  // ── Ações ───────────────────────────────────────────────────────────
  const lembrar = useCallback(async (id: string) => {
    if (conexao === 'sem_destino') {
      setAviso({
        msg: 'Nenhum destino de WhatsApp configurado ainda.',
        tom: 'alerta',
        acao: { label: 'Configurar', onClick: () => setConfigAberta(true) },
      })
      return
    }
    const r = await api.enviarLembrete(id)
    if (!r.ok) {
      setAviso({ msg: r.erro ?? 'Não foi possível abrir o WhatsApp.', tom: 'erro' })
      return
    }
    setAviso({
      msg: r.copiado
        ? 'Grupo aberto e mensagem copiada — é só colar e enviar.'
        : 'WhatsApp aberto com a mensagem pronta — toque em enviar por lá.',
      tom: 'ok',
    })
  }, [api, conexao])

  const confirmar = useCallback((id: string) => {
    const pub = pubs.find(p => p.id === id)
    if (!pub) return
    api.confirmar(id)
    setAbertoId(null)
    setSucesso({ titulo: pub.titulo, codigo: pub.codigo })
    setAviso({
      msg: `${pub.codigo} confirmado. Os lembretes pararam.`,
      tom: 'ok',
      acao: { label: 'Desfazer', onClick: () => api.reabrir(id) },
    })
  }, [api, pubs])

  const salvarForm = useCallback((dados: NovaPublicacao) => {
    if (editando) {
      api.editar(editando.id, dados)
      setAviso({ msg: `${editando.codigo} atualizado.`, tom: 'ok' })
    } else {
      const nova = api.criar(dados)
      setAviso({
        msg: `${nova.codigo} entrou na fila.`,
        tom: 'ok',
        acao: { label: 'Ver detalhes', onClick: () => setAbertoId(nova.id) },
      })
    }
    setFormAberto(false)
    setEditando(null)
  }, [api, editando])

  const abrirEdicao = useCallback((id: string) => {
    const pub = pubs.find(p => p.id === id)
    if (!pub) return
    setEditando(pub)
    setFormAberto(true)
  }, [pubs])

  const verFila = useCallback(() => {
    setFiltro('ativas')
    filaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // ── Tela ────────────────────────────────────────────────────────────
  return (
    // Quem rola é o contêiner da aba (desktop) ou o `scrollBox` do
    // `MobileShell` — os dois já são áreas de rolagem. Criar mais uma aqui
    // deixaria duas barras concorrendo e, pior, a de dentro nunca teria altura
    // definida: o módulo cresceria com o conteúdo e o botão flutuante iria
    // parar lá embaixo, fora do alcance do polegar.
    <Box sx={{
      position: 'relative', flex: 1, minHeight: '100%', display: 'flex', flexDirection: 'column',
      isolation: 'isolate', color: PESQ.t1, overflowX: 'clip',
    }}>
      <GlobalStyles styles={pesqKeyframes} />
      <PesqBackdrop />

      <Box sx={{
        position: 'relative', flex: 1,
        px: { xs: 1.4, md: 2.6, xl: 4 },
        pt: { xs: 1.6, md: 2.4 },
        pb: { xs: 12, md: 4 },
        display: 'flex', flexDirection: 'column', gap: { xs: 1.6, md: 2.2 },
      }}>
        {/* ── Cabeçalho ── */}
        <Box sx={{
          display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, gap: { xs: 1.3, md: 2 },
          flexWrap: 'wrap',
        }}>
          <PesqLogo size={{ xs: 46, md: 54, xl: 62 }} variant="glow" alt="PESQ" />

          <Box sx={{ minWidth: 0, flex: { xs: '1 1 auto', md: '0 1 auto' } }}>
            <Box component="h1" sx={{
              m: 0, fontSize: { xs: '1.25rem', md: '1.65rem', xl: '2rem' }, fontWeight: 800,
              letterSpacing: '-0.035em', lineHeight: 1.06, color: PESQ.t1,
            }}>
              Central de Publicações{' '}
              <Box component="span" sx={{
                background: PESQ.gradient, WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                PESQ
              </Box>
            </Box>
            <Box sx={{
              mt: 0.4, fontSize: { xs: '0.72rem', md: '0.82rem' }, color: PESQ.t2, lineHeight: 1.4,
            }}>
              Conteúdo pronto, publicação no controle
            </Box>
          </Box>

          <Box sx={{
            ml: { md: 'auto' }, display: 'flex', alignItems: 'center', gap: { xs: 0.7, md: 1 },
            flexWrap: 'wrap',
          }}>
            <Tooltip
              arrow
              title={conexao === 'assistido'
                ? `Mensagens vão para ${config.nomeDestino || 'o destino configurado'} — envio com um toque`
                : 'Nenhum número ou grupo configurado ainda'}
            >
              <Box
                onClick={() => setConfigAberta(true)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setConfigAberta(true) } }}
                aria-label="Estado da conexão com o WhatsApp — abrir configuração"
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.8, cursor: 'pointer',
                  px: 1.3, minHeight: 38, borderRadius: `${PESQ.r.pill}px`,
                  background: 'rgba(234,247,241,0.05)',
                  border: `1px solid ${conexao === 'assistido' ? `${PESQ.greenComp}44` : `${PESQ.amber}55`}`,
                  transition: `all ${PESQ.base} ${PESQ.soft}`,
                  '@media (hover: hover)': { '&:hover': { background: 'rgba(82,220,96,0.1)' } },
                }}
              >
                <WhatsAppIcon sx={{ fontSize: 16, color: conexao === 'assistido' ? PESQ.greenComp : PESQ.amber }} />
                <PesqDot cor={conexao === 'assistido' ? PESQ.greenComp : PESQ.amber} pulsar={conexao === 'assistido'} />
                <Box sx={{ fontSize: '0.68rem', fontWeight: 700, color: PESQ.t1, display: { xs: 'none', sm: 'block' } }}>
                  {conexao === 'assistido' ? 'Envio assistido' : 'Configurar envio'}
                </Box>
              </Box>
            </Tooltip>

            {dono && (
              <Box sx={{
                display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1,
                px: 1.2, py: 0.6, borderRadius: `${PESQ.r.pill}px`,
                background: 'rgba(234,247,241,0.05)', border: `1px solid ${PESQ.borderSoft}`,
              }}>
                <Box aria-hidden sx={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: PESQ.gradient, fontSize: '0.8rem',
                }}>
                  {dono.emoji}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ fontSize: '0.72rem', fontWeight: 700, color: PESQ.t1, lineHeight: 1.2 }}>
                    {getDisplayName(config.responsavelPadrao)}
                  </Box>
                  <Box sx={{ fontSize: '0.58rem', color: PESQ.t3 }}>publica no Instagram</Box>
                </Box>
              </Box>
            )}

            <PesqBotao
              tom="cta"
              tamanho="md"
              startIcon={<AddIcon />}
              onClick={() => { setEditando(null); setFormAberto(true) }}
              sx={{ display: { xs: 'none', md: 'inline-flex' } }}
            >
              Nova publicação
            </PesqBotao>

            <PesqBotao
              tom="ghost"
              tamanho="md"
              aria-label="Configurar envio"
              title="Configurar envio"
              onClick={() => setConfigAberta(true)}
              sx={{ px: 1.2 }}
            >
              <SettingsSuggestIcon />
            </PesqBotao>
          </Box>
        </Box>

        {/* ── Indicadores ── */}
        <PesqIndicadores
          resumo={resumo}
          config={config}
          agora={agora}
          onAbrirConfig={() => setConfigAberta(true)}
          onVerFila={verFila}
        />

        {/* ── Painel de lembretes ── */}
        <Box ref={filaRef}>
          <PesqLembretes
            fila={fila}
            agora={agora}
            conexao={conexao}
            onEnviar={lembrar}
            onAbrir={setAbertoId}
            onConfigurar={() => setConfigAberta(true)}
          />
        </Box>

        {/* ── Filtros ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Box role="tablist" aria-label="Filtrar publicações" sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
            {FILTROS.map(f => {
              const ativo = filtro === f.key
              const n = contarFiltro(f.key)
              return (
                <Box
                  key={f.key}
                  role="tab"
                  aria-selected={ativo}
                  tabIndex={0}
                  onClick={() => setFiltro(f.key)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFiltro(f.key) } }}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.6, cursor: 'pointer',
                    px: 1.4, minHeight: { xs: 38, md: 34 }, borderRadius: `${PESQ.r.pill}px`,
                    fontSize: '0.73rem', fontWeight: 700, lineHeight: 1,
                    color: ativo ? PESQ.onAccent : PESQ.t2,
                    background: ativo ? PESQ.gradientCta : 'rgba(234,247,241,0.04)',
                    border: `1px solid ${ativo ? 'transparent' : PESQ.borderSoft}`,
                    transition: `all ${PESQ.base} ${PESQ.soft}`,
                    '@media (hover: hover)': { '&:hover': { borderColor: ativo ? 'transparent' : PESQ.borderLive, color: ativo ? PESQ.onAccent : PESQ.t1 } },
                  }}
                >
                  {f.label}
                  <Box component="span" sx={{
                    fontSize: '0.63rem', fontWeight: 800, opacity: ativo ? 0.75 : 0.6,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {n}
                  </Box>
                </Box>
              )
            })}
          </Box>

          <Box sx={{
            ml: { md: 'auto' }, display: 'flex', alignItems: 'center', gap: 0.8,
            px: 1.2, height: 36, minWidth: { xs: '100%', md: 230 },
            borderRadius: `${PESQ.r.pill}px`, background: PESQ.field,
            border: `1px solid ${PESQ.borderSoft}`,
            transition: `border-color ${PESQ.base} ${PESQ.soft}`,
            '&:focus-within': { borderColor: PESQ.borderLive },
          }}>
            <SearchIcon sx={{ fontSize: 16, color: PESQ.t3 }} />
            <InputBase
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por título ou código"
              inputProps={{ 'aria-label': 'Buscar publicações por título ou código' }}
              sx={{ flex: 1, fontSize: '0.76rem', color: PESQ.t1, '& input::placeholder': { color: PESQ.t3, opacity: 1 } }}
            />
          </Box>
        </Box>

        {/* ── Lista ── */}
        {carregando ? (
          <PesqSkeleton />
        ) : lista.length === 0 ? (
          pubs.length === 0 ? (
            <PesqVazio
              titulo="A fila está limpa"
              texto={<>Nada esperando publicação por aqui. Quando um conteúdo precisar subir à mão — um Reels
                finalizado no Instagram Edits, um carrossel que vai pelo celular — crie a publicação e o
                painel cuida dos lembretes.</>}
              acao={{ label: 'Criar a primeira publicação', onClick: () => { setEditando(null); setFormAberto(true) } }}
            />
          ) : (
            <PesqVazio
              titulo="Nada com esse recorte"
              texto={busca.trim()
                ? <>Nenhuma publicação combina com <strong>{busca.trim()}</strong>. Tente o código ({'PESQ-…'}) ou parte do título.</>
                : <>Nenhuma publicação neste filtro. Veja <strong>Tudo</strong> para conferir o histórico.</>}
              acao={{ label: 'Ver tudo', onClick: () => { setFiltro('todas'); setBusca('') } }}
            />
          )
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.1, md: 1.4 }, position: 'relative' }}>
            {lista.map((pub, i) => (
              <PesqPubCard
                key={pub.id}
                pub={pub}
                agora={agora}
                indice={i}
                onAbrir={setAbertoId}
                onConfirmar={confirmar}
                onLembrar={lembrar}
                onEditar={abrirEdicao}
                onPreverMensagem={setAbertoId}
                onPausar={id => { api.pausar(id); setAviso({ msg: 'Lembretes pausados.', tom: 'alerta' }) }}
                onRetomar={id => { api.retomar(id); setAviso({ msg: 'Lembretes retomados a partir de agora.', tom: 'ok' }) }}
                onCancelar={id => {
                  api.cancelar(id)
                  setAviso({
                    msg: 'Publicação cancelada.',
                    tom: 'alerta',
                    acao: { label: 'Desfazer', onClick: () => api.reabrir(id) },
                  })
                }}
                onReabrir={id => { api.reabrir(id); setAviso({ msg: 'Publicação de volta à fila.', tom: 'ok' }) }}
                onRemover={id => setExcluir(pubs.find(p => p.id === id) ?? null)}
              />
            ))}
          </Box>
        )}

        {/* Assinatura discreta no fim da rolagem */}
        <Box sx={{ position: 'relative', minHeight: 60, mt: 'auto', overflow: 'hidden' }}>
          <PesqWatermark size={220} opacity={0.035} right={-30} bottom={-40} />
        </Box>

        {/* Ação principal ao alcance do polegar.
            `sticky`, não `fixed`: quem rola é um contêiner de fora, e o
            `MobileShell` embrulha a tela num elemento com `transform` — que
            vira bloco de contenção e faz `fixed` medir a partir dele, não da
            janela. Colado na rolagem o botão fica onde o polegar espera em
            qualquer um dos dois casos. */}
        <PesqBotao
          tom="cta"
          onClick={() => { setEditando(null); setFormAberto(true) }}
          aria-label="Nova publicação"
          sx={{
            display: { xs: 'inline-flex', md: 'none' },
            position: 'sticky', bottom: 14, alignSelf: 'flex-end', zIndex: 6,
            width: 56, height: 56, borderRadius: '50%', px: 0, mt: -5,
          }}
        >
          <AddIcon sx={{ fontSize: 26 }} />
        </PesqBotao>
      </Box>

      {/* ── Camadas ── */}
      <PesqDetalhes
        pub={aberta}
        config={config}
        agora={agora}
        onFechar={() => setAbertoId(null)}
        onConfirmar={confirmar}
        onLembrar={lembrar}
        onEditar={abrirEdicao}
        onPausar={api.pausar}
        onRetomar={api.retomar}
        onCancelar={id => { api.cancelar(id); setAbertoId(null) }}
        onReabrir={api.reabrir}
      />

      <PesqPubDialog
        aberto={formAberto}
        editando={editando}
        config={config}
        onFechar={() => { setFormAberto(false); setEditando(null) }}
        onSalvar={salvarForm}
      />

      <PesqConfigDialog
        aberto={configAberta}
        config={config}
        onFechar={() => setConfigAberta(false)}
        onSalvar={c => { api.salvarConfiguracao(c); setAviso({ msg: 'Configuração salva.', tom: 'ok' }) }}
      />

      <Dialog
        open={!!excluir}
        onClose={() => setExcluir(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: {
          background: `linear-gradient(168deg, ${PESQ.surfaceAlt}, ${PESQ.bg})`, backgroundImage: 'none',
          border: `1px solid ${PESQ.border}`, borderRadius: `${PESQ.r.sheet}px`, m: 2,
        } } }}
      >
        <Box sx={{ p: 2.4 }}>
          <Box sx={{ fontSize: '1rem', fontWeight: 800, color: PESQ.t1, mb: 0.8 }}>
            Excluir esta publicação?
          </Box>
          <Box sx={{ fontSize: '0.8rem', color: PESQ.t2, lineHeight: 1.6, mb: 2 }}>
            {excluir?.codigo} — {excluir?.titulo}. O histórico de lembretes some junto, e isso não tem
            como voltar. Se a ideia é só parar de avisar, <strong>cancelar</strong> guarda o registro.
          </Box>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <PesqBotao tom="ghost" onClick={() => setExcluir(null)}>Voltar</PesqBotao>
            <PesqBotao
              tom="ghost"
              onClick={() => {
                if (!excluir) return
                api.cancelar(excluir.id)
                setExcluir(null)
                setAviso({ msg: 'Publicação cancelada — o registro ficou.', tom: 'alerta' })
              }}
            >
              Cancelar em vez de excluir
            </PesqBotao>
            <PesqBotao
              tom="danger"
              onClick={() => {
                if (!excluir) return
                api.remover(excluir.id)
                if (abertoId === excluir.id) setAbertoId(null)
                setExcluir(null)
                setAviso({ msg: 'Publicação excluída do painel.', tom: 'erro' })
              }}
            >
              Excluir
            </PesqBotao>
          </Box>
        </Box>
      </Dialog>

      <PesqSucesso info={sucesso} onFim={() => setSucesso(null)} />
      <PesqToast aviso={aviso} onFechar={() => setAviso(null)} />
    </Box>
  )
}
