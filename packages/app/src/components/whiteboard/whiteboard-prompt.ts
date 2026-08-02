import type { ContentPart } from "@/context/prompt"

export type WhiteboardHandoffIntent = "review" | "plan" | "refine" | "implement"

const WHITEBOARD_PROMPTS = {
  review: {
    zh: "请先识别白板中的所有节点、标签、箭头、分支和循环，仅做设计评审：分析游戏机制、关卡流程、机关谜题与交互关系，指出矛盾、不明确的假设、体验风险与优先改进项。不要修改项目文件。",
    en: "First identify every node, label, arrow, branch, and loop in the whiteboard. Perform a design review only: analyze the game mechanics, level flow, puzzles, and interactions, then identify contradictions, ambiguous assumptions, experience risks, and prioritized improvements. Do not modify project files.",
  },
  plan: {
    zh: "请先识别白板中的所有节点、标签、箭头、分支和循环，分析其中的游戏机制、关卡流程、机关谜题与交互关系，并整理为可执行实现计划：列出目标文件或组件、机制与状态、验收标准和试玩步骤。除非我明确要求，否则不要修改项目文件。",
    en: "First identify every node, label, arrow, branch, and loop in the whiteboard. Analyze the game mechanics, level flow, puzzles, and interactions, then produce an actionable implementation plan covering target files or components, mechanics and state, acceptance criteria, and playtest steps. Do not modify project files unless I explicitly ask.",
  },
  refine: {
    zh: `请先识别白板中的所有节点、标签、箭头、分支和循环，在保留原意的基础上补全关卡或谜题设计。不要修改项目文件。请在回答末尾给出一个可回写到创意白板的 \`\`\`km-whiteboard JSON 代码块，严格使用以下结构：
{"format":"km-agent-whiteboard","version":1,"title":"方案名称","nodes":[{"id":"start","type":"start","label":"节点文字","column":0,"row":0}],"connections":[{"from":"start","to":"next","label":"可选条件"}],"notes":["策划备注"]}
节点 type 只能是 start、step、decision、mechanic、reward、failure、end；column 为 0-7、row 为 0-9 的整数，每个位置只能有一个节点；引用必须指向已声明节点。JSON 中不要加入注释或额外字段。`,
    en: `First identify every node, label, arrow, branch, and loop in the whiteboard, then complete the level or puzzle design while preserving the designer's intent. Do not modify project files. End the response with a \`\`\`km-whiteboard JSON code block using exactly this structure:
{"format":"km-agent-whiteboard","version":1,"title":"Proposal name","nodes":[{"id":"start","type":"start","label":"Node text","column":0,"row":0}],"connections":[{"from":"start","to":"next","label":"Optional condition"}],"notes":["Design note"]}
Node type must be start, step, decision, mechanic, reward, failure, or end. column must be an integer from 0-7 and row from 0-9, with one node per position. Every reference must target a declared node. Do not add comments or extra fields inside the JSON.`,
  },
  implement: {
    zh: "请先识别白板中的所有节点、标签、箭头、分支和循环，分析其中的游戏机制、关卡流程、机关谜题与交互关系；指出不明确的假设，整理成可执行方案，再在当前项目中实现一个可运行的创意 Demo。",
    en: "First identify every node, label, arrow, branch, and loop in the whiteboard. Analyze its game mechanics, level flow, puzzles, and interactions; call out ambiguous assumptions, turn the result into an actionable plan, then implement a playable creative demo in the current project.",
  },
} as const

export function whiteboardPrompt(chinese: boolean, intent: WhiteboardHandoffIntent = "implement") {
  return WHITEBOARD_PROMPTS[intent][chinese ? "zh" : "en"]
}

export function whiteboardAgent(intent: WhiteboardHandoffIntent) {
  return intent === "implement" ? "build" : "plan"
}

export function whiteboardProjectDirectory(activeDirectory: string, projectDirectory?: string) {
  return projectDirectory || activeDirectory
}

export function mergeWhiteboardText(current: string, content: string, sceneContext?: string) {
  const action = content.trim()
  const context = sceneContext?.trim()
  const sections = current.trim() ? [current.trimEnd()] : []
  if (action && !current.includes(action)) sections.push(action)
  if (context && !current.includes(context)) sections.push(context)
  return sections.join("\n\n")
}

export function seedWhiteboardPrompt(prompt: ContentPart[], content: string, sceneContext?: string) {
  const filled = prompt.findIndex((part) => part.type === "text" && part.content.trim())
  const index = filled >= 0 ? filled : prompt.findIndex((part) => part.type === "text")
  const current = index >= 0 && prompt[index]?.type === "text" ? prompt[index].content : ""
  const merged = mergeWhiteboardText(current, content, sceneContext)
  if (merged === current) return prompt
  const next = [...prompt]
  if (index === -1) next.unshift({ type: "text", content: merged, start: 0, end: merged.length })
  else {
    const part = next[index]
    if (part?.type !== "text") return prompt
    next[index] = { ...part, content: merged, end: part.start + merged.length }
  }
  return next
}
