import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types"
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types"
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform"
import {
  formatWhiteboardScene,
  inspectWhiteboardScene,
  selectWhiteboardSceneElements,
  summarizeWhiteboardScene,
  whiteboardSceneDecorations,
  type WhiteboardSceneDiagnostics,
  type WhiteboardSceneScope,
  type WhiteboardSceneSummary,
} from "./whiteboard-scene"

type WhiteboardScene = {
  elements: readonly OrderedExcalidrawElement[]
  files: BinaryFiles
  appState: Pick<
    AppState,
    "gridModeEnabled" | "gridSize" | "gridStep" | "scrollX" | "scrollY" | "viewBackgroundColor" | "zoom"
  >
}

export type WhiteboardDecorationSnapshot = {
  elements: readonly OrderedExcalidrawElement[]
  files: BinaryFiles
}

export type WhiteboardHandle = {
  clear: () => void
  describeScene: (chinese: boolean, scope?: WhiteboardSceneScope) => string
  dispose: () => void
  exportScene: () => Blob
  exportPng: (scope?: WhiteboardSceneScope) => Promise<Blob>
  hasContent: () => boolean
  hasSelection: () => boolean
  importScene: (file: File) => Promise<void>
  inspectScene: (scope?: WhiteboardSceneScope) => WhiteboardSceneDiagnostics
  summarizeScene: (scope?: WhiteboardSceneScope) => WhiteboardSceneSummary
  replaceWith: (elements: ExcalidrawElementSkeleton[]) => void
  replaceStructureWith: (elements: ExcalidrawElementSkeleton[], decorations?: WhiteboardDecorationSnapshot) => void
  snapshotDecorations: () => WhiteboardDecorationSnapshot
  switchScene: (storageKey: string) => void
}

