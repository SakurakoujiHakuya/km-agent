import { describe, expect, test } from "bun:test"
import {
  applyPreviewBuildRecommendation,
  defaultPreviewBuildTargets,
  normalizePreviewBuildOutput,
  normalizePreviewBuildTarget,
  normalizePreviewBuildTargets,
  parsePreviewBuildTargets,
  PREVIEW_BUILD_TARGETS_MAX_COUNT,
  previewBuildOutputPath,
  previewBuildRecommendationApplied,
  previewBuildResultFromExitCode,
  previewBuildTargetsStorageKey,
} from "./game-preview-build"

describe("game preview build targets", () => {
  test("normalizes unique bounded targets and repairs the active selection", () => {
    const items = Array.from({ length: PREVIEW_BUILD_TARGETS_MAX_COUNT + 2 }, (_, index) => ({
      id: index === 1 ? "target-0" : `target-${index}`,
      name: ` Target ${index} `,
      command: " bun run build ",
      output: " ./dist/web/ ",
    }))
    expect(normalizePreviewBuildTargets({ version: 99, active: "missing", items })).toEqual({
      version: 1,
      active: "target-0",
      items: [
        { id: "target-0", name: "Target 0", command: "bun run build", output: "dist/web" },
        { id: "target-2", name: "Target 2", command: "bun run build", output: "dist/web" },
        { id: "target-3", name: "Target 3", command: "bun run build", output: "dist/web" },
        { id: "target-4", name: "Target 4", command: "bun run build", output: "dist/web" },
      ],
    })
  })

  test("rejects unsafe output paths and multiline commands", () => {
    expect(normalizePreviewBuildOutput("../outside")).toBeUndefined()
    expect(normalizePreviewBuildOutput("/tmp/build")).toBeUndefined()
    expect(normalizePreviewBuildOutput("C:\\build")).toBeUndefined()
    expect(normalizePreviewBuildOutput("dist/web:preview")).toBeUndefined()
    expect(
      normalizePreviewBuildTarget({ id: "web", name: "Web", command: "bun build\nrm -rf dist", output: "dist" }),
    ).toBeUndefined()
    expect(normalizePreviewBuildOutput("./dist\\web/")).toBe("dist/web")
  })

  test("falls back safely and resolves project-contained output paths", () => {
    expect(parsePreviewBuildTargets("not-json")).toEqual(defaultPreviewBuildTargets())
    expect(previewBuildTargetsStorageKey("/game")).toBe("km-agent.game-preview-build.v1:/game")
    expect(previewBuildOutputPath("/game/", "dist/web")).toBe("/game/dist/web")
    expect(previewBuildOutputPath("C:\\game\\", "dist/web")).toBe("C:\\game\\dist\\web")
    expect(previewBuildOutputPath("/game", "../outside")).toBeUndefined()
    expect([
      previewBuildResultFromExitCode(0),
      previewBuildResultFromExitCode(1),
      previewBuildResultFromExitCode(undefined),
    ]).toEqual(["success", "failed", "unknown"])
  })

  test("adopts a detected build without overwriting custom targets", () => {
    const recommendation = { id: "detected-phaser-web", name: "Phaser build", command: "bun run build", output: "dist" }
    const adopted = applyPreviewBuildRecommendation(defaultPreviewBuildTargets(), recommendation)
    expect(adopted.items).toEqual([recommendation])
    expect(adopted.active).toBe(recommendation.id)
    expect(previewBuildRecommendationApplied(adopted, recommendation)).toBe(true)

    const custom = normalizePreviewBuildTargets({
      active: "custom",
      items: [{ id: "custom", name: "Custom", command: "npm run export", output: "release" }],
    })
    expect(applyPreviewBuildRecommendation(custom, recommendation).items).toEqual([custom.items[0], recommendation])
  })
})
