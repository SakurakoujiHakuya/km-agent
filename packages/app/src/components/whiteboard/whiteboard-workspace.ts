export const WHITEBOARD_BOARD_MAX_COUNT = 12
export const WHITEBOARD_BOARD_NAME_MAX_LENGTH = 48
export const WHITEBOARD_BOARD_CHAT_MESSAGE_MAX_COUNT = 32

export type WhiteboardBoard = {
  id: string
  name: string
  chatMessageIDs?: string[]
}

export type WhiteboardChatVersion = {
  boardID: string
  boardName: string
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
    const seenChatMessages = new Set<string>()
    const boards = fields.boards
      .flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return []
        const board = Object.fromEntries(Object.entries(item))
        if (typeof board.id !== "string" || !boardId.test(board.id) || seen.has(board.id)) return []
        seen.add(board.id)
        const chatMessageIDs = Array.isArray(board.chatMessageIDs)
          ? board.chatMessageIDs
              .filter((messageID): messageID is string => whiteboardChatMessageID(messageID))
              .slice(-WHITEBOARD_BOARD_CHAT_MESSAGE_MAX_COUNT)
              .filter((messageID) => {
                if (seenChatMessages.has(messageID)) return false
                seenChatMessages.add(messageID)
                return true
              })
          : []
        return [
          {
            id: board.id,
            name: whiteboardBoardName(board.name, chinese ? "未命名白板" : "Untitled board"),
            ...(chatMessageIDs.length > 0 ? { chatMessageIDs } : {}),
          },
        ]
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

export function linkWhiteboardChatMessage(workspace: WhiteboardWorkspace, id: string, messageID: string) {
  if (!workspace.boards.some((board) => board.id === id) || !whiteboardChatMessageID(messageID)) return workspace
  const current = whiteboardChatVersions(workspace)[messageID]
  if (current?.boardID === id) return workspace
  return {
    ...workspace,
    boards: workspace.boards.map((board) => {
      const messages = (board.chatMessageIDs ?? []).filter((value) => value !== messageID)
      if (board.id === id) messages.push(messageID)
      const next = messages.slice(-WHITEBOARD_BOARD_CHAT_MESSAGE_MAX_COUNT)
      const { chatMessageIDs: _, ...rest } = board
      return next.length > 0 ? { ...rest, chatMessageIDs: next } : rest
    }),
  }
}

export function whiteboardChatVersions(workspace: WhiteboardWorkspace) {
  const versions: Record<string, WhiteboardChatVersion> = {}
  workspace.boards.forEach((board) =>
    board.chatMessageIDs?.forEach((messageID) => {
      versions[messageID] = { boardID: board.id, boardName: board.name }
    }),
  )
  return versions
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

function whiteboardChatMessageID(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && !/\s/.test(value)
}
