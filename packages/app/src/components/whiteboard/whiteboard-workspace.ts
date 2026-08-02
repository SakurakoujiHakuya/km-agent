export const WHITEBOARD_BOARD_MAX_COUNT = 12
export const WHITEBOARD_BOARD_NAME_MAX_LENGTH = 48

export type WhiteboardBoard = {
  id: string
  name: string
}

export type WhiteboardWorkspace = {
  version: 1
  active: string
  boards: WhiteboardBoard[]
}

const boardId = /^[a-zA-Z0-9_-]{1,64}$/

export function defaultWhiteboardWorkspace(chinese: boolean): WhiteboardWorkspace {
  return {
    version: 1,
    active: "main",
    boards: [{ id: "main", name: chinese ? "主白板" : "Main board" }],
  }
}

export function parseWhiteboardWorkspace(value: string | null, chinese: boolean): WhiteboardWorkspace {
  const fallback = defaultWhiteboardWorkspace(chinese)
  if (!value) return fallback
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback
    const fields = Object.fromEntries(Object.entries(parsed))
    if (fields.version !== 1 || !Array.isArray(fields.boards)) return fallback
    const seen = new Set<string>()
    const boards = fields.boards
      .flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return []
        const board = Object.fromEntries(Object.entries(item))
        if (typeof board.id !== "string" || !boardId.test(board.id) || seen.has(board.id)) return []
        seen.add(board.id)
        return [{ id: board.id, name: whiteboardBoardName(board.name, chinese ? "未命名白板" : "Untitled board") }]
      })
      .slice(0, WHITEBOARD_BOARD_MAX_COUNT)
    if (boards.length === 0) return fallback
    const active =
      typeof fields.active === "string" && boards.some((board) => board.id === fields.active)
        ? fields.active
        : boards[0].id
    return { version: 1, active, boards }
  } catch {
    return fallback
  }
}

export function addWhiteboardBoard(workspace: WhiteboardWorkspace, id: string, chinese: boolean) {
  if (
    workspace.boards.length >= WHITEBOARD_BOARD_MAX_COUNT ||
    !boardId.test(id) ||
    workspace.boards.some((board) => board.id === id)
  )
    return workspace
  const board = { id, name: `${chinese ? "白板" : "Board"} ${workspace.boards.length + 1}` }
  return { ...workspace, active: id, boards: [...workspace.boards, board] }
}

export function activateWhiteboardBoard(workspace: WhiteboardWorkspace, id: string) {
  if (workspace.active === id || !workspace.boards.some((board) => board.id === id)) return workspace
  return { ...workspace, active: id }
}

export function renameWhiteboardBoard(workspace: WhiteboardWorkspace, id: string, name: string) {
  const current = workspace.boards.find((board) => board.id === id)
  if (!current) return workspace
  const next = whiteboardBoardName(name, current.name)
  if (next === current.name) return workspace
  return { ...workspace, boards: workspace.boards.map((board) => (board.id === id ? { ...board, name: next } : board)) }
}

export function removeWhiteboardBoard(workspace: WhiteboardWorkspace, id: string) {
  if (workspace.boards.length <= 1) return workspace
  const index = workspace.boards.findIndex((board) => board.id === id)
  if (index === -1) return workspace
  const boards = workspace.boards.filter((board) => board.id !== id)
  const active =
    workspace.active === id ? (boards[Math.min(index, boards.length - 1)]?.id ?? boards[0].id) : workspace.active
  return { ...workspace, active, boards }
}

export function whiteboardWorkspaceStorageKey(storageKey: string) {
  return `${storageKey}:workspace:v1`
}

export function whiteboardBoardStorageKey(storageKey: string, id: string) {
  if (id === "main") return storageKey
  return `${storageKey}:board:${encodeURIComponent(id)}`
}

function whiteboardBoardName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback
  return value.replaceAll(/\s+/g, " ").trim().slice(0, WHITEBOARD_BOARD_NAME_MAX_LENGTH) || fallback
}
