import { afterEach, describe, expect, test } from "bun:test"
import { readWhiteboardSceneSnapshot } from "./excalidraw-bridge"

describe("stored whiteboard scene snapshots", () => {
  afterEach(() => localStorage.clear())

  test("recovers the source structure, visual materials, files, and viewport", () => {
    localStorage.setItem(
      "board:source",
      JSON.stringify({
        elements: [
          { id: "node", type: "rectangle", x: 0, y: 0, isDeleted: false },
          { id: "label", type: "text", x: 0, y: 0, isDeleted: false, text: "Spawn", containerId: "node" },
          { id: "reference", type: "image", x: 240, y: 0, isDeleted: false, fileId: "file-1" },
        ],
        files: { "file-1": { id: "file-1", dataURL: "data:image/png;base64,AA==" } },
        appState: {
          gridModeEnabled: true,
          gridSize: 20,
          gridStep: 5,
          scrollX: 120,
          scrollY: 80,
          viewBackgroundColor: "#f8fafc",
          zoom: { value: 0.75 },
        },
      }),
    )

    const snapshot = readWhiteboardSceneSnapshot("board:source")
    expect(snapshot?.summary.nodes).toEqual([{ ref: "N1", type: "rectangle", label: "Spawn" }])
    expect(snapshot?.decorations.elements.map((element) => element.id)).toEqual(["reference"])
    expect(Object.keys(snapshot?.decorations.files ?? {})).toEqual(["file-1"])
    expect(snapshot?.decorations.appState).toMatchObject({ scrollX: 120, scrollY: 80, zoom: { value: 0.75 } })
  })

  test("ignores malformed persisted scenes", () => {
    localStorage.setItem("board:bad", JSON.stringify({ elements: [] }))
    expect(readWhiteboardSceneSnapshot("board:bad")).toBeUndefined()
  })
})
