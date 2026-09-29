import { useState } from 'react'
import { Box, Button, Dialog, DialogContent, Typography } from '@mui/material'
import { DS, ctaGradient } from '../theme'

/**
 * Recado da equipe para o Kaique, que começou o painel (2026-09-29). Aparece
 * uma vez por aparelho, no primeiro acesso dele depois da troca de comando do
 * desenvolvimento. Guardado só no navegador de propósito: o Kaique é cargo
 * isolado, e o servidor não aceita dele chave fora das dos cards.
 */
const CHAVE = 'sm_agradecimento_kaique_visto'

function jaViu(): boolean {
  try { return localStorage.getItem(CHAVE) === '1' } catch { return false }
}

export default function AgradecimentoKaique({ currentUser }: { currentUser: string | null }) {
  const [aberto, setAberto] = useState(() => currentUser === 'kaique' && !jaViu())
  if (currentUser !== 'kaique') return null

  const fechar = () => {
    try { localStorage.setItem(CHAVE, '1') } catch { /* sem armazenamento: aparece de novo, sem problema */ }
    setAberto(false)
  }

  return (
    <Dialog open={aberto} onClose={fechar} maxWidth="sm" fullWidth>
      <Box sx={{ height: 3, background: ctaGradient(90) }} />
      <DialogContent sx={{ p: { xs: 3, md: 4, xl: 5 } }}>
        <Typography sx={{ fontSize: { xs: '1.4rem', md: '1.6rem', xl: '1.9rem' }, fontWeight: 800, letterSpacing: '-0.02em', color: DS.t1, mb: 2.5 }}>
          Obrigado, Kaique! 🤝
        </Typography>
        {[
          'Se você está vendo essa mensagem, é porque o painel que você ajudou a tirar do papel continua evoluindo.',
          'Você foi quem deu o primeiro passo nesse projeto e construiu uma base que nos permitiu chegar até aqui. A partir de agora, assumimos a continuidade do desenvolvimento, fazendo alguns ajustes, melhorias e adaptando o painel às novas necessidades da equipe.',
          'Queremos deixar registrado nosso muito obrigado por todo o trabalho, dedicação e tempo investido nesse projeto.',
          'O painel mudou, mas a base que você criou continua fazendo parte dele.',
          'Valeu por ter dado o primeiro passo. 🚀',
          'E claro, qualquer sugestão ou ajuste que você enxergar que possa melhorar o painel, pode nos avisar! Vai ser sempre bem-vindo.',
        ].map((p, i) => (
          <Typography key={i} sx={{ fontSize: { xs: '0.9rem', md: '0.95rem', xl: '1.05rem' }, color: DS.t2, lineHeight: 1.7, mb: 1.6 }}>
            {p}
          </Typography>
        ))}
        <Typography sx={{ fontSize: { xs: '0.9rem', xl: '1rem' }, fontWeight: 700, color: DS.accent, mt: 2.5, mb: 3 }}>
          — Equipe Agência Digital Scale
        </Typography>
        <Button variant="contained" onClick={fechar} fullWidth sx={{ py: 1.2 }}>
          Valeu, bora!
        </Button>
      </DialogContent>
    </Dialog>
  )
}
