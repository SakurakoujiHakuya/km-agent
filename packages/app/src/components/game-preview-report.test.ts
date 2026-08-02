import { describe, expect, test } from "bun:test"
import type { GamePreviewFrame } from "./game-preview-history"
import {
  previewReportFilename,
  previewReportFrame,
  previewReportHTML,
  previewReportProjectName,
  previewReportStats,
  type PreviewReportFrame,
} from "./game-preview-report"

function frame(input: Partial<GamePreviewFrame> & Pick<GamePreviewFrame, "id" | "createdAt">): PreviewReportFrame {
  return {
    directory: "/private/game",
    url: "http://localhost:5173/level?room=2&mode=test",
    image: new Blob(),
    note: "",
    tags: [],
    checks: {},
    ...input,
    imageDataURL: "data:image/png;base64,cG5n",
  }
}

describe("playtest report", () => {
  test("summarizes coverage across every retained iteration", () => {
    expect(
      previewReportStats([
        frame({ id: "first", createdAt: 1, checks: { launch: "pass", goal: "fail" } }),
        frame({
          id: "second",
          createdAt: 2,
          checks: { launch: "pass", goal: "pass", completion: "pass" },
          scenario: { id: "wrong-answer", name: "Wrong answer", steps: "Pull lever", expected: "Door stays shut" },
          run: { checks: ["fail"], expected: "fail", note: "Door opened" },
        }),
      ]),
    ).toEqual({
      iterations: 2,
      passed: 4,
      failed: 1,
      untested: 7,
      scenarios: 1,
      runsPassed: 0,
      runsFailed: 1,
    })
  })

  test("generates a self-contained, escaped chronological HTML report", () => {
    const html = previewReportHTML({
      projectName: "Puzzle <Lab>",
      generatedAt: 3,
      chinese: false,
      plan: { version: 1, criteria: { goal: "Find the <exit>" } },
      frames: [
        frame({ id: "new", createdAt: 2, note: "Latest", checks: { launch: "pass" } }),
        frame({
          id: "old",
          createdAt: 1,
          url: "javascript:alert(1)",
          note: "<script>alert('no')</script>\nDoor clue",
          tags: ["puzzle"],
          checks: { goal: "fail" },
          scenario: {
            id: "wrong-answer",
            name: "Wrong & answer",
            steps: "Pull <lever>",
            expected: "Door stays shut",
          },
          run: { checks: ["fail"], expected: "fail", note: "Door <opened>" },
        }),
      ],
      criteriaLabels: new Map([
        ["launch", "Demo launches"],
        ["controls", "Controls respond"],
        ["goal", "Goal is clear"],
        ["response", "Feedback is clear"],
        ["retry", "Can retry"],
        ["completion", "Can complete"],
      ]),
      issueLabels: new Map([["puzzle", "Puzzle logic"]]),
      formatTime: (value) => `T${value}`,
    })
    expect(html).toStartWith("<!doctype html>")
    expect(html).toContain("Puzzle &lt;Lab&gt; · Playtest review report")
    expect(html).toContain('src="data:image/png;base64,cG5n"')
    expect(html).toContain("Wrong &amp; answer")
    expect(html).toContain("Pull &lt;lever&gt;")
    expect(html).toContain("Run result")
    expect(html).toContain("Door &lt;opened&gt;")
    expect(html).toContain("&lt;script&gt;alert(&#039;no&#039;)&lt;/script&gt;<br>Door clue")
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("javascript:alert")
    expect(html).not.toContain("/private/game")
    expect(html.indexOf("T1")).toBeLessThan(html.indexOf("T2"))
  })

  test("creates portable names for macOS and Windows projects", () => {
    expect(previewReportProjectName("/Users/me/My Puzzle/")).toBe("My Puzzle")
    expect(previewReportProjectName("C:\\Games\\Temple Demo")).toBe("Temple Demo")
    expect(previewReportFilename("/Games/My Puzzle", Date.UTC(2026, 7, 2))).toBe(
      "km-agent-my-puzzle-playtest-2026-08-02.html",
    )
  })

  test("encodes legacy stored blobs as PNG images", async () => {
    expect((await previewReportFrame(frame({ id: "legacy", createdAt: 1 }))).imageDataURL).toStartWith(
      "data:image/png;base64,",
    )
  })
})
