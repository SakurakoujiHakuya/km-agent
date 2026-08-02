import { uuid } from "@/utils/uuid"

export const PREVIEW_PLAYTEST_SCENARIOS_VERSION = 1
export const PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT = 8
export const PREVIEW_PLAYTEST_SCENARIO_NAME_MAX_LENGTH = 80
export const PREVIEW_PLAYTEST_SCENARIO_DETAIL_MAX_LENGTH = 600

export type PreviewPlaytestScenario = {
  id: string
  name: string
  steps: string
  expected: string
}

export type PreviewPlaytestScenarios = {
  version: typeof PREVIEW_PLAYTEST_SCENARIOS_VERSION
  active: string
  items: PreviewPlaytestScenario[]
}

export function emptyPreviewPlaytestScenarios(): PreviewPlaytestScenarios {
  return { version: PREVIEW_PLAYTEST_SCENARIOS_VERSION, active: "", items: [] }
}

export function createPreviewPlaytestScenario(): PreviewPlaytestScenario {
  return { id: uuid(), name: "", steps: "", expected: "" }
}

export function normalizePreviewPlaytestScenario(value: unknown): PreviewPlaytestScenario | undefined {
  if (!isRecord(value)) return undefined
  const fields = value
  const id = typeof fields.id === "string" ? fields.id.trim().slice(0, 100) : ""
  const name =
    typeof fields.name === "string" ? fields.name.trim().slice(0, PREVIEW_PLAYTEST_SCENARIO_NAME_MAX_LENGTH) : ""
  if (!id || !name) return undefined
  return {
    id,
    name,
    steps:
      typeof fields.steps === "string" ? fields.steps.trim().slice(0, PREVIEW_PLAYTEST_SCENARIO_DETAIL_MAX_LENGTH) : "",
    expected:
      typeof fields.expected === "string"
        ? fields.expected.trim().slice(0, PREVIEW_PLAYTEST_SCENARIO_DETAIL_MAX_LENGTH)
        : "",
  }
}

export function normalizePreviewPlaytestScenarios(value: unknown): PreviewPlaytestScenarios {
  if (!isRecord(value)) return emptyPreviewPlaytestScenarios()
  const fields = value
  const items = Array.isArray(fields.items)
    ? fields.items
        .map(normalizePreviewPlaytestScenario)
        .filter((item): item is PreviewPlaytestScenario => !!item)
        .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
        .slice(0, PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT)
    : []
  const requested = typeof fields.active === "string" ? fields.active : ""
  return {
    version: PREVIEW_PLAYTEST_SCENARIOS_VERSION,
    active: items.some((item) => item.id === requested) ? requested : (items[0]?.id ?? ""),
    items,
  }
}

export function parsePreviewPlaytestScenarios(value: string | null) {
  if (!value) return emptyPreviewPlaytestScenarios()
  try {
    return normalizePreviewPlaytestScenarios(JSON.parse(value))
  } catch {
    return emptyPreviewPlaytestScenarios()
  }
}

export function activePreviewPlaytestScenario(scenarios: PreviewPlaytestScenarios) {
  return scenarios.items.find((item) => item.id === scenarios.active)
}

export function upsertPreviewPlaytestScenario(
  scenarios: PreviewPlaytestScenarios,
  scenario: PreviewPlaytestScenario,
): PreviewPlaytestScenarios {
  const item = normalizePreviewPlaytestScenario(scenario)
  if (!item) return scenarios
  const existing = scenarios.items.findIndex((candidate) => candidate.id === item.id)
  if (existing === -1 && scenarios.items.length >= PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT) return scenarios
  return {
    version: PREVIEW_PLAYTEST_SCENARIOS_VERSION,
    active: item.id,
    items:
      existing === -1
        ? [...scenarios.items, item]
        : scenarios.items.map((candidate, index) => (index === existing ? item : candidate)),
  }
}

export function previewPlaytestScenariosStorageKey(directory: string) {
  return `km-agent.game-preview-scenarios.v${PREVIEW_PLAYTEST_SCENARIOS_VERSION}:${directory}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
