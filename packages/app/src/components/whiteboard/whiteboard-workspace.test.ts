import { describe, expect, test } from "bun:test"
import {
  activateWhiteboardBoard,
  addWhiteboardBoard,
  defaultWhiteboardWorkspace,
  linkWhiteboardChatMessage,
  linkWhiteboardChatRequest,
  parseWhiteboardWorkspace,
  removeWhiteboardBoard,
  renameWhiteboardBoard,
  WHITEBOARD_BOARD_MAX_COUNT,
  whiteboardBoardStorageKey,
  whiteboardChatVersions,
  whiteboardChatRequestTargets,
  whiteboardWorkspaceStorageKey,
  unlinkWhiteboardChatRequest,
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
          {
            id: "draft",
            name: "AI draft",
            sourceBoardID: "main",
            chatMessageIDs: ["msg_shared", "msg_draft", 42],
          },
        ],
      }),
      false,
    )
    expect(parsed.boards).toEqual([
      { id: "main", name: "Main", chatMessageIDs: ["msg_old", "msg_shared"] },
      { id: "draft", name: "AI draft", chatMessageIDs: ["msg_draft"], sourceBoardID: "main" },
    ])
    expect(whiteboardChatVersions(parsed)).toEqual({
      msg_old: { boardID: "main", boardName: "Main" },
      msg_shared: { boardID: "main", boardName: "Main" },
      msg_draft: { boardID: "draft", boardName: "AI draft", sourceBoardID: "main" },
    })

    const relinked = linkWhiteboardChatMessage(parsed, "draft", "msg_shared", "main")
    expect(relinked.boards).toEqual([
      { id: "main", name: "Main", chatMessageIDs: ["msg_old"] },
      {
        id: "draft",
        name: "AI draft",
        sourceBoardID: "main",
        chatMessageIDs: ["msg_draft", "msg_shared"],
      },
    ])
    expect(linkWhiteboardChatMessage(relinked, "draft", "msg_shared")).toBe(relinked)
    expect(whiteboardChatVersions(removeWhiteboardBoard(relinked, "draft"))).toEqual({
      msg_old: { boardID: "main", boardName: "Main" },
    })
  })

  test("persists each pending AI request on exactly one source board", () => {
    const parsed = parseWhiteboardWorkspace(
      JSON.stringify({
        version: 1,
        active: "draft",
        boards: [
          { id: "main", name: "Main", chatRequestIDs: ["msg_main", "msg_shared", "bad id"] },
          { id: "draft", name: "Draft", chatRequestIDs: ["msg_shared", "msg_draft", 42] },
        ],
      }),
      false,
    )
    expect(parsed.boards).toEqual([
      { id: "main", name: "Main", chatRequestIDs: ["msg_main", "msg_shared"] },
      { id: "draft", name: "Draft", chatRequestIDs: ["msg_draft"] },
    ])
    expect(whiteboardChatRequestTargets(parsed)).toEqual({
      msg_main: "main",
      msg_shared: "main",
      msg_draft: "draft",
    })

    const moved = linkWhiteboardChatRequest(parsed, "draft", "msg_shared")
    expect(whiteboardChatRequestTargets(moved).msg_shared).toBe("draft")
    const resolved = unlinkWhiteboardChatRequest(moved, "msg_shared")
    expect(whiteboardChatRequestTargets(resolved).msg_shared).toBeUndefined()
    expect(unlinkWhiteboardChatRequest(resolved, "missing")).toBe(resolved)
    expect(whiteboardChatRequestTargets(removeWhiteboardBoard(resolved, "draft"))).toEqual({ msg_main: "main" })
  })

  test("sanitizes revision sources and reparents descendants when a source version is removed", () => {
    const parsed = parseWhiteboardWorkspace(
      JSON.stringify({
        version: 1,
        active: "revision-2",
        boards: [
          { id: "main", name: "Main", sourceBoardID: "missing" },
          { id: "revision-1", name: "Revision 1", sourceBoardID: "main", chatMessageIDs: ["msg_1"] },
          { id: "revision-2", name: "Revision 2", sourceBoardID: "revision-1", chatMessageIDs: ["msg_2"] },
          { id: "self", name: "Self", sourceBoardID: "self" },
        ],
      }),
      false,
    )
    expect(parsed.boards).toEqual([
      { id: "main", name: "Main" },
      { id: "revision-1", name: "Revision 1", chatMessageIDs: ["msg_1"], sourceBoardID: "main" },
      { id: "revision-2", name: "Revision 2", chatMessageIDs: ["msg_2"], sourceBoardID: "revision-1" },
      { id: "self", name: "Self" },
    ])

    const removed = removeWhiteboardBoard(parsed, "revision-1")
    expect(removed.boards.find((board) => board.id === "revision-2")?.sourceBoardID).toBe("main")
    expect(whiteboardChatVersions(removed).msg_2?.sourceBoardID).toBe("main")
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
