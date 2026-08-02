import { describe, expect, test } from "bun:test"
import {
  formatWhiteboardScene,
  inspectWhiteboardScene,
  selectWhiteboardSceneElements,
  summarizeWhiteboardScene,
  whiteboardSceneDecorations,
  type WhiteboardSceneElement,
} from "./whiteboard-scene"

const element = (value: Partial<WhiteboardSceneElement> & Pick<WhiteboardSceneElement, "id" | "type">) => ({
  x: 0,
  y: 0,
  isDeleted: false,
  ...value,
})

describe("structured whiteboard context", () => {
  test("extracts ordered nodes, bound labels, and directed connections", () => {
    const scene = [
      element({ id: "goal", type: "ellipse", x: 10, y: 10 }),
      element({ id: "goal-label", type: "text", text: "玩家目标\n到达出口", containerId: "goal" }),
      element({ id: "test", type: "diamond", x: 300, y: 10 }),
      element({ id: "test-label", type: "text", text: "首次考验", containerId: "test" }),
      element({
        id: "flow",
        type: "arrow",
        startBinding: { elementId: "goal" },
        endBinding: { elementId: "test" },
      }),
      element({ id: "flow-label", type: "text", text: "进入关卡", containerId: "flow" }),
      element({ id: "title", type: "text", text: "关卡流程" }),
      element({ id: "deleted", type: "rectangle", isDeleted: true }),
    ]

    expect(summarizeWhiteboardScene(scene)).toEqual({
      nodes: [
        { ref: "N1", type: "ellipse", label: "玩家目标 到达出口" },
        { ref: "N2", type: "diamond", label: "首次考验" },
      ],
      connections: [{ from: "N1", to: "N2", label: "进入关卡" }],
      notes: ["关卡流程"],
    })
  })

  test("formats a compact localized context and ignores unbound decoration lines", () => {
    const scene = [
      element({ id: "a", type: "rectangle" }),
      element({ id: "a-label", type: "text", text: "机关输入", containerId: "a" }),
      element({ id: "decoration", type: "line" }),
    ]
    const context = formatWhiteboardScene(scene, true)
    expect(context).toContain("白板结构化上下文")
    expect(context).toContain("N1 [矩形] 机关输入")
    expect(context).not.toContain("连接：")
    expect(context).not.toContain("未命名节点")
    expect(context).toContain("孤立节点: N1")
  })

  test("preserves validated game-design roles from AI-generated nodes", () => {
    const scene = [
      element({
        id: "start",
        type: "ellipse",
        customData: { kmAgentWhiteboard: { version: 1, nodeType: "start" } },
      }),
      element({ id: "start-label", type: "text", text: "进入竞技场", containerId: "start" }),
      element({
        id: "reward",
        type: "rectangle",
        x: 300,
        customData: { kmAgentWhiteboard: { version: 1, nodeType: "reward" } },
      }),
      element({ id: "reward-label", type: "text", text: "获得钥匙", containerId: "reward" }),
      element({
        id: "flow",
        type: "arrow",
        startBinding: { elementId: "start" },
        endBinding: { elementId: "reward" },
      }),
      element({
        id: "invalid",
        type: "diamond",
        x: 600,
        customData: { kmAgentWhiteboard: { version: 2, nodeType: "failure" } },
      }),
    ]

    expect(summarizeWhiteboardScene(scene).nodes).toEqual([
      { ref: "N1", type: "start", label: "进入竞技场" },
      { ref: "N2", type: "reward", label: "获得钥匙" },
      { ref: "N3", type: "diamond", label: "" },
    ])
    const context = formatWhiteboardScene(scene, true)
    expect(context).toContain("N1 [起点] 进入竞技场")
    expect(context).toContain("N2 [奖励] 获得钥匙")
    expect(context).toContain("N3 [菱形] 未命名")
  })

  test("separates AI-managed flow structure from designer visual materials", () => {
    const scene = [
      element({ id: "node", type: "rectangle" }),
      element({ id: "node-label", type: "text", text: "Goal", containerId: "node" }),
      element({ id: "next", type: "ellipse", x: 300 }),
      element({
        id: "flow",
        type: "arrow",
        startBinding: { elementId: "node" },
        endBinding: { elementId: "next" },
      }),
      element({ id: "flow-label", type: "text", text: "Success", containerId: "flow" }),
      element({ id: "note", type: "text", text: "Structured note" }),
      element({ id: "sketch", type: "freedraw" }),
      element({ id: "reference", type: "image" }),
      element({ id: "divider", type: "line" }),
      element({ id: "divider-label", type: "text", text: "Mood", containerId: "divider" }),
      element({ id: "frame", type: "frame" }),
      element({ id: "ai-old-overlay", type: "freedraw" }),
      element({ id: "deleted-image", type: "image", isDeleted: true }),
    ]

    expect(whiteboardSceneDecorations(scene).map((item) => item.id)).toEqual([
      "sketch",
      "reference",
      "divider",
      "divider-label",
      "frame",
    ])
  })

  test("detects graph starts, ends, branches, merges, cycles, and handoff risks", () => {
    const labeledNode = (id: string, x: number) => [
      element({ id, type: "rectangle", x }),
      element({ id: `${id}-label`, type: "text", text: id.toUpperCase(), containerId: id }),
    ]
    const connection = (id: string, from: string, to: string) =>
      element({ id, type: "arrow", startBinding: { elementId: from }, endBinding: { elementId: to } })
    const scene = [
      ...labeledNode("start", 0),
      ...labeledNode("branch", 100),
      ...labeledNode("left", 200),
      ...labeledNode("right", 200),
      ...labeledNode("merge", 300),
      ...labeledNode("finish", 400),
      element({ id: "orphan", type: "diamond", x: 500 }),
      connection("start-branch", "start", "branch"),
      connection("branch-left", "branch", "left"),
      connection("branch-right", "branch", "right"),
      connection("left-merge", "left", "merge"),
      connection("right-merge", "right", "merge"),
      connection("merge-branch", "merge", "branch"),
      connection("merge-finish", "merge", "finish"),
    ]

    expect(inspectWhiteboardScene(scene)).toEqual({
      elementCount: 20,
      nodeCount: 7,
      connectionCount: 7,
      noteCount: 0,
      unlabeled: ["N7"],
      disconnected: ["N7"],
      starts: ["N1"],
      ends: ["N6"],
      branches: ["N2", "N5"],
      merges: ["N2", "N5"],
      cycles: ["N2", "N3", "N4", "N5"],
    })
    const context = formatWhiteboardScene(scene, false)
    expect(context).toContain("Start candidates: N1")
    expect(context).toContain("Cycle nodes: N2, N3, N4, N5")
    expect(context).toContain("Disconnected nodes: N7")
  })

  test("keeps labels and only the connections inside the selected puzzle branch", () => {
    const scene = [
      element({
        id: "switch",
        type: "rectangle",
        x: 0,
        boundElements: [{ id: "switch-label", type: "text" }],
      }),
      element({ id: "switch-label", type: "text", text: "拉杆", containerId: "switch" }),
      element({
        id: "door",
        type: "rectangle",
        x: 300,
        boundElements: [{ id: "door-label", type: "text" }],
      }),
      element({ id: "door-label", type: "text", text: "石门", containerId: "door" }),
      element({
        id: "opens",
        type: "arrow",
        startBinding: { elementId: "switch" },
        endBinding: { elementId: "door" },
      }),
      element({ id: "opens-label", type: "text", text: "开启", containerId: "opens" }),
      element({ id: "trap", type: "diamond" }),
      element({
        id: "trap-branch",
        type: "arrow",
        startBinding: { elementId: "switch" },
        endBinding: { elementId: "trap" },
      }),
    ]

    const selected = selectWhiteboardSceneElements(scene, { switch: true, door: true })
    expect(selected.map((item) => item.id)).toEqual([
      "switch",
      "switch-label",
      "door",
      "door-label",
      "opens",
      "opens-label",
    ])
    expect(formatWhiteboardScene(selected, true, "selection")).toContain("白板选区结构化上下文")
    expect(formatWhiteboardScene(selected, true, "selection")).toContain("N1 -> N2 (开启)")
    expect(formatWhiteboardScene(selected, true, "selection")).not.toContain("trap")
  })

  test("includes connector endpoints, groups, and frame children when they define the selection", () => {
    const scene = [
      element({ id: "a", type: "rectangle" }),
      element({ id: "b", type: "ellipse" }),
      element({
        id: "flow",
        type: "arrow",
        startBinding: { elementId: "a" },
        endBinding: { elementId: "b" },
      }),
      element({ id: "group-a", type: "text", text: "组合", groupIds: ["group"] }),
      element({ id: "group-b", type: "rectangle", groupIds: ["group"] }),
      element({ id: "frame", type: "frame" }),
      element({ id: "inside", type: "diamond", frameId: "frame" }),
      element({ id: "deleted", type: "rectangle", isDeleted: true }),
    ]

    expect(selectWhiteboardSceneElements(scene, { flow: true }).map((item) => item.id)).toEqual(["a", "b", "flow"])
    expect(selectWhiteboardSceneElements(scene, { "group-a": true }).map((item) => item.id)).toEqual([
      "group-a",
      "group-b",
    ])
    expect(selectWhiteboardSceneElements(scene, { frame: true, deleted: true }).map((item) => item.id)).toEqual([
      "frame",
      "inside",
    ])
  })
})
