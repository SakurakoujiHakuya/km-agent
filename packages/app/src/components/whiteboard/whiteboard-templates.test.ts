import { describe, expect, test } from "bun:test"
import { whiteboardTemplate, whiteboardTemplateNeedsConfirmation, whiteboardTemplates } from "./whiteboard-templates"

describe("game design whiteboard templates", () => {
  test("provides editable level, puzzle, core-loop, and narrative scenes", () => {
    const templates = whiteboardTemplates(true)
    expect(templates.map((template) => template.id)).toEqual([
      "level-flow",
      "puzzle-logic",
      "core-loop",
      "narrative-branch",
    ])

    for (const template of templates) {
      const ids = template.elements.map((element) => element.id)
      expect(ids.length).toBeGreaterThan(10)
      expect(new Set(ids).size).toBe(ids.length)
      expect(template.elements.some((element) => element.type === "arrow")).toBe(true)
      expect(template.elements.some((element) => element.type === "text")).toBe(true)
      expect(
        template.elements
          .filter((element) => element.type === "arrow")
          .every((element) => "start" in element && "end" in element && !!element.start?.id && !!element.end?.id),
      ).toBe(true)
    }
  })

  test("localizes labels without changing stable scene identifiers", () => {
    const chinese = whiteboardTemplate("puzzle-logic", true)
    const english = whiteboardTemplate("puzzle-logic", false)
    expect(chinese?.title).toBe("机关谜题")
    expect(english?.title).toBe("Puzzle logic")
    expect(chinese?.elements.map((element) => element.id)).toEqual(english?.elements.map((element) => element.id))
  })

  test("requires a deliberate second click before replacing a non-empty board", () => {
    expect(whiteboardTemplateNeedsConfirmation(false, undefined, "level-flow")).toBe(false)
    expect(whiteboardTemplateNeedsConfirmation(true, undefined, "level-flow")).toBe(true)
    expect(whiteboardTemplateNeedsConfirmation(true, "level-flow", "level-flow")).toBe(false)
    expect(whiteboardTemplateNeedsConfirmation(true, "puzzle-logic", "level-flow")).toBe(true)
  })
})
