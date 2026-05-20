// Lista fechada de usuários autorizados e seus cargos.
// Usada tanto na SplashScreen (detecção) quanto no App (exibição).

export const NAME_MAP: Record<string, { role: string; emoji: string; color: string; glow: string }> = {
  'pradox':  { role: 'Sócio',             emoji: '👑', color: '#FFD700', glow: 'rgba(255,215,0,0.5)'   },
  'testa':   { role: 'Sócio',             emoji: '👑', color: '#FFD700', glow: 'rgba(255,215,0,0.5)'   },
  'kaique':  { role: 'Head operacional',  emoji: '🎬', color: '#ff9039', glow: 'rgba(255,144,57,0.5)'  },
  'geovana': { role: 'Social media',      emoji: '📱', color: '#3B8EFF', glow: 'rgba(59,142,255,0.5)'  },
  'jhones':  { role: 'Design',            emoji: '🎨', color: '#C084FC', glow: 'rgba(192,132,252,0.5)' },
  'kerges':  { role: 'Copy',              emoji: '✍️', color: '#FB7185', glow: 'rgba(251,113,133,0.5)' },
  'arthur':  { role: 'Gestor de tráfego', emoji: '📈', color: '#00C47A', glow: 'rgba(0,196,122,0.5)'  },
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
