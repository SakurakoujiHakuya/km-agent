export const maxWhiteboardFileBytes = 12 * 1024 * 1024

type WhiteboardFileInfo = Pick<File, "name" | "size" | "type">

export function whiteboardFileIssue(file: WhiteboardFileInfo) {
  if (file.size > maxWhiteboardFileBytes) return "too-large" as const
  const name = file.name.toLowerCase()
  if (
    name.endsWith(".excalidraw") ||
    name.endsWith(".json") ||
    file.type === "application/vnd.excalidraw+json" ||
    file.type === "application/json"
  )
    return
  return "unsupported" as const
}

export function whiteboardDownloadName(date = new Date()) {
  return `km-agent-board-${date.toISOString().slice(0, 19).replaceAll(":", "-")}.excalidraw`
}
