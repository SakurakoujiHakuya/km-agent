import { describe, expect, test } from "bun:test"
import {
  mergeWhiteboardText,
  seedWhiteboardPrompt,
  whiteboardAgent,
  whiteboardProjectDirectory,
  whiteboardPrompt,
} from "./whiteboard-prompt"

describe("whiteboard prompt", () => {
  test("provides distinct review, plan, refinement, and implementation intents", () => {
    expect(whiteboardPrompt(true, "review")).toContain("仅做设计评审")
    expect(whiteboardPrompt(true, "review")).toContain("不要修改项目文件")
    expect(whiteboardPrompt(false, "plan")).toContain("actionable implementation plan")
    expect(whiteboardPrompt(false, "plan")).toContain("Do not modify project files")
    expect(whiteboardPrompt(true, "refine")).toContain("km-whiteboard")
    expect(whiteboardPrompt(true, "refine")).toContain('"format":"km-agent-whiteboard"')
    expect(whiteboardPrompt(false, "refine")).toContain("Do not modify project files")
    expect(whiteboardPrompt(true, "implement")).toContain("实现一个可运行的创意 Demo")
    expect(whiteboardAgent("review")).toBe("plan")
    expect(whiteboardAgent("plan")).toBe("plan")
    expect(whiteboardAgent("refine")).toBe("plan")
    expect(whiteboardAgent("implement")).toBe("build")
  })

  test("seeds an empty task with a game implementation request", () => {
    const content = whiteboardPrompt(true)
    expect(seedWhiteboardPrompt([{ type: "text", content: "", start: 0, end: 0 }], content)).toEqual([
      { type: "text", content, start: 0, end: content.length },
    ])
  })

  test("preserves an existing user request and appends the chosen action", () => {
    const current = [{ type: "text" as const, content: "只修改机关反馈", start: 12, end: 19 }]
    const content = whiteboardPrompt(true, "review")
    expect(seedWhiteboardPrompt(current, content)[0]).toEqual({
      type: "text",
      content: `只修改机关反馈\n\n${content}`,
      start: 12,
      end: 12 + 7 + 2 + content.length,
    })
  })

  test("appends exact scene structure without overwriting the user request", () => {
    const current = [{ type: "text" as const, content: "只修改机关反馈", start: 0, end: 7 }]
    const context = "白板结构化上下文：\n- N1 -> N2"
    const content = whiteboardPrompt(true, "plan")
    const next = seedWhiteboardPrompt(current, content, context)
    expect(next[0]).toEqual({
      type: "text",
      content: `只修改机关反馈\n\n${content}\n\n${context}`,
      start: 0,
      end: 7 + 2 + content.length + 2 + context.length,
    })
    expect(seedWhiteboardPrompt(next, content, context)).toBe(next)
  })

  test("combines the implementation request and structure for an empty draft", () => {
    expect(mergeWhiteboardText("", "Build the demo", "Nodes:\n- N1 Goal")).toBe("Build the demo\n\nNodes:\n- N1 Goal")
  })

  test("keeps non-text parts when adding a text prompt", () => {
    const image = {
      type: "image" as const,
      id: "image-1",
      filename: "board.png",
      mime: "image/png",
      dataUrl: "data:image/png;base64,AA==",
    }
    const next = seedWhiteboardPrompt([image], "Review the design")
    expect(next[0]).toEqual({ type: "text", content: "Review the design", start: 0, end: 17 })
    expect(next[1]).toBe(image)
  })

  test("shares the project board across worktrees and sandboxes", () => {
    expect(whiteboardProjectDirectory("/game/.opencode/sandbox-1", "/game")).toBe("/game")
    expect(whiteboardProjectDirectory("/standalone")).toBe("/standalone")
  })
})
