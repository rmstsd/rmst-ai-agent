'use client'

import { PropsWithChildren } from 'react'
import { useIsSSR } from './ssr'

export default function ClientWrapper(props: PropsWithChildren) {
  return props.children
}

export const ClientOnly = (props: PropsWithChildren) => {
  const isSSR = useIsSSR()

  if (isSSR) {
    return null
  }

  return props.children
}
