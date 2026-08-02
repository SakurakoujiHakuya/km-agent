import type { PreviewPlaytestScenario } from "./game-preview-scenarios"

export const PREVIEW_PLAYTEST_RUN_MAX_STEPS = 20
export const PREVIEW_PLAYTEST_RUN_STEP_MAX_LENGTH = 160
export const PREVIEW_PLAYTEST_RUN_NOTE_MAX_LENGTH = 400

export type PreviewPlaytestStepState = "" | "pass" | "fail"

export type PreviewPlaytestRun = {
  checks: PreviewPlaytestStepState[]
  expected: PreviewPlaytestStepState
  note: string
}

export function emptyPreviewPlaytestRun(): PreviewPlaytestRun {
  return { checks: [], expected: "", note: "" }
}

export function previewPlaytestScenarioSteps(scenario: Pick<PreviewPlaytestScenario, "steps">) {
  return scenario.steps
    .split(/\r?\n|(?=\s+\d{1,2}[.)、]\s+)/)
    .map((step) =>
      step
        .trim()
        .replace(/^(?:[-*•]\s+|\d{1,2}[.)、]\s*)/, "")
        .trim(),
    )
    .filter(Boolean)
    .map((step) => step.slice(0, PREVIEW_PLAYTEST_RUN_STEP_MAX_LENGTH))
    .slice(0, PREVIEW_PLAYTEST_RUN_MAX_STEPS)
}

export function normalizePreviewPlaytestRun(
  value: unknown,
  scenario: Pick<PreviewPlaytestScenario, "steps">,
): PreviewPlaytestRun | undefined {
  if (!isRecord(value)) return undefined
  const steps = previewPlaytestScenarioSteps(scenario)
  const checks = Array.from({ length: steps.length }, (_, index) => normalizeState(value.checks, index))
  const expected = value.expected === "pass" || value.expected === "fail" ? value.expected : ""
  const note = typeof value.note === "string" ? value.note.trim().slice(0, PREVIEW_PLAYTEST_RUN_NOTE_MAX_LENGTH) : ""
  if (checks.every((state) => !state) && !expected && !note) return undefined
  return { checks, expected, note }
}

export function previewPlaytestRunComplete(
  run: PreviewPlaytestRun,
  scenario: Pick<PreviewPlaytestScenario, "steps" | "expected">,
) {
  const steps = previewPlaytestScenarioSteps(scenario)
  return (
    steps.length > 0 && steps.every((_, index) => !!run.checks[index]) && (!scenario.expected.trim() || !!run.expected)
  )
}

export function previewPlaytestRunContext(
  scenario: PreviewPlaytestScenario,
  run: PreviewPlaytestRun,
  chinese: boolean,
  label?: string,
) {
  const steps = previewPlaytestScenarioSteps(scenario)
  const status = (state: PreviewPlaytestStepState) => {
    if (state === "pass") return chinese ? "通过" : "Pass"
    if (state === "fail") return chinese ? "需修复" : "Fix"
    return chinese ? "未测试" : "Untested"
  }
  const title = `${chinese ? "场景执行结果" : "Scenario run result"}${label ? ` (${label})` : ""}: ${scenario.name}`
  const checks = steps.map((step, index) => `- ${index + 1}. [${status(run.checks[index] ?? "")}] ${step}`)
  const expected = scenario.expected
    ? `- ${chinese ? "预期结果" : "Expected result"} [${
        run.expected === "pass"
          ? chinese
            ? "符合"
            : "Met"
          : run.expected === "fail"
            ? chinese
              ? "未符合"
              : "Not met"
            : chinese
              ? "未测试"
              : "Untested"
      }]: ${scenario.expected}`
    : ""
  const note = run.note ? `- ${chinese ? "策划备注" : "Designer note"}: ${run.note}` : ""
  return [title, ...checks, expected, note].filter(Boolean).join("\n")
}

function normalizeState(value: unknown, index: number): PreviewPlaytestStepState {
  if (!Array.isArray(value)) return ""
  return value[index] === "pass" || value[index] === "fail" ? value[index] : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
