import { describe, expect, test } from "bun:test"
import {
  emptyPreviewAcceptancePlan,
  normalizePreviewAcceptancePlan,
  parsePreviewAcceptancePlan,
  PREVIEW_ACCEPTANCE_PLAN_ITEM_MAX_LENGTH,
  previewAcceptancePlanStorageKey,
} from "./game-preview-plan"

describe("game preview acceptance plan", () => {
  test("normalizes project criteria and discards unsupported fields", () => {
    expect(
      normalizePreviewAcceptancePlan({
        version: 99,
        criteria: {
          launch: "  three seconds to controls  ",
          goal: "Reach\n the exit",
          response: "x".repeat(PREVIEW_ACCEPTANCE_PLAN_ITEM_MAX_LENGTH + 10),
          unknown: "ignored",
          retry: 42,
        },
      }),
    ).toEqual({
      version: 1,
      criteria: {
        launch: "three seconds to controls",
        goal: "Reach the exit",
        response: "x".repeat(PREVIEW_ACCEPTANCE_PLAN_ITEM_MAX_LENGTH),
      },
    })
  })

  test("falls back safely and uses a project-scoped versioned key", () => {
    expect(parsePreviewAcceptancePlan("not-json")).toEqual(emptyPreviewAcceptancePlan())
    expect(parsePreviewAcceptancePlan(null)).toEqual(emptyPreviewAcceptancePlan())
    expect(previewAcceptancePlanStorageKey("/game")).toBe("km-agent.game-preview-plan.v1:/game")
  })
})
