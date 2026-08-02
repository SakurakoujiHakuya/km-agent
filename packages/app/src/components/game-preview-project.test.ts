import { describe, expect, test } from "bun:test"
import {
  detectPreviewProject,
  mergePreviewProjectPrompt,
  mergePreviewProjectText,
  previewProjectContext,
  previewPrototypePrompt,
} from "./game-preview-project"

describe("game preview project detection", () => {
  test("detects a Bun Phaser project and its runnable scripts", () => {
    expect(
      detectPreviewProject({
        files: ["package.json", "bun.lock", "src"],
        packageJSON: JSON.stringify({
          scripts: { dev: "vite", build: "vite build" },
          dependencies: { phaser: "^3.90.0" },
          devDependencies: { vite: "^7.0.0" },
        }),
      }),
    ).toEqual({
      kind: "phaser",
      packageManager: "bun",
      startCommand: "bun run dev",
      build: {
        id: "detected-phaser-web",
        name: "Phaser build",
        command: "bun run build",
        output: "dist",
      },
      hints: [],
    })
  })

  test("detects Godot Web only when an export preset exists", () => {
    expect(detectPreviewProject({ files: ["project.godot"] })).toEqual({
      kind: "godot",
      build: undefined,
      hints: ["godot.exportPresetMissing"],
    })
    expect(detectPreviewProject({ files: ["project.godot", "export_presets.cfg"] }).build).toEqual({
      id: "detected-godot-web",
      name: "Godot Web",
      command: 'godot --headless --export-release "Web" dist/index.html',
      output: "dist",
    })
  })

  test("detects Unity and Bevy without pretending Unity has a portable CLI build", () => {
    expect(detectPreviewProject({ files: ["Assets", "ProjectSettings", "Packages"] })).toEqual({
      kind: "unity",
      hints: ["unity.manualBuild"],
    })
    expect(detectPreviewProject({ files: ["Cargo.toml"], cargoToml: '[dependencies]\nbevy = "0.16"' })).toEqual({
      kind: "bevy",
      startCommand: "cargo run",
      build: {
        id: "detected-bevy",
        name: "Bevy release",
        command: "cargo build --release",
        output: "target/release",
      },
      hints: [],
    })
  })

  test("distinguishes Next.js output and plain static demos", () => {
    expect(
      detectPreviewProject({
        files: ["package.json", "pnpm-lock.yaml"],
        packageJSON: JSON.stringify({
          scripts: { dev: "next dev", build: "next build" },
          dependencies: { next: "16" },
        }),
      }),
    ).toEqual({
      kind: "next",
      packageManager: "pnpm",
      startCommand: "pnpm run dev",
      build: {
        id: "detected-next-web",
        name: "Next.js build",
        command: "pnpm run build",
        output: ".next",
      },
      hints: ["next.serverOutput"],
    })
    expect(detectPreviewProject({ files: ["index.html", "game.js"] })).toEqual({
      kind: "static",
      startCommand: "python3 -m http.server 8000",
      hints: [],
    })
  })

  test("falls back safely for malformed or unknown projects", () => {
    expect(detectPreviewProject({ files: ["package.json"], packageJSON: "{" })).toEqual({ kind: "unknown", hints: [] })
    expect(detectPreviewProject({ files: ["README.md"] })).toEqual({ kind: "unknown", hints: [] })
  })

  test("generates durable stack-aware AI constraints without replacing designer text", () => {
    const profile = detectPreviewProject({ files: ["project.godot", "export_presets.cfg"] })
    expect(previewProjectContext(profile, true)).toContain(
      '当前项目技术约束:\n- 项目类型: Godot\n- 构建命令: godot --headless --export-release "Web" dist/index.html',
    )
    expect(previewProjectContext(profile, true)).toContain("使用现有 Godot 场景、节点、资源与 GDScript")
    expect(previewPrototypePrompt(profile, false)).toContain("one core mechanic and one small level")
    const generated = previewPrototypePrompt(profile, true)
    expect(mergePreviewProjectText("保留策划要求", generated)).toBe(`保留策划要求\n\n${generated}`)
    expect(mergePreviewProjectText(generated, generated)).toBe(generated)
    const parts = [
      { type: "image" as const, id: "shot", filename: "shot.png", mime: "image/png", dataUrl: "data:image/png" },
      { type: "text" as const, content: "保留策划要求", start: 0, end: 6 },
    ]
    const merged = mergePreviewProjectPrompt(parts, generated)
    expect(merged[0]).toBe(parts[0])
    const text = merged[1]
    expect(text?.type).toBe("text")
    if (text?.type !== "text") throw new Error("Expected merged text part")
    expect(text.content).toBe(`保留策划要求\n\n${generated}`)
  })
})
