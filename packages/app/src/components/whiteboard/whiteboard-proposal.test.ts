import { describe, expect, test } from "bun:test"
import {
  latestWhiteboardProposalText,
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
          a2: [{ type: "reasoning", text: "Working" }, { type: "text", text: newer }],
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
      parseWhiteboardProposal(
        JSON.stringify({ ...proposal, nodes: [{ ...proposal.nodes[0], column: 99 }] }),
      ),
    ).toBeUndefined()
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
