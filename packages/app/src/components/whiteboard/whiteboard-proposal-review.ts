import type { WhiteboardProposal } from "./whiteboard-proposal"
import type { WhiteboardSceneSummary } from "./whiteboard-scene"

export type WhiteboardProposalReview = {
  changes: {
    nodes: { added: string[]; removed: string[] }
    connections: { added: number; removed: number }
    notes: { added: number; removed: number }
  }
  flow: {
    starts: string[]
    ends: string[]
    branches: string[]
    cycles: string[]
    disconnected: string[]
    unreachable: string[]
    incompleteDecisions: string[]
    ambiguousDecisions: string[]
    unexpectedDeadEnds: string[]
    terminalFailures: string[]
  }
  playable: {
    covered: WhiteboardPlayableCheck[]
    missing: WhiteboardPlayableCheck[]
  }
}

export type WhiteboardPlayableCheck = "objective" | "interaction" | "outcome" | "feedback" | "retry" | "completion"

const playableChecks: WhiteboardPlayableCheck[] = [
  "objective",
  "interaction",
  "outcome",
  "feedback",
  "retry",
  "completion",
]

export function whiteboardProposalRepairPrompt(review: WhiteboardProposalReview, chinese: boolean) {
  const disconnected = new Set(review.flow.disconnected)
  const groups = [
    repairIssue(chinese ? "孤立节点" : "Disconnected nodes", review.flow.disconnected, chinese),
    repairIssue(
      chinese ? "不可达节点" : "Unreachable nodes",
      review.flow.unreachable.filter((label) => !disconnected.has(label)),
      chinese,
    ),
    repairIssue(
      chinese ? "不足两个出口的判定" : "Decisions with fewer than two exits",
      review.flow.incompleteDecisions,
      chinese,
    ),
    repairIssue(
      chinese ? "出口条件不清晰的判定" : "Decisions with unclear exit labels",
      review.flow.ambiguousDecisions,
      chinese,
    ),
    repairIssue(chinese ? "意外断头路" : "Unexpected dead ends", review.flow.unexpectedDeadEnds, chinese),
    repairIssue(chinese ? "无重试出口的失败" : "Failures without a retry exit", review.flow.terminalFailures, chinese),
  ].filter((issue): issue is string => !!issue)
  if (groups.length === 0) return undefined

  if (chinese) {
    return [
      "修复当前白板方案中的流程风险，同时保留现有玩法意图、已经成立的节点、连接和策划备注。只做解决这些风险所必需的修改：",
      ...groups.map((issue) => `- ${issue}`),
      "确保每个判定都有清晰可区分的出口，非终点不会意外中断，失败路径提供可理解的重试或恢复方式。",
    ].join("\n")
  }
  return [
    "Fix the flow risks in the current board while preserving its gameplay intent and every valid node, connection, and design note. Make only the changes needed to resolve these issues:",
    ...groups.map((issue) => `- ${issue}`),
    "Give every decision clear distinct exits, prevent non-terminal paths from ending unexpectedly, and provide understandable retry or recovery paths for failures.",
  ].join("\n")
}

export function whiteboardProposalPlayablePrompt(review: WhiteboardProposalReview, chinese: boolean) {
  if (review.playable.missing.length === 0) return undefined
  const labels: Record<WhiteboardPlayableCheck, string> = chinese
    ? {
        objective: "明确的试玩目标与起止状态",
        interaction: "玩家可执行的核心操作",
        outcome: "可验证且条件清晰的成败判定",
        feedback: "玩家能理解的结果反馈",
        retry: "失败后的安全重试或恢复路径",
        completion: "从起点可到达的完成出口",
      }
    : {
        objective: "a clear playtest goal with start and end states",
        interaction: "a core action the player can perform",
        outcome: "a testable outcome decision with distinct conditions",
        feedback: "player-readable outcome feedback",
        retry: "a safe retry or recovery path after failure",
        completion: "a completion exit reachable from the start",
      }
  const missing = review.playable.missing.map((check) => `- ${labels[check]}`)
  return chinese
    ? [
        "把当前白板补成最小可试玩的游戏 Demo 流程，同时保留已有玩法意图、已成立的节点、连接和策划备注。当前缺失：",
        ...missing,
        "只新增或调整补齐这些要素所必需的内容；让玩家目标、核心操作、成败反馈、失败恢复和完成条件能够在一次短流程中被实际验证。",
      ].join("\n")
    : [
        "Complete the current board as a minimal playable game-demo flow while preserving its gameplay intent and every valid node, connection, and design note. It is missing:",
        ...missing,
        "Add or adjust only what these gaps require so the player goal, core action, outcome feedback, failure recovery, and completion condition can be tested in one short run.",
      ].join("\n")
}

