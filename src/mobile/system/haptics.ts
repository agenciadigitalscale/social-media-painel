// Feedback tátil do app mobile.
// iOS Safari NÃO expõe a Vibration API — haptics reais são impossíveis na web em iPhone.
// Estratégia: disparar navigator.vibrate() onde existir (Android/Chrome) e, para momentos
// significativos, tocar um "tick" curtíssimo de áudio como faux-haptic — o cérebro lê o
// pulso sonoro + a micro-animação visual (feita nos componentes) como confirmação física.

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'selection'

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!ctx) ctx = new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

const VIBRATE: Record<HapticKind, number | number[]> = {
  light: 8, selection: 6, medium: 14, heavy: 22, success: [10, 26, 12], warning: [16, 36, 16],
}

// Só tocamos áudio nos eventos que valem uma confirmação sonora — não em cada toque leve.
const TONE: Partial<Record<HapticKind, { f: number; d: number; g: number }>> = {
  medium:  { f: 150, d: 0.028, g: 0.035 },
  heavy:   { f: 110, d: 0.045, g: 0.05 },
  success: { f: 340, d: 0.05,  g: 0.045 },
  warning: { f: 90,  d: 0.06,  g: 0.05 },
}

export function haptic(kind: HapticKind = 'light'): void {
  try { navigator.vibrate?.(VIBRATE[kind]) } catch { /* noop */ }
  const tone = TONE[kind]
  if (!tone) return
  const a = audio()
  if (!a) return
  try {
    const osc = a.createOscillator()
    const gain = a.createGain()
    osc.type = 'sine'
    osc.frequency.value = tone.f
    gain.gain.setValueAtTime(0, a.currentTime)
    gain.gain.linearRampToValueAtTime(tone.g, a.currentTime + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + tone.d)
    osc.connect(gain).connect(a.destination)
    osc.start()
    osc.stop(a.currentTime + tone.d + 0.02)
  } catch { /* noop */ }
}
