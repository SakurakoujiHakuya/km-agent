import { describe, expect, test } from "bun:test"
import { maxWhiteboardFileBytes, whiteboardDownloadName, whiteboardFileIssue } from "./whiteboard-file"

describe("portable whiteboard files", () => {
  test("accepts standard Excalidraw and JSON scene files", () => {
    expect(whiteboardFileIssue({ name: "level.excalidraw", size: 100, type: "" })).toBeUndefined()
    expect(whiteboardFileIssue({ name: "level.json", size: 100, type: "application/json" })).toBeUndefined()
  })

  test("rejects unrelated and oversized files before parsing", () => {
    expect(whiteboardFileIssue({ name: "level.png", size: 100, type: "image/png" })).toBe("unsupported")
    expect(whiteboardFileIssue({ name: "huge.excalidraw", size: maxWhiteboardFileBytes + 1, type: "" })).toBe(
      "too-large",
    )
  })

  test("uses a portable timestamped filename", () => {
    expect(whiteboardDownloadName(new Date("2026-08-02T12:34:56.000Z"))).toBe(
      "km-agent-board-2026-08-02T12-34-56.excalidraw",
    )
  })
})
