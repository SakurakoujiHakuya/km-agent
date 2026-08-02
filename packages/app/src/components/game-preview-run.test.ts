import { describe, expect, test } from "bun:test"
import {
  emptyPreviewPlaytestRun,
  normalizePreviewPlaytestRun,
  PREVIEW_PLAYTEST_RUN_MAX_STEPS,
  previewPlaytestRunComplete,
  previewPlaytestRunContext,
  previewPlaytestScenarioSteps,
} from "./game-preview-run"

const scenario = {
  id: "retry-flow",
  name: "错误解法重试",
  steps: "1. 进入机关房\n2. 拉下错误拉杆\n3. 重置并再次尝试",
  expected: "门保持关闭，线索仍然可见",
}

describe("guided playtest runs", () => {
  test("parses numbered, bulleted, and inline scenario steps within a fixed limit", () => {
    expect(previewPlaytestScenarioSteps(scenario)).toEqual(["进入机关房", "拉下错误拉杆", "重置并再次尝试"])
    expect(previewPlaytestScenarioSteps({ steps: "1. Start 2. Retry 3. Exit" })).toEqual(["Start", "Retry", "Exit"])
    expect(
      previewPlaytestScenarioSteps({
        steps: Array.from({ length: PREVIEW_PLAYTEST_RUN_MAX_STEPS + 2 }, (_, index) => `- Step ${index}`).join("\n"),
      }),
    ).toHaveLength(PREVIEW_PLAYTEST_RUN_MAX_STEPS)
  })

  test("normalizes bounded results and requires every step plus the expected outcome", () => {
    expect(previewPlaytestRunComplete(emptyPreviewPlaytestRun(), scenario)).toBeFalse()
    const run = normalizePreviewPlaytestRun(
      { checks: ["pass", "fail", "pass", "pass"], expected: "fail", note: "  门没有反馈  " },
      scenario,
    )
    expect(run).toEqual({ checks: ["pass", "fail", "pass"], expected: "fail", note: "门没有反馈" })
    expect(previewPlaytestRunComplete(run!, scenario)).toBeTrue()
    expect(
      previewPlaytestRunComplete(
        { checks: ["pass"], expected: "", note: "" },
        { ...scenario, steps: "Play", expected: "" },
      ),
    ).toBeTrue()
    expect(normalizePreviewPlaytestRun({}, scenario)).toBeUndefined()
  })

  test("formats exact step outcomes and designer evidence for AI", () => {
    expect(
      previewPlaytestRunContext(
        scenario,
        { checks: ["pass", "fail", "pass"], expected: "fail", note: "错误后没有突出正确线索" },
        true,
        "第 2 轮",
      ),
    ).toBe(
      "场景执行结果 (第 2 轮): 错误解法重试\n- 1. [通过] 进入机关房\n- 2. [需修复] 拉下错误拉杆\n- 3. [通过] 重置并再次尝试\n- 预期结果 [未符合]: 门保持关闭，线索仍然可见\n- 策划备注: 错误后没有突出正确线索",
    )
  })
})
