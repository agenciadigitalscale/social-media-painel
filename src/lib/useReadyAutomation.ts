import { useSyncExternalStore } from 'react'
import { getReadyStates, subscribeReadyStates, type ReadyAutomationMap } from './readyAutomation'

/** Assina o estado da esteira "Pronto" — o card repinta sozinho a cada fase. */
export function useReadyAutomation(): ReadyAutomationMap {
  return useSyncExternalStore(subscribeReadyStates, getReadyStates, getReadyStates)
}
