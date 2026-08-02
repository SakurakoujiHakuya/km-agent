import {
  parseWhiteboardLiveDraft,
  parseWhiteboardProposal,
  type WhiteboardLiveDraft,
  type WhiteboardProposal,
} from "./whiteboard-proposal"
import type { WhiteboardSceneScope } from "./whiteboard-scene"

export const WHITEBOARD_CHAT_REQUEST_MAX_LENGTH = 800
export const WHITEBOARD_CHAT_CONTEXT_FILENAME = "km-agent-whiteboard-context.md"
export const WHITEBOARD_CHAT_CONTEXT_MARKER = "<!-- km-agent-whiteboard-context -->"

const requestStart = "<!-- km-agent-whiteboard-chat-request:start -->"
const requestEnd = "<!-- km-agent-whiteboard-chat-request:end -->"

export type WhiteboardChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  draft?: WhiteboardLiveDraft
  proposal?: WhiteboardProposal
}

export type WhiteboardChatSendInput = {
  request: string
  boardName: string
  sceneContext: string
  scope: WhiteboardSceneScope
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

export function whiteboardChatContext(
  boardName: string,
  sceneContext: string,
  chinese: boolean,
  scope: WhiteboardSceneScope = "all",
) {
  return [
    WHITEBOARD_CHAT_CONTEXT_MARKER,
    whiteboardChatScopeInstruction(boardName, chinese, scope),
    whiteboardLiveProposalInstruction(chinese),
    sceneContext.trim(),
  ]
    .filter(Boolean)
    .join("\n\n")
}

function whiteboardLiveProposalInstruction(chinese: boolean) {
  if (chinese) {
    return `先识别白板中的所有节点、标签、箭头、分支和循环，在保留原意的基础上完成修改。不要修改项目文件。简短说明后，输出一个 \`\`\`km-whiteboard-live 代码块；每行只能包含一个完整 JSON 对象，并严格按以下顺序输出：
{"op":"start","format":"km-agent-whiteboard-live","version":1,"title":"方案名称"}
{"op":"node","id":"start","type":"start","label":"节点文字","column":0,"row":0}
{"op":"connection","from":"start","to":"next","label":"可选条件"}
{"op":"note","text":"策划备注"}
{"op":"done"}
先输出全部 node，再输出 connection、note 和唯一的 done。节点 type 只能是 start、step、decision、mechanic、reward、failure、end；column 为 0-7、row 为 0-9 的整数且位置不得重复；引用必须指向已声明节点。不要输出数组、注释、空行或额外字段。`
  }
  return `First identify every node, label, arrow, branch, and loop, then make the requested edit while preserving the designer's intent. Do not modify project files. After a short explanation, output one \`\`\`km-whiteboard-live code block with exactly one complete JSON object per line in this order:
{"op":"start","format":"km-agent-whiteboard-live","version":1,"title":"Proposal name"}
{"op":"node","id":"start","type":"start","label":"Node text","column":0,"row":0}
{"op":"connection","from":"start","to":"next","label":"Optional condition"}
{"op":"note","text":"Design note"}
{"op":"done"}
Output every node first, followed by connections, notes, and exactly one done event. Node type must be start, step, decision, mechanic, reward, failure, or end. column must be 0-7 and row 0-9, with no duplicate position. References must target declared nodes. Do not output arrays, comments, blank lines, or extra fields.`
}

function whiteboardChatScopeInstruction(boardName: string, chinese: boolean, scope: WhiteboardSceneScope) {
  if (scope === "selection") {
    return chinese
      ? `你正在与游戏策划实时共创白板「${boardName}」。本次只修改“白板选区结构化上下文”中的内容；除非为保持连接完整绝对必要，不要改动完整白板中的其他节点、连接或备注。最终必须输出包含所有保留内容的完整白板方案，不能只返回选区。先用简短文字说明局部修改。`
      : `You are co-editing the game-design board “${boardName}” in real time. For this turn, edit only the content in “Structured whiteboard selection.” Do not change other nodes, connections, or notes from the complete board unless strictly required to keep connections valid. The final proposal must contain the complete board with all preserved content, not only the selection. Briefly explain the focused edit first.`
  }
  return chinese
    ? `你正在与游戏策划实时共创白板「${boardName}」。把用户要求理解为对当前完整白板的修改；保留未被要求改变且仍然成立的节点、连接和备注。先用简短文字说明修改，再输出可直接回写的完整白板方案。`
    : `You are co-editing the game-design board “${boardName}” in real time. Treat the request as an edit to the complete current board. Preserve every still-valid node, connection, and note that the user did not ask to change. Briefly explain the change, then output the complete board proposal that can be written back.`
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
      const draft = parseWhiteboardLiveDraft(text)
      return {
        active: false,
        items: [
          ...result.items,
          {
            id: message.id,
            role: "assistant",
            text: text.trim(),
            draft,
            proposal: draft?.complete ? draft.proposal : parseWhiteboardProposal(text),
          },
        ],
      }
    },
    { active: false, items: [] },
  ).items
}

export function whiteboardChatDisplayText(message: WhiteboardChatMessage, chinese: boolean, active = true) {
  const text = message.text.replace(/```(?:km-whiteboard-live|km-whiteboard|json)\s*\n?[\s\S]*?(?:```|$)/gi, "").trim()
  if (text) return text
  if (message.draft && !message.draft.complete) {
    if (active) return chinese ? "AI 正在实时搭建白板…" : "AI is building the board live…"
    return chinese ? "已保留可编辑的部分白板草稿。" : "An editable partial board draft was kept."
  }
  if (message.proposal) return chinese ? "已生成可编辑的白板方案。" : "An editable whiteboard proposal is ready."
  return message.text
}

export function whiteboardChatEditableProposal(message: WhiteboardChatMessage) {
  return message.proposal ?? message.draft?.proposal ?? parseWhiteboardProposal(message.text)
}

export function whiteboardChatActiveDraftID(messages: readonly WhiteboardChatMessage[], working: boolean) {
  if (!working) return undefined
  const latest = messages.at(-1)
  if (latest?.role !== "assistant" || !latest.draft || latest.proposal) return undefined
  return latest.id
}

export function whiteboardChatTurnWorking(
  messages: readonly WhiteboardChatMessage[],
  latestSessionUserMessageID: string | undefined,
  working: boolean,
) {
  if (!working) return false
  const latestUser = messages.toReversed().find((message) => message.role === "user")
  if (!latestUser || latestUser.id !== latestSessionUserMessageID) return false
  const latest = messages.at(-1)
  if (!latest) return false
  if (latest.role === "user") return true
  return !!latest.draft && !latest.proposal
}

export function whiteboardChatCanCompose(sending: boolean, working: boolean, canStop: boolean, stopping = false) {
  return !sending && !stopping && (!working || canStop)
}

function whiteboardChatRequest(source: string, tagged: boolean) {
  if (tagged) {
    return (
      source
        .replaceAll(`@${WHITEBOARD_CHAT_CONTEXT_FILENAME}`, "")
        .trim()
        .slice(0, WHITEBOARD_CHAT_REQUEST_MAX_LENGTH) || undefined
    )
  }
  const start = source.indexOf(requestStart)
  if (start === -1) return undefined
  const contentStart = start + requestStart.length
  const end = source.indexOf(requestEnd, contentStart)
  if (end === -1) return undefined
  return source.slice(contentStart, end).trim().slice(0, WHITEBOARD_CHAT_REQUEST_MAX_LENGTH) || undefined
}
