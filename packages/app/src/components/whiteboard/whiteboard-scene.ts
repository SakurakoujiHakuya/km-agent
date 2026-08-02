export type WhiteboardSceneElement = {
  id: string
  type: string
  x: number
  y: number
  isDeleted: boolean
  text?: string
  containerId?: string | null
  boundElements?: readonly { id: string; type: string }[] | null
  frameId?: string | null
  groupIds?: readonly string[]
  startBinding?: { elementId: string } | null
  endBinding?: { elementId: string } | null
}

export type WhiteboardSceneScope = "all" | "selection"

export type WhiteboardSceneSummary = {
  nodes: { ref: string; type: string; label: string }[]
  connections: { from: string; to: string; label?: string }[]
  notes: string[]
}

export type WhiteboardSceneDiagnostics = {
  elementCount: number
  nodeCount: number
  connectionCount: number
  noteCount: number
  unlabeled: string[]
  disconnected: string[]
  starts: string[]
  ends: string[]
  branches: string[]
  merges: string[]
  cycles: string[]
}

const nodeTypes = new Set(["rectangle", "diamond", "ellipse"])
const connectionTypes = new Set(["arrow", "line"])
const nodeLimit = 48
const connectionLimit = 64
const noteLimit = 24
const textLimit = 180
const outputLimit = 6000

function cleanText(value: string) {
  return value.replaceAll(/\s+/g, " ").trim().slice(0, textLimit)
}

export function whiteboardSceneDecorations<Element extends WhiteboardSceneElement>(elements: readonly Element[]) {
  const visible = elements.filter((element) => !element.isDeleted)
  const nodes = new Set(visible.filter((element) => nodeTypes.has(element.type)).map((element) => element.id))
  const managed = new Set(nodes)

  for (const element of visible) {
    if (element.id.startsWith("ai-")) {
      managed.add(element.id)
      continue
    }
    if (element.type === "text" && !element.containerId) managed.add(element.id)
    if (
      connectionTypes.has(element.type) &&
      element.startBinding?.elementId &&
      element.endBinding?.elementId &&
      nodes.has(element.startBinding.elementId) &&
      nodes.has(element.endBinding.elementId)
    )
      managed.add(element.id)
  }

  for (const element of visible) {
    if (element.type === "text" && element.containerId && managed.has(element.containerId)) managed.add(element.id)
  }

  return visible.filter((element) => !managed.has(element.id))
}

export function selectWhiteboardSceneElements<Element extends WhiteboardSceneElement>(
  elements: readonly Element[],
  selectedElementIds: Readonly<Record<string, boolean>>,
) {
  const visible = elements.filter((element) => !element.isDeleted)
  const byId = new Map(visible.map((element) => [element.id, element]))
  const selected = new Set(Object.keys(selectedElementIds).filter((id) => selectedElementIds[id] && byId.has(id)))
  if (selected.size === 0) return []

  let changed = true
  while (changed) {
    const before = selected.size
    const groups = new Set(
      visible.filter((element) => selected.has(element.id)).flatMap((element) => element.groupIds ?? []),
    )
    for (const element of visible) {
      if (element.groupIds?.some((id) => groups.has(id))) selected.add(element.id)
      if (element.frameId && selected.has(element.frameId)) selected.add(element.id)
      if (element.type === "text" && element.containerId) {
        if (selected.has(element.id)) selected.add(element.containerId)
        if (selected.has(element.containerId)) selected.add(element.id)
      }
      if (selected.has(element.id)) {
        for (const bound of element.boundElements ?? []) {
          if (bound.type === "text") selected.add(bound.id)
        }
        if (connectionTypes.has(element.type)) {
          if (element.startBinding?.elementId) selected.add(element.startBinding.elementId)
          if (element.endBinding?.elementId) selected.add(element.endBinding.elementId)
        }
      }
      if (
        connectionTypes.has(element.type) &&
        element.startBinding?.elementId &&
        element.endBinding?.elementId &&
        selected.has(element.startBinding.elementId) &&
        selected.has(element.endBinding.elementId)
      ) {
        selected.add(element.id)
      }
    }
    changed = selected.size !== before
  }

  return visible.filter((element) => selected.has(element.id))
}

export function summarizeWhiteboardScene(elements: readonly WhiteboardSceneElement[]): WhiteboardSceneSummary {
  const visible = elements.filter((element) => !element.isDeleted)
  const labels = new Map(
    visible.flatMap((element) => {
      if (element.type !== "text" || typeof element.containerId !== "string" || typeof element.text !== "string")
        return []
      return [[element.containerId, cleanText(element.text)] as const]
    }),
  )
  const shapes = visible
    .filter((element) => nodeTypes.has(element.type))
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
    .slice(0, nodeLimit)
  const refs = new Map(shapes.map((element, index) => [element.id, `N${index + 1}`]))

  const nodes = shapes.map((element, index) => ({
    ref: `N${index + 1}`,
    type: element.type,
    label: labels.get(element.id) || "",
  }))
  const connections = visible
    .filter((element) => connectionTypes.has(element.type))
    .flatMap((element) => {
      const from = element.startBinding?.elementId ? refs.get(element.startBinding.elementId) : undefined
      const to = element.endBinding?.elementId ? refs.get(element.endBinding.elementId) : undefined
      if (!from || !to) return []
      const label = labels.get(element.id)
      return [{ from, to, label: label || undefined }]
    })
    .slice(0, connectionLimit)
  const notes = visible
    .flatMap((element) => {
      if (element.type !== "text" || element.containerId || typeof element.text !== "string") return []
      return [cleanText(element.text)]
    })
    .filter(Boolean)
    .slice(0, noteLimit)

  return { nodes, connections, notes }
}

