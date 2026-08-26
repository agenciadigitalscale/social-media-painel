import { Box } from '@mui/material'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend'
import { BRAND } from '../../theme'
import { PESQ, PESQ_LOGO } from '../../lib/pesq/brand'
import { previewConversa } from '../../lib/pesq/mensagens'
import { FORMATO_ICONE, thumbDe } from './PesqThumb'
import type { PesqConfig, PesqPublicacao } from '../../lib/pesq/publicacoes'

/* A mensagem como ela vai chegar.
   Cores do WhatsApp são do WhatsApp: aqui elas identificam o serviço, e é o
   único ponto do módulo onde a paleta não é a do PESQ. Se a simulação usasse
   verde da marca, ela deixaria de ser simulação e viraria mais um cartão do
   painel — perdendo justamente o que ela serve para responder: "é isto que o
   Arthur vai ver no celular dele?". */
const WA = {
  fundo:   '#0B141A',   // fundo da conversa (tema escuro)
  bolha:   '#005C4B',   // balão enviado — branco em cima dá 7,8:1
  barra:   '#1F2C34',   // cabeçalho
  texto:   '#E9EDEF',
  meta:    'rgba(233,237,239,0.6)',
  tick:    '#53BDEB',
}

/** Negrito do WhatsApp (*assim*) vira <strong> — o resto é texto puro. */
function Formatado({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*)/g)
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith('*') && p.endsWith('*') && p.length > 2
          ? <Box key={i} component="strong" sx={{ fontWeight: 700 }}>{p.slice(1, -1)}</Box>
          : <Box key={i} component="span">{p}</Box>,
      )}
    </>
  )
}

/** A capa da estreia: logo, chamada, miniatura e código. */
function Capa({ pub }: { pub: PesqPublicacao }) {
  const src = thumbDe(pub)
  return (
    <Box sx={{
      mb: 0.8, borderRadius: '10px', overflow: 'hidden',
      background: `linear-gradient(135deg, ${PESQ.deep} 0%, ${PESQ.bgDeep} 100%)`,
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <Box sx={{
        position: 'relative', height: 104, display: 'flex', alignItems: 'center', gap: 1.2, px: 1.4,
        background: `linear-gradient(120deg, ${PESQ.emerald}3d, transparent 70%)`,
      }}>
        <Box component="img" src={PESQ_LOGO} alt="" aria-hidden
          sx={{ width: 40, height: 40, borderRadius: '10px', objectFit: 'contain', flexShrink: 0 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: PESQ.greenLum }}>
            PESQ
          </Box>
          <Box sx={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', lineHeight: 1.25 }}>
            Publicação manual pendente
          </Box>
          <Box sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.72)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
            {pub.codigo}
          </Box>
        </Box>
        {src
          ? <Box component="img" src={src} alt="" aria-hidden loading="lazy"
              sx={{ width: 58, height: 74, objectFit: 'cover', borderRadius: '8px', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }} />
          : <Box aria-hidden sx={{
              width: 58, height: 74, borderRadius: '8px', flexShrink: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            }}>{FORMATO_ICONE[pub.formato]}</Box>}
      </Box>
    </Box>
  )
}

function Bolha({ texto, hora, capa, pendente, pub }: {
  texto: string; hora: string; capa: boolean; pendente: boolean; pub: PesqPublicacao
}) {
  return (
    <Box sx={{
      alignSelf: 'flex-end', maxWidth: { xs: '92%', md: '84%' },
      background: WA.bolha, color: WA.texto,
      borderRadius: '10px 10px 2px 10px',
      p: 1.1, pb: 0.6,
      boxShadow: '0 1px 1px rgba(0,0,0,0.3)',
      animation: `pesqRise 0.34s ${PESQ.ease} both`,
      ...(pendente && {
        opacity: 0.94,
        outline: `1px dashed ${PESQ.greenLum}88`,
        outlineOffset: '2px',
      }),
    }}>
      {capa && <Capa pub={pub} />}
      <Box sx={{
        fontSize: '0.76rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        <Formatado texto={texto} />
      </Box>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.4,
        mt: 0.3, fontSize: '0.58rem', color: WA.meta,
      }}>
        {pendente ? 'a enviar' : hora}
        {pendente
          ? <ScheduleSendIcon sx={{ fontSize: 12 }} />
          : <DoneAllIcon sx={{ fontSize: 13, color: WA.tick }} />}
      </Box>
    </Box>
  )
}

interface Props {
  pub: PesqPublicacao
  config: PesqConfig
  agora: number
  /** Sem isto a prévia mostra só o histórico — usado depois de publicar. */
  mostrarProxima?: boolean
}

export default function PesqWhatsAppPreview({ pub, config, agora, mostrarProxima = true }: Props) {
  const { enviadas, proxima, tipoProxima } = previewConversa(pub, config, agora)
  const destino = config.nomeDestino || (config.destino ? 'Destino configurado' : 'Nenhum destino configurado')

  return (
    <Box sx={{
      borderRadius: `${PESQ.r.field}px`, overflow: 'hidden',
      border: `1px solid ${PESQ.borderSoft}`, background: WA.fundo,
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.4, py: 1,
        background: WA.barra, borderBottom: '1px solid rgba(0,0,0,0.3)',
      }}>
        <Box sx={{
          width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: BRAND.whatsappDark, flexShrink: 0,
        }}>
          <WhatsAppIcon sx={{ fontSize: 18, color: '#fff' }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: '0.78rem', fontWeight: 700, color: WA.texto, lineHeight: 1.2 }}>{destino}</Box>
          <Box sx={{ fontSize: '0.6rem', color: WA.meta }}>
            {tipoProxima === 'capa' ? 'primeira mensagem — vai com capa' : 'lembrete de texto'}
          </Box>
        </Box>
      </Box>

      <Box sx={{
        p: 1.4, display: 'flex', flexDirection: 'column', gap: 0.9,
        maxHeight: { xs: 300, md: 380 }, overflowY: 'auto',
        // Papel de parede discreto — dá textura de conversa sem imagem externa.
        backgroundImage: `radial-gradient(rgba(255,255,255,0.028) 1px, transparent 1px)`,
        backgroundSize: '18px 18px',
      }}>
        {enviadas.map(b => (
          <Bolha key={b.id} texto={b.texto} hora={b.hora} capa={b.capa} pendente={false} pub={pub} />
        ))}
        {mostrarProxima && proxima && (
          <Bolha texto={proxima.texto} hora={proxima.hora} capa={proxima.capa} pendente pub={pub} />
        )}
        {!enviadas.length && !mostrarProxima && (
          <Box sx={{ fontSize: '0.72rem', color: WA.meta, textAlign: 'center', py: 2 }}>
            Nenhuma mensagem enviada para esta publicação.
          </Box>
        )}
      </Box>
    </Box>
  )
}
