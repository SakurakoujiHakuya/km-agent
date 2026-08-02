import { PREVIEW_ACCEPTANCE_CRITERIA, type PreviewAcceptanceCriterion } from "./game-preview-history"

export const PREVIEW_ACCEPTANCE_PLAN_VERSION = 1
export const PREVIEW_ACCEPTANCE_PLAN_ITEM_MAX_LENGTH = 240

export type PreviewAcceptancePlan = {
  version: typeof PREVIEW_ACCEPTANCE_PLAN_VERSION
  criteria: Partial<Record<PreviewAcceptanceCriterion, string>>
}

export function emptyPreviewAcceptancePlan(): PreviewAcceptancePlan {
  return { version: PREVIEW_ACCEPTANCE_PLAN_VERSION, criteria: {} }
}

export function normalizePreviewAcceptancePlan(value: unknown): PreviewAcceptancePlan {
  if (!value || typeof value !== "object" || !("criteria" in value)) return emptyPreviewAcceptancePlan()
  const criteria = value.criteria
  if (!criteria || typeof criteria !== "object") return emptyPreviewAcceptancePlan()
  const fields = criteria as Record<string, unknown>
  return {
    version: PREVIEW_ACCEPTANCE_PLAN_VERSION,
    criteria: Object.fromEntries(
      PREVIEW_ACCEPTANCE_CRITERIA.flatMap((criterion) => {
        const text = fields[criterion]
        if (typeof text !== "string") return []
        const normalized = text.trim().replace(/\s+/g, " ").slice(0, PREVIEW_ACCEPTANCE_PLAN_ITEM_MAX_LENGTH)
        return normalized ? [[criterion, normalized]] : []
      }),
    ),
  }
}

export function parsePreviewAcceptancePlan(value: string | null) {
  if (!value) return emptyPreviewAcceptancePlan()
  try {
    return normalizePreviewAcceptancePlan(JSON.parse(value))
  } catch {
    return emptyPreviewAcceptancePlan()
  }
}

export function previewAcceptancePlanStorageKey(directory: string) {
  return `km-agent.game-preview-plan.v${PREVIEW_ACCEPTANCE_PLAN_VERSION}:${directory}`
}
