import { describe, expect, test } from "bun:test"
import {
  advanceWhiteboardPlaytest,
  formatWhiteboardPlaytestTrace,
  WHITEBOARD_PLAYTEST_MAX_STEPS,
  whiteboardPlaytestChoices,
  whiteboardPlaytestImprovement,
  whiteboardPlaytestScenario,
  whiteboardPlaytestStarts,
  type WhiteboardPlaytestStep,
} from "./whiteboard-playtest"
import type { WhiteboardSceneSummary } from "./whiteboard-scene"

const graph: WhiteboardSceneSummary = {
  nodes: [
    { ref: "N1", type: "ellipse", label: "进入密室" },
    { ref: "N2", type: "diamond", label: "拉下开关" },
    { ref: "N3", type: "rectangle", label: "取得钥匙" },
    { ref: "N4", type: "rectangle", label: "触发警报" },
  ],
  connections: [
    { from: "N1", to: "N2" },
    { from: "N2", to: "N3", label: "正确顺序" },
    { from: "N2", to: "N4", label: "错误顺序" },
    { from: "N4", to: "N2", label: "重试" },
  ],
  notes: [],
}

describe("whiteboard flow playtest", () => {
  test("finds starts and exposes each real outgoing branch", () => {
    expect(whiteboardPlaytestStarts(graph)).toEqual(["N1"])
    const path = advanceWhiteboardPlaytest(graph, [{ ref: "N1" }], 0)
    expect(path).toEqual([{ ref: "N1" }, { ref: "N2", via: 0 }])
    expect(whiteboardPlaytestChoices(graph, path)).toEqual([
      { index: 1, to: "N3", label: "正确顺序", target: "取得钥匙" },
      { index: 2, to: "N4", label: "错误顺序", target: "触发警报" },
    ])
  })

  test("falls back to the first node for a cycle without a natural start", () => {
    expect(
      whiteboardPlaytestStarts({
        nodes: graph.nodes.slice(0, 2),
        connections: [
          { from: "N1", to: "N2" },
          { from: "N2", to: "N1" },
        ],
        notes: [],
      }),
    ).toEqual(["N1"])
  })

  test("prefers the semantic start even when a retry loop points back to it", () => {
    const semantic = {
      nodes: [
        { ref: "N1", type: "mechanic", label: "Charge" },
        { ref: "N2", type: "start", label: "Enter" },
        { ref: "N3", type: "failure", label: "Retry" },
      ],
      connections: [
        { from: "N2", to: "N1" },
        { from: "N1", to: "N3" },
        { from: "N3", to: "N2", label: "Again" },
      ],
      notes: [],
    } satisfies WhiteboardSceneSummary

    expect(whiteboardPlaytestStarts(semantic)).toEqual(["N2"])
    expect(formatWhiteboardPlaytestTrace(semantic, [{ ref: "N2" }, { ref: "N1", via: 0 }], true)).toContain(
      "N2 [起点] Enter --[继续]--> N1 [核心操作] Charge",
    )
  })

  test("ignores invalid transitions and enforces a bounded trace", () => {
    const start = [{ ref: "N1" }]
    expect(advanceWhiteboardPlaytest(graph, start, 99)).toBe(start)
    const full = Array.from({ length: WHITEBOARD_PLAYTEST_MAX_STEPS }, (_, index) => ({ ref: `N${index}` }))
    expect(advanceWhiteboardPlaytest(graph, full, 0)).toBe(full)
  })

  test("formats the actual branch, endpoint, and repeated cycle for AI review", () => {
    const successful: WhiteboardPlaytestStep[] = [{ ref: "N1" }, { ref: "N2", via: 0 }, { ref: "N3", via: 1 }]
    expect(formatWhiteboardPlaytestTrace(graph, successful, true)).toContain("N2 拉下开关 --[正确顺序]--> N3 取得钥匙")
    expect(formatWhiteboardPlaytestTrace(graph, successful, true)).toContain("到达无后继连接的终点")

    const retry: WhiteboardPlaytestStep[] = [
      { ref: "N1" },
      { ref: "N2", via: 0 },
      { ref: "N4", via: 2 },
      { ref: "N2", via: 3 },
    ]
    const trace = formatWhiteboardPlaytestTrace(graph, retry, false)
    expect(trace).toContain("Revisited / cycle: N2")
    expect(trace).toContain("available choices: 正确顺序 -> N3, 错误顺序 -> N4")
  })

  test("turns the clicked route into a reusable Demo Preview scenario", () => {
    const path: WhiteboardPlaytestStep[] = [
      { ref: "N1" },
      { ref: "N2", via: 0 },
      { ref: "N4", via: 2 },
      { ref: "N2", via: 3 },
    ]
    expect(whiteboardPlaytestScenario(graph, path, { id: "whiteboard-main", board: "机关房", chinese: true })).toEqual({
      id: "whiteboard-main",
      name: "机关房 · 流程试玩",
      steps:
        "1. 从「进入密室」开始\n2. 选择「继续」→「拉下开关」\n3. 选择「错误顺序」→「触发警报」\n4. 选择「重试」→「拉下开关」",
      expected:
        "在「拉下开关」仍可选择：「正确顺序」、「错误顺序」。 轨迹重复经过「拉下开关」；循环应允许重试且不会软锁。",
    })
    expect(whiteboardPlaytestScenario(graph, [], { id: "empty", board: "Empty", chinese: false })).toBeUndefined()
  })

  test("turns a flagged playtest problem into a concise visible request and exact hidden trace", () => {
    const path: WhiteboardPlaytestStep[] = [
      { ref: "N1" },
      { ref: "N2", via: 0 },
      { ref: "N4", via: 2 },
      { ref: "N2", via: 3 },
    ]
    const result = whiteboardPlaytestImprovement(
      graph,
      path,
      "guidance",
      `  玩家不知道先拉哪个开关。${"很".repeat(400)}  `,
      true,
    )
    expect(result?.request).toStartWith("根据刚才的实际试玩优化当前白板：引导不清。策划备注：玩家不知道先拉哪个开关。")
    expect(result?.request.length).toBeLessThan(380)
    expect(result?.context).toContain("已标记问题：引导不清")
    expect(result?.context).toContain("N2 拉下开关 --[错误顺序]--> N4 触发警报")
    expect(result?.context).toContain("重复经过 / 循环: N2")
    expect(whiteboardPlaytestImprovement(graph, [], "feedback", "", false)).toBeUndefined()
  })
})
