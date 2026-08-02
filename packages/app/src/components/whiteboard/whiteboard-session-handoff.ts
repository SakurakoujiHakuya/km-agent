type WhiteboardSessionHandoff = {
  sessionID: string
  createdAt: number
}

const ttl = 60_000
let pending: WhiteboardSessionHandoff | undefined

export function queueWhiteboardSessionHandoff(sessionID: string, now = Date.now()) {
  pending = { sessionID, createdAt: now }
}

export function consumeWhiteboardSessionHandoff(sessionID: string, now = Date.now()) {
  const handoff = pending
  if (!handoff) return false
  if (now - handoff.createdAt > ttl) {
    pending = undefined
    return false
  }
  if (handoff.sessionID !== sessionID) return false
  return true
}

export function clearWhiteboardSessionHandoff(sessionID: string) {
  if (pending?.sessionID !== sessionID) return
  pending = undefined
}
