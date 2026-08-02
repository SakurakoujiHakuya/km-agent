import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { useTheme } from "@opencode-ai/ui/theme/context"
import { createEffect, createMemo, For, onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import {
  parsePreviewPlaytestScenarios,
  PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT,
  previewPlaytestScenariosStorageKey,
  upsertPreviewPlaytestScenario,
} from "../game-preview-scenarios"
import { mountExcalidrawWhiteboard, type WhiteboardHandle } from "./excalidraw-bridge"
import {
  type WhiteboardChatMessage,
  type WhiteboardChatSendInput,
  whiteboardChatEditableProposal,
} from "./whiteboard-chat"
import { WhiteboardChatPanel } from "./whiteboard-chat-panel"
import { whiteboardDownloadName, whiteboardFileIssue } from "./whiteboard-file"
import { WhiteboardPlaytestPanel } from "./whiteboard-playtest-panel"
import {
  advanceWhiteboardPlaytest,
  formatWhiteboardPlaytestTrace,
  whiteboardPlaytestScenario,
  whiteboardPlaytestStarts,
  type WhiteboardPlaytestStep,
} from "./whiteboard-playtest"
import type { WhiteboardHandoffIntent } from "./whiteboard-prompt"
import { parseWhiteboardProposal, whiteboardProposalElements } from "./whiteboard-proposal"
import { reviewWhiteboardProposal, type WhiteboardProposalReview } from "./whiteboard-proposal-review"
import { inspectWhiteboardScene, type WhiteboardSceneScope, type WhiteboardSceneSummary } from "./whiteboard-scene"
import {
  whiteboardTemplate,
  whiteboardTemplateNeedsConfirmation,
  whiteboardTemplates,
  type WhiteboardTemplate,
  type WhiteboardTemplateId,
} from "./whiteboard-templates"
import {
  activateWhiteboardBoard,
  addWhiteboardBoard,
  linkWhiteboardChatMessage,
  parseWhiteboardWorkspace,
  removeWhiteboardBoard,
  renameWhiteboardBoard,
  WHITEBOARD_BOARD_MAX_COUNT,
  whiteboardBoardStorageKey,
  whiteboardChatVersions,
  whiteboardWorkspaceStorageKey,
} from "./whiteboard-workspace"

export default function WhiteboardDialog(props: {
  directory: string
  storageKey: string
  assistantText?: string
  initialTemplate?: WhiteboardTemplateId
  initialBoardName?: string
  onInitialTemplateApplied?: () => void
  chatMessages?: readonly WhiteboardChatMessage[]
  chatWorking?: boolean
  chatCanStop?: boolean
  onChatSend?: (input: WhiteboardChatSendInput) => boolean | void | Promise<boolean | void>
  onChatStop?: () => boolean | void | Promise<boolean | void>
  onAttach: (
    file: File,
    sceneContext?: string,
    intent?: WhiteboardHandoffIntent,
  ) => boolean | void | Promise<boolean | void>
  onClose: () => void
}) {
  const language = useLanguage()
  const theme = useTheme()
  const chinese = createMemo(() => language.locale() === "zh" || language.locale() === "zht")
  const workspace = readWhiteboardWorkspace(props.storageKey, chinese())
  const [state, setState] = createStore({
    handle: undefined as WhiteboardHandle | undefined,
    loading: true,
    exporting: false,
    importing: false,
    selectionCount: 0,
    saved: false,
    notice: "",
    confirmClear: false,
    confirmImport: false,
    pendingTemplate: undefined as WhiteboardTemplateId | undefined,
    workspace,
    boardNameDraft: workspace.boards.find((board) => board.id === workspace.active)?.name ?? "",
    confirmDeleteBoard: "",
    handoffIntent: "implement" as WhiteboardHandoffIntent,
    proposalApplied: false,
    proposalSource: "",
    proposalDraft: "",
    proposalInputOpen: false,
    chatOpen: false,
    chatSending: false,
    chatAutoApply: true,
    chatAutoAttempted: [] as string[],
    chatReviews: {} as Record<string, WhiteboardProposalReview | undefined>,
    chatBaselines: {} as Record<string, WhiteboardSceneSummary | undefined>,
    chatLiveMessage: "",
    chatLiveBoard: "",
    chatLiveSignature: "",
    playtest: undefined as WhiteboardSceneSummary | undefined,
    playtestPath: [] as WhiteboardPlaytestStep[],
    diagnostics: inspectWhiteboardScene([]),
    sceneVersion: 0,
    error: "",
  })
  const copy = createMemo(() =>
    chinese()
      ? {
          title: "创意白板",
          description: "绘制关卡、机关、流程或交互关系，然后把图片和精确结构交给 AI。",
          loading: "正在加载白板…",
          saved: "已自动保存",
          clear: "清空",
          confirmClear: "确认清空",
          exportFile: "导出文件",
          importFile: "导入文件",
          confirmImport: "确认导入",
          importHint: "导入会替换当前白板；再次点击确认，之后可用撤销恢复。",
          imported: "已导入，可撤销",
          exported: "已导出 .excalidraw",
          unsupported: "请选择 .excalidraw 或 JSON 白板文件。",
          tooLarge: "白板文件超过 12 MB，无法导入。",
          importFailed: "无法读取这个白板文件，请确认文件未损坏。",
          close: "关闭",
          attach: "添加到任务",
          attachAll: "添加全部",
          attachSelection: "添加选区",
          aiAction: "AI 动作",
          review: "评审设计",
          plan: "生成计划",
          implement: "实现 Demo",
          refine: "完善白板",
          aiProposal: "AI 可编辑方案",
          applyProposal: "生成新白板",
          proposalApplied: "AI 方案已生成，原白板已保留。",
          proposalHint: "从本任务最近一次有效的 AI 白板方案生成一张新白板，不覆盖当前内容。",
          importProposal: "导入 AI 方案",
          proposalInput: "粘贴包含 km-whiteboard JSON 代码块的 AI 回复",
          parseProposal: "解析方案",
          proposalInvalid: "没有找到有效的 km-whiteboard 方案，请检查格式、节点位置和连接引用。",
          chat: "AI 共创",
          chatUnavailable: "发送首条任务后即可在白板内与 AI 实时共创。",
          chatRevisionApplied: "AI 已生成新的可编辑白板版本，原版本保持不变。",
          chatLiveStarted: "AI 正在实时搭建新版本，原白板保持不变。",
          chatCurrentApplied: "AI 方案已替换当前白板，可使用撤销恢复。",
          playtest: "流程试玩",
          playtestEmpty: "至少需要一个矩形、菱形或椭圆节点才能开始流程试玩。",
          scenarioSaved: "已保存为 Demo 预览试玩场景。",
          scenarioLimit: `项目最多保存 ${PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT} 个试玩场景，请先在 Demo 预览中删除一个。`,
          workbenchCreated: "原型工作台白板已创建，已有白板保持不变。",
          currentBoard: "当前白板",
          structure: "结构",
          nodes: "节点",
          connections: "连接",
          notes: "备注",
          unnamed: "未命名",
          isolated: "孤立",
          cycles: "循环节点",
          noStructure: "暂无结构化节点",
          emptyBoard: "空白白板",
          empty: "请先在白板上绘制一些内容。",
          selectionEmpty: "请先在白板上选中要交给 AI 的内容。",
          boards: "白板",
          boardName: "白板名称",
          newBoard: "新建白板",
          deleteBoard: "删除白板",
          confirmDeleteBoard: "确认删除",
          boardLimit: `每个项目最多 ${WHITEBOARD_BOARD_MAX_COUNT} 张白板。`,
          lastBoard: "项目至少需要保留一张白板。",
          failed: "白板导出失败，请重试。",
          templates: "策划模板",
          replace: "确认替换",
          replaceHint: "当前白板有内容。再次点击同一模板即可替换，并可用撤销恢复。",
          templateFailed: "模板加载失败，请重试。",
        }
      : {
          title: "Idea board",
          description:
            "Sketch levels, puzzles, flows, or interactions, then send both the image and exact structure to AI.",
          loading: "Loading whiteboard…",
          saved: "Autosaved",
          clear: "Clear",
          confirmClear: "Confirm clear",
          exportFile: "Export file",
          importFile: "Import file",
          confirmImport: "Confirm import",
          importHint: "Import replaces this board. Click again to confirm; Undo can restore it afterward.",
          imported: "Imported · Undo available",
          exported: "Exported .excalidraw",
          unsupported: "Choose an .excalidraw or JSON board file.",
          tooLarge: "This board file is larger than 12 MB and cannot be imported.",
          importFailed: "Could not read this board file. Check that it is not damaged.",
          close: "Close",
          attach: "Add to task",
          attachAll: "Add all",
          attachSelection: "Add selection",
          aiAction: "AI action",
          review: "Review design",
          plan: "Create plan",
          implement: "Build demo",
          refine: "Refine board",
          aiProposal: "Editable AI proposal",
          applyProposal: "Create new board",
          proposalApplied: "AI proposal created. The original board is unchanged.",
          proposalHint: "Create a new board from the latest valid AI whiteboard proposal without replacing this one.",
          importProposal: "Import AI proposal",
          proposalInput: "Paste an AI response containing a km-whiteboard JSON code block",
          parseProposal: "Parse proposal",
          proposalInvalid: "No valid km-whiteboard proposal was found. Check its format, node positions, and links.",
          chat: "AI copilot",
          chatUnavailable: "Send the first task to enable live AI co-editing inside the whiteboard.",
          chatRevisionApplied: "AI created a new editable board revision. The previous version is unchanged.",
          chatLiveStarted: "AI is building a live revision. The previous board remains unchanged.",
          chatCurrentApplied: "AI replaced the current board. Use Undo to restore it.",
          playtest: "Flow playtest",
          playtestEmpty: "Add at least one rectangle, diamond, or ellipse node before starting a flow playtest.",
          scenarioSaved: "Saved as a Demo Preview playtest scenario.",
          scenarioLimit: `A project can keep up to ${PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT} playtest scenarios. Delete one in Demo Preview first.`,
          workbenchCreated: "Prototype workbench board created. Existing boards are unchanged.",
          currentBoard: "Current board",
          structure: "Structure",
          nodes: "nodes",
          connections: "links",
          notes: "notes",
          unnamed: "unlabeled",
          isolated: "disconnected",
          cycles: "cycle nodes",
          noStructure: "No structured nodes yet",
          emptyBoard: "Empty board",
          empty: "Draw something on the whiteboard first.",
          selectionEmpty: "Select the part of the whiteboard you want to send to AI.",
          boards: "Boards",
          boardName: "Board name",
          newBoard: "New board",
          deleteBoard: "Delete board",
          confirmDeleteBoard: "Confirm delete",
          boardLimit: `Each project can have up to ${WHITEBOARD_BOARD_MAX_COUNT} boards.`,
          lastBoard: "Keep at least one board in the project.",
          failed: "Could not export the whiteboard. Please try again.",
          templates: "Design templates",
          replace: "Confirm replace",
          replaceHint: "This board has content. Click the same template again to replace it; Undo can restore it.",
          templateFailed: "Could not load the template. Please try again.",
        },
  )
  const templates = createMemo(() => whiteboardTemplates(chinese()))
  const proposal = createMemo(() => parseWhiteboardProposal(state.proposalSource || props.assistantText))
  const initialChatMessageIDs = new Set((props.chatMessages ?? []).map((message) => message.id))
  let host: HTMLDivElement | undefined
  let savedTimer: number | undefined
  let clearTimer: number | undefined
  let templateTimer: number | undefined
  let noticeTimer: number | undefined
  let importTimer: number | undefined
  let deleteBoardTimer: number | undefined
  let sceneSwitchFrame: number | undefined
  let mountedHandle: WhiteboardHandle | undefined
  let importInput: HTMLInputElement | undefined
  let pendingImport: File | undefined
  const activeBoard = createMemo(
    () => state.workspace.boards.find((board) => board.id === state.workspace.active) ?? state.workspace.boards[0],
  )
  const activeBoardStorageKey = () => whiteboardBoardStorageKey(props.storageKey, state.workspace.active)
  const currentScene = createMemo(() => {
    state.sceneVersion
    return state.handle?.summarizeScene()
  })
  const chatVersions = createMemo(() => whiteboardChatVersions(state.workspace))
  const chatApplied = createMemo(() => Object.keys(chatVersions()))
  const structureStatus = createMemo(() => {
    const diagnostics = state.diagnostics
    if (diagnostics.elementCount === 0) return copy().emptyBoard
    if (diagnostics.nodeCount === 0 && diagnostics.noteCount === 0) return copy().noStructure
    return [
      diagnostics.nodeCount > 0 ? `${diagnostics.nodeCount} ${copy().nodes}` : "",
      diagnostics.connectionCount > 0 ? `${diagnostics.connectionCount} ${copy().connections}` : "",
      diagnostics.noteCount > 0 ? `${diagnostics.noteCount} ${copy().notes}` : "",
      diagnostics.unlabeled.length > 0 ? `${diagnostics.unlabeled.length} ${copy().unnamed}` : "",
      diagnostics.disconnected.length > 0 ? `${diagnostics.disconnected.length} ${copy().isolated}` : "",
      diagnostics.cycles.length > 0 ? `${diagnostics.cycles.length} ${copy().cycles}` : "",
    ]
      .filter(Boolean)
      .join(" · ")
  })

  createEffect(() => {
    if (!state.chatAutoApply || !state.handle) return
    const message = (props.chatMessages ?? [])
      .toReversed()
      .find(
        (item) =>
          item.role === "assistant" &&
          !!item.draft &&
          !initialChatMessageIDs.has(item.id) &&
          (!state.chatAutoAttempted.includes(item.id) || state.chatLiveMessage === item.id),
      )
    if (!message) return
    applyChatLiveDraft(message)
  })

  createEffect(() => {
    if (!state.chatAutoApply || !state.handle) return
    const message = (props.chatMessages ?? [])
      .toReversed()
      .find(
        (item) =>
          item.role === "assistant" &&
          !!item.proposal &&
          !initialChatMessageIDs.has(item.id) &&
          !state.chatAutoAttempted.includes(item.id),
      )
    if (!message) return
    setState("chatAutoAttempted", (ids) => [...ids, message.id])
    applyChatProposal(message, "revision")
  })

  onMount(() => {
    if (!host) return
    void mountExcalidrawWhiteboard(host, {
      storageKey: activeBoardStorageKey(),
      langCode: excalidrawLocale(language.locale()),
      theme: theme.mode(),
      onReady: (handle) => {
        mountedHandle = handle
        setState({ handle, loading: false, diagnostics: handle.inspectScene(), sceneVersion: state.sceneVersion + 1 })
        applyInitialTemplate(handle)
      },
      onSelectionChange: (count) => setState("selectionCount", count),
      onSaved: () => {
        if (savedTimer !== undefined) window.clearTimeout(savedTimer)
        setState({
          saved: true,
          diagnostics: state.handle?.inspectScene() ?? inspectWhiteboardScene([]),
          sceneVersion: state.sceneVersion + 1,
        })
        savedTimer = window.setTimeout(() => setState("saved", false), 1600)
      },
    }).catch((error: unknown) =>
      setState({ loading: false, error: error instanceof Error ? error.message : copy().failed }),
    )
  })

  onCleanup(() => {
    if (savedTimer !== undefined) window.clearTimeout(savedTimer)
    if (clearTimer !== undefined) window.clearTimeout(clearTimer)
    if (templateTimer !== undefined) window.clearTimeout(templateTimer)
    if (noticeTimer !== undefined) window.clearTimeout(noticeTimer)
    if (importTimer !== undefined) window.clearTimeout(importTimer)
    if (deleteBoardTimer !== undefined) window.clearTimeout(deleteBoardTimer)
    if (sceneSwitchFrame !== undefined) window.cancelAnimationFrame(sceneSwitchFrame)
    mountedHandle = undefined
    state.handle?.dispose()
  })

  const clear = () => {
    if (!state.handle) return
    if (!state.confirmClear) {
      setState("confirmClear", true)
      if (clearTimer !== undefined) window.clearTimeout(clearTimer)
      clearTimer = window.setTimeout(() => setState("confirmClear", false), 3000)
      return
    }
    state.handle.clear()
    setState({ confirmClear: false, pendingTemplate: undefined, playtest: undefined, playtestPath: [] })
  }

  const applyTemplate = (template: WhiteboardTemplate) => {
    const handle = state.handle
    if (!handle) return
    if (whiteboardTemplateNeedsConfirmation(handle.hasContent(), state.pendingTemplate, template.id)) {
      setState({ pendingTemplate: template.id, error: "" })
      if (templateTimer !== undefined) window.clearTimeout(templateTimer)
      templateTimer = window.setTimeout(() => setState("pendingTemplate", undefined), 5000)
      return
    }
    if (templateTimer !== undefined) window.clearTimeout(templateTimer)
    try {
      handle.replaceWith(template.elements)
      setState({ pendingTemplate: undefined, confirmClear: false, playtest: undefined, playtestPath: [], error: "" })
    } catch (error) {
      setState("error", error instanceof Error ? error.message : copy().templateFailed)
    }
  }

  function applyInitialTemplate(handle: WhiteboardHandle) {
    if (!props.initialTemplate) return
    const template = whiteboardTemplate(props.initialTemplate, chinese())
    if (!template) return
    if (state.workspace.boards.length >= WHITEBOARD_BOARD_MAX_COUNT) {
      setState("error", copy().boardLimit)
      return
    }
    const added = addWhiteboardBoard(state.workspace, crypto.randomUUID(), chinese())
    if (added === state.workspace) return
    const workspace = renameWhiteboardBoard(added, added.active, props.initialBoardName ?? template.title)
    populateNewBoard(handle, workspace, template.elements, copy().workbenchCreated)
    props.onInitialTemplateApplied?.()
  }

  const applyProposal = () => {
    const value = proposal()
    const handle = mountedHandle
    if (!value || !handle || state.proposalApplied) return
    if (state.workspace.boards.length >= WHITEBOARD_BOARD_MAX_COUNT) {
      setState("error", copy().boardLimit)
      return
    }
    const added = addWhiteboardBoard(state.workspace, crypto.randomUUID(), chinese())
    if (added === state.workspace) return
    const workspace = renameWhiteboardBoard(added, added.active, value.title)
    populateNewBoard(handle, workspace, whiteboardProposalElements(value), copy().proposalApplied)
    setState("proposalApplied", true)
  }

  function applyChatProposal(message: WhiteboardChatMessage, target: "revision" | "current") {
    const value = whiteboardChatEditableProposal(message)
    const handle = mountedHandle
    if (!value || !handle || chatApplied().includes(message.id)) return false
    if (!state.chatReviews[message.id]) {
      setState("chatReviews", message.id, reviewWhiteboardProposal(handle.summarizeScene(), value))
    }
    if (target === "current") {
      handle.replaceWith(whiteboardProposalElements(value))
      saveWorkspace(linkWhiteboardChatMessage(state.workspace, state.workspace.active, message.id))
      setState({
        pendingTemplate: undefined,
        playtest: undefined,
        playtestPath: [],
        error: "",
      })
      showNotice(copy().chatCurrentApplied)
      return true
    }
    if (state.workspace.boards.length >= WHITEBOARD_BOARD_MAX_COUNT) {
      setState("error", copy().boardLimit)
      return false
    }
    const added = addWhiteboardBoard(state.workspace, crypto.randomUUID(), chinese())
    if (added === state.workspace) return false
    const partial = !!message.draft && !message.draft.complete && !message.proposal
    const name = partial ? `${chinese() ? "AI 草稿" : "AI draft"} · ${value.title}` : value.title
    const workspace = linkWhiteboardChatMessage(
      renameWhiteboardBoard(added, added.active, name),
      added.active,
      message.id,
    )
    populateNewBoard(handle, workspace, whiteboardProposalElements(value), copy().chatRevisionApplied)
    return true
  }

  function applyChatLiveDraft(message: WhiteboardChatMessage) {
    const draft = message.draft
    const handle = mountedHandle
    if (!draft || !handle) return false
    const signature = `${draft.complete}:${JSON.stringify(draft.proposal)}`
    if (state.chatLiveMessage === message.id && state.chatLiveSignature === signature) return false

    const existing = state.chatLiveMessage === message.id ? state.chatLiveBoard : ""
    if (existing && state.workspace.active !== existing) {
      setState({ chatLiveMessage: "", chatLiveBoard: "", chatLiveSignature: "" })
      return false
    }
    const baseline = state.chatBaselines[message.id] ?? handle.summarizeScene()
    const review = reviewWhiteboardProposal(baseline, draft.proposal)
    if (existing) {
      if (sceneSwitchFrame !== undefined) {
        window.cancelAnimationFrame(sceneSwitchFrame)
        sceneSwitchFrame = undefined
      }
      handle.replaceWith(whiteboardProposalElements(draft.proposal))
      const name = draft.complete
        ? draft.proposal.title
        : `${chinese() ? "AI 草稿" : "AI draft"} · ${draft.proposal.title}`
      const workspace = linkWhiteboardChatMessage(
        renameWhiteboardBoard(state.workspace, existing, name),
        existing,
        message.id,
      )
      if (workspace !== state.workspace) saveWorkspace(workspace)
      setState({
        chatLiveSignature: signature,
        chatReviews: { ...state.chatReviews, [message.id]: review },
        chatAutoAttempted: draft.complete
          ? [...state.chatAutoAttempted.filter((id) => id !== message.id), message.id]
          : state.chatAutoAttempted,
      })
      if (draft.complete) showNotice(copy().chatRevisionApplied)
      return true
    }
    if (state.workspace.boards.length >= WHITEBOARD_BOARD_MAX_COUNT) {
      setState({
        error: copy().boardLimit,
        chatAutoAttempted: [...state.chatAutoAttempted, message.id],
      })
      return false
    }
    const added = addWhiteboardBoard(state.workspace, crypto.randomUUID(), chinese())
    if (added === state.workspace) return false
    const name = draft.complete
      ? draft.proposal.title
      : `${chinese() ? "AI 草稿" : "AI draft"} · ${draft.proposal.title}`
    const workspace = linkWhiteboardChatMessage(
      renameWhiteboardBoard(added, added.active, name),
      added.active,
      message.id,
    )
    setState({
      chatBaselines: { ...state.chatBaselines, [message.id]: baseline },
      chatReviews: { ...state.chatReviews, [message.id]: review },
      chatLiveMessage: message.id,
      chatLiveBoard: workspace.active,
      chatLiveSignature: signature,
      chatAutoAttempted: [...state.chatAutoAttempted, message.id],
    })
    populateNewBoard(handle, workspace, whiteboardProposalElements(draft.proposal), copy().chatLiveStarted)
    return true
  }

  const parseProposalDraft = () => {
    const source = state.proposalDraft.trim()
    if (!source) {
      setState("proposalInputOpen", !state.proposalInputOpen)
      return
    }
    if (!parseWhiteboardProposal(source)) {
      setState("error", copy().proposalInvalid)
      return
    }
    setState({
      proposalSource: source,
      proposalDraft: "",
      proposalInputOpen: false,
      proposalApplied: false,
      error: "",
    })
  }

  const showNotice = (notice: string) => {
    if (noticeTimer !== undefined) window.clearTimeout(noticeTimer)
    setState({ notice, saved: false })
    noticeTimer = window.setTimeout(() => setState("notice", ""), 2200)
  }

  const saveWorkspace = (workspace: typeof state.workspace) => {
    writeWhiteboardWorkspace(props.storageKey, workspace)
    setState({
      workspace,
      boardNameDraft: workspace.boards.find((board) => board.id === workspace.active)?.name ?? "",
      confirmDeleteBoard: "",
      selectionCount: 0,
      diagnostics: state.handle?.inspectScene() ?? inspectWhiteboardScene([]),
      sceneVersion: state.sceneVersion + 1,
      error: "",
    })
  }

  const populateNewBoard = (
    handle: WhiteboardHandle,
    workspace: typeof state.workspace,
    elements: WhiteboardTemplate["elements"],
    notice: string,
  ) => {
    if (sceneSwitchFrame !== undefined) window.cancelAnimationFrame(sceneSwitchFrame)
    handle.switchScene(whiteboardBoardStorageKey(props.storageKey, workspace.active))
    saveWorkspace(workspace)
    sceneSwitchFrame = window.requestAnimationFrame(() => {
      sceneSwitchFrame = undefined
      if (mountedHandle !== handle) return
      handle.replaceWith(elements)
      setState({ playtest: undefined, playtestPath: [] })
      showNotice(notice)
    })
  }

  const switchBoard = (id: string) => {
    const workspace = activateWhiteboardBoard(state.workspace, id)
    if (workspace === state.workspace || state.exporting || state.importing) return
    state.handle?.switchScene(whiteboardBoardStorageKey(props.storageKey, workspace.active))
    saveWorkspace(workspace)
    setState({ playtest: undefined, playtestPath: [] })
  }

  const addBoard = () => {
    if (state.workspace.boards.length >= WHITEBOARD_BOARD_MAX_COUNT) {
      setState("error", copy().boardLimit)
      return
    }
    const workspace = addWhiteboardBoard(state.workspace, crypto.randomUUID(), chinese())
    if (workspace === state.workspace) return
    state.handle?.switchScene(whiteboardBoardStorageKey(props.storageKey, workspace.active))
    saveWorkspace(workspace)
    setState({ playtest: undefined, playtestPath: [] })
  }

  const saveBoardName = () => {
    const workspace = renameWhiteboardBoard(state.workspace, state.workspace.active, state.boardNameDraft)
    if (workspace === state.workspace) {
      setState("boardNameDraft", activeBoard()?.name ?? "")
      return
    }
    saveWorkspace(workspace)
  }

  const deleteBoard = () => {
    if (state.workspace.boards.length <= 1) {
      setState("error", copy().lastBoard)
      return
    }
    const id = state.workspace.active
    if (state.confirmDeleteBoard !== id) {
      setState({ confirmDeleteBoard: id, error: "" })
      if (deleteBoardTimer !== undefined) window.clearTimeout(deleteBoardTimer)
      deleteBoardTimer = window.setTimeout(() => setState("confirmDeleteBoard", ""), 4000)
      return
    }
    if (deleteBoardTimer !== undefined) window.clearTimeout(deleteBoardTimer)
    const workspace = removeWhiteboardBoard(state.workspace, id)
    state.handle?.switchScene(whiteboardBoardStorageKey(props.storageKey, workspace.active))
    removeWhiteboardScene(props.storageKey, id)
    saveWorkspace(workspace)
    setState({ playtest: undefined, playtestPath: [] })
  }

  const exportScene = () => {
    const handle = state.handle
    if (!handle) return
    try {
      const url = URL.createObjectURL(handle.exportScene())
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = whiteboardDownloadName()
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      showNotice(copy().exported)
    } catch {
      setState("error", copy().failed)
    }
  }

  const importScene = async (file: File) => {
    const handle = state.handle
    if (!handle) return
    setState({ importing: true, confirmImport: false, playtest: undefined, playtestPath: [], error: "", notice: "" })
    pendingImport = undefined
    if (importTimer !== undefined) window.clearTimeout(importTimer)
    const imported = await handle.importScene(file).then(
      () => true,
      () => false,
    )
    if (!imported) {
      setState({ importing: false, error: copy().importFailed })
      return
    }
    setState("importing", false)
    showNotice(copy().imported)
  }

  const selectImport = (event: Event) => {
    const input = event.currentTarget
    if (!(input instanceof HTMLInputElement)) return
    const file = input.files?.[0]
    input.value = ""
    if (!file) return
    const issue = whiteboardFileIssue(file)
    if (issue) {
      setState("error", issue === "too-large" ? copy().tooLarge : copy().unsupported)
      return
    }
    if (!state.handle?.hasContent()) {
      void importScene(file)
      return
    }
    pendingImport = file
    setState({ confirmImport: true, error: "", notice: "" })
    if (importTimer !== undefined) window.clearTimeout(importTimer)
    importTimer = window.setTimeout(() => {
      pendingImport = undefined
      setState("confirmImport", false)
    }, 5000)
  }

  const requestImport = () => {
    if (state.confirmImport && pendingImport) {
      void importScene(pendingImport)
      return
    }
    importInput?.click()
  }

  const attach = async (
    scope: WhiteboardSceneScope,
    extraContext?: string,
    intent: WhiteboardHandoffIntent = state.handoffIntent,
  ) => {
    const handle = state.handle
    if (!handle?.hasContent()) {
      setState("error", scope === "selection" ? copy().selectionEmpty : copy().empty)
      return
    }
    if (scope === "selection" && !handle.hasSelection()) {
      setState("error", copy().selectionEmpty)
      return
    }
    setState({ exporting: true, error: "" })
    const blob = await handle.exportPng(scope).catch(() => undefined)
    if (!blob) {
      setState({ exporting: false, error: copy().failed })
      return
    }
    const accepted = await Promise.resolve(
      props.onAttach(
        new File(
          [blob],
          `km-agent-whiteboard${scope === "selection" ? "-selection" : ""}-${new Date().toISOString().replaceAll(":", "-")}.png`,
          { type: "image/png" },
        ),
        [`${copy().currentBoard}: ${activeBoard()?.name}`, handle.describeScene(chinese(), scope), extraContext]
          .filter(Boolean)
          .join("\n\n") || undefined,
        intent,
      ),
    )
      .then((value) => value !== false)
      .catch(() => false)
    if (!accepted) {
      setState({ exporting: false, error: copy().failed })
      return
    }
    setState("exporting", false)
  }

  const sendChat = async (request: string, scope: WhiteboardSceneScope) => {
    const handle = state.handle
    if (!handle || !props.onChatSend || state.chatSending || props.chatWorking) return false
    if (scope === "selection" && !handle.hasSelection()) {
      setState("error", copy().selectionEmpty)
      return false
    }
    setState({ chatSending: true, error: "" })
    const blob = handle.hasContent() ? await handle.exportPng(scope).catch(() => undefined) : undefined
    if (handle.hasContent() && !blob) {
      setState({ chatSending: false, error: copy().failed })
      return false
    }
    const accepted = await Promise.resolve(
      props.onChatSend({
        request,
        boardName: activeBoard()?.name ?? "",
        sceneContext: [
          handle.describeScene(chinese(), "all"),
          scope === "selection" ? handle.describeScene(chinese(), "selection") : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        scope,
        image: blob
          ? new File(
              [blob],
              `km-agent-whiteboard-chat${scope === "selection" ? "-selection" : ""}-${new Date().toISOString().replaceAll(":", "-")}.png`,
              { type: "image/png" },
            )
          : undefined,
      }),
    )
      .then((value) => value !== false)
      .catch(() => false)
    setState("chatSending", false)
    if (!accepted) setState("error", copy().failed)
    return accepted
  }

  const openPlaytest = () => {
    const graph = state.handle?.summarizeScene()
    const start = graph ? whiteboardPlaytestStarts(graph)[0] : undefined
    if (!graph || !start) {
      setState("error", copy().playtestEmpty)
      return
    }
    setState({ playtest: graph, playtestPath: [{ ref: start }], error: "" })
  }

  const reviewPlaytest = () => {
    const graph = state.playtest
    if (!graph) return
    const trace = formatWhiteboardPlaytestTrace(graph, state.playtestPath, chinese())
    if (!trace) return
    void attach("all", trace, "review")
  }

  const savePlaytestScenario = () => {
    const graph = state.playtest
    if (!graph || typeof localStorage !== "object") return
    const scenario = whiteboardPlaytestScenario(graph, state.playtestPath, {
      id: `whiteboard-flow:${state.workspace.active}`,
      board: activeBoard()?.name ?? "",
      chinese: chinese(),
    })
    if (!scenario) return
    try {
      const key = previewPlaytestScenariosStorageKey(props.directory)
      const current = parsePreviewPlaytestScenarios(localStorage.getItem(key))
      const next = upsertPreviewPlaytestScenario(current, scenario)
      if (next === current) {
        setState("error", copy().scenarioLimit)
        return
      }
      localStorage.setItem(key, JSON.stringify(next))
      setState("error", "")
      showNotice(copy().scenarioSaved)
    } catch {
      setState("error", copy().failed)
    }
  }

  return (
    <div
      data-component="whiteboard-dialog"
      class="fixed inset-0 z-[250] flex flex-col bg-v2-background-bg-base"
      role="dialog"
      aria-modal="true"
      aria-label={copy().title}
    >
      <header class="flex h-14 shrink-0 items-center gap-3 border-b border-v2-border-border-base px-4">
        <div class="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-v2-background-bg-layer-02">
          <IconV2 name="edit" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[14px] text-v2-text-text-strong [font-weight:580]">{copy().title}</div>
          <div class="truncate text-[12px] text-v2-text-text-muted">{copy().description}</div>
        </div>
        <Show when={state.notice || state.saved}>
          <span class="text-[12px] text-v2-text-text-muted">{state.notice || copy().saved}</span>
        </Show>
        <ButtonV2
          data-action="whiteboard-chat-toggle"
          variant={state.chatOpen ? "neutral" : "ghost-muted"}
          size="normal"
          icon="edit"
          disabled={!state.handle || state.exporting || state.importing}
          onClick={() => setState("chatOpen", !state.chatOpen)}
        >
          {copy().chat}
        </ButtonV2>
        <ButtonV2
          data-action="whiteboard-export-file"
          variant="ghost-muted"
          size="normal"
          disabled={!state.handle || state.exporting || state.importing}
          onClick={exportScene}
        >
          {copy().exportFile}
        </ButtonV2>
        <ButtonV2
          data-action="whiteboard-import-file"
          variant={state.confirmImport ? "neutral" : "ghost-muted"}
          size="normal"
          disabled={!state.handle || state.exporting || state.importing}
          title={state.confirmImport ? copy().importHint : undefined}
          onClick={requestImport}
        >
          {state.confirmImport ? copy().confirmImport : copy().importFile}
        </ButtonV2>
        <input
          ref={importInput}
          class="hidden"
          type="file"
          accept=".excalidraw,.json,application/vnd.excalidraw+json,application/json"
          onChange={selectImport}
        />
        <ButtonV2
          data-action="whiteboard-clear"
          variant="ghost-muted"
          size="normal"
          disabled={!state.handle || state.importing}
          onClick={clear}
        >
          {state.confirmClear ? copy().confirmClear : copy().clear}
        </ButtonV2>
        <ButtonV2 data-action="whiteboard-close" variant="neutral" size="normal" onClick={props.onClose}>
          {copy().close}
        </ButtonV2>
        <select
          data-action="whiteboard-handoff-intent"
          class="h-8 w-32 shrink-0 rounded-[7px] border border-v2-border-border-base bg-v2-background-bg-base px-2 text-[12px] text-v2-text-text-base outline-none focus:border-v2-border-border-focus"
          aria-label={copy().aiAction}
          value={state.handoffIntent}
          disabled={!state.handle || state.exporting || state.importing}
          onChange={(event) => setState("handoffIntent", parseHandoffIntent(event.currentTarget.value))}
        >
          <option value="review">{copy().review}</option>
          <option value="plan">{copy().plan}</option>
          <option value="refine">{copy().refine}</option>
          <option value="implement">{copy().implement}</option>
        </select>
        <ButtonV2
          data-action="whiteboard-attach"
          variant={state.selectionCount > 0 ? "neutral" : "contrast"}
          size="normal"
          icon="edit"
          disabled={!state.handle || state.exporting || state.importing}
          onClick={() => void attach("all")}
        >
          {state.selectionCount > 0 ? copy().attachAll : copy().attach}
        </ButtonV2>
        <ButtonV2
          data-action="whiteboard-attach-selection"
          variant={state.selectionCount > 0 ? "contrast" : "neutral"}
          size="normal"
          icon="edit"
          disabled={!state.handle || state.exporting || state.importing}
          onClick={() => void attach("selection")}
        >
          {copy().attachSelection}
          <Show when={state.selectionCount > 0}> · {state.selectionCount}</Show>
        </ButtonV2>
      </header>
      <Show when={state.confirmImport}>
        <div class="shrink-0 border-b border-v2-border-border-base bg-v2-background-bg-layer-02 px-4 py-2 text-[12px] text-v2-text-text-base">
          {copy().importHint}
        </div>
      </Show>
      <div
        data-component="whiteboard-board-tabs"
        class="flex min-h-11 shrink-0 items-center gap-2 border-b border-v2-border-border-base bg-v2-background-bg-layer-02 px-4 py-1.5"
      >
        <span class="shrink-0 text-[12px] text-v2-text-text-muted">{copy().boards}</span>
        <span
          class="max-w-72 shrink-0 truncate rounded-[6px] border border-v2-border-border-base bg-v2-background-bg-base px-2 py-1 text-[11px] text-v2-text-text-muted"
          aria-label={`${copy().structure}: ${structureStatus()}`}
          title={structureStatus()}
        >
          {structureStatus()}
        </span>
        <ButtonV2
          data-action="whiteboard-playtest"
          variant={state.playtest ? "neutral" : "ghost-muted"}
          size="small"
          disabled={!state.handle || state.exporting || state.importing || state.diagnostics.nodeCount === 0}
          onClick={openPlaytest}
        >
          {copy().playtest}
        </ButtonV2>
        <div class="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          <For each={state.workspace.boards}>
            {(board) => (
              <ButtonV2
                data-action="whiteboard-switch-board"
                variant={state.workspace.active === board.id ? "neutral" : "ghost-muted"}
                size="small"
                disabled={!state.handle || state.exporting || state.importing}
                onClick={() => switchBoard(board.id)}
              >
                {board.name}
              </ButtonV2>
            )}
          </For>
        </div>
        <input
          class="h-7 w-40 shrink-0 rounded-[6px] border border-v2-border-border-base bg-v2-background-bg-base px-2 text-[12px] text-v2-text-text-base outline-none focus:border-v2-border-border-focus"
          aria-label={copy().boardName}
          value={state.boardNameDraft}
          maxLength={48}
          disabled={!state.handle || state.exporting || state.importing}
          onInput={(event) => setState("boardNameDraft", event.currentTarget.value)}
          onBlur={saveBoardName}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
            if (event.key !== "Escape") return
            setState("boardNameDraft", activeBoard()?.name ?? "")
            event.currentTarget.blur()
          }}
        />
        <ButtonV2
          data-action="whiteboard-add-board"
          variant="ghost-muted"
          size="small"
          disabled={!state.handle || state.exporting || state.importing}
          onClick={addBoard}
        >
          + {copy().newBoard}
        </ButtonV2>
        <ButtonV2
          data-action="whiteboard-delete-board"
          variant={state.confirmDeleteBoard === state.workspace.active ? "neutral" : "ghost-muted"}
          size="small"
          disabled={!state.handle || state.exporting || state.importing}
          onClick={deleteBoard}
        >
          {state.confirmDeleteBoard === state.workspace.active ? copy().confirmDeleteBoard : copy().deleteBoard}
        </ButtonV2>
      </div>
      <Show when={state.proposalInputOpen}>
        <div class="flex shrink-0 items-center gap-2 border-b border-v2-border-border-base bg-v2-background-bg-layer-01 px-4 py-2">
          <textarea
            data-action="whiteboard-ai-proposal-input"
            class="h-16 min-w-0 flex-1 resize-none rounded-[7px] border border-v2-border-border-base bg-v2-background-bg-base px-3 py-2 font-mono text-[11px] text-v2-text-text-base outline-none focus:border-v2-border-border-focus"
            aria-label={copy().proposalInput}
            placeholder={copy().proposalInput}
            value={state.proposalDraft}
            onInput={(event) => setState("proposalDraft", event.currentTarget.value)}
          />
          <ButtonV2
            data-action="whiteboard-parse-ai-proposal"
            variant="contrast"
            size="small"
            disabled={!state.proposalDraft.trim()}
            onClick={parseProposalDraft}
          >
            {copy().parseProposal}
          </ButtonV2>
        </div>
      </Show>
      <Show when={proposal()}>
        {(value) => (
          <div
            data-component="whiteboard-ai-proposal"
            class="flex min-h-11 shrink-0 items-center gap-3 border-b border-v2-border-border-base bg-v2-background-bg-layer-02 px-4 py-1.5"
          >
            <div class="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-v2-background-bg-base">
              <IconV2 name="grid-plus" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[12px] text-v2-text-text-strong [font-weight:580]">
                {copy().aiProposal} · {value().title}
              </div>
              <div class="truncate text-[11px] text-v2-text-text-muted" title={copy().proposalHint}>
                {value().nodes.length} {copy().nodes} · {value().connections.length} {copy().connections} ·{" "}
                {copy().proposalHint}
              </div>
            </div>
            <ButtonV2
              data-action="whiteboard-apply-ai-proposal"
              variant="contrast"
              size="small"
              disabled={!state.handle || state.exporting || state.importing || state.proposalApplied}
              onClick={applyProposal}
            >
              {state.proposalApplied ? copy().proposalApplied : copy().applyProposal}
            </ButtonV2>
          </div>
        )}
      </Show>
      <div class="flex min-h-11 shrink-0 items-center gap-2 border-b border-v2-border-border-base bg-v2-background-bg-layer-01 px-4 py-1.5">
        <span class="shrink-0 text-[12px] text-v2-text-text-muted">{copy().templates}</span>
        <ButtonV2
          data-action="whiteboard-import-ai-proposal"
          variant={state.proposalInputOpen ? "neutral" : "ghost-muted"}
          size="small"
          disabled={!state.handle || state.exporting || state.importing}
          onClick={() => setState("proposalInputOpen", !state.proposalInputOpen)}
        >
          {copy().importProposal}
        </ButtonV2>
        <For each={templates()}>
          {(template) => {
            const pending = () => state.pendingTemplate === template.id
            return (
              <ButtonV2
                data-action={`whiteboard-template-${template.id}`}
                variant={pending() ? "neutral" : "ghost-muted"}
                size="small"
                disabled={!state.handle || state.exporting}
                title={pending() ? copy().replaceHint : template.description}
                onClick={() => applyTemplate(template)}
              >
                {pending() ? `${copy().replace} · ${template.title}` : template.title}
              </ButtonV2>
            )
          }}
        </For>
        <Show when={state.pendingTemplate}>
          <span class="min-w-0 truncate text-[11px] text-v2-text-text-muted">{copy().replaceHint}</span>
        </Show>
      </div>
      <Show when={state.error}>
        <div class="shrink-0 border-b border-v2-border-border-base bg-v2-background-bg-layer-02 px-4 py-2 text-[12px] text-v2-text-text-base">
          {state.error}
        </div>
      </Show>
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <div class="relative min-w-0 flex-1 overflow-hidden">
          <Show when={state.loading}>
            <div class="absolute inset-0 z-10 flex items-center justify-center bg-v2-background-bg-base text-v2-text-text-muted">
              {copy().loading}
            </div>
          </Show>
          <Show when={state.playtest}>
            {(graph) => (
              <WhiteboardPlaytestPanel
                chinese={chinese()}
                graph={graph()}
                path={state.playtestPath}
                disabled={state.exporting || state.importing}
                onStart={(ref) => setState("playtestPath", [{ ref }])}
                onAdvance={(connection) =>
                  setState("playtestPath", advanceWhiteboardPlaytest(graph(), state.playtestPath, connection))
                }
                onBack={() => setState("playtestPath", state.playtestPath.slice(0, -1))}
                onRestart={() =>
                  setState("playtestPath", [
                    { ref: state.playtestPath[0]?.ref ?? whiteboardPlaytestStarts(graph())[0] },
                  ])
                }
                onSaveScenario={savePlaytestScenario}
                onReview={reviewPlaytest}
                onClose={() => setState({ playtest: undefined, playtestPath: [] })}
              />
            )}
          </Show>
          <div ref={host} class="size-full" />
        </div>
        <Show when={state.chatOpen}>
          <WhiteboardChatPanel
            chinese={chinese()}
            messages={props.chatMessages ?? []}
            working={!!props.chatWorking}
            canStop={!!props.chatCanStop}
            sending={state.chatSending}
            applied={chatApplied()}
            versions={chatVersions()}
            activeBoardID={state.workspace.active}
            scene={currentScene()}
            selectionCount={state.selectionCount}
            reviews={state.chatReviews}
            autoApply={state.chatAutoApply}
            disabledReason={props.onChatSend ? undefined : copy().chatUnavailable}
            onAutoApplyChange={(value) => setState("chatAutoApply", value)}
            onSend={sendChat}
            onStop={props.onChatStop}
            onApply={applyChatProposal}
            onOpenVersion={switchBoard}
            onClose={() => setState("chatOpen", false)}
          />
        </Show>
      </div>
    </div>
  )
}