export function inspectWhiteboardScene(elements: readonly WhiteboardSceneElement[]): WhiteboardSceneDiagnostics {
  const summary = summarizeWhiteboardScene(elements)
  const incoming = new Map(summary.nodes.map((node) => [node.ref, 0]))
  const outgoing = new Map(summary.nodes.map((node) => [node.ref, 0]))
  const adjacency = new Map(summary.nodes.map((node) => [node.ref, [] as string[]]))
  summary.connections.forEach((connection) => {
    incoming.set(connection.to, (incoming.get(connection.to) ?? 0) + 1)
    outgoing.set(connection.from, (outgoing.get(connection.from) ?? 0) + 1)
    adjacency.get(connection.from)?.push(connection.to)
  })
  const disconnected = summary.nodes
    .filter((node) => (incoming.get(node.ref) ?? 0) === 0 && (outgoing.get(node.ref) ?? 0) === 0)
    .map((node) => node.ref)
  const reachesStart = (start: string, current: string, visited: ReadonlySet<string>): boolean =>
    (adjacency.get(current) ?? []).some(
      (next) => next === start || (!visited.has(next) && reachesStart(start, next, new Set([...visited, next]))),
    )

  return {
    elementCount: elements.filter((element) => !element.isDeleted).length,
    nodeCount: summary.nodes.length,
    connectionCount: summary.connections.length,
    noteCount: summary.notes.length,
    unlabeled: summary.nodes.filter((node) => !node.label).map((node) => node.ref),
    disconnected,
    starts: summary.nodes
      .filter((node) => (incoming.get(node.ref) ?? 0) === 0 && (outgoing.get(node.ref) ?? 0) > 0)
      .map((node) => node.ref),
    ends: summary.nodes
      .filter((node) => (outgoing.get(node.ref) ?? 0) === 0 && (incoming.get(node.ref) ?? 0) > 0)
      .map((node) => node.ref),
    branches: summary.nodes.filter((node) => (outgoing.get(node.ref) ?? 0) > 1).map((node) => node.ref),
    merges: summary.nodes.filter((node) => (incoming.get(node.ref) ?? 0) > 1).map((node) => node.ref),
    cycles: summary.nodes
      .filter((node) => reachesStart(node.ref, node.ref, new Set([node.ref])))
      .map((node) => node.ref),
  }
}

export function formatWhiteboardScene(
  elements: readonly WhiteboardSceneElement[],
  chinese: boolean,
  scope: WhiteboardSceneScope = "all",
) {
  const summary = summarizeWhiteboardScene(elements)
  const diagnostics = inspectWhiteboardScene(elements)
  if (summary.nodes.length === 0 && summary.connections.length === 0 && summary.notes.length === 0) return ""

  const types = chinese
    ? { rectangle: "矩形", diamond: "菱形", ellipse: "椭圆" }
    : { rectangle: "rectangle", diamond: "diamond", ellipse: "ellipse" }
  const lines = [
    scope === "selection"
      ? chinese
        ? "白板选区结构化上下文（仅包含策划选中的局部，请与选区图片一起理解）："
        : "Structured whiteboard selection (only the designer-selected area; interpret with the selection image):"
      : chinese
        ? "白板结构化上下文（自动提取，请与白板图片一起理解）："
        : "Structured whiteboard context (auto-extracted; interpret together with the board image):",
  ]
  if (summary.nodes.length > 0) {
    lines.push(chinese ? "节点：" : "Nodes:")
    for (const node of summary.nodes) {
      const type =
        node.type === "rectangle"
          ? types.rectangle
          : node.type === "diamond"
            ? types.diamond
            : node.type === "ellipse"
              ? types.ellipse
              : node.type
      const label = node.label || (chinese ? "未命名" : "Unlabeled")
      lines.push(`- ${node.ref} [${type}] ${label}`)
    }
  }
  if (summary.connections.length > 0) {
    lines.push(chinese ? "连接：" : "Connections:")
    for (const connection of summary.connections) {
      lines.push(`- ${connection.from} -> ${connection.to}${connection.label ? ` (${connection.label})` : ""}`)
    }
  }
  const checks = [
    diagnostics.starts.length > 0
      ? `${chinese ? "起点候选" : "Start candidates"}: ${diagnostics.starts.join(", ")}`
      : "",
    diagnostics.ends.length > 0 ? `${chinese ? "终点候选" : "End candidates"}: ${diagnostics.ends.join(", ")}` : "",
    diagnostics.branches.length > 0
      ? `${chinese ? "分支节点" : "Branch nodes"}: ${diagnostics.branches.join(", ")}`
      : "",
    diagnostics.merges.length > 0 ? `${chinese ? "汇合节点" : "Merge nodes"}: ${diagnostics.merges.join(", ")}` : "",
    diagnostics.cycles.length > 0 ? `${chinese ? "循环节点" : "Cycle nodes"}: ${diagnostics.cycles.join(", ")}` : "",
    diagnostics.unlabeled.length > 0
      ? `${chinese ? "未命名节点" : "Unlabeled nodes"}: ${diagnostics.unlabeled.join(", ")}`
      : "",
    diagnostics.disconnected.length > 0
      ? `${chinese ? "孤立节点" : "Disconnected nodes"}: ${diagnostics.disconnected.join(", ")}`
      : "",
  ].filter(Boolean)
  if (checks.length > 0) {
    lines.push(chinese ? "结构检查：" : "Structure checks:")
    checks.forEach((check) => lines.push(`- ${check}`))
  }
  if (summary.notes.length > 0) {
    lines.push(chinese ? "独立文字：" : "Standalone text:")
    for (const note of summary.notes) lines.push(`- ${note}`)
  }

  const output = lines.join("\n")
  if (output.length <= outputLimit) return output
  return `${output.slice(0, outputLimit - 2)}\n…`
}
