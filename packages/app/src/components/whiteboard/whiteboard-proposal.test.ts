import { describe, expect, test } from "bun:test"
import {
  latestWhiteboardProposalText,
  parseWhiteboardLiveDraft,
  parseWhiteboardProposal,
  type WhiteboardProposal,
  whiteboardProposalElements,
} from "./whiteboard-proposal"

const proposal = {
  format: "km-agent-whiteboard",
  version: 1,
  title: "Laser vault",
  nodes: [
    { id: "start", type: "start", label: "Enter vault", column: 0, row: 0 },
    { id: "switch", type: "decision", label: "Disable lasers?", column: 1, row: 0 },
    { id: "reward", type: "reward", label: "Collect key", column: 2, row: 0 },
  ],
  connections: [
    { from: "start", to: "switch" },
    { from: "switch", to: "reward", label: "Solved" },
  ],
  notes: ["Wrong input resets the switch sequence"],
} satisfies WhiteboardProposal

describe("AI whiteboard proposal", () => {
  test("extracts and normalizes a fenced proposal from an assistant response", () => {
    const parsed = parseWhiteboardProposal(`Design notes\n\n\`\`\`km-whiteboard\n${JSON.stringify(proposal)}\n\`\`\``)
    expect(parsed).toEqual(proposal)
  })

  test("uses the latest assistant response containing a valid proposal", () => {
    const older = `\`\`\`km-whiteboard\n${JSON.stringify(proposal)}\n\`\`\``
    const newer = older.replace("Laser vault", "Improved vault")
    expect(
      latestWhiteboardProposalText(
        [
          { id: "a1", role: "assistant" },
          { id: "u2", role: "user" },
          { id: "a2", role: "assistant" },
        ],
        {
          a1: [{ type: "text", text: older }],
          u2: [{ type: "text", text: "Make it clearer" }],
          a2: [
            { type: "reasoning", text: "Working" },
            { type: "text", text: newer },
          ],
        },
      ),
    ).toBe(newer)
  })

  test("rejects unsafe references, duplicate positions, and oversized coordinates", () => {
    expect(
      parseWhiteboardProposal(JSON.stringify({ ...proposal, connections: [{ from: "start", to: "missing" }] })),
    ).toBeUndefined()
    expect(
      parseWhiteboardProposal(JSON.stringify({ ...proposal, connections: [{ from: "start", to: "start" }] })),
    ).toBeUndefined()
    expect(
      parseWhiteboardProposal(
        JSON.stringify({
          ...proposal,
          nodes: proposal.nodes.map((node) => ({ ...node, column: 0, row: 0 })),
        }),
      ),
    ).toBeUndefined()
    expect(
      parseWhiteboardProposal(JSON.stringify({ ...proposal, nodes: [{ ...proposal.nodes[0], column: 99 }] })),
    ).toBeUndefined()
  })

  test("normalizes empty optional connection labels from model output", () => {
    const value = parseWhiteboardProposal(
      JSON.stringify({
        format: "km-agent-whiteboard",
        version: 1,
        title: "Retry flow",
        nodes: [
          { id: "start", type: "start", label: "Start", column: 0, row: 0 },
          { id: "end", type: "end", label: "End", column: 1, row: 0 },
        ],
        connections: [{ from: "start", to: "end", label: "" }],
        notes: [],
      }),
    )

    expect(value?.connections).toEqual([{ from: "start", to: "end", label: undefined }])
  })

  test("builds a safe incremental draft from complete streamed events", () => {
    const partial = `Working\n\n\`\`\`km-whiteboard-live
{"op":"start","format":"km-agent-whiteboard-live","version":1,"title":"Live vault"}
{"op":"node","id":"start","type":"start","label":"Enter vault","column":0,"row":0}
{"op":"connection","from":"start","to":"reward"}
{"op":"node","id":"reward","type":"reward","label":"Collect key","column":1,"row":0}
{"op":"note","text":"Show a strong pickup effect"}
{"op":"connec`
    const draft = parseWhiteboardLiveDraft(partial)

    expect(draft?.complete).toBeFalse()
    expect(draft?.proposal.nodes).toHaveLength(2)
    expect(draft?.proposal.connections).toEqual([{ from: "start", to: "reward", label: undefined }])
    expect(draft?.proposal.notes).toEqual(["Show a strong pickup effect"])
    expect(parseWhiteboardProposal(partial)).toBeUndefined()

    const complete = `${partial.slice(0, partial.lastIndexOf("{"))}{"op":"done"}\n\`\`\``
    expect(parseWhiteboardLiveDraft(complete)?.complete).toBeTrue()
    expect(parseWhiteboardProposal(complete)?.title).toBe("Live vault")
  })

  test("does not complete a stream with invalid or unresolved events", () => {
    const invalid = `\`\`\`km-whiteboard-live
{"op":"start","format":"km-agent-whiteboard-live","version":1,"title":"Unsafe"}
{"op":"node","id":"start","type":"start","label":"Start","column":0,"row":0}
{"op":"connection","from":"start","to":"missing"}
{"op":"done"}
\`\`\``

    expect(parseWhiteboardLiveDraft(invalid)?.complete).toBeFalse()
    expect(parseWhiteboardProposal(invalid)).toBeUndefined()
  })

  test("creates editable bound shapes, arrows, heading, and notes", () => {
    const parsed = parseWhiteboardProposal(JSON.stringify(proposal))!
    const elements = whiteboardProposalElements(parsed)
    expect(elements[0]).toMatchObject({ id: "ai-proposal-title", type: "text", text: "Laser vault" })
    expect(elements.find((element) => element.id === "ai-node-switch")?.type).toBe("diamond")
    expect(elements.find((element) => element.id === "ai-node-start")?.type).toBe("ellipse")
    expect(elements.find((element) => element.id === "ai-edge-2")).toMatchObject({
      type: "arrow",
      start: { id: "ai-node-switch" },
      end: { id: "ai-node-reward" },
      label: { text: "Solved" },
    })
    expect(elements.at(-1)).toMatchObject({ type: "text", text: "• Wrong input resets the switch sequence" })
  })
})
