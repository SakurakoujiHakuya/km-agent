import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { createMemo, For, onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useSDK } from "@/context/sdk"
import {
  deletePreviewFrame,
  listPreviewFrames,
  PREVIEW_ACCEPTANCE_CRITERIA,
  PREVIEW_FRAME_NOTE_MAX_LENGTH,
  PREVIEW_ISSUE_TAGS,
  previewFrameFile,
  savePreviewFrame,
  updatePreviewFrame,
  type GamePreviewFrame,
  type PreviewAcceptanceChecks,
  type PreviewAcceptanceCriterion,
  type PreviewAcceptanceState,
  type PreviewIssueTag,
} from "./game-preview-history"
import {
  detectPreviewURLs,
  normalizePreviewURL,
  previewAcceptancePlanContext,
  previewAnnotationContext,
  previewCaptureRegion,
  previewPlaytestScenarioContext,
  type PreviewCaptureIntent,
} from "./game-preview"
import {
  emptyPreviewAcceptancePlan,
  normalizePreviewAcceptancePlan,
  parsePreviewAcceptancePlan,
  PREVIEW_ACCEPTANCE_PLAN_ITEM_MAX_LENGTH,
  previewAcceptancePlanStorageKey,
  type PreviewAcceptancePlan,
} from "./game-preview-plan"
import {
  activePreviewPlaytestScenario,
  createPreviewPlaytestScenario,
  emptyPreviewPlaytestScenarios,
  normalizePreviewPlaytestScenarios,
  parsePreviewPlaytestScenarios,
  PREVIEW_PLAYTEST_SCENARIO_DETAIL_MAX_LENGTH,
  PREVIEW_PLAYTEST_SCENARIO_NAME_MAX_LENGTH,
  PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT,
  previewPlaytestScenariosStorageKey,
  type PreviewPlaytestScenario,
} from "./game-preview-scenarios"
import {
  previewReportFilename,
  previewReportFrame,
  previewReportHTML,
  previewReportProjectName,
} from "./game-preview-report"
import {
  activePreviewBuildTarget,
  applyPreviewBuildRecommendation,
  createPreviewBuildTarget,
  defaultPreviewBuildTargets,
  normalizePreviewBuildTarget,
  normalizePreviewBuildTargets,
  parsePreviewBuildTargets,
  PREVIEW_BUILD_COMMAND_MAX_LENGTH,
  PREVIEW_BUILD_OUTPUT_MAX_LENGTH,
  PREVIEW_BUILD_TARGET_NAME_MAX_LENGTH,
  PREVIEW_BUILD_TARGETS_MAX_COUNT,
  previewBuildRecommendationApplied,
  previewBuildTargetsStorageKey,
  type PreviewBuildResult,
  type PreviewBuildTarget,
} from "./game-preview-build"
import {
  previewProjectKindLabel,
  previewPrototypePrompt,
  type PreviewProjectHint,
  type PreviewProjectProfile,
} from "./game-preview-project"
import { loadPreviewProjectProfile } from "./game-preview-project-loader"
import { GamePreviewRunPanel } from "./game-preview-run-panel"
import {
  emptyPreviewPlaytestRun,
  normalizePreviewPlaytestRun,
  previewPlaytestRunComplete,
  previewPlaytestRunContext,
  previewPlaytestScenarioSteps,
  type PreviewPlaytestRun,
  type PreviewPlaytestStepState,
} from "./game-preview-run"

const COMMON_PREVIEW_PORTS = [3000, 5173, 8080, 8000]
type PreviewFrameView = { frame: GamePreviewFrame; src: string }

