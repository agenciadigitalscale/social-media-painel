/**
 * Peças do "planner" dentro do Calendário de postagem:
 *  - SituacaoIG: o que vai acontecer com o post em cada rede.
 *  - ConexoesIG: quais clientes publicam sozinho, e (sócio) conectar/desconectar.
 */
import { useMemo, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import InstagramIcon from '@mui/icons-material/Instagram'
import FacebookIcon from '@mui/icons-material/Facebook'
import type { ContentItem, ItemState } from '../../types'
import { DS } from '../../theme'
import { postagemDoCard, textoDoMomento } from '../../lib/programacao'
import {
  conectarInstagram, desconectarInstagram, descobrirContas, NOME_REDE, REDES,
  type AgendamentosDoCard, type IgConta, type Rede,
} from '../../lib/instagram'
import { sugerirVinculos, type ContaMeta } from '../../lib/vinculoContas'

const ROTULO_SECAO = { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: DS.t3 }
const ICONE: Record<Rede, typeof InstagramIcon> = { instagram: InstagramIcon, facebook: FacebookIcon }

/** "@loja · Página Loja" — onde o post sai sozinho, ou vazio. */
export function destinosDa(conta: IgConta | undefined): string {
  if (!conta) return ''
  return [conta.perfil, conta.pagina && `Página ${conta.pagina}`].filter(Boolean).join(' · ')
}

// ── O que vai acontecer com este post em cada rede ───────────────────────

export function SituacaoIG({ item, st, agendamentos, conta, onReprogramar }: {
  item: ContentItem
  st: ItemState | undefined
  agendamentos?: AgendamentosDoCard
  conta?: IgConta
  onReprogramar?: () => void
}) {
  const s = st?.status ?? item.s
  const linhas: React.ReactNode[] = []

  for (const rede of REDES) {
    const a = agendamentos?.[rede]
    const Icone = ICONE[rede]
    const link = (rede === 'instagram' ? st?.igPermalink : st?.fbPermalink) || (a?.status === 'published' ? a.permalink : null)
    const destino = rede === 'instagram' ? conta?.perfil : conta?.pagina && `Página ${conta.pagina}`
    const linha = (cor: string, texto: string, extra?: React.ReactNode) => (
      <Box key={rede} sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mt: 0.6, flexWrap: 'wrap' }}>
        <Icone sx={{ fontSize: 15, color: cor }} />
        <Typography sx={{ fontSize: '0.72rem', color: cor, fontWeight: 600 }}>{texto}</Typography>
        {extra}
      </Box>
    )
    if (link || a?.status === 'published') {
      linhas.push(linha(DS.green, `Publicado no ${NOME_REDE[rede]} pelo painel`, link && (
        <Box component="a" href={link} target="_blank" rel="noreferrer"
          sx={{ fontSize: '0.72rem', fontWeight: 700, color: DS.accent, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
          ver post ↗
        </Box>
      )))
      continue
    }
    if (!a) continue
    if (a.status === 'pending' && s === 9) {
      linhas.push(linha(DS.t1, `Vai publicar sozinho${destino ? ` em ${destino}` : ` no ${NOME_REDE[rede]}`} — ${textoDoMomento(Date.parse(a.quando))}`))
    } else if (a.status === 'publishing') {
      linhas.push(linha(DS.amber, `Publicando no ${NOME_REDE[rede]} agora…`))
    } else if (a.status === 'failed') {
      linhas.push(linha(DS.red, `${NOME_REDE[rede]} não publicou: ${a.erro ?? 'erro desconhecido'}`))
    }
  }

  const falhou = REDES.some(r => agendamentos?.[r]?.status === 'failed')
  const nadaAutomatico = s === 9 && linhas.length === 0
  if (nadaAutomatico) {
    linhas.push(
      <Box key="manual" sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mt: 0.6 }}>
        <Typography sx={{ fontSize: '0.72rem', color: DS.t3 }}>
          {destinosDa(conta) ? 'Programado só no painel — publicação manual.' : 'Publicação manual — o cliente não tem Instagram nem Facebook conectado.'}
        </Typography>
      </Box>,
    )
  }
  if (linhas.length === 0) return null

  return (
    <Box sx={{ mt: 0.4 }}>
      {linhas}
      {onReprogramar && (falhou || (nadaAutomatico && destinosDa(conta))) && (
        <Button size="small" onClick={onReprogramar} sx={{ mt: 0.4, fontSize: '0.7rem', fontWeight: 700, color: DS.accent, textTransform: 'none', px: 0 }}>
          Revisar e programar de novo
        </Button>
      )}
    </Box>
  )
}

