import { createContext, PropsWithChildren, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react'

function getSnapshot() {
  return false
}

function getServerSnapshot() {
  return true
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function subscribe(onStoreChange: () => void): () => void {
  // noop
  return () => {}
}

export function useIsSSR(): boolean {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return snapshot

  return useContext(IsSSRContext)
}

const IsSSRContext = createContext(true)

export const IsSSRProvider = (props: PropsWithChildren) => {
  const [isServer, setIsServer] = useState(true)

  useLayoutEffect(() => {
    setIsServer(false)
  }, [])

  return <IsSSRContext.Provider value={isServer}>{props.children}</IsSSRContext.Provider>
}