function excalidrawLocale(locale: ReturnType<typeof useLanguage>["locale"] extends () => infer Value ? Value : never) {
  if (locale === "zh") return "zh-CN"
  if (locale === "zht") return "zh-TW"
  if (locale === "br") return "pt-BR"
  if (locale === "no") return "nb-NO"
  return locale
}

function parseHandoffIntent(value: string): WhiteboardHandoffIntent {
  if (value === "review" || value === "plan" || value === "refine") return value
  return "implement"
}

function readWhiteboardWorkspace(storageKey: string, chinese: boolean) {
  if (typeof localStorage !== "object") return parseWhiteboardWorkspace(null, chinese)
  try {
    return parseWhiteboardWorkspace(localStorage.getItem(whiteboardWorkspaceStorageKey(storageKey)), chinese)
  } catch {
    return parseWhiteboardWorkspace(null, chinese)
  }
}

function writeWhiteboardWorkspace(storageKey: string, workspace: ReturnType<typeof readWhiteboardWorkspace>) {
  if (typeof localStorage !== "object") return
  try {
    localStorage.setItem(whiteboardWorkspaceStorageKey(storageKey), JSON.stringify(workspace))
  } catch {}
}

function removeWhiteboardScene(storageKey: string, id: string) {
  if (typeof localStorage !== "object") return
  try {
    localStorage.removeItem(whiteboardBoardStorageKey(storageKey, id))
  } catch {}
}