export default function GamePreviewDialog(props: {
  directory: string
  startCommand?: string
  onStart?: (command?: string) => boolean | Promise<boolean>
  onCapture?: (
    files: File[],
    intent: PreviewCaptureIntent,
    annotation?: string,
  ) => boolean | void | Promise<boolean | void>
  onBuild?: (target: PreviewBuildTarget) => Promise<PreviewBuildResult>
  onRevealBuild?: (target: PreviewBuildTarget) => Promise<boolean>
  onRequestPrototype?: (content: string) => boolean | void | Promise<boolean | void>
  onClose: () => void
}) {
  const language = useLanguage()
  const platform = usePlatform()
  const sdk = useSDK()
  const [state, setState] = createStore({
    draft: "",
    url: "",
    frameKey: 0,
    loading: false,
    scanning: false,
    starting: false,
    capturing: false,
    historyOpen: false,
    historyLoading: true,
    history: [] as PreviewFrameView[],
    selected: [] as string[],
    editing: "",
    noteDraft: "",
    tagDraft: [] as PreviewIssueTag[],
    checkDraft: {} as PreviewAcceptanceChecks,
    savingAnnotation: false,
    planOpen: false,
    plan: emptyPreviewAcceptancePlan(),
    planDraft: {} as PreviewAcceptancePlan["criteria"],
    scenariosOpen: false,
    scenarios: emptyPreviewPlaytestScenarios(),
    scenariosDraft: emptyPreviewPlaytestScenarios(),
    runOpen: false,
    runScenario: undefined as PreviewPlaytestScenario | undefined,
    run: emptyPreviewPlaytestRun(),
    reporting: false,
    reportExported: false,
    buildOpen: false,
    buildTargets: defaultPreviewBuildTargets(),
    buildDraft: defaultPreviewBuildTargets(),
    building: false,
    buildResult: "" as "" | PreviewBuildResult,
    revealingBuild: false,
    requestingPrototype: false,
    profileLoading: true,
    profile: undefined as PreviewProjectProfile | undefined,
    detected: [] as string[],
    error: "",
  })
  const chinese = createMemo(() => language.locale() === "zh" || language.locale() === "zht")
  const copy = createMemo(() =>
    chinese()
      ? {
          title: "Demo 预览",
          description: "在任务旁直接试玩 AI 构建的网页游戏，并在修改后快速刷新验证。",
          address: "预览地址",
          placeholder: "http://localhost:5173",
          open: "打开预览",
          refresh: "刷新",
          external: "在浏览器打开",
          disconnect: "断开",
          close: "关闭",
          setup: "连接运行中的游戏 Demo",
          help: "让 AI 在终端启动开发服务器，然后输入本地地址。地址会按项目自动记忆。",
          common: "常用本地端口",
          invalid: "请输入有效的 HTTP 或 HTTPS 地址。",
          loading: "正在载入 Demo…",
          scan: "扫描端口",
          scanning: "正在扫描本地服务…",
          detected: "检测到可用服务",
          noneDetected: "暂未检测到运行中的服务",
          start: "启动并预览",
          starting: "正在启动…",
          command: "项目启动命令",
          startFailed: "无法启动项目预览，请检查启动命令和终端输出。",
          capture: "截图给 AI",
          capturing: "正在截图…",
          captureFailed: "无法捕获试玩画面，请重试。",
          history: "试玩记录",
          historyHelp: "先定义验收计划和试玩场景；选择两帧可让 AI 对比迭代变化。",
          historyEmpty: "还没有试玩截图",
          exportReport: "导出试玩报告",
          exportingReport: "正在生成…",
          reportExported: "试玩报告已导出",
          reportFailed: "无法生成试玩报告，请重试。",
          build: "构建发布",
          buildHelp: "保存项目的交付目标，在终端执行构建，并快速定位生成的试玩产物。",
          buildConfigured: "个目标",
          addBuildTarget: "新增目标",
          deleteBuildTarget: "删除目标",
          buildTargetName: "目标名称",
          buildTargetNamePlaceholder: "例如：Web 试玩版",
          buildCommand: "构建命令",
          buildCommandPlaceholder: "bun run build",
          buildOutput: "产物目录",
          buildOutputPlaceholder: "dist",
          buildOutputHelp: "填写项目内的相对目录，不允许使用绝对路径或 ..。",
          saveBuildTargets: "保存目标",
          currentBuildTarget: "当前构建目标（保存后生效）",
          runBuild: "开始构建",
          building: "正在构建…",
          buildSuccess: "构建成功，可以定位产物。",
          buildFailed: "构建失败，请检查终端输出。",
          buildUnknown: "构建已结束，请检查终端输出确认结果。",
          buildUnavailable: "创建任务后即可在项目终端运行构建。",
          buildTerminalHelp: "构建过程显示在 Game Build 终端中；关闭此窗口也不会中断构建。",
          revealBuild: "定位产物",
          outputMissing: "未找到构建产物目录，请检查构建配置和终端输出。",
          detectingProject: "正在识别项目类型…",
          detectedProject: "已识别项目",
          unknownProject: "未识别到可用预设，可以继续手动配置构建目标。",
          packageManager: "包管理器",
          suggestedStart: "推荐启动",
          suggestedBuild: "推荐构建",
          applySuggestion: "采用推荐",
          suggestionApplied: "已采用",
          suggestionLimit: "构建目标已达上限",
          prototypeAI: "让 AI 创建原型",
          requestingPrototype: "正在写入…",
          prototypeFailed: "无法将原型请求写入任务，请重试。",
          hintGodot: "请先在 Godot 中创建名为 Web 的导出预设，随后即可自动生成 Web 构建目标。",
          hintUnity: "Unity 命令行构建依赖项目自定义 BuildScript；为避免生成不可执行命令，请手动配置后再运行。",
          hintNext: "Next.js 默认产物需要 Node.js 服务；如需纯静态分享，请在项目中启用 output: export。",
          compare: "对比给 AI",
          selected: "已选择",
          deleteFrame: "删除这一帧",
          annotation: "策划批注",
          annotationHelp: "记录这帧暴露的问题、设计意图或下一轮目标。",
          note: "文字备注",
          notePlaceholder: "例如：玩家看不到机关与门的因果关系，需要更明确的反馈。",
          saveAnnotation: "保存批注",
          reviewFrame: "带验收发送给 AI",
          savingAnnotation: "正在保存…",
          annotationFailed: "无法保存批注，请重试。",
          acceptance: "试玩验收",
          acceptanceHelp: "未测试项可以留空；再次点击已选结果可清除。",
          plan: "项目验收计划",
          planHelp: "写下这一轮 Demo 可验证的成功标准；它们会自动附加到每次截图评审。",
          planConfigured: "项标准",
          savePlan: "保存计划",
          launchExample: "例如：打开后 3 秒内进入可操作状态",
          controlsExample: "例如：键盘和手柄都能移动、交互与暂停",
          goalExample: "例如：玩家无需额外说明也能找到出口",
          responseExample: "例如：机关状态变化有动画、音效或颜色反馈",
          retryExample: "例如：失败后 2 秒内可重新开始本关",
          completionExample: "例如：完成后显示结果并能进入下一关",
          scenarios: "试玩场景",
          scenariosHelp: "保存可重复执行的测试步骤。选择当前场景后，新截图会保留一份场景快照。",
          scenarioConfigured: "个场景",
          addScenario: "新增场景",
          deleteScenario: "删除场景",
          untitledScenario: "未命名场景",
          scenarioName: "场景名称",
          scenarioNamePlaceholder: "例如：错误解法反馈",
          scenarioSteps: "测试步骤",
          scenarioStepsPlaceholder: "1. 进入机关房\n2. 拉下错误拉杆\n3. 观察门与线索",
          scenarioExpected: "预期结果",
          scenarioExpectedPlaceholder: "门保持关闭，并通过动画或颜色突出正确线索。",
          saveScenarios: "保存场景",
          currentScenario: "当前截图场景（保存后生效）",
          runScenario: "执行场景",
          runResult: "场景结果",
          expectedMet: "符合预期",
          expectedMissed: "未符合",
          pass: "通过",
          fail: "需修复",
          launch: "可启动",
          controls: "操作响应",
          goal: "目标清晰",
          response: "反馈明确",
          retry: "失败可重试",
          completion: "可以通关",
          guidance: "目标引导",
          puzzle: "机关逻辑",
          feedback: "操作反馈",
          pacing: "关卡节奏",
          visual: "视觉层级",
          bug: "缺陷",
        }
      : {
          title: "Demo preview",
          description: "Play the web game beside the task and refresh quickly after each AI iteration.",
          address: "Preview URL",
          placeholder: "http://localhost:5173",
          open: "Open preview",
          refresh: "Refresh",
          external: "Open in browser",
          disconnect: "Disconnect",
          close: "Close",
          setup: "Connect a running game demo",
          help: "Ask AI to start the development server, then enter its local URL. It is remembered per project.",
          common: "Common local ports",
          invalid: "Enter a valid HTTP or HTTPS URL.",
          loading: "Loading demo…",
          scan: "Scan ports",
          scanning: "Scanning local services…",
          detected: "Available services",
          noneDetected: "No running service detected yet",
          start: "Start and preview",
          starting: "Starting…",
          command: "Project start command",
          startFailed: "Could not start the project preview. Check the start command and terminal output.",
          capture: "Send frame to AI",
          capturing: "Capturing…",
          captureFailed: "Could not capture the game frame. Please try again.",
          history: "Playtest history",
          historyHelp: "Define acceptance and playtest scenarios, then select two frames to compare changes.",
          historyEmpty: "No gameplay frames yet",
          exportReport: "Export report",
          exportingReport: "Generating…",
          reportExported: "Playtest report exported",
          reportFailed: "Could not generate the playtest report. Please try again.",
          build: "Build release",
          buildHelp:
            "Save project delivery targets, run builds in the terminal, and locate the generated playable output.",
          buildConfigured: "targets",
          addBuildTarget: "Add target",
          deleteBuildTarget: "Delete target",
          buildTargetName: "Target name",
          buildTargetNamePlaceholder: "Example: Web playtest",
          buildCommand: "Build command",
          buildCommandPlaceholder: "bun run build",
          buildOutput: "Output directory",
          buildOutputPlaceholder: "dist",
          buildOutputHelp: "Use a project-relative directory. Absolute paths and .. are not allowed.",
          saveBuildTargets: "Save targets",
          currentBuildTarget: "Current build target (applies after save)",
          runBuild: "Start build",
          building: "Building…",
          buildSuccess: "Build succeeded. The output is ready to locate.",
          buildFailed: "Build failed. Check the terminal output.",
          buildUnknown: "Build finished. Check the terminal output to confirm the result.",
          buildUnavailable: "Create a task to run builds in the project terminal.",
          buildTerminalHelp:
            "Progress appears in the Game Build terminal. Closing this window does not stop the build.",
          revealBuild: "Reveal output",
          outputMissing: "The build output directory was not found. Check the target and terminal output.",
          detectingProject: "Detecting project type…",
          detectedProject: "Detected project",
          unknownProject: "No supported preset was detected. You can continue with a custom build target.",
          packageManager: "Package manager",
          suggestedStart: "Suggested start",
          suggestedBuild: "Suggested build",
          applySuggestion: "Use suggestion",
          suggestionApplied: "Applied",
          suggestionLimit: "Build target limit reached",
          prototypeAI: "Build prototype with AI",
          requestingPrototype: "Adding…",
          prototypeFailed: "Could not add the prototype request to the task. Please try again.",
          hintGodot: "Create a Godot export preset named Web, then KM Agent can generate the Web build target.",
          hintUnity:
            "Unity CLI builds depend on a project-specific BuildScript, so KM Agent leaves the command manual instead of inventing one.",
          hintNext:
            "The default Next.js output requires a Node.js server. Enable output: export in the project for static sharing.",
          compare: "Compare with AI",
          selected: "Selected",
          deleteFrame: "Delete this frame",
          annotation: "Designer annotation",
          annotationHelp: "Record the issue, design intent, or goal for the next iteration.",
          note: "Notes",
          notePlaceholder: "Example: The player cannot see the causal link between the switch and the door.",
          saveAnnotation: "Save annotation",
          reviewFrame: "Review checks with AI",
          savingAnnotation: "Saving…",
          annotationFailed: "Could not save the annotation. Please try again.",
          acceptance: "Playtest checks",
          acceptanceHelp: "Leave untested items blank. Click a selected result again to clear it.",
          plan: "Project acceptance plan",
          planHelp: "Define verifiable success criteria for this demo. They are added to every frame review.",
          planConfigured: "criteria",
          savePlan: "Save plan",
          launchExample: "Example: Reach interactive state within 3 seconds",
          controlsExample: "Example: Keyboard and gamepad both move, interact, and pause",
          goalExample: "Example: Find the exit without extra instructions",
          responseExample: "Example: State changes use animation, sound, or color feedback",
          retryExample: "Example: Retry the level within 2 seconds of failure",
          completionExample: "Example: Show results and allow continuing after success",
          scenarios: "Playtest scenarios",
          scenariosHelp: "Save repeatable test flows. New frames keep a snapshot of the selected scenario.",
          scenarioConfigured: "scenarios",
          addScenario: "Add scenario",
          deleteScenario: "Delete scenario",
          untitledScenario: "Untitled scenario",
          scenarioName: "Scenario name",
          scenarioNamePlaceholder: "Example: Wrong-solution feedback",
          scenarioSteps: "Test steps",
          scenarioStepsPlaceholder: "1. Enter the puzzle room\n2. Pull the wrong lever\n3. Observe the door and clue",
          scenarioExpected: "Expected result",
          scenarioExpectedPlaceholder: "The door stays closed and animation or color highlights the correct clue.",
          saveScenarios: "Save scenarios",
          currentScenario: "Current frame scenario (applies after save)",
          runScenario: "Run scenario",
          runResult: "Scenario result",
          expectedMet: "Expectation met",
          expectedMissed: "Not met",
          pass: "Pass",
          fail: "Fix",
          launch: "Demo launches",
          controls: "Controls respond",
          goal: "Goal is clear",
          response: "Feedback is clear",
          retry: "Failure can retry",
          completion: "Can complete",
          guidance: "Goal guidance",
          puzzle: "Puzzle logic",
          feedback: "Interaction feedback",
          pacing: "Level pacing",
          visual: "Visual hierarchy",
          bug: "Bug",
        },
  )
  const tagOptions = createMemo(
    () =>
      PREVIEW_ISSUE_TAGS.map((id) => ({ id, label: copy()[id] })) satisfies {
        id: PreviewIssueTag
        label: string
      }[],
  )
  const criteriaOptions = createMemo(
    () =>
      PREVIEW_ACCEPTANCE_CRITERIA.map((id) => ({ id, label: copy()[id] })) satisfies {
        id: PreviewAcceptanceCriterion
        label: string
      }[],
  )
  const planExamples = createMemo<Record<PreviewAcceptanceCriterion, string>>(() => ({
    launch: copy().launchExample,
    controls: copy().controlsExample,
    goal: copy().goalExample,
    response: copy().responseExample,
    retry: copy().retryExample,
    completion: copy().completionExample,
  }))
  const planCount = createMemo(() => Object.keys(state.plan.criteria).length)
  const scenarioCount = createMemo(() => state.scenarios.items.length)
  const scenarioDraftCount = createMemo(() => state.scenariosDraft.items.filter((item) => item.name.trim()).length)
  const activeScenario = createMemo(() => activePreviewPlaytestScenario(state.scenarios))
  const activeScenarioDraft = createMemo(() => activePreviewPlaytestScenario(state.scenariosDraft))
  const runnableScenario = createMemo(() => {
    const scenario = activeScenario()
    return scenario && previewPlaytestScenarioSteps(scenario).length > 0 ? scenario : undefined
  })
  const buildCount = createMemo(() => state.buildTargets.items.length)
  const activeBuildTarget = createMemo(() => activePreviewBuildTarget(state.buildTargets))
  const activeBuildDraft = createMemo(() => activePreviewBuildTarget(state.buildDraft))
  const buildDraftValid = createMemo(
    () =>
      state.buildDraft.items.length > 0 &&
      state.buildDraft.items.every((target) => !!normalizePreviewBuildTarget(target)),
  )
  const projectHintLabels = createMemo<Record<PreviewProjectHint, string>>(() => ({
    "godot.exportPresetMissing": copy().hintGodot,
    "unity.manualBuild": copy().hintUnity,
    "next.serverOutput": copy().hintNext,
  }))
  const effectiveStartCommand = createMemo(() => props.startCommand?.trim() || state.profile?.startCommand)
  const detectedBuildApplied = createMemo(() => {
    const target = state.profile?.build
    return target ? previewBuildRecommendationApplied(state.buildTargets, target) : false
  })
  const detectedBuildBlocked = createMemo(() => {
    const target = state.profile?.build
    if (!target || detectedBuildApplied()) return false
    return state.buildTargets.items.length >= PREVIEW_BUILD_TARGETS_MAX_COUNT
  })
  const storageKey = () => `km-agent.game-preview.v1:${props.directory}`
  const planStorageKey = () => previewAcceptancePlanStorageKey(props.directory)
  const scenariosStorageKey = () => previewPlaytestScenariosStorageKey(props.directory)
  const buildStorageKey = () => previewBuildTargetsStorageKey(props.directory)
  const frame = createMemo(() => ({ key: state.frameKey, url: state.url }), undefined, {
    equals: (a, b) => a.key === b.key && a.url === b.url,
  })
  let disposed = false
  let scanRequest: Promise<string[]> | undefined
  let frameElement: HTMLIFrameElement | undefined
  let historySources: string[] = []

  const showHistory = (frames: GamePreviewFrame[]) => {
    historySources.forEach((src) => URL.revokeObjectURL(src))
    const history = frames.map((frame) => ({ frame, src: URL.createObjectURL(frame.image) }))
    historySources = history.map((item) => item.src)
    const ids = new Set(frames.map((frame) => frame.id))
    setState({
      history,
      historyLoading: false,
      reportExported: false,
      selected: state.selected.filter((id) => ids.has(id)),
    })
  }

  const loadHistory = () =>
    listPreviewFrames(props.directory)
      .then((frames) => {
        if (!disposed) showHistory(frames)
      })
      .catch(() => {
        if (!disposed) setState("historyLoading", false)
      })

  const scan = () => {
    if (scanRequest) return scanRequest
    setState("scanning", true)
    scanRequest = detectPreviewURLs(COMMON_PREVIEW_PORTS.map((port) => `http://localhost:${port}`))
      .then((detected) => {
        if (!disposed) setState("detected", detected)
        return detected
      })
      .finally(() => {
        scanRequest = undefined
        if (!disposed) setState("scanning", false)
      })
    return scanRequest
  }

  const loadProjectProfile = async () => {
    setState("profileLoading", true)
    const profile = await loadPreviewProjectProfile(sdk())
    if (disposed) return
    setState({ profile, profileLoading: false })
  }

  onMount(() => {
    void loadHistory()
    void loadProjectProfile()
    const plan = parsePreviewAcceptancePlan(localStorage.getItem(planStorageKey()))
    const scenarios = parsePreviewPlaytestScenarios(localStorage.getItem(scenariosStorageKey()))
    const buildTargets = parsePreviewBuildTargets(localStorage.getItem(buildStorageKey()))
    setState({
      plan,
      planDraft: { ...plan.criteria },
      scenarios,
      scenariosDraft: { ...scenarios, items: scenarios.items.map((item) => ({ ...item })) },
      buildTargets,
      buildDraft: { ...buildTargets, items: buildTargets.items.map((item) => ({ ...item })) },
    })
    const saved = localStorage.getItem(storageKey()) ?? ""
    const url = normalizePreviewURL(saved)
    if (!url) {
      void scan()
      return
    }
    setState({ draft: url, url, loading: true })
  })

  onCleanup(() => {
    disposed = true
    historySources.forEach((src) => URL.revokeObjectURL(src))
    historySources = []
  })

  const open = (value = state.draft) => {
    const url = normalizePreviewURL(value)
    if (!url) {
      setState("error", copy().invalid)
      return
    }
    localStorage.setItem(storageKey(), url)
    setState({ draft: url, url, frameKey: state.frameKey + 1, loading: true, error: "" })
  }

  const start = async () => {
    const command = effectiveStartCommand()
    if (!props.onStart || !command || state.starting) return
    setState({ starting: true, error: "" })
    const started = await Promise.resolve(props.onStart(command)).catch(() => false)
    if (!started) {
      setState({ starting: false, error: copy().startFailed })
      return
    }
    for (const attempt of Array.from({ length: 10 }, (_, index) => index)) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 500 : 1000))
      if (disposed) return
      const detected = await scan()
      if (!detected[0]) continue
      open(detected[0])
      setState("starting", false)
      return
    }
    setState({ starting: false, error: copy().noneDetected })
  }

  const capture = async (run?: PreviewPlaytestRun, runScenario?: PreviewPlaytestScenario) => {
    if (!props.onCapture || !platform.captureRegion || !frameElement || state.capturing) return
    const region = previewCaptureRegion(frameElement.getBoundingClientRect())
    if (!region) {
      setState("error", copy().captureFailed)
      return
    }
    setState({ capturing: true, error: "" })
    const file = await platform.captureRegion(region).catch(() => null)
    if (disposed) return
    if (!file) {
      setState({ capturing: false, error: copy().captureFailed })
      return
    }
    const scenario = runScenario ?? activeScenario()
    const result =
      scenario && run && previewPlaytestRunComplete(run, scenario)
        ? normalizePreviewPlaytestRun(run, scenario)
        : undefined
    const history = await savePreviewFrame({
      directory: props.directory,
      url: state.url,
      file,
      scenario,
      run: result,
    }).catch(() => undefined)
    if (history && !disposed) showHistory(history)
    const annotation = [
      planContext(),
      scenario ? previewPlaytestScenarioContext(scenario, chinese()) : "",
      scenario && result ? previewPlaytestRunContext(scenario, result, chinese()) : "",
    ]
      .filter(Boolean)
      .join("\n\n")
    const accepted = await Promise.resolve(props.onCapture([file], "review", annotation || undefined))
      .then((value) => value !== false)
      .catch(() => false)
    if (disposed) return
    setState({
      capturing: false,
      runOpen: result && accepted ? false : state.runOpen,
      error: accepted ? "" : copy().captureFailed,
    })
  }

  const toggleFrame = (id: string) => {
    if (state.selected.includes(id)) {
      setState(
        "selected",
        state.selected.filter((item) => item !== id),
      )
      return
    }
    setState("selected", [...state.selected.slice(-1), id])
  }

  const editFrame = (frame: GamePreviewFrame) => {
    setState({ editing: frame.id, noteDraft: frame.note, tagDraft: [...frame.tags], checkDraft: { ...frame.checks } })
  }

  const toggleTag = (tag: PreviewIssueTag) => {
    setState(
      "tagDraft",
      state.tagDraft.includes(tag) ? state.tagDraft.filter((item) => item !== tag) : [...state.tagDraft, tag],
    )
  }

  const toggleCheck = (criterion: PreviewAcceptanceCriterion, value: PreviewAcceptanceState) => {
    const next = { ...state.checkDraft }
    if (next[criterion] === value) delete next[criterion]
    else next[criterion] = value
    setState("checkDraft", next)
  }

  const setPlanCriterion = (criterion: PreviewAcceptanceCriterion, value: string) => {
    setState("planDraft", { ...state.planDraft, [criterion]: value })
  }

  const savePlan = () => {
    const plan = normalizePreviewAcceptancePlan({ version: 1, criteria: state.planDraft })
    localStorage.setItem(planStorageKey(), JSON.stringify(plan))
    setState({ plan, planDraft: { ...plan.criteria } })
  }

  const selectScenario = (id: string) => {
    setState("scenariosDraft", { ...state.scenariosDraft, active: id })
    if (!state.scenarios.items.some((item) => item.id === id)) return
    const scenarios = { ...state.scenarios, active: id }
    localStorage.setItem(scenariosStorageKey(), JSON.stringify(scenarios))
    setState("scenarios", scenarios)
  }

  const updateScenario = (id: string, patch: Partial<Omit<PreviewPlaytestScenario, "id">>) => {
    setState("scenariosDraft", {
      ...state.scenariosDraft,
      items: state.scenariosDraft.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  const addScenario = () => {
    if (state.scenariosDraft.items.length >= PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT) return
    const scenario = createPreviewPlaytestScenario()
    setState("scenariosDraft", {
      ...state.scenariosDraft,
      active: scenario.id,
      items: [...state.scenariosDraft.items, scenario],
    })
  }

  const removeScenario = (id: string) => {
    const items = state.scenariosDraft.items.filter((item) => item.id !== id)
    setState("scenariosDraft", {
      ...state.scenariosDraft,
      active: state.scenariosDraft.active === id ? (items[0]?.id ?? "") : state.scenariosDraft.active,
      items,
    })
  }

  const saveScenarios = () => {
    const scenarios = normalizePreviewPlaytestScenarios(state.scenariosDraft)
    localStorage.setItem(scenariosStorageKey(), JSON.stringify(scenarios))
    setState({
      scenarios,
      scenariosDraft: { ...scenarios, items: scenarios.items.map((item) => ({ ...item })) },
    })
  }

  const startScenarioRun = () => {
    if (state.runOpen) {
      setState("runOpen", false)
      return
    }
    const scenario = runnableScenario()
    if (!scenario) {
      setState({ historyOpen: true, buildOpen: false, scenariosOpen: true, planOpen: false })
      return
    }
    setState({
      runOpen: true,
      runScenario: { ...scenario },
      run: emptyPreviewPlaytestRun(),
      historyOpen: false,
      buildOpen: false,
    })
  }

  const setRunCheck = (index: number, value: Exclude<PreviewPlaytestStepState, "">) => {
    const scenario = state.runScenario
    if (!scenario) return
    const checks = Array.from(
      { length: previewPlaytestScenarioSteps(scenario).length },
      (_, step) => state.run.checks[step] ?? "",
    )
    checks[index] = value
    setState("run", { ...state.run, checks })
  }

  const selectBuildTarget = (id: string) => {
    setState("buildDraft", { ...state.buildDraft, active: id })
    setState("buildResult", "")
    if (!state.buildTargets.items.some((item) => item.id === id)) return
    const buildTargets = { ...state.buildTargets, active: id }
    localStorage.setItem(buildStorageKey(), JSON.stringify(buildTargets))
    setState("buildTargets", buildTargets)
  }

  const updateBuildTarget = (id: string, patch: Partial<Omit<PreviewBuildTarget, "id">>) => {
    setState("buildDraft", {
      ...state.buildDraft,
      items: state.buildDraft.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  const addBuildTarget = () => {
    if (state.buildDraft.items.length >= PREVIEW_BUILD_TARGETS_MAX_COUNT) return
    const target = createPreviewBuildTarget(
      chinese() ? `Web 构建 ${state.buildDraft.items.length + 1}` : `Web build ${state.buildDraft.items.length + 1}`,
    )
    setState("buildDraft", {
      ...state.buildDraft,
      active: target.id,
      items: [...state.buildDraft.items, target],
    })
    setState("buildResult", "")
  }

  const removeBuildTarget = (id: string) => {
    if (state.buildDraft.items.length <= 1) return
    const items = state.buildDraft.items.filter((item) => item.id !== id)
    setState("buildDraft", {
      ...state.buildDraft,
      active: state.buildDraft.active === id ? items[0].id : state.buildDraft.active,
      items,
    })
    setState("buildResult", "")
  }

  const saveBuildTargets = () => {
    if (!buildDraftValid()) return
    const buildTargets = normalizePreviewBuildTargets(state.buildDraft)
    localStorage.setItem(buildStorageKey(), JSON.stringify(buildTargets))
    setState({
      buildTargets,
      buildDraft: { ...buildTargets, items: buildTargets.items.map((item) => ({ ...item })) },
      buildResult: "",
    })
  }

  const applyDetectedBuild = () => {
    const target = state.profile?.build
    if (!target || detectedBuildBlocked()) return
    const buildTargets = applyPreviewBuildRecommendation(state.buildTargets, target)
    localStorage.setItem(buildStorageKey(), JSON.stringify(buildTargets))
    setState({
      buildTargets,
      buildDraft: { ...buildTargets, items: buildTargets.items.map((item) => ({ ...item })) },
      buildResult: "",
    })
  }

  const requestPrototype = async () => {
    const profile = state.profile
    if (!profile || !props.onRequestPrototype || state.requestingPrototype) return
    setState({ requestingPrototype: true, error: "" })
    const accepted = await Promise.resolve(props.onRequestPrototype(previewPrototypePrompt(profile, chinese())))
      .then((value) => value !== false)
      .catch(() => false)
    if (disposed) return
    setState({ requestingPrototype: false, error: accepted ? "" : copy().prototypeFailed })
    if (accepted) props.onClose()
  }

  const runBuild = async () => {
    const target = activeBuildTarget()
    if (!target || !props.onBuild || state.building) return
    setState({ building: true, buildResult: "", error: "" })
    const result = await props.onBuild(target).catch(() => "failed" as const)
    if (disposed) return
    setState({ building: false, buildResult: result })
  }

  const revealBuild = async () => {
    const target = activeBuildTarget()
    if (!target || !props.onRevealBuild || state.revealingBuild) return
    setState({ revealingBuild: true, error: "" })
    const revealed = await props.onRevealBuild(target).catch(() => false)
    if (disposed) return
    setState({ revealingBuild: false, error: revealed ? "" : copy().outputMissing })
  }

  const annotationOptions = () => ({
    chinese: chinese(),
    labels: new Map(tagOptions().map((item) => [item.id, item.label])),
    criteriaLabels: new Map(criteriaOptions().map((item) => [item.id, item.label])),
    stateLabels: new Map<PreviewAcceptanceState, string>([
      ["pass", copy().pass],
      ["fail", copy().fail],
    ]),
    scenarioLabel: copy().scenarios,
  })

  const planContext = () => {
    const options = annotationOptions()
    return previewAcceptancePlanContext(state.plan, {
      chinese: options.chinese,
      criteriaLabels: options.criteriaLabels,
    })
  }

  const annotatedFramesContext = (frames: GamePreviewFrame[]) => {
    const snapshots = frames
      .flatMap((frame) => frame.scenario ?? [])
      .filter(
        (scenario, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.id === scenario.id &&
              candidate.name === scenario.name &&
              candidate.steps === scenario.steps &&
              candidate.expected === scenario.expected,
          ) === index,
      )
    const current = activeScenario()
    const scenarios = snapshots.length > 0 ? snapshots : current ? [current] : []
    return [
      planContext(),
      ...scenarios.map((scenario) => previewPlaytestScenarioContext(scenario, chinese())),
      ...frames.flatMap((frame) =>
        frame.scenario && frame.run
          ? [
              previewPlaytestRunContext(
                frame.scenario,
                frame.run,
                chinese(),
                new Date(frame.createdAt).toLocaleString(),
              ),
            ]
          : [],
      ),
      previewAnnotationContext(frames, annotationOptions()),
    ]
      .filter(Boolean)
      .join("\n\n")
  }

  const persistAnnotation = async () => {
    const frame = state.history.find((item) => item.frame.id === state.editing)?.frame
    if (!frame || state.savingAnnotation) return undefined
    setState({ savingAnnotation: true, error: "" })
    const saved = await updatePreviewFrame(frame, {
      note: state.noteDraft,
      tags: state.tagDraft,
      checks: state.checkDraft,
    }).catch(() => undefined)
    if (disposed) return undefined
    if (!saved) {
      setState({ savingAnnotation: false, error: copy().annotationFailed })
      return undefined
    }
    await loadHistory()
    if (disposed) return undefined
    setState({
      savingAnnotation: false,
      noteDraft: saved.note,
      tagDraft: [...saved.tags],
      checkDraft: { ...saved.checks },
    })
    return saved
  }

  const saveAnnotation = async () => void (await persistAnnotation())

  const reviewFrame = async () => {
    if (!props.onCapture || state.capturing) return
    const frame = await persistAnnotation()
    if (!frame || disposed) return
    const annotation = annotatedFramesContext([frame])
    setState({ capturing: true, error: "" })
    const accepted = await Promise.resolve(props.onCapture([previewFrameFile(frame)], "review", annotation))
      .then((value) => value !== false)
      .catch(() => false)
    if (disposed) return
    setState({ capturing: false, error: accepted ? "" : copy().captureFailed })
  }

  const removeFrame = async (id: string) => {
    if (state.editing === id) setState({ editing: "", noteDraft: "", tagDraft: [], checkDraft: {} })
    await deletePreviewFrame(id).catch(() => undefined)
    if (!disposed) void loadHistory()
  }

  const compareFrames = async () => {
    if (!props.onCapture || state.selected.length !== 2 || state.capturing) return
    const selected = state.history
      .filter((item) => state.selected.includes(item.frame.id))
      .map((item) => item.frame)
      .sort((a, b) => a.createdAt - b.createdAt)
    if (selected.length !== 2) return
    const annotation = annotatedFramesContext(selected)
    setState({ capturing: true, error: "" })
    const accepted = await Promise.resolve(props.onCapture(selected.map(previewFrameFile), "compare", annotation))
      .then((value) => value !== false)
      .catch(() => false)
    if (disposed) return
    setState({ capturing: false, error: accepted ? "" : copy().captureFailed })
  }

  const exportReport = async () => {
    if (state.history.length === 0 || state.reporting || state.savingAnnotation) return
    setState({ reporting: true, reportExported: false, error: "" })
    if (state.editing) {
      const saved = await persistAnnotation()
      if (disposed) return
      if (!saved) {
        setState({ reporting: false, error: copy().reportFailed })
        return
      }
    }
    const frames = await Promise.all(state.history.map((item) => previewReportFrame(item.frame))).catch(() => undefined)
    if (disposed) return
    if (!frames) {
      setState({ reporting: false, error: copy().reportFailed })
      return
    }
    const generatedAt = Date.now()
    const report = previewReportHTML({
      projectName: previewReportProjectName(props.directory),
      generatedAt,
      frames,
      plan: state.plan,
      chinese: chinese(),
      criteriaLabels: new Map(criteriaOptions().map((item) => [item.id, item.label])),
      issueLabels: new Map(tagOptions().map((item) => [item.id, item.label])),
    })
    const url = URL.createObjectURL(new Blob([report], { type: "text/html;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = previewReportFilename(props.directory, generatedAt)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setState({ reporting: false, reportExported: true })
  }

  return (
    <div
      data-component="game-preview-dialog"
      class="fixed inset-0 z-[250] flex flex-col bg-v2-background-bg-base"
      role="dialog"
      aria-modal="true"
      aria-label={copy().title}
    >
      <header class="flex h-14 shrink-0 items-center gap-3 border-b border-v2-border-border-base px-4">
        <div class="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-v2-background-bg-layer-02">
          <IconV2 name="monitor" />
        </div>
        <div class="hidden min-w-0 flex-1 sm:block">
          <div class="text-[14px] text-v2-text-text-strong [font-weight:580]">{copy().title}</div>
          <div class="truncate text-[12px] text-v2-text-text-muted">{copy().description}</div>
        </div>
        <form
          class="flex min-w-0 flex-[2] items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            open()
          }}
        >
          <TextInputV2
            class="min-w-0 flex-1"
            value={state.draft}
            placeholder={copy().placeholder}
            aria-label={copy().address}
            invalid={!!state.error}
            onInput={(event) => setState({ draft: event.currentTarget.value, error: "" })}
          />
          <ButtonV2 type="submit" variant="neutral" size="normal" disabled={!state.draft.trim()}>
            {copy().open}
          </ButtonV2>
        </form>
        <ButtonV2
          data-action="game-preview-build"
          variant={state.buildOpen ? "neutral" : "ghost-muted"}
          size="normal"
          icon="download"
          aria-pressed={state.buildOpen}
          onClick={() => setState({ buildOpen: !state.buildOpen, historyOpen: false, runOpen: false })}
        >
          <span class="hidden xl:inline">{copy().build}</span>
          <Show when={buildCount() > 1}>
            <span>{buildCount()}</span>
          </Show>
        </ButtonV2>
        <Show when={props.onCapture}>
          <ButtonV2
            data-action="game-preview-history"
            variant={state.historyOpen ? "neutral" : "ghost-muted"}
            size="normal"
            icon="photo"
            onClick={() => setState({ historyOpen: !state.historyOpen, buildOpen: false, runOpen: false })}
          >
            <span class="hidden xl:inline">{copy().history}</span>
            <Show when={state.history.length > 0}>
              <span>{state.history.length}</span>
            </Show>
          </ButtonV2>
        </Show>
        <Show when={state.url && props.onCapture}>
          <ButtonV2
            data-action="game-preview-run-scenario"
            variant={state.runOpen ? "contrast" : "ghost-muted"}
            size="normal"
            aria-pressed={state.runOpen}
            disabled={state.capturing}
            onClick={startScenarioRun}
          >
            <span class="hidden xl:inline">{copy().runScenario}</span>
            <span class="xl:hidden" aria-hidden="true">
              ▶
            </span>
          </ButtonV2>
        </Show>
        <Show when={state.url}>
          <Show when={platform.captureRegion && props.onCapture}>
            <ButtonV2
              data-action="game-preview-capture"
              variant="contrast"
              size="normal"
              icon="photo"
              disabled={state.capturing || state.loading}
              onClick={() => void capture()}
            >
              <span class="hidden lg:inline">{state.capturing ? copy().capturing : copy().capture}</span>
            </ButtonV2>
          </Show>
          <ButtonV2
            data-action="game-preview-refresh"
            variant="ghost-muted"
            size="normal"
            icon="reset"
            onClick={() => setState({ frameKey: state.frameKey + 1, loading: true })}
          >
            <span class="hidden lg:inline">{copy().refresh}</span>
          </ButtonV2>
          <ButtonV2
            data-action="game-preview-external"
            variant="ghost-muted"
            size="normal"
            icon="outline-square-arrow"
            onClick={() => platform.openExternal(state.url)}
          >
            <span class="hidden xl:inline">{copy().external}</span>
          </ButtonV2>
          <ButtonV2
            data-action="game-preview-disconnect"
            variant="ghost-muted"
            size="normal"
            aria-label={copy().disconnect}
            onClick={() => {
              localStorage.removeItem(storageKey())
              setState({ draft: "", url: "", frameKey: state.frameKey + 1, loading: false, error: "" })
            }}
          >
            <span class="hidden lg:inline">{copy().disconnect}</span>
            <span class="lg:hidden" aria-hidden="true">
              ×
            </span>
          </ButtonV2>
        </Show>
        <ButtonV2 data-action="game-preview-close" variant="neutral" size="normal" onClick={props.onClose}>
          {copy().close}
        </ButtonV2>
      </header>
      <Show when={state.error}>
        <div class="shrink-0 border-b border-v2-border-border-base bg-v2-background-bg-layer-02 px-4 py-2 text-[12px] text-v2-text-text-base">
          {state.error}
        </div>
      </Show>
      <div class="relative min-h-0 flex-1 bg-v2-background-bg-deep">
        <Show when={state.runOpen && state.runScenario} keyed>
          {(scenario) => (
            <GamePreviewRunPanel
              chinese={chinese()}
              scenario={scenario}
              run={state.run}
              capturing={state.capturing}
              captureAvailable={!!platform.captureRegion && !!props.onCapture && !!frameElement && !state.loading}
              onCheck={setRunCheck}
              onExpected={(value) => setState("run", { ...state.run, expected: value })}
              onNote={(note) => setState("run", { ...state.run, note })}
              onReset={() => setState("run", emptyPreviewPlaytestRun())}
              onCapture={() => void capture(state.run, scenario)}
              onClose={() => setState("runOpen", false)}
            />
          )}
        </Show>
        <Show when={state.buildOpen}>
          <aside
            data-component="game-preview-build"
            class="absolute inset-y-0 right-0 z-20 flex w-[440px] max-w-full flex-col border-l border-v2-border-border-base bg-v2-background-bg-base shadow-[var(--v2-elevation-raised)]"
            aria-label={copy().build}
          >
            <div class="flex shrink-0 items-start gap-3 border-b border-v2-border-border-base px-4 py-3">
              <div class="min-w-0 flex-1">
                <div class="text-[14px] text-v2-text-text-strong [font-weight:580]">{copy().build}</div>
                <div class="mt-1 text-[12px] leading-4 text-v2-text-text-muted">{copy().buildHelp}</div>
              </div>
              <ButtonV2
                variant="ghost-muted"
                size="small"
                aria-label={copy().close}
                onClick={() => setState("buildOpen", false)}
              >
                ×
              </ButtonV2>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto p-3">
              <div
                data-component="game-preview-project-profile"
                class="mb-3 rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-layer-02 p-3"
              >
                <Show
                  when={!state.profileLoading}
                  fallback={<div class="text-[11px] text-v2-text-text-muted">{copy().detectingProject}</div>}
                >
                  <Show when={state.profile} keyed>
                    {(profile) => (
                      <Show
                        when={profile.kind !== "unknown"}
                        fallback={
                          <div class="text-[11px] leading-4 text-v2-text-text-muted">{copy().unknownProject}</div>
                        }
                      >
                        <div class="flex items-center justify-between gap-3">
                          <div>
                            <div class="text-[10px] text-v2-text-text-faint">{copy().detectedProject}</div>
                            <div class="mt-0.5 text-[13px] text-v2-text-text-strong [font-weight:580]">
                              {previewProjectKindLabel(profile.kind, chinese())}
                            </div>
                          </div>
                          <Show when={profile.packageManager} keyed>
                            {(manager) => (
                              <span class="rounded-[5px] border border-v2-border-border-base bg-v2-background-bg-base px-2 py-1 text-[10px] text-v2-text-text-muted">
                                {copy().packageManager}: {manager}
                              </span>
                            )}
                          </Show>
                        </div>
                        <Show when={props.onRequestPrototype}>
                          <ButtonV2
                            data-action="game-preview-request-prototype"
                            class="mt-2.5 w-full"
                            variant="contrast"
                            size="small"
                            disabled={state.requestingPrototype}
                            onClick={requestPrototype}
                          >
                            {state.requestingPrototype ? copy().requestingPrototype : copy().prototypeAI}
                          </ButtonV2>
                        </Show>
                        <Show when={profile.startCommand} keyed>
                          {(command) => (
                            <div class="mt-2.5">
                              <div class="text-[10px] text-v2-text-text-faint">{copy().suggestedStart}</div>
                              <code class="mt-0.5 block break-all text-[11px] leading-4 text-v2-text-text-base">
                                {command}
                              </code>
                            </div>
                          )}
                        </Show>
                        <Show when={profile.build} keyed>
                          {(target) => (
                            <div class="mt-2.5 flex items-end gap-3">
                              <div class="min-w-0 flex-1">
                                <div class="text-[10px] text-v2-text-text-faint">{copy().suggestedBuild}</div>
                                <code class="mt-0.5 block break-all text-[11px] leading-4 text-v2-text-text-base">
                                  {target.command}
                                </code>
                                <div class="mt-0.5 text-[10px] text-v2-text-text-faint">
                                  {copy().buildOutput}: {target.output}
                                </div>
                              </div>
                              <ButtonV2
                                data-action="game-preview-apply-detected-build"
                                variant={detectedBuildApplied() ? "neutral" : "contrast"}
                                size="small"
                                disabled={detectedBuildApplied() || detectedBuildBlocked()}
                                onClick={applyDetectedBuild}
                              >
                                {detectedBuildApplied()
                                  ? copy().suggestionApplied
                                  : detectedBuildBlocked()
                                    ? copy().suggestionLimit
                                    : copy().applySuggestion}
                              </ButtonV2>
                            </div>
                          )}
                        </Show>
                        <For each={profile.hints}>
                          {(hint) => (
                            <div class="mt-2.5 rounded-[7px] bg-v2-background-bg-base px-2.5 py-2 text-[10px] leading-4 text-v2-text-text-muted">
                              {projectHintLabels()[hint]}
                            </div>
                          )}
                        </For>
                      </Show>
                    )}
                  </Show>
                </Show>
              </div>
              <div class="rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-base p-3">
                <div class="flex flex-wrap gap-1.5">
                  <For each={state.buildDraft.items}>
                    {(target) => (
                      <ButtonV2
                        variant={state.buildDraft.active === target.id ? "contrast" : "neutral"}
                        size="small"
                        aria-pressed={state.buildDraft.active === target.id}
                        onClick={() => selectBuildTarget(target.id)}
                      >
                        {target.name}
                      </ButtonV2>
                    )}
                  </For>
                  <ButtonV2
                    data-action="game-preview-add-build"
                    variant="neutral"
                    size="small"
                    disabled={state.buildDraft.items.length >= PREVIEW_BUILD_TARGETS_MAX_COUNT}
                    onClick={addBuildTarget}
                  >
                    + {copy().addBuildTarget}
                  </ButtonV2>
                </div>
                <Show when={activeBuildDraft()} keyed>
                  {(target) => (
                    <div class="mt-3 rounded-[8px] bg-v2-background-bg-deep p-2.5">
                      <div class="text-[10px] text-v2-text-text-faint">{copy().currentBuildTarget}</div>
                      <label class="mt-2 block text-[11px] text-v2-text-text-muted">
                        <span>{copy().buildTargetName}</span>
                        <input
                          value={target.name}
                          maxLength={PREVIEW_BUILD_TARGET_NAME_MAX_LENGTH}
                          placeholder={copy().buildTargetNamePlaceholder}
                          class="mt-1 w-full rounded-[7px] border border-v2-border-border-base bg-v2-background-bg-base px-2.5 py-1.5 text-[11px] text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus"
                          onInput={(event) => updateBuildTarget(target.id, { name: event.currentTarget.value })}
                        />
                      </label>
                      <label class="mt-2.5 block text-[11px] text-v2-text-text-muted">
                        <span>{copy().buildCommand}</span>
                        <input
                          value={target.command}
                          maxLength={PREVIEW_BUILD_COMMAND_MAX_LENGTH}
                          placeholder={copy().buildCommandPlaceholder}
                          class="mt-1 w-full rounded-[7px] border border-v2-border-border-base bg-v2-background-bg-base px-2.5 py-1.5 font-mono text-[11px] text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus"
                          onInput={(event) => updateBuildTarget(target.id, { command: event.currentTarget.value })}
                        />
                      </label>
                      <label class="mt-2.5 block text-[11px] text-v2-text-text-muted">
                        <span>{copy().buildOutput}</span>
                        <input
                          value={target.output}
                          maxLength={PREVIEW_BUILD_OUTPUT_MAX_LENGTH}
                          placeholder={copy().buildOutputPlaceholder}
                          class="mt-1 w-full rounded-[7px] border border-v2-border-border-base bg-v2-background-bg-base px-2.5 py-1.5 font-mono text-[11px] text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus"
                          onInput={(event) => updateBuildTarget(target.id, { output: event.currentTarget.value })}
                        />
                        <span class="mt-1 block text-[10px] leading-4 text-v2-text-text-faint">
                          {copy().buildOutputHelp}
                        </span>
                      </label>
                      <div class="mt-2 flex justify-end">
                        <ButtonV2
                          variant="ghost-muted"
                          size="small"
                          disabled={state.buildDraft.items.length <= 1}
                          onClick={() => removeBuildTarget(target.id)}
                        >
                          {copy().deleteBuildTarget}
                        </ButtonV2>
                      </div>
                    </div>
                  )}
                </Show>
                <div class="mt-3 flex items-center justify-between gap-3">
                  <span class="text-[10px] text-v2-text-text-faint">
                    {state.buildDraft.items.length} {copy().buildConfigured}
                  </span>
                  <ButtonV2
                    data-action="game-preview-save-builds"
                    variant="contrast"
                    size="normal"
                    disabled={!buildDraftValid() || state.building}
                    onClick={saveBuildTargets}
                  >
                    {copy().saveBuildTargets}
                  </ButtonV2>
                </div>
              </div>
              <Show when={activeBuildTarget()} keyed>
                {(target) => (
                  <div class="mt-3 rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-base p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="truncate text-[13px] text-v2-text-text-strong [font-weight:580]">{target.name}</div>
                        <code class="mt-1 block break-all text-[11px] leading-4 text-v2-text-text-muted">
                          {target.command}
                        </code>
                        <div class="mt-1 text-[10px] text-v2-text-text-faint">
                          {copy().buildOutput}: <code>{target.output}</code>
                        </div>
                      </div>
                      <ButtonV2
                        data-action="game-preview-run-build"
                        variant="contrast"
                        size="normal"
                        disabled={!props.onBuild || state.building}
                        onClick={() => void runBuild()}
                      >
                        {state.building ? copy().building : copy().runBuild}
                      </ButtonV2>
                    </div>
                    <div class="mt-3 text-[11px] leading-4 text-v2-text-text-muted">
                      {props.onBuild ? copy().buildTerminalHelp : copy().buildUnavailable}
                    </div>
                    <Show when={state.buildResult}>
                      <div
                        class="mt-3 rounded-[8px] border border-v2-border-border-base bg-v2-background-bg-layer-02 px-2.5 py-2 text-[11px] leading-4"
                        classList={{
                          "text-v2-text-text-strong": state.buildResult === "success",
                          "text-v2-state-fg-danger": state.buildResult === "failed",
                          "text-v2-text-text-muted": state.buildResult === "unknown",
                        }}
                      >
                        {state.buildResult === "success"
                          ? copy().buildSuccess
                          : state.buildResult === "failed"
                            ? copy().buildFailed
                            : copy().buildUnknown}
                      </div>
                    </Show>
                    <Show
                      when={props.onRevealBuild && (state.buildResult === "success" || state.buildResult === "unknown")}
                    >
                      <div class="mt-3 flex justify-end">
                        <ButtonV2
                          data-action="game-preview-reveal-build"
                          variant="neutral"
                          size="normal"
                          disabled={state.revealingBuild}
                          onClick={() => void revealBuild()}
                        >
                          {copy().revealBuild}
                        </ButtonV2>
                      </div>
                    </Show>
                  </div>
                )}
              </Show>
            </div>
          </aside>
        </Show>
        <Show when={state.historyOpen}>
          <aside
            data-component="game-preview-history"
            class="absolute inset-y-0 right-0 z-20 flex w-[440px] max-w-full flex-col border-l border-v2-border-border-base bg-v2-background-bg-base shadow-[var(--v2-elevation-raised)]"
            aria-label={copy().history}
          >
            <div class="flex shrink-0 items-start gap-3 border-b border-v2-border-border-base px-4 py-3">
              <div class="min-w-0 flex-1">
                <div class="text-[14px] text-v2-text-text-strong [font-weight:580]">{copy().history}</div>
                <div class="mt-1 text-[12px] leading-4 text-v2-text-text-muted">{copy().historyHelp}</div>
              </div>
              <ButtonV2
                data-action="game-preview-plan"
                variant={state.planOpen ? "contrast" : "neutral"}
                size="small"
                aria-pressed={state.planOpen}
                onClick={() => setState({ planOpen: !state.planOpen, scenariosOpen: false })}
              >
                {copy().plan}
                <Show when={planCount() > 0}>
                  <span>{planCount()}</span>
                </Show>
              </ButtonV2>
              <ButtonV2
                data-action="game-preview-scenarios"
                variant={state.scenariosOpen ? "contrast" : "neutral"}
                size="small"
                aria-pressed={state.scenariosOpen}
                onClick={() => setState({ scenariosOpen: !state.scenariosOpen, planOpen: false })}
              >
                {copy().scenarios}
                <Show when={scenarioCount() > 0}>
                  <span>{scenarioCount()}</span>
                </Show>
              </ButtonV2>
              <ButtonV2
                variant="ghost-muted"
                size="small"
                aria-label={copy().close}
                onClick={() => setState("historyOpen", false)}
              >
                ×
              </ButtonV2>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto p-3">
              <Show when={state.planOpen}>
                <div class="mb-3 rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-base p-3">
                  <div class="text-[12px] text-v2-text-text-strong [font-weight:580]">{copy().plan}</div>
                  <div class="mt-1 text-[11px] leading-4 text-v2-text-text-muted">{copy().planHelp}</div>
                  <div class="mt-3 space-y-2.5">
                    <For each={criteriaOptions()}>
                      {(criterion) => (
                        <label class="block text-[11px] text-v2-text-text-muted">
                          <span>{criterion.label}</span>
                          <input
                            value={state.planDraft[criterion.id] ?? ""}
                            maxLength={PREVIEW_ACCEPTANCE_PLAN_ITEM_MAX_LENGTH}
                            placeholder={planExamples()[criterion.id]}
                            class="mt-1 w-full rounded-[7px] border border-v2-border-border-base bg-v2-background-bg-deep px-2.5 py-1.5 text-[11px] text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus"
                            onInput={(event) => setPlanCriterion(criterion.id, event.currentTarget.value)}
                          />
                        </label>
                      )}
                    </For>
                  </div>
                  <div class="mt-3 flex items-center justify-between gap-3">
                    <span class="text-[10px] text-v2-text-text-faint">
                      {planCount()} {copy().planConfigured}
                    </span>
                    <ButtonV2 data-action="game-preview-save-plan" variant="contrast" size="normal" onClick={savePlan}>
                      {copy().savePlan}
                    </ButtonV2>
                  </div>
                </div>
              </Show>
              <Show when={state.scenariosOpen}>
                <div class="mb-3 rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-base p-3">
                  <div class="text-[12px] text-v2-text-text-strong [font-weight:580]">{copy().scenarios}</div>
                  <div class="mt-1 text-[11px] leading-4 text-v2-text-text-muted">{copy().scenariosHelp}</div>
                  <div class="mt-3 flex flex-wrap gap-1.5">
                    <For each={state.scenariosDraft.items}>
                      {(scenario) => (
                        <ButtonV2
                          variant={state.scenariosDraft.active === scenario.id ? "contrast" : "neutral"}
                          size="small"
                          aria-pressed={state.scenariosDraft.active === scenario.id}
                          onClick={() => selectScenario(scenario.id)}
                        >
                          {scenario.name.trim() || copy().untitledScenario}
                        </ButtonV2>
                      )}
                    </For>
                    <ButtonV2
                      data-action="game-preview-add-scenario"
                      variant="neutral"
                      size="small"
                      disabled={state.scenariosDraft.items.length >= PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT}
                      onClick={addScenario}
                    >
                      + {copy().addScenario}
                    </ButtonV2>
                  </div>
                  <Show when={activeScenarioDraft()} keyed>
                    {(scenario) => (
                      <div class="mt-3 rounded-[8px] bg-v2-background-bg-deep p-2.5">
                        <div class="text-[10px] text-v2-text-text-faint">{copy().currentScenario}</div>
                        <label class="mt-2 block text-[11px] text-v2-text-text-muted">
                          <span>{copy().scenarioName}</span>
                          <input
                            value={scenario.name}
                            maxLength={PREVIEW_PLAYTEST_SCENARIO_NAME_MAX_LENGTH}
                            placeholder={copy().scenarioNamePlaceholder}
                            class="mt-1 w-full rounded-[7px] border border-v2-border-border-base bg-v2-background-bg-base px-2.5 py-1.5 text-[11px] text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus"
                            onInput={(event) => updateScenario(scenario.id, { name: event.currentTarget.value })}
                          />
                        </label>
                        <label class="mt-2.5 block text-[11px] text-v2-text-text-muted">
                          <span>{copy().scenarioSteps}</span>
                          <textarea
                            value={scenario.steps}
                            maxLength={PREVIEW_PLAYTEST_SCENARIO_DETAIL_MAX_LENGTH}
                            placeholder={copy().scenarioStepsPlaceholder}
                            class="mt-1 min-h-20 w-full resize-y rounded-[7px] border border-v2-border-border-base bg-v2-background-bg-base px-2.5 py-2 text-[11px] leading-4 text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus"
                            onInput={(event) => updateScenario(scenario.id, { steps: event.currentTarget.value })}
                          />
                        </label>
                        <label class="mt-2.5 block text-[11px] text-v2-text-text-muted">
                          <span>{copy().scenarioExpected}</span>
                          <textarea
                            value={scenario.expected}
                            maxLength={PREVIEW_PLAYTEST_SCENARIO_DETAIL_MAX_LENGTH}
                            placeholder={copy().scenarioExpectedPlaceholder}
                            class="mt-1 min-h-16 w-full resize-y rounded-[7px] border border-v2-border-border-base bg-v2-background-bg-base px-2.5 py-2 text-[11px] leading-4 text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus"
                            onInput={(event) => updateScenario(scenario.id, { expected: event.currentTarget.value })}
                          />
                        </label>
                        <div class="mt-2 flex justify-end">
                          <ButtonV2 variant="ghost-muted" size="small" onClick={() => removeScenario(scenario.id)}>
                            {copy().deleteScenario}
                          </ButtonV2>
                        </div>
                      </div>
                    )}
                  </Show>
                  <div class="mt-3 flex items-center justify-between gap-3">
                    <span class="text-[10px] text-v2-text-text-faint">
                      {scenarioDraftCount()} {copy().scenarioConfigured}
                    </span>
                    <ButtonV2
                      data-action="game-preview-save-scenarios"
                      variant="contrast"
                      size="normal"
                      onClick={saveScenarios}
                    >
                      {copy().saveScenarios}
                    </ButtonV2>
                  </div>
                </div>
              </Show>
              <Show when={!state.historyLoading && state.history.length === 0}>
                <div class="flex h-full items-center justify-center text-[12px] text-v2-text-text-muted">
                  {copy().historyEmpty}
                </div>
              </Show>
              <div class="grid grid-cols-2 gap-2">
                <For each={state.history}>
                  {(item) => {
                    const selected = () => state.selected.includes(item.frame.id)
                    const checked = () => Object.values(item.frame.checks)
                    const passed = () => checked().filter((value) => value === "pass").length
                    return (
                      <div
                        class="group relative overflow-hidden rounded-[8px] border bg-v2-background-bg-deep"
                        classList={{
                          "border-v2-border-border-focus": selected(),
                          "border-v2-border-border-base": !selected(),
                        }}
                      >
                        <button
                          type="button"
                          class="block w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-v2-border-border-focus"
                          aria-pressed={selected()}
                          onClick={() => {
                            toggleFrame(item.frame.id)
                            editFrame(item.frame)
                          }}
                        >
                          <img
                            src={item.src}
                            alt={`${copy().history} ${new Date(item.frame.createdAt).toLocaleString()}`}
                            class="aspect-video w-full bg-black object-contain"
                          />
                          <div class="flex items-center justify-between gap-2 px-2 py-1.5">
                            <span class="truncate text-[10px] text-v2-text-text-muted">
                              {new Date(item.frame.createdAt).toLocaleString()}
                            </span>
                            <Show when={selected()}>
                              <span class="text-[10px] text-v2-text-text-strong">✓</span>
                            </Show>
                          </div>
                          <Show when={item.frame.scenario} keyed>
                            {(scenario) => (
                              <div class="flex px-2 pb-1.5">
                                <span class="truncate rounded-[4px] bg-v2-background-bg-layer-02 px-1 py-0.5 text-[9px] text-v2-text-text-muted">
                                  {copy().scenarios}: {scenario.name}
                                </span>
                              </div>
                            )}
                          </Show>
                          <Show when={item.frame.run} keyed>
                            {(run) => (
                              <div class="flex px-2 pb-1.5">
                                <span
                                  class="truncate rounded-[4px] px-1 py-0.5 text-[9px]"
                                  classList={{
                                    "bg-v2-state-bg-success text-v2-state-fg-success": run.expected === "pass",
                                    "bg-v2-state-bg-danger text-v2-state-fg-danger": run.expected === "fail",
                                  }}
                                >
                                  {copy().runResult}:{" "}
                                  {run.expected === "pass" ? copy().expectedMet : copy().expectedMissed}
                                </span>
                              </div>
                            )}
                          </Show>
                          <Show when={item.frame.tags.length > 0}>
                            <div class="flex flex-wrap gap-1 px-2 pb-1.5">
                              <For each={item.frame.tags}>
                                {(tag) => (
                                  <span class="rounded-[4px] bg-v2-background-bg-layer-02 px-1 py-0.5 text-[9px] text-v2-text-text-muted">
                                    {tagOptions().find((option) => option.id === tag)?.label}
                                  </span>
                                )}
                              </For>
                            </div>
                          </Show>
                          <Show when={checked().length > 0}>
                            <div class="flex px-2 pb-1.5">
                              <span class="rounded-[4px] bg-v2-background-bg-layer-02 px-1 py-0.5 text-[9px] text-v2-text-text-muted">
                                {copy().acceptance} {passed()}/{checked().length}
                              </span>
                            </div>
                          </Show>
                          <Show when={item.frame.note}>
                            <p class="line-clamp-2 px-2 pb-2 text-[10px] leading-4 text-v2-text-text-muted">
                              {item.frame.note}
                            </p>
                          </Show>
                        </button>
                        <button
                          type="button"
                          class="absolute right-1 top-1 flex size-6 items-center justify-center rounded-[6px] bg-black/65 text-[13px] text-white opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100"
                          aria-label={copy().deleteFrame}
                          onClick={() => void removeFrame(item.frame.id)}
                        >
                          ×
                        </button>
                      </div>
                    )
                  }}
                </For>
              </div>
              <Show when={state.history.find((item) => item.frame.id === state.editing)}>
                <div class="mt-3 rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-base p-3">
                  <div class="text-[12px] text-v2-text-text-strong [font-weight:580]">{copy().annotation}</div>
                  <div class="mt-1 text-[11px] leading-4 text-v2-text-text-muted">{copy().annotationHelp}</div>
                  <Show when={state.history.find((item) => item.frame.id === state.editing)?.frame.scenario} keyed>
                    {(scenario) => (
                      <div class="mt-2 rounded-[7px] bg-v2-background-bg-layer-02 px-2.5 py-2 text-[10px] leading-4 text-v2-text-text-muted">
                        <span class="text-v2-text-text-strong [font-weight:580]">{copy().currentScenario}: </span>
                        {scenario.name}
                      </div>
                    )}
                  </Show>
                  <Show when={state.history.find((item) => item.frame.id === state.editing)?.frame.run} keyed>
                    {(run) => (
                      <div class="mt-2 rounded-[7px] bg-v2-background-bg-layer-02 px-2.5 py-2 text-[10px] leading-4 text-v2-text-text-muted">
                        <span class="text-v2-text-text-strong [font-weight:580]">{copy().runResult}: </span>
                        {run.expected === "pass" ? copy().expectedMet : copy().expectedMissed}
                        <Show when={run.note}>
                          <span> · {run.note}</span>
                        </Show>
                      </div>
                    )}
                  </Show>
                  <div class="mt-3 rounded-[8px] bg-v2-background-bg-deep p-2.5">
                    <div class="text-[11px] text-v2-text-text-strong [font-weight:580]">{copy().acceptance}</div>
                    <div class="mt-0.5 text-[10px] leading-4 text-v2-text-text-faint">{copy().acceptanceHelp}</div>
                    <div class="mt-2 space-y-1.5">
                      <For each={criteriaOptions()}>
                        {(criterion) => (
                          <div class="flex items-center gap-2">
                            <span class="min-w-0 flex-1 text-[11px] text-v2-text-text-muted">
                              <span class="block">{criterion.label}</span>
                              <Show when={state.plan.criteria[criterion.id]}>
                                <span class="mt-0.5 line-clamp-2 block text-[10px] leading-3.5 text-v2-text-text-faint">
                                  {state.plan.criteria[criterion.id]}
                                </span>
                              </Show>
                            </span>
                            <ButtonV2
                              variant={state.checkDraft[criterion.id] === "pass" ? "contrast" : "neutral"}
                              size="small"
                              aria-pressed={state.checkDraft[criterion.id] === "pass"}
                              onClick={() => toggleCheck(criterion.id, "pass")}
                            >
                              {copy().pass}
                            </ButtonV2>
                            <ButtonV2
                              variant={state.checkDraft[criterion.id] === "fail" ? "contrast" : "neutral"}
                              size="small"
                              aria-pressed={state.checkDraft[criterion.id] === "fail"}
                              onClick={() => toggleCheck(criterion.id, "fail")}
                            >
                              {copy().fail}
                            </ButtonV2>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-1.5">
                    <For each={tagOptions()}>
                      {(tag) => (
                        <ButtonV2
                          variant={state.tagDraft.includes(tag.id) ? "contrast" : "neutral"}
                          size="small"
                          aria-pressed={state.tagDraft.includes(tag.id)}
                          onClick={() => toggleTag(tag.id)}
                        >
                          {tag.label}
                        </ButtonV2>
                      )}
                    </For>
                  </div>
                  <label class="mt-3 block text-[11px] text-v2-text-text-muted">
                    <span>{copy().note}</span>
                    <textarea
                      value={state.noteDraft}
                      maxLength={PREVIEW_FRAME_NOTE_MAX_LENGTH}
                      placeholder={copy().notePlaceholder}
                      class="mt-1.5 min-h-20 w-full resize-y rounded-[8px] border border-v2-border-border-base bg-v2-background-bg-deep px-2.5 py-2 text-[12px] leading-5 text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus"
                      onInput={(event) => setState("noteDraft", event.currentTarget.value)}
                    />
                  </label>
                  <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span class="text-[10px] text-v2-text-text-faint">
                      {state.noteDraft.length}/{PREVIEW_FRAME_NOTE_MAX_LENGTH}
                    </span>
                    <div class="flex items-center gap-2">
                      <ButtonV2
                        data-action="game-preview-save-annotation"
                        variant="neutral"
                        size="normal"
                        disabled={state.savingAnnotation || state.capturing}
                        onClick={() => void saveAnnotation()}
                      >
                        {state.savingAnnotation ? copy().savingAnnotation : copy().saveAnnotation}
                      </ButtonV2>
                      <ButtonV2
                        data-action="game-preview-review-annotation"
                        variant="contrast"
                        size="normal"
                        disabled={state.savingAnnotation || state.capturing}
                        onClick={() => void reviewFrame()}
                      >
                        {state.capturing ? copy().capturing : copy().reviewFrame}
                      </ButtonV2>
                    </div>
                  </div>
                </div>
              </Show>
            </div>
            <div class="flex shrink-0 items-center gap-3 border-t border-v2-border-border-base px-4 py-3">
              <span class="min-w-0 flex-1 text-[12px] text-v2-text-text-muted">
                {state.reportExported ? copy().reportExported : `${copy().selected} ${state.selected.length}/2`}
              </span>
              <ButtonV2
                data-action="game-preview-export-report"
                variant="neutral"
                size="normal"
                disabled={state.history.length === 0 || state.reporting || state.savingAnnotation}
                onClick={() => void exportReport()}
              >
                {state.reporting ? copy().exportingReport : copy().exportReport}
              </ButtonV2>
              <ButtonV2
                data-action="game-preview-compare"
                variant="contrast"
                size="normal"
                disabled={state.selected.length !== 2 || state.capturing}
                onClick={() => void compareFrames()}
              >
                {state.capturing ? copy().capturing : copy().compare}
              </ButtonV2>
            </div>
          </aside>
        </Show>
        <Show
          when={state.url}
          fallback={
            <div class="flex size-full items-center justify-center px-6 pb-16 text-center">
              <div class="flex max-w-[520px] flex-col items-center">
                <div class="flex size-12 items-center justify-center rounded-[14px] bg-v2-background-bg-layer-02 text-v2-icon-icon-base shadow-[var(--v2-elevation-raised)]">
                  <IconV2 name="monitor" size="large" />
                </div>
                <h2 class="mt-5 text-[18px] text-v2-text-text-strong [font-weight:580]">{copy().setup}</h2>
                <p class="mt-2 max-w-[420px] text-[13px] leading-5 text-v2-text-text-muted">{copy().help}</p>
                <Show when={effectiveStartCommand() && props.onStart}>
                  <div class="mt-5 flex w-full max-w-[440px] items-center gap-3 rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-base px-3 py-2.5 text-left">
                    <div class="min-w-0 flex-1">
                      <div class="text-[11px] text-v2-text-text-faint">{copy().command}</div>
                      <code class="mt-0.5 block truncate text-[12px] text-v2-text-text-base">
                        {effectiveStartCommand()}
                      </code>
                    </div>
                    <ButtonV2
                      data-action="game-preview-start"
                      variant="contrast"
                      size="normal"
                      disabled={state.starting}
                      onClick={() => void start()}
                    >
                      {state.starting ? copy().starting : copy().start}
                    </ButtonV2>
                  </div>
                </Show>
                <div class="mt-6 flex items-center gap-2 text-[12px] text-v2-text-text-faint">
                  <span>{state.detected.length > 0 ? copy().detected : copy().common}</span>
                  <ButtonV2
                    data-action="game-preview-scan"
                    variant="ghost-muted"
                    size="small"
                    disabled={state.scanning}
                    onClick={() => void scan()}
                  >
                    {copy().scan}
                  </ButtonV2>
                </div>
                <div class="mt-2 flex flex-wrap justify-center gap-2">
                  <For each={state.detected}>
                    {(url) => (
                      <ButtonV2 variant="contrast" size="normal" onClick={() => open(url)}>
                        {new URL(url).host}
                      </ButtonV2>
                    )}
                  </For>
                  <For each={COMMON_PREVIEW_PORTS}>
                    {(port) => (
                      <Show when={!state.detected.includes(`http://localhost:${port}/`)}>
                        <ButtonV2 variant="neutral" size="normal" onClick={() => open(`http://localhost:${port}`)}>
                          localhost:{port}
                        </ButtonV2>
                      </Show>
                    )}
                  </For>
                </div>
                <Show when={state.scanning}>
                  <div class="mt-3 text-[12px] text-v2-text-text-muted">{copy().scanning}</div>
                </Show>
              </div>
            </div>
          }
        >
          <Show when={state.loading}>
            <div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-v2-background-bg-deep/80 text-[13px] text-v2-text-text-muted">
              {copy().loading}
            </div>
          </Show>
          <Show when={frame()} keyed>
            {(current) => (
              <iframe
                ref={frameElement}
                data-component="game-preview-frame"
                title={copy().title}
                src={current.url}
                class="size-full border-0 bg-white"
                sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts"
                allow="autoplay; fullscreen; gamepad"
                onLoad={() => setState("loading", false)}
              />
            )}
          </Show>
        </Show>
      </div>
    </div>
  )
}
