import type { CaptureRegion } from "@/context/platform"
import type { ContentPart } from "@/context/prompt"
import {
  PREVIEW_ACCEPTANCE_CRITERIA,
  type PreviewAcceptanceChecks,
  type PreviewAcceptanceCriterion,
  type PreviewAcceptanceState,
} from "./game-preview-history"
import type { PreviewAcceptancePlan } from "./game-preview-plan"
import type { PreviewPlaytestScenario } from "./game-preview-scenarios"

const PREVIEW_FEEDBACK_PROMPT = {
  review: {
    zh: "分析附件中的当前试玩画面，并结合项目代码检查核心玩法、关卡可读性、操作反馈、目标引导和完成条件。找出影响试玩体验最大的三个问题，直接实现最高优先级改进，运行必要检查，并说明如何验证。",
    en: "Analyze the attached current gameplay frame and inspect the project code for the core loop, level readability, interaction feedback, goal guidance, and completion conditions. Identify the three highest-impact playability issues, implement the top-priority improvements, run the relevant checks, and explain how to verify them.",
  },
  compare: {
    zh: "按时间顺序对比附件中的两个试玩画面，并结合项目代码判断这一轮迭代改善了什么、引入了哪些退化，以及关卡可读性、操作反馈、目标引导和视觉层级还存在哪些问题。直接实现影响最大且可验证的下一项改进，并运行必要检查。",
    en: "Compare the two attached gameplay frames in chronological order and inspect the project code to determine what improved, what regressed, and what still needs work in level readability, interaction feedback, goal guidance, and visual hierarchy. Implement the highest-impact verifiable next improvement and run the relevant checks.",
  },
} as const

export type PreviewCaptureIntent = keyof typeof PREVIEW_FEEDBACK_PROMPT

export function shouldAppendPreviewFeedback(intent: PreviewCaptureIntent, annotation?: string) {
  return intent === "compare" || !!annotation?.trim()
}

function previewAnnotationSection(chinese: boolean, annotation: string) {
  return `${chinese ? "策划标注" : "Designer annotations"}:\n${annotation.trim().slice(0, 4000)}`
}

export function previewFeedbackPrompt(chinese: boolean, intent: PreviewCaptureIntent = "review", annotation?: string) {
  const prompt = PREVIEW_FEEDBACK_PROMPT[intent][chinese ? "zh" : "en"]
  const context = annotation?.trim()
  if (!context) return prompt
  return `${prompt}\n\n${previewAnnotationSection(chinese, context)}`
}

export function previewFeedbackAppendPrompt(
  current: string,
  chinese: boolean,
  intent: PreviewCaptureIntent,
  annotation?: string,
) {
  const context = annotation?.trim()
  const base = PREVIEW_FEEDBACK_PROMPT[intent][chinese ? "zh" : "en"]
  if (context && current.includes(base)) return previewAnnotationSection(chinese, context)
  return previewFeedbackPrompt(chinese, intent, annotation)
}

export function seedPreviewFeedbackPrompt(prompt: ContentPart[], content: string) {
  if (prompt.some((part) => part.type === "text" && part.content.trim())) return prompt
  const index = prompt.findIndex((part) => part.type === "text")
  const next = [...prompt]
  const text = { type: "text" as const, content, start: 0, end: content.length }
  if (index === -1) next.unshift(text)
  else next[index] = text
  return next
}

export function mergePreviewFeedbackText(current: string, generated: string, appendWhenPopulated: boolean) {
  if (!current.trim()) return generated
  if (!appendWhenPopulated) return current
  return `${current.trimEnd()}\n\n${generated}`
}

export function mergePreviewFeedbackPrompt(prompt: ContentPart[], generated: string, appendWhenPopulated: boolean) {
  const seeded = seedPreviewFeedbackPrompt(prompt, generated)
  if (seeded !== prompt || !appendWhenPopulated) return seeded
  const index = prompt.findIndex((part) => part.type === "text" && part.content.trim())
  if (index === -1) return seeded
  const part = prompt[index]
  if (part.type !== "text") return seeded
  const content = mergePreviewFeedbackText(part.content, generated, true)
  const next = [...prompt]
  next[index] = { ...part, content, end: part.start + content.length }
  return next
}

