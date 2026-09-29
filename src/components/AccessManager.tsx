import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogTitle, Box, Typography, IconButton,
  TextField, Button, Chip, CircularProgress, Collapse, Divider,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CheckIcon from '@mui/icons-material/Check'
import { NAME_MAP } from '../lib/users'
import { DS } from '../theme'
import SyncAuditPanel from './SyncAuditPanel'

// Ordered list of team members for display
const MEMBER_ORDER = ['pradox', 'testa', 'arthur', 'robson', 'jhones', 'julio', 'kaique', 'kerges']

interface Props {
  open: boolean
  onClose: () => void
  currentUser?: string
}

type EditingRow = { username: string; password: string; confirm: string; error: string }

export default function AccessManager({ open, onClose, currentUser }: Props) {
  const [configuredUsers, setConfiguredUsers]   = useState<string[]>([])
  const [adminPassword,   setAdminPassword]     = useState('')
  const [adminVerified,   setAdminVerified]     = useState(false)
  const [adminError,      setAdminError]        = useState('')
  const [adminLoading,    setAdminLoading]      = useState(false)
  const [editingUser,     setEditingUser]       = useState<string | null>(null)
  const [editRow,         setEditRow]           = useState<EditingRow>({ username: '', password: '', confirm: '', error: '' })
  const [saving,          setSaving]            = useState(false)
  const [savedUser,       setSavedUser]         = useState<string | null>(null)
  const [erroGeral,       setErroGeral]         = useState('')

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setAdminPassword('')
      setAdminVerified(false)
      setAdminError('')
      setEditingUser(null)
      refreshConfigured()
    }
  }, [open])

  function refreshConfigured() {
    fetch('/api/role-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    })
      .then(r => r.json())
      .then((d: { configured?: string[] }) => setConfiguredUsers(d.configured ?? []))
      .catch(() => {})
  }

  // Admin = só os sócios (2026-09-28: o Kaique virou editor isolado). Mesma
  // lista do servidor (functions/api/_lib/users.ts → ADMIN_USERS).
  const adminUsers = ['pradox', 'testa']
  const hasSocioPassword = configuredUsers.some(u => adminUsers.includes(u))

  async function handleVerifyAdmin() {
    if (!adminPassword.trim()) return
    setAdminLoading(true)
    setAdminError('')
    try {
      for (const adminUser of adminUsers) {
        if (!configuredUsers.includes(adminUser)) continue
        const res  = await fetch('/api/role-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify', role: adminUser, password: adminPassword }),
        })
        const data = await res.json() as { ok: boolean }
        if (data.ok) { setAdminVerified(true); setAdminLoading(false); return }
      }
      setAdminError('Senha incorreta. Use a sua senha de sócio.')
    } catch {
      setAdminError('Sem conexão com o servidor — tente de novo.')
    } finally {
      setAdminLoading(false)
    }
  }

  function startEditing(username: string) {
    setEditingUser(username)
    setEditRow({ username, password: '', confirm: '', error: '' })
  }

  function cancelEditing() {
    setEditingUser(null)
    setEditRow({ username: '', password: '', confirm: '', error: '' })
  }

  async function handleSavePassword() {
    const { password, confirm, username } = editRow
    if (!password) { setEditRow(r => ({ ...r, error: 'Digite uma senha.' })); return }
    if (password.length < 4) { setEditRow(r => ({ ...r, error: 'Mínimo 4 caracteres.' })); return }
    if (password !== confirm) { setEditRow(r => ({ ...r, error: 'As senhas não coincidem.' })); return }

    setSaving(true)
    setEditRow(r => ({ ...r, error: '' }))
    try {
      const res  = await fetch('/api/role-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set',
          role: username,
          password,
          adminPassword,
        }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (data.ok) {
        refreshConfigured()
        setSavedUser(username)
        setTimeout(() => setSavedUser(null), 2000)
        cancelEditing()
      } else {
        setEditRow(r => ({ ...r, error: data.error ?? 'Erro ao salvar.' }))
      }
    } catch {
      setEditRow(r => ({ ...r, error: 'Servidor indisponível.' }))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemovePassword(username: string) {
    setSaving(true)
    try {
      const res  = await fetch('/api/role-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', role: username, adminPassword }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (data.ok) { refreshConfigured(); setErroGeral('') }
      else setErroGeral(data.error ?? 'Não foi possível remover a senha.')
    } catch { setErroGeral('Servidor indisponível.') }
    finally { setSaving(false) }
  }

  // Sócio TAMBÉM confirma a própria senha (2026-09-29). Antes o sócio logado
  // pulava esta etapa, a senha de admin ia vazia e o servidor recusava toda troca
  // — nenhum sócio conseguia mudar senha nenhuma por esta tela. O servidor
  // continua sendo quem confere; aqui é só onde a senha é pedida.
  const needsAdminVerify = hasSocioPassword && !adminVerified

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(12,12,12,0.98)',
          backdropFilter: 'blur(24px)',
          border: '1.5px solid rgba(255,181,46,0.2)',
          borderRadius: 3,
          boxShadow: '0 8px 48px rgba(255,181,46,0.1)',
        },
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, pt: 2.5, pb: 2 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'rgba(255,181,46,0.1)', border: '1px solid rgba(255,181,46,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LockIcon sx={{ fontSize: 18, color: DS.amber }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>Senhas da Equipe</Typography>
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(247,247,245,0.35)' }}>
              Configure senha individual por membro · só os sócios
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(247,247,245,0.4)', '&:hover': { color: '#fff' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'rgba(247,247,245,0.07)' }} />
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>

        {/* ── Admin verification ── */}
        {needsAdminVerify ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255,181,46,0.05)', border: '1px solid rgba(255,181,46,0.15)' }}>
              <Typography sx={{ fontSize: '0.8rem', color: 'rgba(247,247,245,0.6)', lineHeight: 1.6 }}>
                Para gerenciar as senhas da equipe, confirme a sua senha de sócio (<strong style={{ color: DS.accent }}>Matheus Prado</strong> ou <strong style={{ color: DS.accent }}>Matheus Trindade</strong>).
              </Typography>
            </Box>
            <TextField
              fullWidth size="small" type="password"
              label="Sua senha de sócio"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleVerifyAdmin() }}
              error={!!adminError}
              helperText={adminError}
              autoComplete="current-password"
              sx={fieldSx(DS.amber)}
            />
            <Button
              variant="contained"
              onClick={handleVerifyAdmin}
              disabled={!adminPassword.trim() || adminLoading}
              sx={{ bgcolor: DS.accent, color: DS.onAccent, fontWeight: 800, '&:hover': { bgcolor: DS.accentStrong } }}
            >
              {adminLoading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Verificar'}
            </Button>
          </Box>

        ) : (
          /* ── Member list ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {!hasSocioPassword && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,122,0,0.06)', border: '1px solid rgba(255,122,0,0.15)', mb: 1 }}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(247,247,245,0.45)', lineHeight: 1.6 }}>
                  Defina primeiro a senha de um sócio, para proteger o painel.
                </Typography>
              </Box>
            )}
            {erroGeral && (
              <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: `${DS.red}14`, border: `1px solid ${DS.red}40`, mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.74rem', color: DS.redSoft }}>{erroGeral}</Typography>
              </Box>
            )}

            {MEMBER_ORDER.map(username => {
              const info        = NAME_MAP[username]
              if (!info) return null
              const hasPassword = configuredUsers.includes(username)
              const isEditing   = editingUser === username
              const wasSaved    = savedUser === username

              return (
                <Box key={username} sx={{
                  borderRadius: 2,
                  border: `1px solid ${isEditing ? `${info.color}40` : 'rgba(247,247,245,0.07)'}`,
                  background: isEditing ? `${info.color}06` : 'rgba(247,247,245,0.02)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                }}>
                  {/* Row header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.3 }}>
                    <Typography sx={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0 }}>{info.initials}</Typography>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: info.color, lineHeight: 1 }}>
                        {info.fullName}
                      </Typography>
                      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(247,247,245,0.3)', lineHeight: 1.2 }}>
                        {info.role}
                      </Typography>
                    </Box>

                    {wasSaved && (
                      <Chip
                        icon={<CheckIcon sx={{ fontSize: 12 }} />}
                        label="Salvo"
                        size="small"
                        sx={{ bgcolor: 'rgba(32,216,120,0.15)', color: DS.green, borderColor: 'rgba(32,216,120,0.3)', border: '1px solid', fontSize: '0.62rem', height: 22 }}
                      />
                    )}

                    {hasPassword ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LockIcon sx={{ fontSize: 13, color: info.color }} />
                        <Typography sx={{ fontSize: '0.62rem', color: info.color, fontWeight: 700 }}>Protegido</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LockOpenIcon sx={{ fontSize: 13, color: 'rgba(247,247,245,0.2)' }} />
                        <Typography sx={{ fontSize: '0.62rem', color: 'rgba(247,247,245,0.2)' }}>Sem senha</Typography>
                      </Box>
                    )}

                    {!isEditing && (
                      <IconButton
                        size="small"
                        onClick={() => startEditing(username)}
                        sx={{ color: 'rgba(247,247,245,0.3)', '&:hover': { color: info.color }, p: 0.5 }}
                      >
                        <EditIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                    {hasPassword && !isEditing && (
                      <IconButton
                        size="small"
                        onClick={() => handleRemovePassword(username)}
                        disabled={saving}
                        sx={{ color: 'rgba(247,247,245,0.2)', '&:hover': { color: DS.red }, p: 0.5 }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </Box>

                  {/* Inline edit form */}
                  <Collapse in={isEditing}>
                    <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5, borderTop: '1px solid rgba(247,247,245,0.06)', pt: 1.5 }}>
                      <Typography sx={{ fontSize: '0.68rem', color: 'rgba(247,247,245,0.4)' }}>
                        {hasPassword ? 'Alterar senha' : 'Definir senha'} para <strong style={{ color: info.color }}>{info.fullName}</strong>
                      </Typography>
                      <TextField
                        fullWidth size="small" type="password"
                        label="Nova senha"
                        value={editRow.password}
                        onChange={e => setEditRow(r => ({ ...r, password: e.target.value, error: '' }))}
                        sx={fieldSx(info.color)}
                      />
                      <TextField
                        fullWidth size="small" type="password"
                        label="Confirmar senha"
                        value={editRow.confirm}
                        onChange={e => setEditRow(r => ({ ...r, confirm: e.target.value, error: '' }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleSavePassword() }}
                        error={!!editRow.error}
                        helperText={editRow.error}
                        sx={fieldSx(info.color)}
                      />
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="contained" size="small"
                          onClick={handleSavePassword}
                          disabled={saving}
                          sx={{ bgcolor: info.color, color: '#000', fontWeight: 800, flex: 1, '&:hover': { filter: 'brightness(1.12)' }, '&.Mui-disabled': { bgcolor: 'rgba(247,247,245,0.08)', color: 'rgba(247,247,245,0.2)' } }}
                        >
                          {saving ? <CircularProgress size={16} sx={{ color: '#000' }} /> : 'Salvar'}
                        </Button>
                        <Button
                          variant="outlined" size="small"
                          onClick={cancelEditing}
                          sx={{ borderColor: 'rgba(247,247,245,0.15)', color: 'rgba(247,247,245,0.5)', '&:hover': { borderColor: 'rgba(247,247,245,0.3)', color: '#fff' } }}
                        >
                          Cancelar
                        </Button>
                      </Box>
                    </Box>
                  </Collapse>
                </Box>
              )
            })}

            <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: 'rgba(247,247,245,0.02)', border: '1px solid rgba(247,247,245,0.05)' }}>
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(247,247,245,0.25)', lineHeight: 1.7 }}>
                🔐 Senhas são criptografadas com SHA-256 no banco de dados.<br />
                Sem senha definida, o membro entra direto ao selecionar o avatar.
              </Typography>
            </Box>

            {/* O sinal para fechar o /api/sync. Fica aqui porque esta é a tela
                de acesso — e ler daqui não estraga a medição, ao contrário do
                GET /api/sync?key=sm_auth_audit, que conta como anônimo. */}
            <SyncAuditPanel />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}

function fieldSx(color: string) {
  return {
    '& .MuiOutlinedInput-root': {
      color: '#fff', background: 'rgba(247,247,245,0.03)',
      '& fieldset': { borderColor: `${color}25` },
      '&:hover fieldset': { borderColor: `${color}50` },
      '&.Mui-focused fieldset': { borderColor: color },
    },
    '& .MuiInputLabel-root': { color: 'rgba(247,247,245,0.4)' },
    '& .MuiInputLabel-root.Mui-focused': { color },
    '& .MuiFormHelperText-root.Mui-error': { color: DS.red },
  }
}