export function reviewWhiteboardProposal(
  current: WhiteboardSceneSummary,
  proposal: WhiteboardProposal,
): WhiteboardProposalReview {
  const currentLabels = new Map(current.nodes.map((node) => [node.ref, node.label || node.ref]))
  const proposalLabels = new Map(proposal.nodes.map((node) => [node.id, node.label]))
  const currentNodes = current.nodes.map((node) => node.label || node.ref)
  const proposalNodes = proposal.nodes.map((node) => node.label)
  const currentConnections = current.connections.map((connection) =>
    connectionKey(
      currentLabels.get(connection.from) ?? connection.from,
      currentLabels.get(connection.to) ?? connection.to,
      connection.label,
    ),
  )
  const proposalConnections = proposal.connections.map((connection) =>
    connectionKey(
      proposalLabels.get(connection.from) ?? connection.from,
      proposalLabels.get(connection.to) ?? connection.to,
      connection.label,
    ),
  )
  const currentNotes = current.notes
    .filter((note) => comparisonKey(note) !== comparisonKey(proposal.title))
    .map(normalizeNote)
  const proposalNotes = proposal.notes.map(normalizeNote)
  const incoming = new Map(proposal.nodes.map((node) => [node.id, 0]))
  const outgoing = new Map(proposal.nodes.map((node) => [node.id, 0]))
  const adjacency = new Map(proposal.nodes.map((node) => [node.id, [] as string[]]))
  const outgoingConnections = new Map(proposal.nodes.map((node) => [node.id, [] as WhiteboardProposal["connections"]]))
  proposal.connections.forEach((connection) => {
    incoming.set(connection.to, (incoming.get(connection.to) ?? 0) + 1)
    outgoing.set(connection.from, (outgoing.get(connection.from) ?? 0) + 1)
    adjacency.get(connection.from)?.push(connection.to)
    outgoingConnections.get(connection.from)?.push(connection)
  })
  const explicitStarts = proposal.nodes.filter((node) => node.type === "start").map((node) => node.id)
  const starts =
    explicitStarts.length > 0
      ? explicitStarts
      : proposal.nodes
          .filter((node) => (incoming.get(node.id) ?? 0) === 0 && (outgoing.get(node.id) ?? 0) > 0)
          .map((node) => node.id)
  const explicitEnds = proposal.nodes.filter((node) => node.type === "end").map((node) => node.id)
  const ends =
    explicitEnds.length > 0
      ? explicitEnds
      : proposal.nodes
          .filter((node) => (outgoing.get(node.id) ?? 0) === 0 && (incoming.get(node.id) ?? 0) > 0)
          .map((node) => node.id)
  const reachable = new Set<string>()
  const visit = (id: string) => {
    if (reachable.has(id)) return
    reachable.add(id)
    adjacency.get(id)?.forEach(visit)
  }
  starts.forEach(visit)
  const reachesStart = (start: string, current: string, visited: ReadonlySet<string>): boolean =>
    (adjacency.get(current) ?? []).some(
      (next) => next === start || (!visited.has(next) && reachesStart(start, next, new Set([...visited, next]))),
    )
  const labels = (ids: readonly string[]) => ids.map((id) => proposalLabels.get(id) ?? id)
  const cycleIDs = proposal.nodes
    .filter((node) => reachesStart(node.id, node.id, new Set([node.id])))
    .map((node) => node.id)
  const proposalNodesByID = new Map(proposal.nodes.map((node) => [node.id, node]))
  const reachesInteraction = (start: string) => {
    const pending = [...(adjacency.get(start) ?? [])]
    const visited = new Set([start])
    while (pending.length > 0) {
      const id = pending.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      const node = proposalNodesByID.get(id)
      if (node?.type === "mechanic" || node?.type === "decision") return true
      pending.push(...(adjacency.get(id) ?? []))
    }
    return false
  }
  const healthyDecisions = proposal.nodes.filter((node) => {
    if (node.type !== "decision" || !reachable.has(node.id)) return false
    const connections = outgoingConnections.get(node.id) ?? []
    if (connections.length < 2) return false
    const conditions = connections.map((connection) => comparisonKey(connection.label ?? ""))
    return conditions.every(Boolean) && new Set(conditions).size === conditions.length
  })
  const playable: Record<WhiteboardPlayableCheck, boolean> = {
    objective: explicitStarts.length > 0 && explicitEnds.length > 0,
    interaction: proposal.nodes.some(
      (node) => reachable.has(node.id) && (node.type === "mechanic" || node.type === "decision"),
    ),
    outcome: healthyDecisions.length > 0,
    feedback: proposal.nodes.some(
      (node) => reachable.has(node.id) && (node.type === "reward" || node.type === "failure"),
    ),
    retry: proposal.nodes.some(
      (node) => reachable.has(node.id) && node.type === "failure" && reachesInteraction(node.id),
    ),
    completion: explicitEnds.some((id) => reachable.has(id)),
  }

  return {
    changes: {
      nodes: {
        added: listDifference(proposalNodes, currentNodes),
        removed: listDifference(currentNodes, proposalNodes),
      },
      connections: {
        added: listDifference(proposalConnections, currentConnections).length,
        removed: listDifference(currentConnections, proposalConnections).length,
      },
      notes: {
        added: listDifference(proposalNotes, currentNotes).length,
        removed: listDifference(currentNotes, proposalNotes).length,
      },
    },
    flow: {
      starts: labels(starts),
      ends: labels(ends),
      branches: labels(proposal.nodes.filter((node) => (outgoing.get(node.id) ?? 0) > 1).map((node) => node.id)),
      cycles: labels(cycleIDs),
      disconnected: labels(
        proposal.nodes
          .filter((node) => (incoming.get(node.id) ?? 0) === 0 && (outgoing.get(node.id) ?? 0) === 0)
          .map((node) => node.id),
      ),
      unreachable: labels(proposal.nodes.filter((node) => !reachable.has(node.id)).map((node) => node.id)),
      incompleteDecisions: labels(
        proposal.nodes
          .filter((node) => node.type === "decision" && (outgoing.get(node.id) ?? 0) < 2)
          .map((node) => node.id),
      ),
      ambiguousDecisions: labels(
        proposal.nodes
          .filter((node) => {
            if (node.type !== "decision") return false
            const connections = outgoingConnections.get(node.id) ?? []
            if (connections.length < 2) return false
            const labels = connections.map((connection) => comparisonKey(connection.label ?? ""))
            return labels.some((label) => !label) || new Set(labels).size !== labels.length
          })
          .map((node) => node.id),
      ),
      unexpectedDeadEnds: labels(
        proposal.nodes
          .filter(
            (node) =>
              (outgoing.get(node.id) ?? 0) === 0 &&
              node.type !== "end" &&
              node.type !== "reward" &&
              node.type !== "failure",
          )
          .map((node) => node.id),
      ),
      terminalFailures: labels(
        proposal.nodes
          .filter((node) => node.type === "failure" && (outgoing.get(node.id) ?? 0) === 0)
          .map((node) => node.id),
      ),
    },
    playable: {
      covered: playableChecks.filter((check) => playable[check]),
      missing: playableChecks.filter((check) => !playable[check]),
    },
  }
}

function listDifference(next: readonly string[], previous: readonly string[]) {
  const available = new Map<string, number>()
  previous.forEach((value) => available.set(comparisonKey(value), (available.get(comparisonKey(value)) ?? 0) + 1))
  return next.flatMap((value) => {
    const key = comparisonKey(value)
    const count = available.get(key) ?? 0
    if (count === 0) return [value]
    available.set(key, count - 1)
    return []
  })
}

function connectionKey(from: string, to: string, label?: string) {
  return `${comparisonKey(from)}\u0000${comparisonKey(to)}\u0000${comparisonKey(label ?? "")}`
}

function comparisonKey(value: string) {
  return value.replaceAll(/\s+/g, " ").trim().toLocaleLowerCase()
}

function normalizeNote(value: string) {
  return value.replace(/^\s*[•*-]\s*/, "").trim()
}

function repairIssue(label: string, nodes: readonly string[], chinese: boolean) {
  if (nodes.length === 0) return undefined
  const example = nodes[0]?.replaceAll(/\s+/g, " ").trim().slice(0, 48)
  const more = nodes.length - 1
  const suffix = more > 0 ? (chinese ? `（另有 ${more} 项）` : ` (+${more} more)`) : ""
  return `${label}: ${example}${suffix}`
}
