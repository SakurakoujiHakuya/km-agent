import type { ContentPart } from "@/context/prompt"
import type { PreviewBuildTarget } from "./game-preview-build"

export const PREVIEW_PROJECT_FILE_MAX_LENGTH = 128 * 1024

export type PreviewProjectKind =
  | "godot"
  | "unity"
  | "bevy"
  | "phaser"
  | "pixi"
  | "three"
  | "next"
  | "vite"
  | "web"
  | "static"
  | "unknown"

export type PreviewProjectHint = "godot.exportPresetMissing" | "unity.manualBuild" | "next.serverOutput"

export type PreviewProjectProfile = {
  kind: PreviewProjectKind
  packageManager?: "bun" | "pnpm" | "yarn" | "npm"
  startCommand?: string
  build?: PreviewBuildTarget
  hints: PreviewProjectHint[]
}

export type PreviewProjectSnapshot = {
  files: string[]
  packageJSON?: string
  cargoToml?: string
}

export function detectPreviewProject(input: PreviewProjectSnapshot): PreviewProjectProfile {
  const files = new Set(input.files.map((file) => file.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "")))
  if (files.has("project.godot")) {
    const exportReady = files.has("export_presets.cfg")
    return {
      kind: "godot",
      build: exportReady
        ? {
            id: "detected-godot-web",
            name: "Godot Web",
            command: 'godot --headless --export-release "Web" dist/index.html',
            output: "dist",
          }
        : undefined,
      hints: exportReady ? [] : ["godot.exportPresetMissing"],
    }
  }
  if (files.has("Assets") && files.has("ProjectSettings")) {
    return { kind: "unity", hints: ["unity.manualBuild"] }
  }
  if (
    files.has("Cargo.toml") &&
    /(^|\n)\s*bevy\s*=/.test(input.cargoToml?.slice(0, PREVIEW_PROJECT_FILE_MAX_LENGTH) ?? "")
  ) {
    return {
      kind: "bevy",
      startCommand: "cargo run",
      build: { id: "detected-bevy", name: "Bevy release", command: "cargo build --release", output: "target/release" },
      hints: [],
    }
  }

  const packageInfo = parsePackageInfo(input.packageJSON)
  if (packageInfo) {
    const packageManager = detectPackageManager(files)
    const dependencies = new Set([
      ...Object.keys(packageInfo.dependencies),
      ...Object.keys(packageInfo.devDependencies),
    ])
    const kind = packageKind(dependencies)
    const next = dependencies.has("next")
    const startScript =
      typeof packageInfo.scripts.dev === "string" ? "dev" : typeof packageInfo.scripts.start === "string" ? "start" : ""
    const buildScript = typeof packageInfo.scripts.build === "string" ? "build" : ""
    return {
      kind,
      packageManager,
      startCommand: startScript ? `${packageManager} run ${startScript}` : undefined,
      build: buildScript
        ? {
            id: `detected-${kind}-web`,
            name: `${projectKindName(kind)} build`,
            command: `${packageManager} run ${buildScript}`,
            output: next ? ".next" : "dist",
          }
        : undefined,
      hints: next ? ["next.serverOutput"] : [],
    }
  }
  if (files.has("index.html")) {
    return { kind: "static", startCommand: "python3 -m http.server 8000", hints: [] }
  }
  return { kind: "unknown", hints: [] }
}

export function previewProjectKindLabel(kind: PreviewProjectKind, chinese: boolean) {
  if (kind === "godot") return "Godot"
  if (kind === "unity") return "Unity"
  if (kind === "bevy") return "Bevy"
  if (kind === "phaser") return "Phaser"
  if (kind === "pixi") return "PixiJS"
  if (kind === "three") return "Three.js"
  if (kind === "next") return "Next.js"
  if (kind === "vite") return "Vite"
  if (kind === "static") return chinese ? "静态网页" : "Static web"
  if (kind === "web") return chinese ? "Web 项目" : "Web project"
  return chinese ? "未知项目" : "Unknown project"
}

export function previewProjectContext(profile: PreviewProjectProfile, chinese: boolean) {
  const rows = [
    `- ${chinese ? "项目类型" : "Project type"}: ${previewProjectKindLabel(profile.kind, chinese)}`,
    profile.packageManager ? `- ${chinese ? "包管理器" : "Package manager"}: ${profile.packageManager}` : "",
    profile.startCommand ? `- ${chinese ? "启动命令" : "Start command"}: ${profile.startCommand}` : "",
    profile.build
      ? `- ${chinese ? "构建命令" : "Build command"}: ${profile.build.command}\n- ${chinese ? "产物目录" : "Output directory"}: ${profile.build.output}`
      : "",
  ].filter(Boolean)
  return `${chinese ? "当前项目技术约束" : "Current project constraints"}:\n${rows.join("\n")}\n${projectGuidance(profile, chinese)}`
}

export function previewPrototypePrompt(profile: PreviewProjectProfile, chinese: boolean) {
  const request = chinese
    ? "先检查当前项目结构与已有代码，再基于下面的技术约束实现一个可直接试玩的垂直切片。将范围控制在一个核心机制和一个小关卡：明确玩家目标、操作方式、成功与失败条件、即时反馈和快速重试；复用现有依赖与目录结构，不要另起冲突框架。完成后运行适用的启动或构建检查，并说明策划如何验证。"
    : "Inspect the current project structure and existing code first, then implement a directly playable vertical slice under the technical constraints below. Keep the scope to one core mechanic and one small level: define the player goal, controls, success and failure conditions, immediate feedback, and fast retry. Reuse the existing dependencies and layout instead of introducing a competing framework. Run the applicable start or build checks and explain how a designer can verify the result."
  return `${request}\n\n${previewProjectContext(profile, chinese)}`
}

