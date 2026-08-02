import { describe, expect, test } from "bun:test"
import type { WhiteboardProposal } from "./whiteboard-proposal"
import { reviewWhiteboardProposal, whiteboardProposalRepairPrompt } from "./whiteboard-proposal-review"
import type { WhiteboardSceneSummary } from "./whiteboard-scene"

const current = {
  nodes: [
    { ref: "N1", type: "ellipse", label: "Enter room" },
    { ref: "N2", type: "diamond", label: "Choose plate" },
    { ref: "N3", type: "ellipse", label: "Exit" },
  ],
  connections: [
    { from: "N1", to: "N2" },
    { from: "N2", to: "N3", label: "Correct" },
  ],
  notes: ["Puzzle flow", "• Color order stays visible"],
} satisfies WhiteboardSceneSummary

const proposal = {
  format: "km-agent-whiteboard",
  version: 1,
  title: "Puzzle flow",
  nodes: [
    { id: "start", type: "start", label: "Enter room", column: 0, row: 0 },
    { id: "choice", type: "decision", label: "Choose plate", column: 1, row: 0 },
    { id: "hint", type: "step", label: "Show color hint", column: 1, row: 2 },
    { id: "end", type: "end", label: "Exit", column: 2, row: 0 },
  ],
  connections: [
    { from: "start", to: "choice" },
    { from: "choice", to: "end", label: "Correct" },
    { from: "choice", to: "hint", label: "Two failures" },
    { from: "hint", to: "choice", label: "Retry" },
  ],
  notes: ["Color order stays visible"],
} satisfies WhiteboardProposal

describe("AI whiteboard proposal review", () => {
  test("summarizes semantic changes and healthy game-flow structure", () => {
    const review = reviewWhiteboardProposal(current, proposal)

    expect(review.changes).toEqual({
      nodes: { added: ["Show color hint"], removed: [] },
      connections: { added: 2, removed: 0 },
      notes: { added: 0, removed: 0 },
    })
    expect(review.flow).toMatchObject({
      starts: ["Enter room"],
      ends: ["Exit"],
      branches: ["Choose plate"],
      cycles: ["Choose plate", "Show color hint"],
      disconnected: [],
      unreachable: [],
      incompleteDecisions: [],
      ambiguousDecisions: [],
      unexpectedDeadEnds: [],
      terminalFailures: [],
    })
  })

  test("flags unreachable, isolated, incomplete, and dead-end proposal nodes", () => {
    const unsafe = {
      ...proposal,
      nodes: [
        { id: "start", type: "start", label: "Start", column: 0, row: 0 },
        { id: "choice", type: "decision", label: "One-way choice", column: 1, row: 0 },
        { id: "stuck", type: "step", label: "Stuck corridor", column: 2, row: 0 },
        { id: "end", type: "end", label: "Unreachable exit", column: 3, row: 0 },
        { id: "fail", type: "failure", label: "Game over", column: 4, row: 0 },
      ],
      connections: [
        { from: "start", to: "choice" },
        { from: "choice", to: "stuck" },
      ],
      notes: [],
    } satisfies WhiteboardProposal

    const review = reviewWhiteboardProposal({ nodes: [], connections: [], notes: [] }, unsafe)
    expect(review.flow).toMatchObject({
      disconnected: ["Unreachable exit", "Game over"],
      unreachable: ["Unreachable exit", "Game over"],
      incompleteDecisions: ["One-way choice"],
      ambiguousDecisions: [],
      unexpectedDeadEnds: ["Stuck corridor"],
      terminalFailures: ["Game over"],
    })
    expect(whiteboardProposalRepairPrompt(review, false)).toBe(
      [
        "Fix the flow risks in the current board while preserving its gameplay intent and every valid node, connection, and design note. Make only the changes needed to resolve these issues:",
        "- Disconnected nodes: Unreachable exit (+1 more)",
        "- Decisions with fewer than two exits: One-way choice",
        "- Unexpected dead ends: Stuck corridor",
        "- Failures without a retry exit: Game over",
        "Give every decision clear distinct exits, prevent non-terminal paths from ending unexpectedly, and provide understandable retry or recovery paths for failures.",
      ].join("\n"),
    )
    expect(whiteboardProposalRepairPrompt(review, false)!.length).toBeLessThanOrEqual(800)
  })

  test("does not offer a repair turn for a healthy proposal", () => {
    expect(whiteboardProposalRepairPrompt(reviewWhiteboardProposal(current, proposal), true)).toBeUndefined()
  })

  test("flags decision exits that are missing or repeat their player-facing condition", () => {
    const ambiguous = {
      ...proposal,
      connections: [
        { from: "start", to: "choice" },
        { from: "choice", to: "hint", label: "Choose" },
        { from: "choice", to: "end", label: " choose " },
      ],
    } satisfies WhiteboardProposal
    const review = reviewWhiteboardProposal(current, ambiguous)

    expect(review.flow.ambiguousDecisions).toEqual(["Choose plate"])
    expect(whiteboardProposalRepairPrompt(review, true)).toContain("出口条件不清晰的判定: Choose plate")
  })
})