export function previewAnnotationContext(
  frames: {
    createdAt: number
    note: string
    tags: string[]
    checks?: PreviewAcceptanceChecks
    scenario?: PreviewPlaytestScenario
  }[],
  options: {
    chinese: boolean
    labels: ReadonlyMap<string, string>
    criteriaLabels?: ReadonlyMap<PreviewAcceptanceCriterion, string>
    stateLabels?: ReadonlyMap<PreviewAcceptanceState, string>
    scenarioLabel?: string
    formatTime?: (value: number) => string
  },
) {
  const formatTime = options.formatTime ?? ((value: number) => new Date(value).toLocaleString())
  return [...frames]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((frame, index) => {
      const tags = frame.tags.map((tag) => options.labels.get(tag)).filter((label): label is string => !!label)
      const checks = PREVIEW_ACCEPTANCE_CRITERIA.flatMap((criterion) => {
        const state = frame.checks?.[criterion]
        if (!state) return []
        const criterionLabel = options.criteriaLabels?.get(criterion) ?? criterion
        const stateLabel = options.stateLabels?.get(state) ?? state
        return `${criterionLabel}=${stateLabel}`
      })
      const acceptance =
        checks.length > 0 ? `${options.chinese ? "验收" : "Checks"}: ${checks.join(options.chinese ? "、" : ", ")}` : ""
      const scenario = frame.scenario
        ? `${options.scenarioLabel ?? (options.chinese ? "场景" : "Scenario")}: ${frame.scenario.name}`
        : ""
      const details = [
        scenario,
        tags.length > 0 ? tags.join(options.chinese ? "、" : ", ") : "",
        acceptance,
        frame.note.trim(),
      ]
        .filter(Boolean)
        .join(options.chinese ? "；" : "; ")
      return `${index + 1}. ${formatTime(frame.createdAt)}${details ? ` — ${details}` : ""}`
    })
    .join("\n")
}

export function previewAcceptancePlanContext(
  plan: PreviewAcceptancePlan,
  options: {
    chinese: boolean
    criteriaLabels: ReadonlyMap<PreviewAcceptanceCriterion, string>
  },
) {
  const items = PREVIEW_ACCEPTANCE_CRITERIA.flatMap((criterion) => {
    const requirement = plan.criteria[criterion]?.trim()
    if (!requirement) return []
    return `- ${options.criteriaLabels.get(criterion) ?? criterion}: ${requirement}`
  })
  if (items.length === 0) return ""
  return `${options.chinese ? "项目验收计划" : "Project acceptance plan"}:\n${items.join("\n")}`
}

export function previewPlaytestScenarioContext(scenario: PreviewPlaytestScenario, chinese: boolean) {
  const details = [
    scenario.steps ? `${chinese ? "测试步骤" : "Steps"}:\n${scenario.steps}` : "",
    scenario.expected ? `${chinese ? "预期结果" : "Expected result"}:\n${scenario.expected}` : "",
  ]
    .filter(Boolean)
    .join("\n")
  return `${chinese ? "试玩场景" : "Playtest scenario"}: ${scenario.name}${details ? `\n${details}` : ""}`
}

export function normalizePreviewURL(value: string) {
  const input = value.trim()
  if (!input) return
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(input) && !/^https?:\/\//i.test(input)) return
  const candidate = /^https?:\/\//i.test(input) ? input : `http://${input}`
  if (!URL.canParse(candidate)) return
  const url = new URL(candidate)
  if (url.protocol !== "http:" && url.protocol !== "https:") return
  return url.href
}

export function previewCaptureRegion(
  rect: Pick<DOMRect, "left" | "top" | "right" | "bottom">,
): CaptureRegion | undefined {
  const values = [rect.left, rect.top, rect.right, rect.bottom]
  if (values.some((value) => !Number.isFinite(value))) return
  const x = Math.max(0, Math.floor(rect.left))
  const y = Math.max(0, Math.floor(rect.top))
  const right = Math.ceil(rect.right)
  const bottom = Math.ceil(rect.bottom)
  if (right <= x || bottom <= y) return
  return { x, y, width: right - x, height: bottom - y }
}

export function previewStartProcess(command: string, platform: "windows" | "unix") {
  if (platform === "windows") {
    return { command: "powershell.exe", args: ["-NoExit", "-Command", command] }
  }
  return { command: "/bin/sh", args: ["-lc", command] }
}

type PreviewRequest = (
  url: string,
  options: { cache: "no-store"; mode: "no-cors"; signal: AbortSignal },
) => Promise<unknown>

export async function detectPreviewURLs(urls: string[], request?: PreviewRequest, timeoutMs = 900) {
  const candidates = [...new Set(urls.flatMap((value) => normalizePreviewURL(value) ?? []))]
  const send: PreviewRequest = request ?? ((url, options) => fetch(url, options))
  const results = await Promise.all(
    candidates.map(async (url) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const result = await send(url, { cache: "no-store", mode: "no-cors", signal: controller.signal })
        .then(() => url)
        .catch(() => undefined)
      clearTimeout(timer)
      return result
    }),
  )
  return results.filter((url): url is string => !!url)
}
