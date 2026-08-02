import { parseWhiteboardProposal, type WhiteboardProposal } from "./whiteboard-proposal"
import { whiteboardPrompt } from "./whiteboard-prompt"

export const WHITEBOARD_CHAT_REQUEST_MAX_LENGTH = 800
export const WHITEBOARD_CHAT_CONTEXT_FILENAME = "km-agent-whiteboard-context.md"
export const WHITEBOARD_CHAT_CONTEXT_MARKER = "<!-- km-agent-whiteboard-context -->"

const requestStart = "<!-- km-agent-whiteboard-chat-request:start -->"
const requestEnd = "<!-- km-agent-whiteboard-chat-request:end -->"

export type WhiteboardChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  proposal?: WhiteboardProposal
}

export type WhiteboardChatSendInput = {
  request: string
  boardName: string
  sceneContext: string
  image?: File
}

export function whiteboardChatPrompt(request: string, chinese: boolean) {
  const clean = request
    .trim()
    .slice(0, WHITEBOARD_CHAT_REQUEST_MAX_LENGTH)
    .replaceAll(requestStart, "")
    .replaceAll(requestEnd, "")
  const task = clean || (chinese ? "完善当前白板" : "Refine the current board")
  return task
}

export function whiteboardChatContext(boardName: string, sceneContext: string, chinese: boolean) {
  return [
    WHITEBOARD_CHAT_CONTEXT_MARKER,
    chinese
      ? `你正在与游戏策划实时共创白板「${boardName}」。把用户要求理解为对当前完整白板的修改；保留未被要求改变且仍然成立的节点、连接和备注。先用简短文字说明修改，再输出可直接回写的完整白板方案。`
      : `You are co-editing the game-design board “${boardName}” in real time. Treat the request as an edit to the complete current board. Preserve every still-valid node, connection, and note that the user did not ask to change. Briefly explain the change, then output the complete board proposal that can be written back.`,
    whiteboardPrompt(chinese, "refine"),
    sceneContext.trim(),
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function whiteboardChatTranscript(
  messages: readonly { id: string; role: string }[],
  parts: Readonly<
    Record<string, readonly { type: string; text?: string; filename?: string; synthetic?: boolean }[] | undefined>
  >,
) {
  return messages.reduce<{ active: boolean; items: WhiteboardChatMessage[] }>(
    (result, message) => {
      const text = (parts[message.id] ?? [])
        .filter((part) => part.type === "text" && !!part.text && !part.synthetic)
        .map((part) => part.text)
        .join("\n\n")

      if (message.role === "user") {
        const request = whiteboardChatRequest(
          text,
          (parts[message.id] ?? []).some(
            (part) => part.type === "file" && part.filename === WHITEBOARD_CHAT_CONTEXT_FILENAME,
          ) ||
            (parts[message.id] ?? []).some(
              (part) => part.type === "text" && part.synthetic && part.text?.includes(WHITEBOARD_CHAT_CONTEXT_MARKER),
            ),
        )
        if (!request) return { ...result, active: false }
        return {
          active: true,
          items: [...result.items, { id: message.id, role: "user", text: request }],
        }
      }

      if (message.role !== "assistant" || !result.active || !text.trim()) return result
      return {
        active: false,
        items: [
          ...result.items,
          {
            id: message.id,
            role: "assistant",
            text: text.trim(),
            proposal: parseWhiteboardProposal(text),
          },
        ],
      }
    },
    { active: false, items: [] },
  ).items
}

export function whiteboardChatDisplayText(message: WhiteboardChatMessage, chinese: boolean) {
  const text = message.text.replace(/```(?:km-whiteboard|json)\s*\n?[\s\S]*?```/gi, "").trim()
  if (text) return text
  if (message.proposal) return chinese ? "已生成可编辑的白板方案。" : "An editable whiteboard proposal is ready."
  return message.text
}

function whiteboardChatRequest(source: string, tagged: boolean) {
  if (tagged) {
    return (
      source.replaceAll(`@${WHITEBOARD_CHAT_CONTEXT_FILENAME}`, "").trim().slice(0, WHITEBOARD_CHAT_REQUEST_MAX_LENGTH) ||
      undefined
    )
  }
  const start = source.indexOf(requestStart)
  if (start === -1) return undefined
  const contentStart = start + requestStart.length
  const end = source.indexOf(requestEnd, contentStart)
  if (end === -1) return undefined
  return source.slice(contentStart, end).trim().slice(0, WHITEBOARD_CHAT_REQUEST_MAX_LENGTH) || undefined
}
