import { describe, expect, test } from "bun:test"
import {
  detectPreviewURLs,
  normalizePreviewURL,
  mergePreviewFeedbackPrompt,
  mergePreviewFeedbackText,
  previewAnnotationContext,
  previewAcceptancePlanContext,
  previewCaptureRegion,
  previewFeedbackAppendPrompt,
  previewFeedbackPrompt,
  previewPlaytestScenarioContext,
  previewStartProcess,
  seedPreviewFeedbackPrompt,
  shouldAppendPreviewFeedback,
} from "./game-preview"

describe("game preview URL", () => {
  test("defaults local addresses to HTTP", () => {
    expect(normalizePreviewURL("localhost:5173")).toBe("http://localhost:5173/")
  })

  test("keeps HTTP paths and rejects unsafe protocols", () => {
    expect(normalizePreviewURL("https://example.com/demo?level=2")).toBe("https://example.com/demo?level=2")
    expect(normalizePreviewURL("javascript:alert(1)")).toBeUndefined()
    expect(normalizePreviewURL("file:///tmp/demo.html")).toBeUndefined()
  })
})

describe("game preview discovery", () => {
  test("returns only reachable normalized URLs", async () => {
    const found = await detectPreviewURLs(["localhost:3000", "http://localhost:5173", "javascript:alert(1)"], (url) =>
      url.includes("5173") ? Promise.resolve({}) : Promise.reject(new Error("offline")),
    )
    expect(found).toEqual(["http://localhost:5173/"])
  })

  test("builds explicit shell processes for project start commands", () => {
    expect(previewStartProcess("bun dev", "unix")).toEqual({ command: "/bin/sh", args: ["-lc", "bun dev"] })
    expect(previewStartProcess("bun dev", "windows")).toEqual({
      command: "powershell.exe",
      args: ["-NoExit", "-Command", "bun dev"],
    })
  })

  test("converts the rendered frame bounds into a capture region", () => {
    expect(previewCaptureRegion({ left: 12.4, top: 56.2, right: 812.8, bottom: 656.7 })).toEqual({
      x: 12,
      y: 56,
      width: 801,
      height: 601,
    })
    expect(previewCaptureRegion({ left: 20, top: 20, right: 20, bottom: 40 })).toBeUndefined()
  })

  test("seeds a game-focused feedback request without replacing user text", () => {
    const content = previewFeedbackPrompt(true)
    expect(seedPreviewFeedbackPrompt([{ type: "text", content: "", start: 0, end: 0 }], content)).toEqual([
      { type: "text", content, start: 0, end: content.length },
    ])
    const written = [{ type: "text" as const, content: "Keep this request", start: 0, end: 17 }]
    expect(seedPreviewFeedbackPrompt(written, content)).toBe(written)
    expect(previewFeedbackPrompt(false, "compare")).toContain("chronological order")
    expect(previewFeedbackPrompt(true, "compare", "1. 目标引导 — 出口不明显")).toContain(
      "策划标注:\n1. 目标引导 — 出口不明显",
    )
    expect(mergePreviewFeedbackText("保留我的要求", "策划标注", true)).toBe("保留我的要求\n\n策划标注")
    expect(mergePreviewFeedbackText("保留我的要求", "策划标注", false)).toBe("保留我的要求")
    expect(shouldAppendPreviewFeedback("review")).toBe(false)
    expect(shouldAppendPreviewFeedback("review", "验收: 可启动=通过")).toBe(true)
    expect(shouldAppendPreviewFeedback("compare")).toBe(true)
    expect(previewFeedbackAppendPrompt(content, true, "review", "验收: 可启动=通过")).toBe(
      "策划标注:\n验收: 可启动=通过",
    )
    expect(previewFeedbackAppendPrompt("保留我的要求", true, "review", "验收: 可启动=通过")).toBe(
      `${content}\n\n策划标注:\n验收: 可启动=通过`,
    )
    expect(mergePreviewFeedbackPrompt(written, "Compare frames", true)[0]).toMatchObject({
      type: "text",
      content: "Keep this request\n\nCompare frames",
    })
  })

  test("formats chronological designer annotations for comparison", () => {
    const context = previewAnnotationContext(
      [
        { createdAt: 2, tags: ["bug"], checks: { launch: "pass" }, note: "门没有打开" },
        { createdAt: 1, tags: ["guidance", "puzzle"], checks: { goal: "fail" }, note: "出口不明显" },
      ],
      {
        chinese: true,
        labels: new Map([
          ["guidance", "目标引导"],
          ["puzzle", "机关逻辑"],
          ["bug", "缺陷"],
        ]),
        criteriaLabels: new Map([
          ["launch", "可启动"],
          ["goal", "目标清晰"],
        ]),
        stateLabels: new Map([
          ["pass", "通过"],
          ["fail", "需修复"],
        ]),
        formatTime: (value) => `T${value}`,
      },
    )
    expect(context).toBe(
      "1. T1 — 目标引导、机关逻辑；验收: 目标清晰=需修复；出口不明显\n2. T2 — 缺陷；验收: 可启动=通过；门没有打开",
    )
  })

  test("formats project acceptance criteria for every AI review", () => {
    expect(
      previewAcceptancePlanContext(
        { version: 1, criteria: { launch: "3 秒内可操作", goal: "玩家无需文字说明也能找到出口" } },
        {
          chinese: true,
          criteriaLabels: new Map([
            ["launch", "可启动"],
            ["goal", "目标清晰"],
          ]),
        },
      ),
    ).toBe("项目验收计划:\n- 可启动: 3 秒内可操作\n- 目标清晰: 玩家无需文字说明也能找到出口")
  })

  test("formats a durable playtest scenario snapshot", () => {
    const scenario = {
      id: "wrong-answer",
      name: "错误解法反馈",
      steps: "1. 拉下错误拉杆\n2. 观察机关",
      expected: "门保持关闭，并突出显示正确线索",
    }
    expect(previewPlaytestScenarioContext(scenario, true)).toBe(
      "试玩场景: 错误解法反馈\n测试步骤:\n1. 拉下错误拉杆\n2. 观察机关\n预期结果:\n门保持关闭，并突出显示正确线索",
    )
    expect(
      previewAnnotationContext([{ createdAt: 1, tags: [], note: "", scenario }], {
        chinese: true,
        labels: new Map(),
        formatTime: () => "T1",
      }),
    ).toBe("1. T1 — 场景: 错误解法反馈")
  })
})
