import { useEffect, useMemo, useState } from 'react'
import { carregarAtribuicoes, carregarPaineis, EVENTO_ATRIBUICOES } from './paineis'
import { EVENTO_EQUIPE } from './equipeProducao'

/**
 * Gavetas e atribuições (de quem é cada card), relidas quando mudam — aqui, em
 * outra tela ou pelo sync. Ler uma vez ao montar deixava a conta de entregas
 * zerada no navegador que abriu a tela antes de os dados chegarem (2026-10-29).
 */
export function useGavetas() {
  const [versao, setVersao] = useState(0)
  useEffect(() => {
    const reler = () => setVersao(v => v + 1)
    window.addEventListener(EVENTO_ATRIBUICOES, reler)
    window.addEventListener(EVENTO_EQUIPE, reler)
    return () => {
      window.removeEventListener(EVENTO_ATRIBUICOES, reler)
      window.removeEventListener(EVENTO_EQUIPE, reler)
    }
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ paineis: carregarPaineis(), atrib: carregarAtribuicoes() }), [versao])
}
