import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform"

export type WhiteboardProposalNodeType = "start" | "step" | "decision" | "mechanic" | "reward" | "failure" | "end"

export type WhiteboardProposal = {
  format: "km-agent-whiteboard"
  version: 1
  title: string
  nodes: {
    id: string
    type: WhiteboardProposalNodeType
    label: string
    column: number
    row: number
  }[]
  connections: {
    from: string
    to: string
    label?: string
  }[]
  notes: string[]
}

export type WhiteboardLiveDraft = {
  proposal: WhiteboardProposal
  complete: boolean
  eventCount: number
}

const nodeTypes: WhiteboardProposalNodeType[] = ["start", "step", "decision", "mechanic", "reward", "failure", "end"]
const idPattern = /^[a-zA-Z0-9_-]{1,48}$/
const maxSourceLength = 100_000
const maxNodes = 36
const maxConnections = 64
const maxNotes = 16

export function parseWhiteboardProposal(source: string | undefined): WhiteboardProposal | undefined {
  if (!source || source.length > maxSourceLength) return undefined
  const live = parseWhiteboardLiveDraft(source)
  if (live?.complete) return live.proposal
  const fenced = [...source.matchAll(/```(?:km-whiteboard|json)\s*\n?([\s\S]*?)```/gi)].map((match) => match[1] ?? "")
  return [...fenced, source]
    .toReversed()
    .flatMap((candidate) => parseProposalJSON(candidate.trim()) ?? [])
    .at(0)
}

export function parseWhiteboardLiveDraft(source: string | undefined): WhiteboardLiveDraft | undefined {
  if (!source || source.length > maxSourceLength) return undefined
  const block = [...source.matchAll(/```km-whiteboard-live\s*\n?([\s\S]*?)(?:```|$)/gi)].at(-1)?.[1]
  if (!block) return undefined
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxNodes + maxConnections + maxNotes + 4)
  const parsed = lines.map(parseLiveLine)
  const events = parsed.filter((event): event is Record<string, unknown> => !!event)
  const starts = events.filter((event) => event.op === "start")
  if (starts.length !== 1 || starts[0]?.format !== "km-agent-whiteboard-live" || starts[0]?.version !== 1)
    return undefined

  const nodeEvents = events.filter((event) => event.op === "node")
  if (nodeEvents.length === 0) return undefined
  const connectionEvents = events.filter((event) => event.op === "connection")
  const noteEvents = events.filter((event) => event.op === "note")
  const nodeIds = new Set(
    nodeEvents.flatMap((event) => (typeof event.id === "string" ? [event.id] : [])),
  )
  const connected = connectionEvents.filter(
    (event) =>
      typeof event.from === "string" &&
      typeof event.to === "string" &&
      nodeIds.has(event.from) &&
      nodeIds.has(event.to),
  )
  const proposal = parseProposal({
    format: "km-agent-whiteboard",
    version: 1,
    title: starts[0]?.title,
    nodes: nodeEvents.map(withoutLiveOperation),
    connections: connected.map(withoutLiveOperation),
    notes: noteEvents.map((event) => event.text),
  })
  if (!proposal) return undefined

  const done = events.findIndex((event) => event.op === "done")
  const complete =
    done === events.length - 1 &&
    connectionEvents.length === connected.length &&
    parsed.every((event, index) => !!event || (index === parsed.length - 1 && !lines[index]?.endsWith("}"))) &&
    events.filter((event) => event.op === "done").length === 1
  return {
    proposal,
    complete,
    eventCount: nodeEvents.length + connected.length + noteEvents.length,
  }
}

export function latestWhiteboardProposalText(
  messages: readonly { id: string; role: string }[],
  parts: Readonly<Record<string, readonly { type: string; text?: string }[] | undefined>>,
) {
  return messages
    .toReversed()
    .filter((message) => message.role === "assistant")
    .map((message) =>
      (parts[message.id] ?? [])
        .filter((part) => part.type === "text" && !!part.text?.trim())
        .map((part) => part.text)
        .join("\n\n"),
    )
    .find((text) => !!parseWhiteboardProposal(text))
}