export async function mountExcalidrawWhiteboard(
  host: HTMLElement,
  options: {
    storageKey: string
    langCode: string
    theme: "light" | "dark"
    onReady: (handle: WhiteboardHandle) => void
    onSaved: () => void
    onSelectionChange: (count: number) => void
  },
) {
  const React = await import("react")
  const ReactDOM = await import("react-dom/client")
  const ExcalidrawLibrary = await import("@excalidraw/excalidraw")
  await import("@excalidraw/excalidraw/index.css")

  const root = ReactDOM.createRoot(host)
  const initialData = readScene(options.storageKey)
  let api: ExcalidrawImperativeAPI | undefined
  let latestScene: WhiteboardScene | undefined
  let saveTimer: number | undefined
  let selectionCount = -1
  let currentStorageKey = options.storageKey
  let ready = false

  const notifyReady = () => {
    if (ready || !api || api.getAppState().isLoading) return
    ready = true
    options.onReady(handle)
  }

  const scopedElements = (scope: WhiteboardSceneScope) => {
    const elements = api?.getSceneElements() ?? []
    if (scope === "all") return elements
    return selectWhiteboardSceneElements(elements, api?.getAppState().selectedElementIds ?? {})
  }

  const updateSelectionCount = (elements: readonly OrderedExcalidrawElement[], appState: AppState) => {
    const count = elements.filter((element) => appState.selectedElementIds[element.id]).length
    if (count === selectionCount) return
    selectionCount = count
    options.onSelectionChange(count)
  }

  const save = () => {
    if (!latestScene) return
    writeScene(currentStorageKey, latestScene)
    options.onSaved()
  }

  const scheduleSave = () => {
    if (saveTimer !== undefined) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(save, 350)
  }

  const snapshotDecorations = (): WhiteboardDecorationSnapshot => ({
    elements: whiteboardSceneDecorations(api?.getSceneElements() ?? []),
    files: api?.getFiles() ?? {},
  })

  const replaceElements = (skeletons: ExcalidrawElementSkeleton[], decorations?: WhiteboardDecorationSnapshot) => {
    if (!api) return
    const generated = ExcalidrawLibrary.convertToExcalidrawElements(skeletons, { regenerateIds: false })
    if (decorations) api.addFiles(Object.values(decorations.files))
    const elements = [...(decorations?.elements ?? []), ...generated]
    api.updateScene({
      elements,
      appState: { selectedElementIds: {} },
      captureUpdate: ExcalidrawLibrary.CaptureUpdateAction.IMMEDIATELY,
    })
    window.requestAnimationFrame(() =>
      api?.scrollToContent(elements, { fitToViewport: true, viewportZoomFactor: 0.82, animate: true }),
    )
  }

  const handle: WhiteboardHandle = {
    clear: () => api?.resetScene(),
    describeScene: (chinese, scope = "all") => formatWhiteboardScene(scopedElements(scope), chinese, scope),
    dispose: () => {
      if (saveTimer !== undefined) window.clearTimeout(saveTimer)
      save()
      root.unmount()
    },
    hasContent: () => (api?.getSceneElements().length ?? 0) > 0,
    hasSelection: () => scopedElements("selection").length > 0,
    exportScene: () => {
      if (!api) throw new Error("Whiteboard is not ready")
      const value = ExcalidrawLibrary.serializeAsJSON(
        api.getSceneElements(),
        api.getAppState(),
        api.getFiles(),
        "local",
      )
      return new Blob([value], { type: "application/vnd.excalidraw+json" })
    },
    importScene: async (file) => {
      if (!api) throw new Error("Whiteboard is not ready")
      const restored = await ExcalidrawLibrary.loadFromBlob(file, api.getAppState(), null)
      api.addFiles(Object.values(restored.files))
      api.updateScene({
        elements: restored.elements,
        appState: { ...restored.appState, selectedElementIds: {} },
        captureUpdate: ExcalidrawLibrary.CaptureUpdateAction.IMMEDIATELY,
      })
      if (restored.elements.length > 0) {
        window.requestAnimationFrame(() =>
          api?.scrollToContent(restored.elements, { fitToViewport: true, viewportZoomFactor: 0.82, animate: true }),
        )
      }
    },
    inspectScene: (scope = "all") => inspectWhiteboardScene(scopedElements(scope)),
    summarizeScene: (scope = "all") => summarizeWhiteboardScene(scopedElements(scope)),
    replaceWith: (skeletons) => replaceElements(skeletons),
    replaceStructureWith: (skeletons, decorations) => replaceElements(skeletons, decorations ?? snapshotDecorations()),
    snapshotDecorations,
    switchScene: (storageKey) => {
      if (!api || storageKey === currentStorageKey) return
      if (saveTimer !== undefined) window.clearTimeout(saveTimer)
      save()
      currentStorageKey = storageKey
      latestScene = undefined
      selectionCount = -1
      const scene = readScene(storageKey)
      api.resetScene()
      if (scene?.files) api.addFiles(Object.values(scene.files))
      api.updateScene({
        elements: scene?.elements ?? [],
        appState: { ...api.getAppState(), ...scene?.appState, selectedElementIds: {} },
        captureUpdate: ExcalidrawLibrary.CaptureUpdateAction.NEVER,
      })
      updateSelectionCount(api.getSceneElements(), api.getAppState())
      if (!scene?.elements?.length) return
      if (hasWhiteboardViewport(scene.appState)) return
      window.requestAnimationFrame(() =>
        api?.scrollToContent(scene.elements ?? [], {
          fitToViewport: true,
          viewportZoomFactor: 0.82,
          maxZoom: 1,
          animate: true,
        }),
      )
    },
    exportPng: async (scope = "all") => {
      if (!api) throw new Error("Whiteboard is not ready")
      const elements = scopedElements(scope)
      if (elements.length === 0)
        throw new Error(scope === "selection" ? "Whiteboard selection is empty" : "Whiteboard is empty")
      return ExcalidrawLibrary.exportToBlob({
        elements,
        appState: {
          ...api.getAppState(),
          exportBackground: true,
          exportWithDarkMode: false,
          viewBackgroundColor: "#ffffff",
        },
        files: api.getFiles(),
        mimeType: "image/png",
        exportPadding: 32,
      })
    },
  }

  root.render(
    React.createElement(ExcalidrawLibrary.Excalidraw, {
      autoFocus: true,
      detectScroll: false,
      handleKeyboardGlobally: false,
      initialData,
      langCode: options.langCode,
      name: "KM Agent Whiteboard",
      theme: options.theme,
      excalidrawAPI: (value: ExcalidrawImperativeAPI) => {
        api = value
        updateSelectionCount(value.getSceneElements(), value.getAppState())
        notifyReady()
      },
      onChange: (elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
        notifyReady()
        updateSelectionCount(elements, appState)
        latestScene = {
          elements,
          files,
          appState: {
            gridModeEnabled: appState.gridModeEnabled,
            gridSize: appState.gridSize,
            gridStep: appState.gridStep,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            viewBackgroundColor: appState.viewBackgroundColor,
            zoom: appState.zoom,
          },
        }
        scheduleSave()
      },
      UIOptions: {
        canvasActions: {
          changeViewBackgroundColor: true,
          clearCanvas: false,
          export: false,
          loadScene: false,
          saveAsImage: false,
          saveToActiveFile: false,
          toggleTheme: false,
        },
      },
    }),
  )
}

function readScene(storageKey: string): ExcalidrawInitialDataState | null {
  if (typeof localStorage !== "object") return null
  try {
    const value = localStorage.getItem(storageKey)
    if (!value) return null
    const scene: unknown = JSON.parse(value)
    if (!isWhiteboardScene(scene)) return null
    return {
      elements: scene.elements,
      files: scene.files,
      appState: scene.appState,
      scrollToContent: !hasWhiteboardViewport(scene.appState),
    }
  } catch {
    return null
  }
}

function hasWhiteboardViewport(appState: Readonly<Partial<AppState>> | null | undefined) {
  return (
    !!appState &&
    typeof appState.scrollX === "number" &&
    typeof appState.scrollY === "number" &&
    !!appState.zoom &&
    typeof appState.zoom.value === "number"
  )
}

function isWhiteboardScene(value: unknown): value is WhiteboardScene {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const fields = Object.fromEntries(Object.entries(value))
  return (
    Array.isArray(fields.elements) &&
    !!fields.files &&
    typeof fields.files === "object" &&
    !Array.isArray(fields.files) &&
    !!fields.appState &&
    typeof fields.appState === "object" &&
    !Array.isArray(fields.appState)
  )
}

function writeScene(storageKey: string, scene: WhiteboardScene) {
  if (typeof localStorage !== "object") return
  try {
    localStorage.setItem(storageKey, JSON.stringify(scene))
  } catch {}
}
