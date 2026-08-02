import {
  whiteboardSceneNodeTypeLabel,
  whiteboardSemanticNodeType,
  type WhiteboardSceneSummary,
} from "./whiteboard-scene"
import {
  PREVIEW_PLAYTEST_SCENARIO_DETAIL_MAX_LENGTH,
  PREVIEW_PLAYTEST_SCENARIO_NAME_MAX_LENGTH,
  type PreviewPlaytestScenario,
} from "../game-preview-scenarios"

export type WhiteboardPlaytestStep = {
  ref: string
  via?: number
}

export type WhiteboardPlaytestChoice = {
  index: number
  to: string
  label: string
  target: string
}

export const WHITEBOARD_PLAYTEST_MAX_STEPS = 40
export const WHITEBOARD_PLAYTEST_NOTE_MAX_LENGTH = 300
export const WHITEBOARD_PLAYTEST_ISSUES = ["guidance", "feedback", "soft-lock", "pacing", "branch"] as const
export type WhiteboardPlaytestIssue = (typeof WHITEBOARD_PLAYTEST_ISSUES)[number]

export function whiteboardPlaytestStarts(graph: WhiteboardSceneSummary) {
  const explicit = graph.nodes.filter((node) => node.type === "start").map((node) => node.ref)
  if (explicit.length > 0) return explicit
  const incoming = new Set(graph.connections.map((connection) => connection.to))
  const outgoing = new Set(graph.connections.map((connection) => connection.from))
  const starts = graph.nodes.filter((node) => !incoming.has(node.ref) && outgoing.has(node.ref)).map((node) => node.ref)
  if (starts.length > 0) return starts
  return graph.nodes[0] ? [graph.nodes[0].ref] : []
}

export function whiteboardPlaytestChoices(
  graph: WhiteboardSceneSummary,
  path: readonly WhiteboardPlaytestStep[],
): WhiteboardPlaytestChoice[] {
  const current = path.at(-1)?.ref
  if (!current) return []
  const nodes = new Map(graph.nodes.map((node) => [node.ref, node]))
  return graph.connections.flatMap((connection, index) => {
    if (connection.from !== current) return []
    const target = nodes.get(connection.to)
    if (!target) return []
    return [
      {
        index,
        to: target.ref,
        label: connection.label || target.label || target.ref,
        target: target.label || target.ref,
      },
    ]
  })
}

export function advanceWhiteboardPlaytest(
  graph: WhiteboardSceneSummary,
  path: readonly WhiteboardPlaytestStep[],
  connection: number,
) {
  if (path.length >= WHITEBOARD_PLAYTEST_MAX_STEPS) return path
  const choice = whiteboardPlaytestChoices(graph, path).find((item) => item.index === connection)
  if (!choice) return path
  return [...path, { ref: choice.to, via: connection }]
}

export function formatWhiteboardPlaytestTrace(
  graph: WhiteboardSceneSummary,
  path: readonly WhiteboardPlaytestStep[],
  chinese: boolean,
) {
  const nodes = new Map(graph.nodes.map((node) => [node.ref, node]))
  const start = path[0]
  if (!start) return ""
  const nodeLabel = (ref: string) => nodes.get(ref)?.label || ref
  const nodeDescription = (ref: string) => {
    const node = nodes.get(ref)
    const role = whiteboardSemanticNodeType(node?.type)
    return `${ref}${role ? ` [${whiteboardSceneNodeTypeLabel(role, chinese)}]` : ""} ${nodeLabel(ref)}`
  }
  const lines = [
    chinese
      ? "白板流程试玩轨迹（策划在 KM Agent 中实际点击，请据此复现和评审）："
      : "Whiteboard flow playtest trace (clicked by the designer in KM Agent; use it to reproduce and review the flow):",
    `- ${chinese ? "起点" : "Start"}: ${nodeDescription(start.ref)}`,
    ...path.slice(1).map((step, index) => {
      const previous = path[index]
      const connection = step.via === undefined ? undefined : graph.connections[step.via]
      const transition = connection?.label || (chinese ? "继续" : "Continue")
      return `- ${index + 1}. ${nodeDescription(previous?.ref ?? "?")} --[${transition}]--> ${nodeDescription(step.ref)}`
    }),
  ]
  const choices = whiteboardPlaytestChoices(graph, path)
  const repeated = path.filter((step, index) => path.findIndex((candidate) => candidate.ref === step.ref) !== index)
  if (choices.length === 0) {
    lines.push(
      `${chinese ? "试玩结果" : "Result"}: ${chinese ? "到达无后继连接的终点" : "Reached an endpoint with no outgoing link"} (${nodeDescription(path.at(-1)?.ref ?? "")})`,
    )
  }
  if (choices.length > 0) {
    lines.push(
      `${chinese ? "试玩结果" : "Result"}: ${chinese ? "在此暂停" : "Stopped"} (${path.at(-1)?.ref} ${nodeLabel(path.at(-1)?.ref ?? "")}); ${chinese ? "仍可选择" : "available choices"}: ${choices.map((choice) => `${choice.label} -> ${choice.to}`).join(", ")}`,
    )
  }
  if (repeated.length > 0)
    lines.push(
      `${chinese ? "重复经过 / 循环" : "Revisited / cycle"}: ${[...new Set(repeated.map((step) => step.ref))].join(", ")}`,
    )
  if (path.length >= WHITEBOARD_PLAYTEST_MAX_STEPS)
    lines.push(
      chinese
        ? `轨迹已达到 ${WHITEBOARD_PLAYTEST_MAX_STEPS} 步安全上限。`
        : `Trace reached the ${WHITEBOARD_PLAYTEST_MAX_STEPS}-step safety limit.`,
    )
  return lines.join("\n")
}