export function whiteboardProposalElements(proposal: WhiteboardProposal): ExcalidrawElementSkeleton[] {
  const geometry = new Map(
    proposal.nodes.map((node) => {
      const width = 230
      const height = node.type === "decision" ? 126 : 96
      return [
        node.id,
        {
          id: `ai-node-${node.id}`,
          x: 60 + node.column * 300,
          y: 110 + node.row * 190,
          width,
          height,
        },
      ] as const
    }),
  )
  const maxRow = Math.max(...proposal.nodes.map((node) => node.row))
  const nodes = proposal.nodes.map((node): ExcalidrawElementSkeleton => {
    const shape = geometry.get(node.id)!
    const palette = proposalPalette(node.type)
    return {
      id: shape.id,
      type:
        node.type === "decision" ? "diamond" : node.type === "start" || node.type === "end" ? "ellipse" : "rectangle",
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      label: { text: node.label, fontSize: 19 },
      backgroundColor: palette.backgroundColor,
      strokeColor: palette.strokeColor,
      fillStyle: "solid",
      roughness: 1,
      roundness: node.type === "decision" || node.type === "start" || node.type === "end" ? null : { type: 3 },
      strokeWidth: 2,
    }
  })
  const connections = proposal.connections.map((connection, index): ExcalidrawElementSkeleton => {
    const start = geometry.get(connection.from)!
    const end = geometry.get(connection.to)!
    const deltaX = end.x + end.width / 2 - (start.x + start.width / 2)
    const deltaY = end.y + end.height / 2 - (start.y + start.height / 2)
    const startScale = 1 / Math.max(Math.abs(deltaX) / (start.width / 2), Math.abs(deltaY) / (start.height / 2))
    const endScale = 1 / Math.max(Math.abs(deltaX) / (end.width / 2), Math.abs(deltaY) / (end.height / 2))
    const x = start.x + start.width / 2 + deltaX * startScale
    const y = start.y + start.height / 2 + deltaY * startScale
    const endX = end.x + end.width / 2 - deltaX * endScale
    const endY = end.y + end.height / 2 - deltaY * endScale
    return {
      id: `ai-edge-${index + 1}`,
      type: "arrow",
      x,
      y,
      width: endX - x,
      height: endY - y,
      endArrowhead: "arrow",
      strokeColor: "#495057",
      strokeWidth: 2,
      start: { id: start.id },
      end: { id: end.id },
      label: connection.label ? { text: connection.label, fontSize: 15 } : undefined,
    }
  })
  const notes = proposal.notes.map(
    (note, index): ExcalidrawElementSkeleton => ({
      id: `ai-note-${index + 1}`,
      type: "text",
      text: `• ${note}`,
      x: 60,
      y: 110 + (maxRow + 1) * 190 + index * 42,
      fontSize: 18,
      strokeColor: "#495057",
    }),
  )
  return [
    {
      id: "ai-proposal-title",
      type: "text",
      text: proposal.title,
      x: 60,
      y: 28,
      fontSize: 30,
      strokeColor: "#1b1b1f",
    },
    ...nodes,
    ...connections,
    ...notes,
  ]
}

function parseProposalJSON(source: string) {
  if (!source.startsWith("{")) return undefined
  try {
    return parseProposal(JSON.parse(source))
  } catch {
    return undefined
  }
}

function parseLiveLine(source: string): Record<string, unknown> | undefined {
  if (!source.endsWith("}")) return undefined
  try {
    const value: unknown = JSON.parse(source)
    if (!isRecord(value)) return undefined
    if (typeof value.op !== "string") return undefined
    if (!new Set(["start", "node", "connection", "note", "done"]).has(value.op)) return undefined
    return value
  } catch {
    return undefined
  }
}

function withoutLiveOperation(event: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(event).filter(([key]) => key !== "op"))
}

function parseProposal(value: unknown): WhiteboardProposal | undefined {
  if (!isRecord(value) || value.format !== "km-agent-whiteboard" || value.version !== 1) return undefined
  const title = cleanText(value.title, 48)
  if (!title || !Array.isArray(value.nodes) || value.nodes.length === 0 || value.nodes.length > maxNodes)
    return undefined
  if (!Array.isArray(value.connections) || value.connections.length > maxConnections) return undefined
  if (value.notes !== undefined && (!Array.isArray(value.notes) || value.notes.length > maxNotes)) return undefined

  const nodes = value.nodes.flatMap((node) => parseNode(node) ?? [])
  if (nodes.length !== value.nodes.length) return undefined
  if (new Set(nodes.map((node) => node.id)).size !== nodes.length) return undefined
  if (new Set(nodes.map((node) => `${node.column}:${node.row}`)).size !== nodes.length) return undefined

  const nodeIds = new Set(nodes.map((node) => node.id))
  const connections = value.connections.flatMap((connection) => parseConnection(connection, nodeIds) ?? [])
  if (connections.length !== value.connections.length) return undefined
  const notes = (value.notes ?? []).flatMap((note) => cleanText(note, 200) ?? [])
  if (notes.length !== (value.notes ?? []).length) return undefined
  return { format: "km-agent-whiteboard", version: 1, title, nodes, connections, notes }
}

function parseNode(value: unknown): WhiteboardProposal["nodes"][number] | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || !idPattern.test(value.id)) return undefined
  if (!isProposalNodeType(value.type)) return undefined
  const label = cleanText(value.label, 120)
  if (!label || !position(value.column, 7) || !position(value.row, 9)) return undefined
  return {
    id: value.id,
    type: value.type,
    label,
    column: value.column,
    row: value.row,
  }
}

function parseConnection(
  value: unknown,
  nodeIds: ReadonlySet<string>,
): WhiteboardProposal["connections"][number] | undefined {
  if (!isRecord(value) || typeof value.from !== "string" || typeof value.to !== "string") return undefined
  if (!nodeIds.has(value.from) || !nodeIds.has(value.to) || value.from === value.to) return undefined
  if (value.label !== undefined && typeof value.label !== "string") return undefined
  const label = value.label === undefined ? undefined : cleanText(value.label, 80)
  return { from: value.from, to: value.to, label }
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return undefined
  const text = value.replaceAll(/\s+/g, " ").trim().slice(0, max)
  return text || undefined
}

function isProposalNodeType(value: unknown): value is WhiteboardProposalNodeType {
  return nodeTypes.some((type) => type === value)
}

function position(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function proposalPalette(type: WhiteboardProposalNodeType) {
  if (type === "start" || type === "end" || type === "reward")
    return { backgroundColor: "#ebfbee", strokeColor: "#2b8a3e" }
  if (type === "decision") return { backgroundColor: "#fff9db", strokeColor: "#f08c00" }
  if (type === "mechanic") return { backgroundColor: "#f3f0ff", strokeColor: "#7048e8" }
  if (type === "failure") return { backgroundColor: "#fff4e6", strokeColor: "#d9480f" }
  return { backgroundColor: "#e7f5ff", strokeColor: "#1971c2" }
}
