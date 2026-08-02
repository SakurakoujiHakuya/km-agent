import { describe, expect, test } from "bun:test"
import { promptPermissionModeCopy, promptWorkflowLabel } from "./prompt-input-workflow"

describe("prompt workflow controls", () => {
  test("localizes built-in workflows while preserving custom agent names", () => {
    expect(promptWorkflowLabel("build", true)).toBe("实现")
    expect(promptWorkflowLabel("plan", false)).toBe("Plan")
    expect(promptWorkflowLabel("level-designer", true)).toBe("level-designer")
  })

  test("explains both permission modes without hiding their effect", () => {
    expect(promptPermissionModeCopy(false, true)).toEqual({
      label: "逐项确认",
      tooltip: "需要权限时先请求确认。点击改为自动批准。",
    })
    expect(promptPermissionModeCopy(true, false)).toEqual({
      label: "Auto approve",
      tooltip: "Permission requests are approved automatically. Click to ask first.",
    })
  })
})