export function whiteboardPlaytestImprovement(
  graph: WhiteboardSceneSummary,
  path: readonly WhiteboardPlaytestStep[],
  issue: WhiteboardPlaytestIssue,
  note: string,
  chinese: boolean,
) {
  const trace = formatWhiteboardPlaytestTrace(graph, path, chinese)
  if (!trace) return undefined
  const labels: Record<WhiteboardPlaytestIssue, { zh: string; en: string }> = {
    guidance: { zh: "引导不清", en: "unclear guidance" },
    feedback: { zh: "反馈不足", en: "insufficient feedback" },
    "soft-lock": { zh: "卡住或软锁", en: "stuck state or soft lock" },
    pacing: { zh: "节奏问题", en: "pacing issue" },
    branch: { zh: "分支缺少意义", en: "weak or meaningless branch" },
  }
  const detail = note.trim().replace(/\s+/g, " ").slice(0, WHITEBOARD_PLAYTEST_NOTE_MAX_LENGTH)
  const label = chinese ? labels[issue].zh : labels[issue].en
  return {
    request: chinese
      ? `根据刚才的实际试玩优化当前白板：${label}。${detail ? `策划备注：${detail}` : "修复这个问题，并保持未涉及的流程不变。"}`
      : `Improve the current board from the playtest just performed: ${label}. ${detail ? `Designer note: ${detail}` : "Fix this issue while preserving unaffected flow."}`,
    context: [
      chinese
        ? `本次白板修改由策划的实际流程试玩触发。已标记问题：${label}${detail ? `；策划备注：${detail}` : ""}。请优先修复实际经过的路径，并检查相邻分支不会因此产生新问题。`
        : `This board edit was triggered by the designer's actual flow playtest. Flagged issue: ${label}${detail ? `; designer note: ${detail}` : ""}. Prioritize the played route and verify that adjacent branches do not gain new problems.`,
      trace,
    ].join("\n\n"),
  }
}

export function whiteboardPlaytestScenario(
  graph: WhiteboardSceneSummary,
  path: readonly WhiteboardPlaytestStep[],
  input: { id: string; board: string; chinese: boolean },
): PreviewPlaytestScenario | undefined {
  const start = path[0]
  if (!start) return undefined
  const nodes = new Map(graph.nodes.map((node) => [node.ref, node]))
  const nodeLabel = (ref: string) => nodes.get(ref)?.label || ref
  const steps = [
    input.chinese ? `1. 从「${nodeLabel(start.ref)}」开始` : `1. Start at “${nodeLabel(start.ref)}”`,
    ...path.slice(1).map((step, index) => {
      const connection = step.via === undefined ? undefined : graph.connections[step.via]
      const transition = connection?.label || (input.chinese ? "继续" : "Continue")
      return input.chinese
        ? `${index + 2}. 选择「${transition}」→「${nodeLabel(step.ref)}」`
        : `${index + 2}. Choose “${transition}” → “${nodeLabel(step.ref)}”`
    }),
  ]
    .join("\n")
    .slice(0, PREVIEW_PLAYTEST_SCENARIO_DETAIL_MAX_LENGTH)
  const current = path.at(-1)?.ref ?? start.ref
  const choices = whiteboardPlaytestChoices(graph, path)
  const repeated = path.filter((step, index) => path.findIndex((candidate) => candidate.ref === step.ref) !== index)
  const expected = [
    choices.length === 0
      ? input.chinese
        ? `到达「${nodeLabel(current)}」后流程结束，并出现明确的通关、失败或阶段结束反馈。`
        : `The flow ends at “${nodeLabel(current)}” with clear completion, failure, or stage-end feedback.`
      : input.chinese
        ? `在「${nodeLabel(current)}」仍可选择：${choices.map((choice) => `「${choice.label}」`).join("、")}。`
        : `At “${nodeLabel(current)}”, these choices remain available: ${choices.map((choice) => `“${choice.label}”`).join(", ")}.`,
    repeated.length > 0
      ? input.chinese
        ? `轨迹重复经过「${[...new Set(repeated.map((step) => nodeLabel(step.ref)))].join("、")}」；循环应允许重试且不会软锁。`
        : `The trace revisits “${[...new Set(repeated.map((step) => nodeLabel(step.ref)))].join(", ")}”; the loop remains retryable without a soft lock.`
      : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, PREVIEW_PLAYTEST_SCENARIO_DETAIL_MAX_LENGTH)
  return {
    id: input.id,
    name: `${input.board.trim() || (input.chinese ? "白板" : "Whiteboard")} · ${input.chinese ? "流程试玩" : "Flow playtest"}`.slice(
      0,
      PREVIEW_PLAYTEST_SCENARIO_NAME_MAX_LENGTH,
    ),
    steps,
    expected,
  }
}