/** Ícones pequenos no card da grade: sai sozinho (cinza), saiu (verde), falhou (vermelho). */
export function MarcaIG({ agendamentos, st }: { agendamentos?: AgendamentosDoCard; st?: ItemState }) {
  return (
    <>
      {REDES.map(rede => {
        const a = agendamentos?.[rede]
        const publicado = !!(rede === 'instagram' ? st?.igPermalink : st?.fbPermalink) || a?.status === 'published'
        const cor = publicado ? DS.green
          : a?.status === 'failed' ? DS.red
          : a?.status === 'pending' || a?.status === 'publishing' ? DS.t2
          : null
        if (!cor) return null
        const Icone = ICONE[rede]
        const dica = publicado ? `Publicado no ${NOME_REDE[rede]} pelo painel`
          : cor === DS.red ? `${NOME_REDE[rede]} não publicou: ${a?.erro ?? ''}` : `Vai publicar sozinho no ${NOME_REDE[rede]}`
        return (
          <Tooltip key={rede} title={dica}>
            <Icone aria-label={dica} sx={{ fontSize: 12, color: cor, flexShrink: 0 }} />
          </Tooltip>
        )
      })}
    </>
  )
}

// ── Conexões: quais clientes publicam sozinho ────────────────────────────

export function ConexoesIG({ open, onClose, clientes, conectados, podeConectar }: {
  open: boolean
  onClose: () => void
  clientes: string[]
  conectados: IgConta[]
  podeConectar: boolean
}) {
  const [cliente, setCliente] = useState('')
  const [igId, setIgId] = useState('')
  const [pageId, setPageId] = useState('')
  const [token, setToken] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [manual, setManual] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
  const semConexao = useMemo(() => clientes.filter(c => !conectados.some(x => x.clientName === c)), [clientes, conectados])

  const conectar = async () => {
    setSalvando(true); setMsg(null)
    const r = await conectarInstagram(cliente, token, igId, pageId)
    setSalvando(false)
    if (r.ok) {
      setMsg({ tipo: 'success', texto: `${cliente} conectado: ${[r.perfil, r.pagina && `Página ${r.pagina}`].filter(Boolean).join(' · ')}.` })
      setIgId(''); setPageId(''); setToken(''); setCliente('')
    } else setMsg({ tipo: 'error', texto: r.error ?? 'Não deu para conectar.' })
  }
  const desconectar = async (c: string) => {
    if (!window.confirm(`Desconectar o Instagram e o Facebook de ${c}? Os posts dele programados deixam de sair sozinhos.`)) return
    const r = await desconectarInstagram(c)
    setMsg(r.ok ? { tipo: 'success', texto: `${c} desconectado.` } : { tipo: 'error', texto: r.error ?? 'Erro.' })
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Instagram e Facebook dos clientes</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography sx={{ fontSize: '0.78rem', color: DS.t2 }}>
          Cliente conectado tem o post publicado sozinho no horário programado, nas redes marcadas na
          revisão. Os demais ficam programados no calendário para publicação manual.
        </Typography>
        {msg && <Alert severity={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Alert>}

        <Box>
          <Typography sx={{ ...ROTULO_SECAO, mb: 0.8 }}>Conectados ({conectados.length})</Typography>
          {conectados.length === 0 && <Typography sx={{ fontSize: '0.78rem', color: DS.t3 }}>Nenhum cliente conectado ainda.</Typography>}
          {conectados.map(c => (
            <Box key={c.clientName} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.7, borderBottom: `1px solid ${DS.border}`, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: DS.t1, flex: 1, minWidth: 140 }}>{c.clientName}</Typography>
              {c.perfil && <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}><InstagramIcon sx={{ fontSize: 14, color: DS.green }} /><Typography sx={{ fontSize: '0.74rem', color: DS.t2 }}>{c.perfil}</Typography></Box>}
              {c.pagina && <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}><FacebookIcon sx={{ fontSize: 14, color: DS.green }} /><Typography sx={{ fontSize: '0.74rem', color: DS.t2 }}>{c.pagina}</Typography></Box>}
              {podeConectar && (
                <Button size="small" onClick={() => desconectar(c.clientName)} sx={{ fontSize: '0.68rem', color: DS.t3, '&:hover': { color: DS.red } }}>
                  Desconectar
                </Button>
              )}
            </Box>
          ))}
        </Box>

        {podeConectar && <ConectarEmLote clientes={clientes} />}

        {podeConectar && (
          <Button size="small" onClick={() => setManual(v => !v)} sx={{ alignSelf: 'flex-start', fontSize: '0.72rem', color: DS.t2, textTransform: 'none', px: 0 }}>
            {manual ? 'Esconder conexão manual' : 'Conectar manualmente, por ID →'}
          </Button>
        )}
        {podeConectar ? manual && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.1, p: 1.4, borderRadius: '11px', border: `1px solid ${DS.border}`, bgcolor: DS.surfaceAlt }}>
            <Typography sx={ROTULO_SECAO}>Conectar um cliente</Typography>
            <TextField select size="small" label="Cliente" value={cliente} onChange={e => setCliente(e.target.value)}>
              {semConexao.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.78rem' }}>{c}</MenuItem>)}
            </TextField>
            <TextField size="small" label="ID da conta do Instagram" value={igId} onChange={e => setIgId(e.target.value.replace(/\D/g, ''))}
              helperText="O “Instagram Business Account ID” (só números). Deixe vazio se for só Facebook." />
            <TextField size="small" label="ID da Página do Facebook" value={pageId} onChange={e => setPageId(e.target.value.replace(/\D/g, ''))}
              helperText="Só números. Deixe vazio se for só Instagram." />
            <TextField size="small" label="Token de acesso" type="password" value={token} onChange={e => setToken(e.target.value)}
              autoComplete="off"
              helperText="Token do usuário do sistema no Gerenciador de Negócios, com instagram_content_publish e pages_manage_posts." />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" size="small" disabled={!cliente || (!igId && !pageId) || !token || salvando} onClick={conectar}
                startIcon={salvando ? <CircularProgress size={14} /> : undefined}>
                Conectar e testar
              </Button>
            </Box>
          </Box>
        ) : (
          <Typography sx={{ fontSize: '0.74rem', color: DS.t3 }}>Só os sócios conectam ou desconectam as contas de um cliente.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: DS.t2 }}>Fechar</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Conectar todos de uma vez ────────────────────────────────────────────

