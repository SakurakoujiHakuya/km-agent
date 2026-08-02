import { describe, expect, test } from "bun:test"
import {
  normalizePreviewFrame,
  PREVIEW_FRAME_NOTE_MAX_LENGTH,
  retainedPreviewFrames,
  type GamePreviewFrame,
} from "./game-preview-history"

function frame(id: string, createdAt: number, bytes: number): GamePreviewFrame {
  return {
    id,
    directory: "/game",
    url: "http://localhost:5173/",
    createdAt,
    image: new Blob([new Uint8Array(bytes)]),
    note: "",
    tags: [],
    checks: {},
  }
}

describe("playtest frame retention", () => {
  test("keeps the newest frames within the count limit", () => {
    const frames = [frame("old", 1, 2), frame("new", 3, 2), frame("middle", 2, 2)]
    expect(retainedPreviewFrames(frames, { count: 2, bytes: 100 }).map((item) => item.id)).toEqual(["new", "middle"])
  })

  test("skips oversized frames while retaining newer frames that fit", () => {
    const frames = [frame("new", 3, 4), frame("too-large", 2, 10), frame("old", 1, 4)]
    expect(retainedPreviewFrames(frames, { count: 3, bytes: 8 }).map((item) => item.id)).toEqual(["new", "old"])
  })

  test("migrates legacy frames and sanitizes annotation metadata", () => {
    const current = frame("frame", 1, 2)
    const legacy = normalizePreviewFrame({
      id: current.id,
      directory: current.directory,
      url: current.url,
      createdAt: current.createdAt,
      image: current.image,
    })
    expect(legacy.note).toBe("")
    expect(legacy.tags).toEqual([])
    expect(legacy.checks).toEqual({})
    expect(legacy.scenario).toBeUndefined()
    expect(legacy.run).toBeUndefined()
    const annotated = normalizePreviewFrame({
      ...current,
      note: "x".repeat(PREVIEW_FRAME_NOTE_MAX_LENGTH + 10),
      tags: ["guidance", "guidance", "bug", "unknown"],
      checks: { launch: "pass", controls: "fail", goal: "unknown", unknown: "pass" },
      scenario: { id: "first-run", name: " First run ", steps: " Move ", expected: " Exit " },
      run: { checks: ["pass", "fail"], expected: "fail", note: "  blocked  " },
    })
    expect(annotated.note).toHaveLength(PREVIEW_FRAME_NOTE_MAX_LENGTH)
    expect(annotated.tags).toEqual(["guidance", "bug"])
    expect(annotated.checks).toEqual({ launch: "pass", controls: "fail" })
    expect(annotated.scenario).toEqual({ id: "first-run", name: "First run", steps: "Move", expected: "Exit" })
    expect(annotated.run).toEqual({ checks: ["pass"], expected: "fail", note: "blocked" })
  })
})
