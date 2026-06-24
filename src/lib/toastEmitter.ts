type Listener = (msg: string) => void
const _listeners: Listener[] = []

export const toastEmitter = {
  emit(msg: string) {
    _listeners.forEach((l) => l(msg))
  },
  on(listener: Listener): () => void {
    _listeners.push(listener)
    return () => {
      const i = _listeners.indexOf(listener)
      if (i > -1) _listeners.splice(i, 1)
    }
  },
}
