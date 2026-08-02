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
}

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
      cycles: labels(
        proposal.nodes.filter((node) => reachesStart(node.id, node.id, new Set([node.id]))).map((node) => node.id),
      ),
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
