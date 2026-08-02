import { describe, expect, test } from "bun:test"
import {
  advanceWhiteboardDemoHandoff,
  emptyWhiteboardDemoHandoff,
  queueWhiteboardDemoHandoff,
} from "./whiteboard-demo-handoff"

describe("whiteboard demo preview handoff", () => {
  test("tracks a queued Build turn until it has run and returned idle", () => {
    const queued = queueWhiteboardDemoHandoff("session-1", false)
    const waiting = advanceWhiteboardDemoHandoff(queued, "session-1", false)
    const running = advanceWhiteboardDemoHandoff(waiting, "session-1", true)
    const ready = advanceWhiteboardDemoHandoff(running, "session-1", false)

    expect(waiting).toBe(queued)
    expect(running).toEqual({ sessionID: "session-1", phase: "running" })
    expect(ready).toEqual({ sessionID: "session-1", phase: "ready" })
    expect(advanceWhiteboardDemoHandoff(ready, "session-1", true)).toBe(ready)
  })

  test("starts in running when optimistic busy is already visible", () => {
    expect(queueWhiteboardDemoHandoff("session-1", true)).toEqual({
      sessionID: "session-1",
      phase: "running",
    })
  })

  test("does not complete from another session or from an invalid request", () => {
    const running = queueWhiteboardDemoHandoff("session-1", true)
    expect(advanceWhiteboardDemoHandoff(running, "session-2", false)).toBe(running)
    expect(queueWhiteboardDemoHandoff(" ", false)).toEqual(emptyWhiteboardDemoHandoff())
  })
})
