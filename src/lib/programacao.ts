/**
 * Programação de postagem — o "planner" do painel.
 *
 * O card carrega o DIA (`item.dt`) e a HORA (`state.horaPostagem`) em que deve
 * ir ao ar. Depois que o cliente aprova (5), o Social aprova com um clique e o
 * card vira Programado (9) exatamente nesse dia e hora — sem redigitar nada.
 *
 * Só funções puras: quem grava é o App.
 */
import type { ContentItem, ItemState, Status } from '../types'

/** Etapa em que o conteúdo espera a aprovação final do Social para ser programado. */
export const STATUS_AGUARDA_SOCIAL: Status = 5

export function horaValida(h: string | undefined | null): h is string {
  return typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "HH:MM" no fuso do aparelho — a hora que a pessoa digitou é a hora local. */
export function horaDe(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Dia (local) + "HH:MM" → instante. */
export function juntar(dia: Date, hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m, 0, 0).getTime()
}

export interface Postagem {
  /** Dia (e hora, quando há) em que o conteúdo vai ao ar. */
  quando: Date
  /** "HH:MM" quando o card tem horário; `null` = só o dia está definido. */
  hora: string | null
  /** true = Programado de fato; false = só planejado no card. */
  firme: boolean
}

/**
 * Quando este conteúdo vai ao ar. Programado manda (é o compromisso); senão,
 * o dia da pauta com a hora do card, se houver.
 */
export function postagemDoCard(item: ContentItem, st: ItemState | undefined): Postagem {
  if (st?.status === 9 && st.programadoPara) {
    return { quando: new Date(st.programadoPara), hora: horaDe(st.programadoPara), firme: true }
  }
  const dia = new Date(item.dt)
  if (horaValida(st?.horaPostagem)) {
    return { quando: new Date(juntar(dia, st.horaPostagem)), hora: st.horaPostagem, firme: false }
  }
  return { quando: dia, hora: null, firme: false }
}

/**
 * O instante em que o card pode ser programado SEM perguntar nada: tem dia,
 * tem hora e ainda não passou. `null` = falta dado (ou a data venceu) e a
 * pessoa precisa escolher.
 */
export function programacaoAutomatica(item: ContentItem, st: ItemState | undefined, agora: number): number | null {
  if (!horaValida(st?.horaPostagem)) return null
  const ts = juntar(new Date(item.dt), st.horaPostagem)
  return ts > agora ? ts : null
}

/** Aprovados pelo cliente esperando o Social — em ordem de quando vão ao ar. */
export function aguardandoSocial(items: ContentItem[], states: Record<number, ItemState>): ContentItem[] {
  return items
    .filter(i => (states[i.i]?.status ?? i.s) === STATUS_AGUARDA_SOCIAL)
    .sort((a, b) => postagemDoCard(a, states[a.i]).quando.getTime() - postagemDoCard(b, states[b.i]).quando.getTime())
}

/**
 * O que gravar quando a hora do card muda. Num card já Programado a hora
 * marcada anda junto — senão o calendário continuaria mostrando a antiga.
 */
export function patchDaHora(st: ItemState | undefined, hora: string): Partial<ItemState> {
  if (!horaValida(hora)) return { horaPostagem: undefined }
  if (st?.status === 9 && st.programadoPara) {
    return { horaPostagem: hora, programadoPara: juntar(new Date(st.programadoPara), hora) }
  }
  return { horaPostagem: hora }
}

/** "30/09 às 18:00" — o texto dos avisos. */
export function textoDoMomento(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${horaDe(ts)}`
}
