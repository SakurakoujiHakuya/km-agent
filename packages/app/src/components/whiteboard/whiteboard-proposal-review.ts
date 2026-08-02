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
    unexpectedDeadEnds: string[]
    terminalFailures: string[]
  }
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
  proposal.connections.forEach((connection) => {
    incoming.set(connection.to, (incoming.get(connection.to) ?? 0) + 1)
    outgoing.set(connection.from, (outgoing.get(connection.from) ?? 0) + 1)
    adjacency.get(connection.from)?.push(connection.to)
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
        proposal.nodes
          .filter((node) => reachesStart(node.id, node.id, new Set([node.id])))
          .map((node) => node.id),
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
