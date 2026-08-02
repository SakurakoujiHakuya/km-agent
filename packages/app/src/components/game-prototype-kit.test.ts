import { describe, expect, test } from "bun:test"
import { emptyPreviewAcceptancePlan } from "./game-preview-plan"
import { emptyPreviewPlaytestScenarios } from "./game-preview-scenarios"
import {
  gamePrototypeKit,
  gamePrototypeKitPrompt,
  gamePrototypeKits,
  mergeGamePrototypeKitAcceptancePlan,
  upsertGamePrototypeKitScenario,
} from "./game-prototype-kit"

describe("game prototype workbench kits", () => {
  test("provides four localized kits with a board, acceptance plan, and repeatable scenario", () => {
    const chinese = gamePrototypeKits(true)
    const english = gamePrototypeKits(false)
    expect(chinese.map((kit) => kit.id)).toEqual(["level", "puzzle", "core-loop", "narrative"])
    expect(chinese.map((kit) => kit.template)).toEqual(["level-flow", "puzzle-logic", "core-loop", "narrative-branch"])
    expect(chinese.every((kit) => Object.keys(kit.acceptance.criteria).length === 6)).toBeTrue()
    expect(chinese.every((kit) => kit.scenario.steps.split("\n").length >= 4)).toBeTrue()
    expect(english.map((kit) => kit.scenario.id)).toEqual(chinese.map((kit) => kit.scenario.id))
  })

  test("adds a bounded creative brief without weakening the implementation request", () => {
    const kit = gamePrototypeKit("puzzle", true)!
    expect(gamePrototypeKitPrompt(kit, "  废弃观测站中的光路谜题  ", true)).toBe(
      `${kit.prompt}\n\n创意补充:\n废弃观测站中的光路谜题`,
    )
    expect(gamePrototypeKitPrompt(kit, "", true)).toBe(kit.prompt)
  })

  test("fills missing acceptance criteria, preserves project edits, and upserts a stable scenario", () => {
    const kit = gamePrototypeKit("level", false)!
    const plan = mergeGamePrototypeKitAcceptancePlan({ version: 1, criteria: { goal: "Keep my custom goal" } }, kit)
    expect(plan.criteria.goal).toBe("Keep my custom goal")
    expect(Object.keys(plan.criteria)).toHaveLength(6)
    expect(mergeGamePrototypeKitAcceptancePlan(emptyPreviewAcceptancePlan(), kit)).toEqual(kit.acceptance)

    const created = upsertGamePrototypeKitScenario(emptyPreviewPlaytestScenarios(), kit)
    const updated = upsertGamePrototypeKitScenario(created, { ...kit, scenario: { ...kit.scenario, name: "Updated" } })
    expect(created.items).toHaveLength(1)
    expect(updated.items).toHaveLength(1)
    expect(updated.items[0]?.name).toBe("Updated")
  })
})
