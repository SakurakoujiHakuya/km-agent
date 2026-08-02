import { describe, expect, test } from "bun:test"
import {
  clearWhiteboardSessionHandoff,
  consumeWhiteboardSessionHandoff,
  queueWhiteboardSessionHandoff,
} from "./whiteboard-session-handoff"

describe("whiteboard session handoff", () => {
  test("keeps reopening the whiteboard while the promoted task settles", () => {
    queueWhiteboardSessionHandoff("session_1", 1_000)

    expect(consumeWhiteboardSessionHandoff("session_other", 1_001)).toBe(false)
    expect(consumeWhiteboardSessionHandoff("session_1", 1_002)).toBe(true)
    expect(consumeWhiteboardSessionHandoff("session_1", 1_003)).toBe(true)
    clearWhiteboardSessionHandoff("session_1")
    expect(consumeWhiteboardSessionHandoff("session_1", 1_004)).toBe(false)
  })

  test("discards expired and explicitly cleared handoffs", () => {
    queueWhiteboardSessionHandoff("session_expired", 1_000)
    expect(consumeWhiteboardSessionHandoff("session_expired", 61_001)).toBe(false)

    queueWhiteboardSessionHandoff("session_clear", 2_000)
    clearWhiteboardSessionHandoff("session_clear")
    expect(consumeWhiteboardSessionHandoff("session_clear", 2_001)).toBe(false)
  })
})