type Resultado = { ok: boolean; texto: string }

/**
 * Cola o token uma vez, o painel lista as Páginas (e o Instagram ligado a cada
 * uma) que ele enxerga e SUGERE o cliente de cada — o sócio confere e conecta
 * tudo num clique. Sem isto, era caçar dois IDs por cliente no Gerenciador.
 */
function ConectarEmLote({ clientes }: { clientes: string[] }) {
  const [token, setToken] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [contas, setContas] = useState<ContaMeta[] | null>(null)
  const [faltando, setFaltando] = useState<string[]>([])
  const [vinculo, setVinculo] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<Record<string, Resultado>>({})
  const [conectando, setConectando] = useState(false)

  const buscar = async () => {
    setBuscando(true); setErro(null); setContas(null); setResultado({})
    const r = await descobrirContas(token.trim())
    setBuscando(false)
    if (!r.ok || !r.contas) { setErro(r.error ?? 'Não deu para buscar as contas.'); return }
    setContas(r.contas)
    setFaltando(r.faltando ?? [])
    setVinculo(sugerirVinculos(clientes, r.contas))
  }

  const escolhidos = (contas ?? []).filter(c => vinculo[c.pageId])
  const repetidos = new Set(escolhidos.map(c => vinculo[c.pageId]).filter((c, i, a) => a.indexOf(c) !== i))

  const conectarTodos = async () => {
    setConectando(true)
    for (const c of escolhidos) {
      const cliente = vinculo[c.pageId]
      setResultado(r => ({ ...r, [c.pageId]: { ok: true, texto: 'conectando…' } }))
      const r = await conectarInstagram(cliente, token.trim(), c.igUserId ?? '', c.pageId)
      setResultado(prev => ({ ...prev, [c.pageId]: r.ok ? { ok: true, texto: 'conectado' } : { ok: false, texto: r.error ?? 'erro' } }))
    }
    setConectando(false)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.1, p: 1.4, borderRadius: '11px', border: `1px solid ${DS.border}`, bgcolor: DS.surfaceAlt }}>
      <Typography sx={ROTULO_SECAO}>Conectar todos de uma vez</Typography>
      <Typography sx={{ fontSize: '0.74rem', color: DS.t2 }}>
        Cole o token do usuário do sistema. O painel busca as Páginas e os Instagrams a que ele tem acesso e sugere de qual cliente é cada um.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField size="small" fullWidth label="Token de acesso" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} />
        <Button variant="contained" size="small" disabled={!token.trim() || buscando} onClick={buscar}
          startIcon={buscando ? <CircularProgress size={14} /> : undefined} sx={{ flexShrink: 0 }}>
          Buscar contas
        </Button>
      </Box>
      {erro && <Alert severity="error" sx={{ fontSize: '0.74rem' }}>{erro}</Alert>}

      {contas && faltando.length > 0 && (
        <Alert severity="warning" sx={{ fontSize: '0.74rem' }}>
          O token está sem {faltando.length === 1 ? 'a permissão' : 'as permissões'} <b>{faltando.join(', ')}</b>.
          {faltando.includes('instagram_basic') && ' Sem ela a Meta não mostra o Instagram ligado a cada Página.'}
          {' '}Gere o token de novo marcando {faltando.length === 1 ? 'essa permissão' : 'essas permissões'}.
        </Alert>
      )}
      {contas && contas.length > 0 && faltando.length === 0 && contas.some(c => !c.igUserId) && (
        <Alert severity="info" sx={{ fontSize: '0.74rem' }}>
          As permissões do token estão certas. Página "sem Instagram ligado" é configuração na Meta: atribua o
          Instagram do cliente ao usuário do sistema (Assign assets → Instagram accounts) e confira se ele está
          vinculado à Página (Página → Configurações → Contas vinculadas).
        </Alert>
      )}
      {contas && contas.length === 0 && (
        <Alert severity="warning" sx={{ fontSize: '0.74rem' }}>
          O token não enxerga nenhuma Página. Confira se as Páginas dos clientes foram atribuídas ao usuário do sistema.
        </Alert>
      )}

      {contas && contas.length > 0 && (
        <>
          <Typography sx={{ fontSize: '0.72rem', color: DS.t2 }}>
            {contas.length} Página{contas.length !== 1 ? 's' : ''} encontrada{contas.length !== 1 ? 's' : ''}. Confira o cliente de cada uma — a sugestão é pelo nome e pode errar.
          </Typography>
          <Box sx={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {contas.map(c => {
              const res = resultado[c.pageId]
              return (
                <Box key={c.pageId} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.8, borderBottom: `1px solid ${DS.border}`, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: 1, minWidth: 170 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <FacebookIcon sx={{ fontSize: 14, color: DS.t2 }} />
                      <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 700, color: DS.t1 }}>{c.pageName || c.pageId}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <InstagramIcon sx={{ fontSize: 14, color: c.igUsername ? DS.t2 : DS.t4 }} />
                      <Typography noWrap sx={{ fontSize: '0.72rem', color: c.igUsername ? DS.t2 : DS.t4 }}>
                        {c.igUsername ? `@${c.igUsername}` : 'sem Instagram ligado à Página'}
                      </Typography>
                    </Box>
                  </Box>
                  <TextField select size="small" value={vinculo[c.pageId] ?? ''} disabled={conectando}
                    onChange={e => setVinculo(v => ({ ...v, [c.pageId]: e.target.value }))}
                    error={!!vinculo[c.pageId] && repetidos.has(vinculo[c.pageId])}
                    sx={{ width: 200, '& .MuiInputBase-root': { fontSize: '0.76rem' } }}>
                    <MenuItem value="" sx={{ fontSize: '0.76rem', color: DS.t3 }}>— não conectar —</MenuItem>
                    {clientes.map(cl => <MenuItem key={cl} value={cl} sx={{ fontSize: '0.76rem' }}>{cl}</MenuItem>)}
                  </TextField>
                  {res && (
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: res.texto === 'conectando…' ? DS.t2 : res.ok ? DS.green : DS.red, width: '100%', textAlign: 'right' }}>
                      {res.texto}
                    </Typography>
                  )}
                </Box>
              )
            })}
          </Box>
          {repetidos.size > 0 && (
            <Typography sx={{ fontSize: '0.72rem', color: DS.red }}>O mesmo cliente está escolhido em duas Páginas — deixe um só.</Typography>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" size="small" disabled={!escolhidos.length || repetidos.size > 0 || conectando} onClick={conectarTodos}
              startIcon={conectando ? <CircularProgress size={14} /> : undefined}>
              Conectar {escolhidos.length} cliente{escolhidos.length !== 1 ? 's' : ''}
            </Button>
          </Box>
        </>
      )}
    </Box>
  )
}
