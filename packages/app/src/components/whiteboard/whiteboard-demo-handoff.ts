export type WhiteboardDemoHandoff = {
  sessionID: string
  phase: "idle" | "queued" | "running" | "ready"
}

export function emptyWhiteboardDemoHandoff(): WhiteboardDemoHandoff {
  return { sessionID: "", phase: "idle" }
}

export function queueWhiteboardDemoHandoff(sessionID: string, working: boolean): WhiteboardDemoHandoff {
  const id = sessionID.trim()
  if (!id) return emptyWhiteboardDemoHandoff()
  return { sessionID: id, phase: working ? "running" : "queued" }
}

export function advanceWhiteboardDemoHandoff(
  handoff: WhiteboardDemoHandoff,
  sessionID: string | undefined,
  working: boolean,
) {
  if (!sessionID || handoff.sessionID !== sessionID || handoff.phase === "idle" || handoff.phase === "ready")
    return handoff
  if (handoff.phase === "queued") return working ? { ...handoff, phase: "running" as const } : handoff
  return working ? handoff : { ...handoff, phase: "ready" as const }
}
