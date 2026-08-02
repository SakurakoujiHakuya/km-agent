import { describe, expect, test } from "bun:test"
import {
  activePreviewPlaytestScenario,
  emptyPreviewPlaytestScenarios,
  normalizePreviewPlaytestScenario,
  normalizePreviewPlaytestScenarios,
  parsePreviewPlaytestScenarios,
  PREVIEW_PLAYTEST_SCENARIO_DETAIL_MAX_LENGTH,
  PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT,
  previewPlaytestScenariosStorageKey,
  upsertPreviewPlaytestScenario,
} from "./game-preview-scenarios"

describe("game preview playtest scenarios", () => {
  test("normalizes unique bounded scenarios and repairs the active selection", () => {
    const items = Array.from({ length: PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT + 2 }, (_, index) => ({
      id: `scenario-${index}`,
      name: ` Scenario ${index} `,
      steps: "x".repeat(PREVIEW_PLAYTEST_SCENARIO_DETAIL_MAX_LENGTH + 10),
      expected: " Works ",
    }))
    const scenarios = normalizePreviewPlaytestScenarios({
      version: 99,
      active: "missing",
      items: [...items, items[0], { id: "invalid", name: "" }],
    })
    expect(scenarios.version).toBe(1)
    expect(scenarios.items).toHaveLength(PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT)
    expect(scenarios.active).toBe("scenario-0")
    expect(scenarios.items[0]).toEqual({
      id: "scenario-0",
      name: "Scenario 0",
      steps: "x".repeat(PREVIEW_PLAYTEST_SCENARIO_DETAIL_MAX_LENGTH),
      expected: "Works",
    })
  })

  test("sanitizes snapshots and falls back from invalid stored data", () => {
    expect(
      normalizePreviewPlaytestScenario({ id: "first", name: "First run", steps: "1. Move", expected: "Exit" }),
    ).toEqual({
      id: "first",
      name: "First run",
      steps: "1. Move",
      expected: "Exit",
    })
    expect(normalizePreviewPlaytestScenario({ id: "", name: "Missing id" })).toBeUndefined()
    expect(parsePreviewPlaytestScenarios("not-json")).toEqual(emptyPreviewPlaytestScenarios())
    expect(activePreviewPlaytestScenario(emptyPreviewPlaytestScenarios())).toBeUndefined()
    expect(previewPlaytestScenariosStorageKey("/game")).toBe("km-agent.game-preview-scenarios.v1:/game")
  })

  test("adds and updates a stable scenario without exceeding the project limit", () => {
    const created = upsertPreviewPlaytestScenario(emptyPreviewPlaytestScenarios(), {
      id: "whiteboard-main",
      name: "Main board flow",
      steps: "1. Start",
      expected: "Reach the exit",
    })
    expect(created.active).toBe("whiteboard-main")
    expect(created.items).toHaveLength(1)

    const updated = upsertPreviewPlaytestScenario(created, {
      id: "whiteboard-main",
      name: "Main board retry flow",
      steps: "1. Start\n2. Retry",
      expected: "Return to the switch",
    })
    expect(updated.items).toHaveLength(1)
    expect(updated.items[0]?.name).toBe("Main board retry flow")

    const full = normalizePreviewPlaytestScenarios({
      items: Array.from({ length: PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT }, (_, index) => ({
        id: `scenario-${index}`,
        name: `Scenario ${index}`,
      })),
      active: "scenario-0",
    })
    expect(
      upsertPreviewPlaytestScenario(full, {
        id: "overflow",
        name: "Overflow",
        steps: "",
        expected: "",
      }),
    ).toBe(full)
  })
})
