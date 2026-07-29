// Lista fechada de usuários autorizados e seus cargos.
// Usada tanto na SplashScreen (detecção) quanto no App (exibição).

// Base SaaS azul: identidade do membro fica no emoji + tom cool. Sócios em roxo
// (liderança), Head em azul (marca); demais em cinza neutro.
const MEMBER_GRAY = '#9CA3AF'
const MEMBER_GLOW = 'rgba(156,163,175,0.45)'
export const NAME_MAP: Record<string, { role: string; emoji: string; color: string; glow: string }> = {
  'pradox':  { role: 'Sócio',             emoji: '👑', color: '#7C5CFC',    glow: 'rgba(124,92,252,0.5)' },
  'testa':   { role: 'Sócio',             emoji: '👑', color: '#7C5CFC',    glow: 'rgba(124,92,252,0.5)' },
  'kaique':  { role: 'Head · Fundador do painel', emoji: '🎬', color: '#3B82F6', glow: 'rgba(59,130,246,0.5)' },
  'jhones':  { role: 'Design',            emoji: '🎨', color: MEMBER_GRAY,  glow: MEMBER_GLOW },
  'kerges':  { role: 'Copy',              emoji: '✍️', color: MEMBER_GRAY,  glow: MEMBER_GLOW },
  'arthur':  { role: 'Social media + Tráfego', emoji: '📱', color: MEMBER_GRAY, glow: MEMBER_GLOW },
  'robson':  { role: 'Gestor de tráfego', emoji: '📈', color: MEMBER_GRAY,  glow: MEMBER_GLOW },
}

/**
 * Conta Google → membro do painel.
 *
 * É o que transforma "entrou com o Google" em "é o Kaique": sem isto a pessoa
 * passaria pelo login do Google e AINDA teria que escolher o avatar e digitar a
 * senha do cargo na splash — dois portões perguntando a mesma coisa.
 *
 * Quem não está aqui continua entrando pela splash (avatar + senha do cargo),
 * que hoje também emite sessão de verdade. Adicionar alguém é uma linha.
 */
export const EMAIL_TO_USER: Record<string, string> = {
  'kaiquedigitalscale@gmail.com':          'kaique',
  'geovanakergesdigitalscale@gmail.com':   'kerges',
  'arthurdigitalscale@gmail.com':          'arthur',
  'robsondigitalscale@gmail.com':          'robson',
  'mateuspradomendes123@gmail.com':        'pradox',
  'matheusdigitalscale@gmail.com':         'testa',
  // Falta o jhones — entra pela splash até ter conta cadastrada aqui.
}

/** Membro correspondente a um e-mail Google, ou null se não for da equipe. */
export function userFromEmail(email: string): string | null {
  return EMAIL_TO_USER[email.toLowerCase().trim()] ?? null
}

export type UserInfo = (typeof NAME_MAP)[string]

/** Retorna os dados do usuário ou null se não autorizado. */
export function getUserInfo(name: string): UserInfo | null {
  return NAME_MAP[name.toLowerCase().trim()] ?? null
}

/** Capitaliza apenas a primeira letra do nome. */
export function getDisplayName(name: string): string {
  if (!name) return ''
  const n = name.trim()
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
}