export function mergePreviewProjectText(current: string, generated: string) {
  if (!current.trim()) return generated
  if (current.includes(generated)) return current
  return `${current.trimEnd()}\n\n${generated}`
}

export function mergePreviewProjectPrompt(prompt: ContentPart[], generated: string) {
  const filled = prompt.findIndex((part) => part.type === "text" && part.content.trim())
  const index = filled >= 0 ? filled : prompt.findIndex((part) => part.type === "text")
  const current = index >= 0 && prompt[index]?.type === "text" ? prompt[index].content : ""
  const content = mergePreviewProjectText(current, generated)
  if (content === current) return prompt
  const next = [...prompt]
  if (index === -1) {
    next.unshift({ type: "text", content, start: 0, end: content.length })
    return next
  }
  const part = next[index]
  if (part.type !== "text") return prompt
  next[index] = { ...part, content, end: part.start + content.length }
  return next
}

function parsePackageInfo(value: string | undefined) {
  if (!value) return undefined
  try {
    const parsed: unknown = JSON.parse(value.slice(0, PREVIEW_PROJECT_FILE_MAX_LENGTH))
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined
    const fields = Object.fromEntries(Object.entries(parsed))
    return {
      scripts: record(fields.scripts),
      dependencies: record(fields.dependencies),
      devDependencies: record(fields.devDependencies),
    }
  } catch {
    return undefined
  }
}

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value))
}

function detectPackageManager(files: Set<string>) {
  if (files.has("bun.lock") || files.has("bun.lockb")) return "bun" as const
  if (files.has("pnpm-lock.yaml")) return "pnpm" as const
  if (files.has("yarn.lock")) return "yarn" as const
  return "npm" as const
}

function packageKind(dependencies: Set<string>): PreviewProjectKind {
  if (dependencies.has("phaser")) return "phaser"
  if (dependencies.has("pixi.js") || [...dependencies].some((dependency) => dependency.startsWith("@pixi/")))
    return "pixi"
  if (dependencies.has("three")) return "three"
  if (dependencies.has("next")) return "next"
  if (dependencies.has("vite")) return "vite"
  return "web"
}

function projectKindName(kind: PreviewProjectKind) {
  if (kind === "phaser") return "Phaser"
  if (kind === "pixi") return "PixiJS"
  if (kind === "three") return "Three.js"
  if (kind === "next") return "Next.js"
  if (kind === "vite") return "Vite"
  return "Web"
}

function projectGuidance(profile: PreviewProjectProfile, chinese: boolean) {
  if (profile.kind === "godot") {
    return chinese
      ? "使用现有 Godot 场景、节点、资源与 GDScript 组织玩法；不要改造成网页框架。需要 Web 交付时使用项目已有的导出预设。"
      : "Use the existing Godot scenes, nodes, resources, and GDScript organization; do not convert it into a web framework. Use the project's export preset when Web delivery is required."
  }
  if (profile.kind === "unity") {
    return chinese
      ? "沿用现有 Unity 场景、Prefab、组件与 C# 脚本，并以编辑器 Play Mode 为首要验证方式；不要虚构不存在的 BuildScript。"
      : "Keep the existing Unity scenes, prefabs, components, and C# scripts, using Editor Play Mode as the primary verification path. Do not invent a BuildScript that is not in the project."
  }
  if (profile.kind === "bevy") {
    return chinese
      ? "沿用 Bevy 的 ECS、状态与插件结构，把原型实现为小而完整的 Rust 系统组合。"
      : "Follow the Bevy ECS, state, and plugin structure, implementing the prototype as a small complete composition of Rust systems."
  }
  if (profile.kind === "phaser") {
    return chinese
      ? "沿用 Phaser Scene、Game Object、输入与物理结构，并复用现有 Web 打包工具。"
      : "Use the existing Phaser scenes, game objects, input, and physics structure, reusing the current web bundler."
  }
  if (profile.kind === "pixi") {
    return chinese
      ? "沿用 PixiJS 渲染器、容器和现有游戏循环，补足明确的状态与交互反馈。"
      : "Use the existing PixiJS renderer, containers, and game loop, adding explicit state and interaction feedback."
  }
  if (profile.kind === "three") {
    return chinese
      ? "沿用 Three.js 场景、相机、渲染循环与资源加载方式，保持性能预算可控。"
      : "Use the existing Three.js scene, camera, render loop, and asset pipeline while keeping the performance budget controlled."
  }
  if (profile.kind === "next") {
    return chinese
      ? "遵循现有 Next.js 路由与组件边界；需要纯静态试玩包时先确认项目支持静态导出。"
      : "Respect the existing Next.js routes and component boundaries; confirm static export support before promising a standalone static playtest."
  }
  if (profile.kind === "vite") {
    return chinese
      ? "沿用 Vite 入口、模块和资源处理方式，避免引入第二套构建工具。"
      : "Keep the Vite entrypoints, modules, and asset handling instead of introducing a second build tool."
  }
  if (profile.kind === "static") {
    return chinese
      ? "保持为无需构建的静态 HTML/CSS/JavaScript Demo，所有资源使用可移植相对路径。"
      : "Keep this as a build-free static HTML/CSS/JavaScript demo with portable relative asset paths."
  }
  return chinese
    ? "先识别并沿用现有框架、依赖与代码风格；如果技术栈仍不明确，先说明假设再实现。"
    : "Identify and retain the current framework, dependencies, and code style. If the stack remains unclear, state the assumption before implementing."
}
