import { useEffect, useState } from 'react'
import { EVENTO_EQUIPE, equipeAtual, type EquipeStore } from './equipeProducao'

/** O cadastro de Encarregados/Painéis, relido quando muda aqui ou chega do sync. */
export function useEquipe(): EquipeStore {
  const [eq, setEq] = useState<EquipeStore>(() => equipeAtual())
  useEffect(() => {
    const reler = () => setEq(equipeAtual())
    window.addEventListener(EVENTO_EQUIPE, reler)
    return () => window.removeEventListener(EVENTO_EQUIPE, reler)
  }, [])
  return eq
}
