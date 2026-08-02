import { describe, expect, test } from "bun:test"
import {
  activateWhiteboardBoard,
  addWhiteboardBoard,
  defaultWhiteboardWorkspace,
  linkWhiteboardChatMessage,
  parseWhiteboardWorkspace,
  removeWhiteboardBoard,
  renameWhiteboardBoard,
  WHITEBOARD_BOARD_MAX_COUNT,
  whiteboardBoardStorageKey,
  whiteboardChatVersions,
  whiteboardWorkspaceStorageKey,
} from "./whiteboard-workspace"

describe("multi-board whiteboard workspace", () => {
  test("migrates the existing scene into a stable default board", () => {
    expect(parseWhiteboardWorkspace(null, true)).toEqual({
      version: 1,
      active: "main",
      boards: [{ id: "main", name: "主白板" }],
    })
    expect(whiteboardBoardStorageKey("project-board", "main")).toBe("project-board")
    expect(whiteboardWorkspaceStorageKey("project-board")).toBe("project-board:workspace:v1")
  })

  test("sanitizes persisted boards, duplicate IDs, names, and active selection", () => {
    expect(
      parseWhiteboardWorkspace(
        JSON.stringify({
          version: 1,
          active: "missing",
          boards: [
            { id: "level-1", name: "  入口   教学  " },
            { id: "level-1", name: "duplicate" },
            { id: "bad:id", name: "bad" },
          ],
        }),
        true,
      ),
    ).toEqual({ version: 1, active: "level-1", boards: [{ id: "level-1", name: "入口 教学" }] })
  })

  test("persists one traceable board version for each bounded AI chat message", () => {
    const parsed = parseWhiteboardWorkspace(
      JSON.stringify({
        version: 1,
        active: "draft",
        boards: [
          { id: "main", name: "Main", chatMessageIDs: ["msg_old", "bad id", "msg_shared"] },
          { id: "draft", name: "AI draft", chatMessageIDs: ["msg_shared", "msg_draft", 42] },
        ],
      }),
      false,
    )
    expect(parsed.boards).toEqual([
      { id: "main", name: "Main", chatMessageIDs: ["msg_old", "msg_shared"] },
      { id: "draft", name: "AI draft", chatMessageIDs: ["msg_draft"] },
    ])
    expect(whiteboardChatVersions(parsed)).toEqual({
      msg_old: { boardID: "main", boardName: "Main" },
      msg_shared: { boardID: "main", boardName: "Main" },
      msg_draft: { boardID: "draft", boardName: "AI draft" },
    })

    const relinked = linkWhiteboardChatMessage(parsed, "draft", "msg_shared")
    expect(relinked.boards).toEqual([
      { id: "main", name: "Main", chatMessageIDs: ["msg_old"] },
      { id: "draft", name: "AI draft", chatMessageIDs: ["msg_draft", "msg_shared"] },
    ])
    expect(linkWhiteboardChatMessage(relinked, "draft", "msg_shared")).toBe(relinked)
    expect(whiteboardChatVersions(removeWhiteboardBoard(relinked, "draft"))).toEqual({
      msg_old: { boardID: "main", boardName: "Main" },
    })
  })

  test("adds, switches, renames, and removes boards without deleting the last board", () => {
    const initial = defaultWhiteboardWorkspace(false)
    const added = addWhiteboardBoard(initial, "puzzle", false)
    expect(added).toEqual({
      version: 1,
      active: "puzzle",
      boards: [
        { id: "main", name: "Main board" },
        { id: "puzzle", name: "Board 2" },
      ],
    })
    const renamed = renameWhiteboardBoard(added, "puzzle", "  Observatory   lock ")
    expect(renamed.boards[1]?.name).toBe("Observatory lock")
    expect(activateWhiteboardBoard(renamed, "main").active).toBe("main")
    expect(removeWhiteboardBoard(renamed, "puzzle")).toEqual(initial)
    expect(removeWhiteboardBoard(initial, "main")).toBe(initial)
  })

  test("enforces a bounded board count and safe scene keys", () => {
    const full = Array.from({ length: WHITEBOARD_BOARD_MAX_COUNT }, (_, index) => ({
      id: `board-${index}`,
      name: `Board ${index}`,
    }))
    const workspace = { version: 1 as const, active: "board-0", boards: full }
    expect(addWhiteboardBoard(workspace, "overflow", false)).toBe(workspace)
    expect(whiteboardBoardStorageKey("project-board", "level-1")).toBe("project-board:board:level-1")
  })
})
