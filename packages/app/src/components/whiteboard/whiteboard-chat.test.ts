import { describe, expect, test } from "bun:test"
import {
  WHITEBOARD_CHAT_CONTEXT_FILENAME,
  WHITEBOARD_CHAT_CONTEXT_MARKER,
  WHITEBOARD_CHAT_REQUEST_MAX_LENGTH,
  whiteboardChatContext,
  whiteboardChatActiveDraftID,
  whiteboardChatBuildable,
  whiteboardChatCanCompose,
  whiteboardChatDisplayText,
  whiteboardChatEditableProposal,
  whiteboardChatPrompt,
  whiteboardChatRequestFinished,
  whiteboardChatTranscript,
  whiteboardChatTurnWorking,
} from "./whiteboard-chat"

describe("whiteboard AI chat", () => {
  test("builds a bounded, traceable edit prompt with the current scene", () => {
    const prompt = whiteboardChatPrompt("增加一个失败分支", true)

    expect(prompt).toBe("增加一个失败分支")
    const context = whiteboardChatContext("机关房", "Structured board: start -> switch", true)
    expect(context).toContain("机关房")
    expect(context).toContain("Structured board: start -> switch")
    expect(context).toContain("km-whiteboard-live")
    expect(context).toContain('{"op":"done"}')
    expect(context).toContain("先输出全部 node")
    expect(context).toContain("不要修改项目文件")
    expect(context).toContain(WHITEBOARD_CHAT_CONTEXT_MARKER)

    const selection = whiteboardChatContext(
      "机关房",
      "完整白板结构\n\n白板选区结构化上下文：\n- N2 [菱形] 判定",
      true,
      "selection",
    )
    expect(selection).toContain("只修改“白板选区结构化上下文”")
    expect(selection).toContain("完整白板方案")
    expect(selection).toContain("完整白板结构")
    expect(selection).toContain("N2 [菱形] 判定")
    expect(whiteboardChatPrompt("x".repeat(WHITEBOARD_CHAT_REQUEST_MAX_LENGTH + 20), false)).not.toContain(
      "x".repeat(WHITEBOARD_CHAT_REQUEST_MAX_LENGTH + 1),
    )
  })

  test("extracts only persistent whiteboard turns and links the next assistant response", () => {
    const prompt = whiteboardChatPrompt("Add a retry loop", false)
    const proposal = `Done.\n\n\`\`\`km-whiteboard\n{"format":"km-agent-whiteboard","version":1,"title":"Retry","nodes":[{"id":"start","type":"start","label":"Start","column":0,"row":0},{"id":"retry","type":"failure","label":"Retry","column":1,"row":0}],"connections":[{"from":"start","to":"retry"}],"notes":[]}\n\`\`\``
    const messages = [
      { id: "unrelated-user", role: "user" },
      { id: "unrelated-assistant", role: "assistant" },
      { id: "chat-user", role: "user" },
      { id: "chat-assistant", role: "assistant" },
    ]
    const parts = {
      "unrelated-user": [{ type: "text", text: "Build the game" }],
      "unrelated-assistant": [{ type: "text", text: "Okay" }],
      "chat-user": [
        { type: "text", text: prompt },
        { type: "text", text: `${WHITEBOARD_CHAT_CONTEXT_MARKER}\nHidden structured context`, synthetic: true },
      ],
      "chat-assistant": [{ type: "text", text: proposal }],
    }

    const transcript = whiteboardChatTranscript(messages, parts)
    expect(transcript).toHaveLength(2)
    expect(transcript[0]).toMatchObject({ id: "chat-user", role: "user", text: "Add a retry loop" })
    expect(transcript[1]).toMatchObject({ id: "chat-assistant", role: "assistant", requestID: "chat-user" })
    expect(transcript[1]?.proposal?.title).toBe("Retry")
    expect(whiteboardChatDisplayText(transcript[1], false)).toBe("Done.")
  })

  test("exposes a streamed draft before the final proposal is complete", () => {
    const live = `Building the branch.\n\n\`\`\`km-whiteboard-live
{"op":"start","format":"km-agent-whiteboard-live","version":1,"title":"Live retry"}
{"op":"node","id":"start","type":"start","label":"Start","column":0,"row":0}
{"op":"node","id":"retry","type":"failure","label":"Retry","column":1,"row":0}
{"op":"connec`
    const transcript = whiteboardChatTranscript(
      [
        { id: "chat-user", role: "user" },
        { id: "chat-assistant", role: "assistant" },
      ],
      {
        "chat-user": [
          { type: "text", text: whiteboardChatPrompt("Add retry", false) },
          { type: "file", filename: WHITEBOARD_CHAT_CONTEXT_FILENAME },
        ],
        "chat-assistant": [{ type: "text", text: live }],
      },
    )

    expect(transcript[1]?.draft?.proposal.nodes).toHaveLength(2)
    expect(transcript[1]?.requestID).toBe("chat-user")
    expect(transcript[1]?.draft?.complete).toBeFalse()
    expect(transcript[1]?.proposal).toBeUndefined()
    expect(whiteboardChatDisplayText(transcript[1], false)).toBe("Building the branch.")
    expect(whiteboardChatEditableProposal(transcript[1])?.title).toBe("Live retry")
    expect(whiteboardChatActiveDraftID(transcript, true)).toBe("chat-assistant")
    expect(whiteboardChatActiveDraftID(transcript, false)).toBeUndefined()
  })

  test("marks only the latest partial assistant draft as active", () => {
    const draft = {
      proposal: {
        format: "km-agent-whiteboard" as const,
        version: 1 as const,
        title: "Partial",
        nodes: [{ id: "start", type: "start" as const, label: "Start", column: 0, row: 0 }],
        connections: [],
        notes: [],
      },
      complete: false,
      eventCount: 1,
    }
    const messages = [
      { id: "request", role: "user" as const, text: "Add a retry" },
      { id: "older", role: "assistant" as const, text: "", draft },
      { id: "latest", role: "assistant" as const, text: "", draft },
    ]

    expect(whiteboardChatActiveDraftID(messages, true)).toBe("latest")
    expect(
      whiteboardChatActiveDraftID([...messages, { id: "next", role: "user", text: "Continue" }], true),
    ).toBeUndefined()
    expect(whiteboardChatEditableProposal(messages[1])?.title).toBe("Partial")
    expect(whiteboardChatDisplayText(messages[1], false, false)).toBe("An editable partial board draft was kept.")
    expect(whiteboardChatTurnWorking(messages, "request", true)).toBeTrue()
    expect(whiteboardChatTurnWorking(messages, "unrelated-message", true)).toBeFalse()
    expect(whiteboardChatTurnWorking(messages, "request", false)).toBeFalse()
  })

  test("recognizes a whiteboard request before the assistant starts streaming", () => {
    const messages = [{ id: "request", role: "user" as const, text: "Add a retry" }]
    expect(whiteboardChatTurnWorking(messages, "request", true)).toBeTrue()
  })

  test("allows live steering only while the current work belongs to the whiteboard", () => {
    expect(whiteboardChatCanCompose(false, false, false)).toBeTrue()
    expect(whiteboardChatCanCompose(false, true, true)).toBeTrue()
    expect(whiteboardChatCanCompose(false, true, false)).toBeFalse()
    expect(whiteboardChatCanCompose(true, true, true)).toBeFalse()
    expect(whiteboardChatCanCompose(false, true, true, true)).toBeFalse()
  })

  test("offers demo builds only for complete validated whiteboard proposals", () => {
    const proposal = {
      format: "km-agent-whiteboard" as const,
      version: 1 as const,
      title: "Playable puzzle",
      nodes: [{ id: "start", type: "start" as const, label: "Start", column: 0, row: 0 }],
      connections: [],
      notes: [],
    }
    expect(whiteboardChatBuildable({ id: "proposal", role: "assistant", text: "", proposal })).toBeTrue()
    expect(
      whiteboardChatBuildable({
        id: "complete-draft",
        role: "assistant",
        text: "",
        draft: { complete: true, eventCount: 2, proposal },
      }),
    ).toBeTrue()
    expect(
      whiteboardChatBuildable({
        id: "partial-draft",
        role: "assistant",
        text: "",
        draft: { complete: false, eventCount: 1, proposal },
      }),
    ).toBeFalse()
    expect(whiteboardChatBuildable({ id: "text", role: "assistant", text: "Looks good" })).toBeFalse()
  })

  test("keeps a streamed request pending until it completes or stops", () => {
    const proposal = {
      format: "km-agent-whiteboard" as const,
      version: 1 as const,
      title: "Partial",
      nodes: [{ id: "start", type: "start" as const, label: "Start", column: 0, row: 0 }],
      connections: [],
      notes: [],
    }
    const partial = {
      id: "partial",
      role: "assistant" as const,
      text: "",
      draft: { complete: false, eventCount: 1, proposal },
    }
    expect(whiteboardChatRequestFinished(partial, true)).toBeFalse()
    expect(whiteboardChatRequestFinished(partial, false)).toBeTrue()
    expect(whiteboardChatRequestFinished({ ...partial, draft: { ...partial.draft, complete: true } }, true)).toBeTrue()
    expect(whiteboardChatRequestFinished({ id: "text", role: "assistant", text: "Done" }, false)).toBeFalse()
  })

  test("does not attach an unrelated assistant response to an abandoned whiteboard turn", () => {
    const messages = [
      { id: "chat-user", role: "user" },
      { id: "regular-user", role: "user" },
      { id: "regular-assistant", role: "assistant" },
    ]
    const parts = {
      "chat-user": [
        { type: "text", text: whiteboardChatPrompt("First", false) },
        { type: "file", filename: WHITEBOARD_CHAT_CONTEXT_FILENAME },
      ],
      "regular-user": [{ type: "text", text: "Second" }],
      "regular-assistant": [{ type: "text", text: "Response" }],
    }

    expect(whiteboardChatTranscript(messages, parts)).toEqual([{ id: "chat-user", role: "user", text: "First" }])
  })
})
