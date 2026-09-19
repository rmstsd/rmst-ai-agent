const controllers = new Map<string, AbortController>()

export function startExecution(threadId: string, requestSignal: AbortSignal) {
  controllers.get(threadId)?.abort()

  const controller = new AbortController()
  const abortFromRequest = () => controller.abort(requestSignal.reason)

  if (requestSignal.aborted) {
    abortFromRequest()
  } else {
    requestSignal.addEventListener('abort', abortFromRequest, { once: true })
  }

  controllers.set(threadId, controller)

  return {
    signal: controller.signal,
    release() {
      requestSignal.removeEventListener('abort', abortFromRequest)
      if (controllers.get(threadId) === controller) {
        controllers.delete(threadId)
      }
    }
  }
}

export function cancelExecution(threadId: string) {
  const controller = controllers.get(threadId)
  if (!controller) return false

  controller.abort(new Error('用户取消了本次响应'))
  controllers.delete(threadId)
  return true
}
