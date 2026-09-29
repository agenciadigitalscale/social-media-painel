// Lista fechada de usuários autorizados e seus cargos.
// Usada tanto na SplashScreen (detecção) quanto no App (exibição).

// Identidade do membro fica no ÍCONE (o campo `emoji` é traduzido para ícone
// pelo <Glyph/>). Liderança (sócios + head) em laranja da marca; demais em cinza.
const MEMBER_GRAY = '#9298A5'
const MEMBER_GLOW = 'rgba(146,152,165,0.40)'
/** `fullName` é o nome da pessoa (tela de login); a chave segue sendo o usuário. */
export const NAME_MAP: Record<string, { fullName: string; role: string; emoji: string; color: string; glow: string }> = {
  'pradox':  { fullName: 'Matheus Prado', role: 'Sócio',             emoji: '👑', color: '#FF7A00', glow: 'rgba(255,122,0,0.45)' },
  'testa':   { fullName: 'Matheus Trindade', role: 'Sócio',             emoji: '👑', color: '#FF7A00', glow: 'rgba(255,122,0,0.45)' },
  'kaique':  { fullName: 'Kaique Sena', role: 'Editor de vídeo', emoji: '🎬', color: '#FF7A00', glow: 'rgba(255,122,0,0.45)' },
  'jhones':  { fullName: 'Matheus Johnny', role: 'Design',            emoji: '🎨', color: MEMBER_GRAY,  glow: MEMBER_GLOW },
  'julio':   { fullName: 'Julio Vicente', role: 'Design',            emoji: '🖌', color: MEMBER_GRAY,  glow: MEMBER_GLOW },
  'kerges':  { fullName: 'Geovana Kerges', role: 'Copy',              emoji: '✍', color: MEMBER_GRAY,  glow: MEMBER_GLOW },
  'arthur':  { fullName: 'Arthur Caetano', role: 'Social media + Tráfego', emoji: '📱', color: MEMBER_GRAY, glow: MEMBER_GLOW },
  'robson':  { fullName: 'Robson Barbosa', role: 'Gestor de tráfego', emoji: '📈', color: MEMBER_GRAY,  glow: MEMBER_GLOW },
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

/**
 * Quem ocupa um cargo hoje. Usado para achar o Design sem espalhar 'jhones'
 * pelas telas: quando a área trocar de mão, muda o `NAME_MAP` e as telas
 * seguem junto — um literal em cada arquivo garantiria que alguém esqueceria um.
 *
 * Devolve o PRIMEIRO da lista. Para "Sócio", que tem dois, isso seria ambíguo;
 * por isso só é usado onde o cargo é de uma pessoa só.
 */
export function membroDoCargo(role: string): string | undefined {
  return Object.keys(NAME_MAP).find(k => NAME_MAP[k].role === role)
}

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
