import { uuid } from "@/utils/uuid"

export const PREVIEW_BUILD_TARGETS_VERSION = 1
export const PREVIEW_BUILD_TARGETS_MAX_COUNT = 4
export const PREVIEW_BUILD_TARGET_NAME_MAX_LENGTH = 60
export const PREVIEW_BUILD_COMMAND_MAX_LENGTH = 500
export const PREVIEW_BUILD_OUTPUT_MAX_LENGTH = 200

export type PreviewBuildTarget = {
  id: string
  name: string
  command: string
  output: string
}

export type PreviewBuildTargets = {
  version: typeof PREVIEW_BUILD_TARGETS_VERSION
  active: string
  items: PreviewBuildTarget[]
}

export type PreviewBuildResult = "success" | "failed" | "unknown"

export function previewBuildResultFromExitCode(exitCode: number | undefined): PreviewBuildResult {
  if (exitCode === undefined) return "unknown"
  return exitCode === 0 ? "success" : "failed"
}

export function defaultPreviewBuildTargets(): PreviewBuildTargets {
  return {
    version: PREVIEW_BUILD_TARGETS_VERSION,
    active: "web-release",
    items: [{ id: "web-release", name: "Web", command: "bun run build", output: "dist" }],
  }
}

export function createPreviewBuildTarget(name = "Web build"): PreviewBuildTarget {
  return { id: uuid(), name, command: "bun run build", output: "dist" }
}

export function normalizePreviewBuildOutput(value: unknown) {
  if (typeof value !== "string") return
  const normalized = value.trim().replaceAll("\\", "/").slice(0, PREVIEW_BUILD_OUTPUT_MAX_LENGTH)
  if (!normalized || normalized.startsWith("/") || normalized.startsWith("~") || /^[a-z]:/i.test(normalized)) return
  const parts = normalized.split("/").filter((part) => part && part !== ".")
  if (parts.length === 0 || parts.some((part) => part === ".." || /[\0\r\n<>:"|?*]/.test(part))) return
  return parts.join("/")
}

export function normalizePreviewBuildTarget(value: unknown): PreviewBuildTarget | undefined {
  if (!value || typeof value !== "object") return
  const fields = value as Record<string, unknown>
  const id = typeof fields.id === "string" ? fields.id.trim().slice(0, 100) : ""
  const name =
    typeof fields.name === "string"
      ? fields.name.trim().replace(/\s+/g, " ").slice(0, PREVIEW_BUILD_TARGET_NAME_MAX_LENGTH)
      : ""
  const rawCommand = typeof fields.command === "string" ? fields.command.trim() : ""
  const command = rawCommand.slice(0, PREVIEW_BUILD_COMMAND_MAX_LENGTH)
  const output = normalizePreviewBuildOutput(fields.output)
  if (!id || !name || !command || !output || /[\0\r\n]/.test(rawCommand)) return
  return { id, name, command, output }
}

export function normalizePreviewBuildTargets(value: unknown): PreviewBuildTargets {
  if (!value || typeof value !== "object") return defaultPreviewBuildTargets()
  const fields = value as Record<string, unknown>
  const items = Array.isArray(fields.items)
    ? fields.items
        .map(normalizePreviewBuildTarget)
        .filter((item): item is PreviewBuildTarget => !!item)
        .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
        .slice(0, PREVIEW_BUILD_TARGETS_MAX_COUNT)
    : []
  if (items.length === 0) return defaultPreviewBuildTargets()
  const requested = typeof fields.active === "string" ? fields.active : ""
  return {
    version: PREVIEW_BUILD_TARGETS_VERSION,
    active: items.some((item) => item.id === requested) ? requested : items[0].id,
    items,
  }
}

export function parsePreviewBuildTargets(value: string | null) {
  if (!value) return defaultPreviewBuildTargets()
  try {
    return normalizePreviewBuildTargets(JSON.parse(value))
  } catch {
    return defaultPreviewBuildTargets()
  }
}

export function activePreviewBuildTarget(targets: PreviewBuildTargets) {
  return targets.items.find((item) => item.id === targets.active)
}

export function previewBuildRecommendationApplied(targets: PreviewBuildTargets, target: PreviewBuildTarget) {
  return targets.items.some(
    (item) =>
      item.id === target.id &&
      item.name === target.name &&
      item.command === target.command &&
      item.output === target.output,
  )
}

export function applyPreviewBuildRecommendation(targets: PreviewBuildTargets, target: PreviewBuildTarget) {
  const recommendation = normalizePreviewBuildTarget(target)
  if (!recommendation) return targets
  const existing = targets.items.findIndex((item) => item.id === recommendation.id)
  if (existing >= 0) {
    return normalizePreviewBuildTargets({
      ...targets,
      active: recommendation.id,
      items: targets.items.map((item, index) => (index === existing ? recommendation : item)),
    })
  }
  if (targets.items.length === 1 && targets.items[0].id === "web-release") {
    return normalizePreviewBuildTargets({ ...targets, active: recommendation.id, items: [recommendation] })
  }
  if (targets.items.length >= PREVIEW_BUILD_TARGETS_MAX_COUNT) return targets
  return normalizePreviewBuildTargets({
    ...targets,
    active: recommendation.id,
    items: [...targets.items, recommendation],
  })
}

export function previewBuildTargetsStorageKey(directory: string) {
  return `km-agent.game-preview-build.v${PREVIEW_BUILD_TARGETS_VERSION}:${directory}`
}

export function previewBuildOutputPath(directory: string, output: string) {
  const normalized = normalizePreviewBuildOutput(output)
  if (!normalized) return
  const separator = directory.includes("\\") ? "\\" : "/"
  return `${directory.replace(/[\\/]+$/, "")}${separator}${normalized.replaceAll("/", separator)}`
}
