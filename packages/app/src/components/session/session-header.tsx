import { AppIcon } from "@opencode-ai/ui/app-icon"
import { Button } from "@opencode-ai/ui/button"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Keybind } from "@opencode-ai/ui/keybind"
import { Spinner } from "@opencode-ai/ui/spinner"
import { showToast } from "@/utils/toast"
import { Tooltip, TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { getFilename } from "@opencode-ai/core/util/path"
import { createEffect, createMemo, createSignal, For, lazy, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { createMediaQuery } from "@solid-primitives/media"
import { Portal } from "solid-js/web"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useLocal } from "@/context/local"
import { usePlatform } from "@/context/platform"
import { usePrompt } from "@/context/prompt"
import { useSDK } from "@/context/sdk"
import { useServer } from "@/context/server"
import { useSettings } from "@/context/settings"
import { useSync } from "@/context/sync"
import { useTerminal } from "@/context/terminal"
import { focusTerminalById } from "@/pages/session/helpers"
import { useSessionLayout } from "@/pages/session/session-layout"
import { messageAgentColor } from "@/utils/agent"
import { decode64 } from "@/utils/base64"
import { fileManagerApp } from "@/utils/file-manager"
import { Persist, persisted } from "@/utils/persist"
import { StatusPopover, StatusPopoverV2 } from "../status-popover"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { KeybindV2 } from "@opencode-ai/ui/v2/keybind-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { reviewTooltipKeybind } from "../command-tooltip-keybind"
import { useTitlebarRightMount } from "../titlebar"
import {
  mergePreviewFeedbackPrompt,
  previewFeedbackAppendPrompt,
  previewStartProcess,
  shouldAppendPreviewFeedback,
  type PreviewCaptureIntent,
} from "../game-preview"
import {
  previewBuildOutputPath,
  previewBuildResultFromExitCode,
  type PreviewBuildResult,
  type PreviewBuildTarget,
} from "../game-preview-build"
import { mergePreviewProjectPrompt, previewProjectContext } from "../game-preview-project"
import { loadPreviewProjectProfile } from "../game-preview-project-loader"
import { appendPromptImageAttachment } from "../prompt-input/attachments"
import {
  seedWhiteboardPrompt,
  type WhiteboardHandoffIntent,
  whiteboardAgent,
  whiteboardProjectDirectory,
  whiteboardPrompt,
} from "../whiteboard/whiteboard-prompt"
import { latestWhiteboardProposalText } from "../whiteboard/whiteboard-proposal"

const OPEN_APPS = [
  "vscode",
  "cursor",
  "zed",
  "textmate",
  "antigravity",
  "finder",
  "terminal",
  "iterm2",
  "ghostty",
  "warp",
  "xcode",
  "android-studio",
  "powershell",
  "sublime-text",
] as const

const GamePreviewDialog = lazy(() => import("@/components/game-preview-dialog"))
const WhiteboardDialog = lazy(() => import("@/components/whiteboard/whiteboard-dialog"))

type OpenApp = (typeof OPEN_APPS)[number]
type OS = "macos" | "windows" | "linux" | "unknown"

const isOpenApp = (value: unknown): value is OpenApp =>
  typeof value === "string" && OPEN_APPS.some((app) => app === value)

const MAC_APPS = [
  {
    id: "vscode",
    label: "session.header.open.app.vscode",
    icon: "vscode",
    openWith: "Visual Studio Code",
  },
  { id: "cursor", label: "session.header.open.app.cursor", icon: "cursor", openWith: "Cursor" },
  { id: "zed", label: "session.header.open.app.zed", icon: "zed", openWith: "Zed" },
  { id: "textmate", label: "session.header.open.app.textmate", icon: "textmate", openWith: "TextMate" },
  {
    id: "antigravity",
    label: "session.header.open.app.antigravity",
    icon: "antigravity",
    openWith: "Antigravity",
  },
  { id: "terminal", label: "session.header.open.app.terminal", icon: "terminal", openWith: "Terminal" },
  { id: "iterm2", label: "session.header.open.app.iterm2", icon: "iterm2", openWith: "iTerm" },
  { id: "ghostty", label: "session.header.open.app.ghostty", icon: "ghostty", openWith: "Ghostty" },
  { id: "warp", label: "session.header.open.app.warp", icon: "warp", openWith: "Warp" },
  { id: "xcode", label: "session.header.open.app.xcode", icon: "xcode", openWith: "Xcode" },
  {
    id: "android-studio",
    label: "session.header.open.app.androidStudio",
    icon: "android-studio",
    openWith: "Android Studio",
  },
  {
    id: "sublime-text",
    label: "session.header.open.app.sublimeText",
    icon: "sublime-text",
    openWith: "Sublime Text",
  },
] as const

const WINDOWS_APPS = [
  { id: "vscode", label: "session.header.open.app.vscode", icon: "vscode", openWith: "code" },
  { id: "cursor", label: "session.header.open.app.cursor", icon: "cursor", openWith: "cursor" },
  { id: "zed", label: "session.header.open.app.zed", icon: "zed", openWith: "zed" },
  {
    id: "powershell",
    label: "session.header.open.app.powershell",
    icon: "powershell",
    openWith: "powershell",
  },
  {
    id: "sublime-text",
    label: "session.header.open.app.sublimeText",
    icon: "sublime-text",
    openWith: "Sublime Text",
  },
] as const

const LINUX_APPS = [
  { id: "vscode", label: "session.header.open.app.vscode", icon: "vscode", openWith: "code" },
  { id: "cursor", label: "session.header.open.app.cursor", icon: "cursor", openWith: "cursor" },
  { id: "zed", label: "session.header.open.app.zed", icon: "zed", openWith: "zed" },
  {
    id: "sublime-text",
    label: "session.header.open.app.sublimeText",
    icon: "sublime-text",
    openWith: "Sublime Text",
  },
] as const

const detectOS = (platform: ReturnType<typeof usePlatform>): OS => {
  if (platform.platform === "desktop" && platform.os) return platform.os
  if (typeof navigator !== "object") return "unknown"
  const value = navigator.platform || navigator.userAgent
  if (/Mac/i.test(value)) return "macos"
  if (/Win/i.test(value)) return "windows"
  if (/Linux/i.test(value)) return "linux"
  return "unknown"
}

const showRequestError = (language: ReturnType<typeof useLanguage>, err: unknown) => {
  showToast({
    variant: "error",
    title: language.t("common.requestFailed"),
    description: err instanceof Error ? err.message : String(err),
  })
}

export function SessionHeader() {
  const layout = useLayout()
  const local = useLocal()
  const command = useCommand()
  const server = useServer()
  const platform = usePlatform()
  const prompt = usePrompt()
  const sdk = useSDK()
  const language = useLanguage()
  const settings = useSettings()
  const sync = useSync()
  const terminal = useTerminal()
  const { params, view } = useSessionLayout()

  const projectDirectory = createMemo(() => decode64(params.dir) ?? "")
  const project = createMemo(() => {
    const directory = projectDirectory()
    if (!directory) return undefined
    return layout.projects.list().find((p) => p.worktree === directory || p.sandboxes?.includes(directory))
  })
  const name = createMemo(() => {
    const current = project()
    if (current) return current.name || getFilename(current.worktree)
    return getFilename(projectDirectory())
  })
  const hotkey = createMemo(() => command.keybind("file.open"))
  const startupCommand = createMemo(
    () => project()?.commands?.start?.trim() || sync().data.projectMeta?.commands?.start?.trim(),
  )
  const chinese = createMemo(() => language.locale() === "zh" || language.locale() === "zht")
  const whiteboardLabel = createMemo(() => (chinese() ? "创意白板" : "Idea board"))
  const projectDesignDirectory = createMemo(() => whiteboardProjectDirectory(projectDirectory(), project()?.worktree))
  const whiteboardProposal = createMemo(() =>
    latestWhiteboardProposalText(params.id ? (sync().data.message[params.id] ?? []) : [], sync().data.part),
  )
  const os = createMemo(() => detectOS(platform))
  const isV2 = settings.general.newLayoutDesigns
  const search = settings.visibility.search
  const status = settings.visibility.status
  const isDesktop = createMediaQuery("(min-width: 768px)")

  const [exists, setExists] = createStore<Partial<Record<OpenApp, boolean>>>({
    finder: true,
  })

  const apps = createMemo(() => {
    if (os() === "macos") return MAC_APPS
    if (os() === "windows") return WINDOWS_APPS
    return LINUX_APPS
  })

  const fileManager = createMemo(() => fileManagerApp(os()))

  createEffect(() => {
    if (platform.platform !== "desktop") return
    if (!platform.checkAppExists) return

    const list = apps()

    setExists(Object.fromEntries(list.map((app) => [app.id, undefined])) as Partial<Record<OpenApp, boolean>>)

    void Promise.all(
      list.map((app) =>
        Promise.resolve(platform.checkAppExists?.(app.openWith))
          .then((value) => Boolean(value))
          .catch(() => false)
          .then((ok) => [app.id, ok] as const),
      ),
    ).then((entries) => {
      setExists(Object.fromEntries(entries) as Partial<Record<OpenApp, boolean>>)
    })
  })

  const options = createMemo(() => {
    return [
      { id: "finder", label: language.t(fileManager().label), icon: fileManager().icon },
      ...apps()
        .filter((app) => exists[app.id])
        .map((app) => ({ ...app, label: language.t(app.label) })),
    ] as const
  })

  const toggleTerminal = () => {
    const next = !view().terminal.opened()
    view().terminal.toggle()
    if (!next) return

    const id = terminal.active()
    if (!id) return
    focusTerminalById(id)
  }

  const startPreview = async (detected?: string) => {
    const startup = detected?.trim() || startupCommand()
    if (!startup) return false
    const process = previewStartProcess(startup, os() === "windows" ? "windows" : "unix")
    if (!view().terminal.opened()) view().terminal.toggle()
    return !!(await terminal.new({ title: "Game Preview", ...process }))
  }

  const buildPreview = async (target: PreviewBuildTarget): Promise<PreviewBuildResult> => {
    const process = previewStartProcess(target.command, os() === "windows" ? "windows" : "unix")
    if (!view().terminal.opened()) view().terminal.toggle()
    const created = await terminal.new({ title: `Game Build · ${target.name}`, ...process })
    if (!created) return "failed"
    return previewBuildResultFromExitCode(await terminal.waitForExit(created.id))
  }

  const revealBuild = async (target: PreviewBuildTarget) => {
    if (!platform.revealPath || !server.isLocal()) return false
    const output = previewBuildOutputPath(projectDirectory(), target.output)
    if (!output) return false
    return platform.revealPath(output)
  }

  const capturePreview = async (files: File[], intent: PreviewCaptureIntent, annotation?: string) => {
    const target = prompt.capture()
    for (const file of files) {
      if (!(await appendPromptImageAttachment(file, target))) return false
    }
    const current = target.current()
    const chinese = language.locale() === "zh" || language.locale() === "zht"
    const currentText = current
      .filter((part) => part.type === "text")
      .map((part) => part.content)
      .join("\n")
    const content = previewFeedbackAppendPrompt(currentText, chinese, intent, annotation)
    const next = mergePreviewFeedbackPrompt(current, content, shouldAppendPreviewFeedback(intent, annotation))
    if (next !== current) {
      const text = next.find((part) => part.type === "text")
      target.set(next, text?.type === "text" ? text.content.length : undefined)
    }
    setPreview("open", false)
    return true
  }

  const requestPrototype = (content: string) => {
    const target = prompt.capture()
    const current = target.current()
    const next = mergePreviewProjectPrompt(current, content)
    if (next !== current) {
      const text = next.find((part) => part.type === "text")
      target.set(next, text?.type === "text" ? text.content.length : undefined)
    }
    setPreview("open", false)
    return true
  }

  const attachWhiteboard = async (file: File, sceneContext?: string, intent: WhiteboardHandoffIntent = "implement") => {
    const target = prompt.capture()
    if (!(await appendPromptImageAttachment(file, target))) return false
    local.agent.set(whiteboardAgent(intent))
    const profile = await loadPreviewProjectProfile(sdk())
    const stackContext = profile.kind === "unknown" ? "" : previewProjectContext(profile, chinese())
    const context = [sceneContext?.trim(), stackContext].filter(Boolean).join("\n\n")
    const current = target.current()
    const next = seedWhiteboardPrompt(current, whiteboardPrompt(chinese(), intent), context || undefined)
    if (next !== current) {
      const text = next.find((part) => part.type === "text")
      target.set(next, text?.type === "text" ? text.content.length : undefined)
    }
    setWhiteboard("open", false)
    return true
  }

  const [prefs, setPrefs] = persisted(Persist.global("open.app"), createStore({ app: "finder" as OpenApp }))
  const [menu, setMenu] = createStore({ open: false })
  const [preview, setPreview] = createStore({ open: false })
  const [whiteboard, setWhiteboard] = createStore({ open: false })
  const [openRequest, setOpenRequest] = createStore({
    app: undefined as OpenApp | undefined,
  })

  const canOpen = createMemo(() => platform.platform === "desktop" && !!platform.openPath && server.isLocal())
  const current = createMemo(
    () =>
      options().find((o) => o.id === prefs.app) ??
      options()[0] ??
      ({ id: "finder", label: fileManager().label, icon: fileManager().icon } as const),
  )
  const opening = createMemo(() => openRequest.app !== undefined)
  const tint = createMemo(() =>
    messageAgentColor(params.id ? sync().data.message[params.id] : undefined, sync().data.agent),
  )
  const v2ActionsState = createMemo<SessionHeaderV2ActionsState>(() => ({
    statusVisible: status(),
    statusLabel: language.t("status.popover.trigger"),
    whiteboardLabel: whiteboardLabel(),
    whiteboardVisible: !!projectDesignDirectory(),
    onWhiteboardOpen: () => setWhiteboard("open", true),
    previewLabel: chinese() ? "Demo 预览" : "Demo preview",
    previewVisible: !!projectDirectory(),
    onPreviewOpen: () => setPreview("open", true),
    reviewLabel: language.t("command.review.toggle"),
    reviewKeybind: reviewTooltipKeybind(command),
    reviewVisible: isDesktop(),
    reviewOpened: view().reviewPanel.opened(),
    onReviewToggle: () => view().reviewPanel.toggle(),
  }))

  const selectApp = (app: OpenApp) => {
    if (!options().some((item) => item.id === app)) return
    setPrefs("app", app)
  }

  const openDir = (app: OpenApp) => {
    if (opening() || !canOpen() || !platform.openPath) return
    const directory = projectDirectory()
    if (!directory) return

    const item = options().find((o) => o.id === app)
    const openWith = item && "openWith" in item ? item.openWith : undefined
    setOpenRequest("app", app)
    platform
      .openPath(directory, openWith)
      .catch((err: unknown) => showRequestError(language, err))
      .finally(() => {
        setOpenRequest("app", undefined)
      })
  }

  const copyPath = () => {
    const directory = projectDirectory()
    if (!directory) return
    navigator.clipboard
      .writeText(directory)
      .then(() => {
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("session.share.copy.copied"),
          description: directory,
        })
      })
      .catch((err: unknown) => showRequestError(language, err))
  }

  const [centerMount, setCenterMount] = createSignal<HTMLElement | null>(null)
  const rightMount = useTitlebarRightMount()
  onMount(() => {
    setCenterMount(document.getElementById("opencode-titlebar-center"))
  })

  return (
    <>
      <Show when={search() && centerMount()} keyed>
        {(mount) => (
          <Portal mount={mount}>
            <Button
              type="button"
              variant="ghost"
              size="small"
              class="hidden md:flex w-[240px] max-w-full min-w-0 items-center gap-2 justify-between rounded-md border border-border-weak-base bg-surface-panel shadow-none cursor-default"
              onClick={() => command.trigger("file.open")}
              aria-label={language.t("session.header.searchFiles")}
            >
              <div class="flex min-w-0 flex-1 items-center overflow-visible">
                <span class="flex-1 min-w-0 text-12-regular text-text-weak truncate text-left">
                  {language.t("session.header.search.placeholder", {
                    project: name(),
                  })}
                </span>
              </div>

              <Show when={hotkey()} keyed>
                {(keybind) => (
                  <Keybind class="shrink-0 !border-0 !bg-transparent !shadow-none px-0 text-text-weaker">
                    {keybind}
                  </Keybind>
                )}
              </Show>
            </Button>
          </Portal>
        )}
      </Show>
      <Show when={rightMount()} keyed>
        {(mount) => (
          <Portal mount={mount}>
            <Show
              when={isV2}
              fallback={
                <div class="flex items-center gap-2">
                  <Show when={projectDirectory()}>
                    <div class="hidden xl:flex items-center">
                      <Show
                        when={canOpen()}
                        fallback={
                          <div class="flex h-[24px] box-border items-center rounded-md border border-border-weak-base bg-surface-panel overflow-hidden">
                            <Button
                              variant="ghost"
                              class="rounded-none h-full py-0 pr-3 pl-0.5 gap-1.5 border-none shadow-none"
                              onClick={copyPath}
                              aria-label={language.t("session.header.open.copyPath")}
                            >
                              <Icon name="copy" size="small" class="text-icon-base" />
                              <span class="text-12-regular text-text-strong">
                                {language.t("session.header.open.copyPath")}
                              </span>
                            </Button>
                          </div>
                        }
                      >
                        <div class="flex items-center">
                          <div class="flex h-[24px] box-border items-center rounded-md border border-border-weak-base bg-surface-panel overflow-hidden">
                            <Button
                              variant="ghost"
                              class="rounded-none h-full px-0.5 border-none shadow-none disabled:!cursor-default"
                              classList={{
                                "bg-surface-raised-base-active": opening(),
                              }}
                              onClick={() => openDir(current().id)}
                              disabled={opening()}
                              aria-label={language.t("session.header.open.ariaLabel", { app: current().label })}
                            >
                              <div class="flex size-5 shrink-0 items-center justify-center [&_[data-component=app-icon]]:size-5">
                                <Show when={opening()} fallback={<AppIcon id={current().icon} />}>
                                  <Spinner class="size-3.5" style={{ color: tint() ?? "var(--icon-base)" }} />
                                </Show>
                              </div>
                            </Button>
                            <DropdownMenu
                              gutter={4}
                              placement="bottom-end"
                              open={menu.open}
                              onOpenChange={(open) => setMenu("open", open)}
                            >
                              <DropdownMenu.Trigger
                                as={IconButton}
                                icon="chevron-down"
                                variant="ghost"
                                disabled={opening()}
                                class="rounded-none h-full w-[20px] p-0 border-none shadow-none data-[expanded]:bg-surface-raised-base-active disabled:!cursor-default"
                                classList={{
                                  "bg-surface-raised-base-active": opening(),
                                }}
                                aria-label={language.t("session.header.open.menu")}
                              />
                              <DropdownMenu.Portal>
                                <DropdownMenu.Content class="[&_[data-slot=dropdown-menu-item]]:pl-1 [&_[data-slot=dropdown-menu-radio-item]]:pl-1 [&_[data-slot=dropdown-menu-radio-item]+[data-slot=dropdown-menu-radio-item]]:mt-1">
                                  <DropdownMenu.Group>
                                    <DropdownMenu.GroupLabel class="!px-1 !py-1">
                                      {language.t("session.header.openIn")}
                                    </DropdownMenu.GroupLabel>
                                    <DropdownMenu.RadioGroup
                                      class="mt-1"
                                      value={current().id}
                                      onChange={(value) => {
                                        if (!isOpenApp(value)) return
                                        selectApp(value)
                                      }}
                                    >
                                      <For each={options()}>
                                        {(o) => (
                                          <DropdownMenu.RadioItem
                                            value={o.id}
                                            disabled={opening()}
                                            onSelect={() => {
                                              setMenu("open", false)
                                              openDir(o.id)
                                            }}
                                          >
                                            <div class="flex size-5 shrink-0 items-center justify-center [&_[data-component=app-icon]]:size-5">
                                              <AppIcon id={o.icon} />
                                            </div>
                                            <DropdownMenu.ItemLabel>{o.label}</DropdownMenu.ItemLabel>
                                            <DropdownMenu.ItemIndicator>
                                              <Icon name="check-small" size="small" class="text-icon-weak" />
                                            </DropdownMenu.ItemIndicator>
                                          </DropdownMenu.RadioItem>
                                        )}
                                      </For>
                                    </DropdownMenu.RadioGroup>
                                  </DropdownMenu.Group>
                                  <DropdownMenu.Separator />
                                  <DropdownMenu.Item
                                    onSelect={() => {
                                      setMenu("open", false)
                                      copyPath()
                                    }}
                                  >
                                    <div class="flex size-5 shrink-0 items-center justify-center">
                                      <Icon name="copy" size="small" class="text-icon-weak" />
                                    </div>
                                    <DropdownMenu.ItemLabel>
                                      {language.t("session.header.open.copyPath")}
                                    </DropdownMenu.ItemLabel>
                                  </DropdownMenu.Item>
                                </DropdownMenu.Content>
                              </DropdownMenu.Portal>
                            </DropdownMenu>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </Show>
                  <div class="flex items-center gap-1">
                    <Show when={status()}>
                      <Tooltip placement="bottom" value={language.t("status.popover.trigger")}>
                        <StatusPopover />
                      </Tooltip>
                    </Show>
                    <Show when={projectDesignDirectory()}>
                      <Tooltip placement="bottom" value={whiteboardLabel()}>
                        <Button
                          variant="ghost"
                          class="titlebar-icon h-6 w-8 shrink-0 p-0"
                          onClick={() => setWhiteboard("open", true)}
                          aria-label={whiteboardLabel()}
                        >
                          <Icon size="small" name="edit" />
                        </Button>
                      </Tooltip>
                    </Show>
                    <Show when={projectDirectory()}>
                      <Tooltip placement="bottom" value={chinese() ? "Demo 预览" : "Demo preview"}>
                        <Button
                          variant="ghost"
                          class="titlebar-icon h-6 w-8 shrink-0 p-0"
                          onClick={() => setPreview("open", true)}
                          aria-label={chinese() ? "Demo 预览" : "Demo preview"}
                        >
                          <Icon size="small" name="window-cursor" />
                        </Button>
                      </Tooltip>
                    </Show>
                    <TooltipKeybind
                      title={language.t("command.terminal.toggle")}
                      keybind={command.keybind("terminal.toggle")}
                    >
                      <Button
                        variant="ghost"
                        class="group/terminal-toggle titlebar-icon w-8 h-6 p-0 box-border shrink-0"
                        onClick={toggleTerminal}
                        aria-label={language.t("command.terminal.toggle")}
                        aria-expanded={view().terminal.opened()}
                        aria-controls="terminal-panel"
                      >
                        <Icon size="small" name={view().terminal.opened() ? "terminal-active" : "terminal"} />
                      </Button>
                    </TooltipKeybind>

                    <div class="hidden md:flex items-center gap-1 shrink-0">
                      <TooltipKeybind
                        title={language.t("command.review.toggle")}
                        keybind={command.keybind("review.toggle")}
                      >
                        <Button
                          variant="ghost"
                          class="group/review-toggle titlebar-icon w-8 h-6 p-0 box-border"
                          onClick={() => view().reviewPanel.toggle()}
                          aria-label={language.t("command.review.toggle")}
                          aria-expanded={view().reviewPanel.opened()}
                          aria-controls="review-panel"
                        >
                          <Icon size="small" name={view().reviewPanel.opened() ? "review-active" : "review"} />
                        </Button>
                      </TooltipKeybind>

                      <TooltipKeybind
                        title={language.t("command.fileTree.toggle")}
                        keybind={command.keybind("fileTree.toggle")}
                      >
                        <Button
                          variant="ghost"
                          class="titlebar-icon w-8 h-6 p-0 box-border"
                          onClick={() => layout.fileTree.toggle()}
                          aria-label={language.t("command.fileTree.toggle")}
                          aria-expanded={layout.fileTree.opened()}
                          aria-controls="file-tree-panel"
                        >
                          <div class="relative flex items-center justify-center size-4">
                            <Icon
                              size="small"
                              name={layout.fileTree.opened() ? "file-tree-active" : "file-tree"}
                              classList={{
                                "text-icon-strong": layout.fileTree.opened(),
                                "text-icon-weak": !layout.fileTree.opened(),
                              }}
                            />
                          </div>
                        </Button>
                      </TooltipKeybind>
                    </div>
                  </div>
                </div>
              }
            >
              <SessionHeaderV2Actions state={v2ActionsState()} />
            </Show>
          </Portal>
        )}
      </Show>
      <Show when={preview.open && projectDesignDirectory()}>
        <GamePreviewDialog
          directory={projectDesignDirectory()}
          startCommand={startupCommand()}
          onStart={startPreview}
          onBuild={buildPreview}
          onRevealBuild={platform.revealPath && server.isLocal() ? revealBuild : undefined}
          onCapture={capturePreview}
          onRequestPrototype={requestPrototype}
          onClose={() => setPreview("open", false)}
        />
      </Show>
      <Show when={whiteboard.open && projectDesignDirectory()}>
        <WhiteboardDialog
          directory={projectDesignDirectory()}
          storageKey={`km-agent.whiteboard.v1:${projectDesignDirectory()}`}
          assistantText={whiteboardProposal()}
          onAttach={attachWhiteboard}
          onClose={() => setWhiteboard("open", false)}
        />
      </Show>
    </>
  )
}

type SessionHeaderV2ActionsState = {
  statusVisible: boolean
  statusLabel: string
  whiteboardLabel: string
  whiteboardVisible: boolean
  onWhiteboardOpen: () => void
  previewLabel: string
  previewVisible: boolean
  onPreviewOpen: () => void
  reviewLabel: string
  reviewKeybind: string[]
  reviewVisible: boolean
  reviewOpened: boolean
  onReviewToggle: () => void
}

function SessionHeaderV2Actions(props: { state: SessionHeaderV2ActionsState }) {
  return (
    <div class="flex items-center gap-2">
      <Show when={props.state.statusVisible}>
        <Tooltip placement="bottom" value={props.state.statusLabel}>
          <StatusPopoverV2 />
        </Tooltip>
      </Show>
      <Show when={props.state.whiteboardVisible}>
        <TooltipV2 class="shrink-0" placement="bottom" value={props.state.whiteboardLabel}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="large"
            class="!w-9 shrink-0"
            onClick={props.state.onWhiteboardOpen}
            aria-label={props.state.whiteboardLabel}
            icon={<IconV2 name="edit" />}
          />
        </TooltipV2>
      </Show>
      <Show when={props.state.previewVisible}>
        <TooltipV2 class="shrink-0" placement="bottom" value={props.state.previewLabel}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="large"
            class="!w-9 shrink-0"
            onClick={props.state.onPreviewOpen}
            aria-label={props.state.previewLabel}
            icon={<IconV2 name="monitor" />}
          />
        </TooltipV2>
      </Show>
      <Show when={props.state.reviewVisible}>
        <TooltipV2
          class="shrink-0"
          placement="bottom"
          value={
            <>
              {props.state.reviewLabel}
              <Show when={props.state.reviewKeybind.length > 0}>
                <KeybindV2 keys={props.state.reviewKeybind} variant="neutral" />
              </Show>
            </>
          }
        >
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="large"
            class="!w-9 shrink-0"
            state={props.state.reviewOpened ? "pressed" : undefined}
            onClick={props.state.onReviewToggle}
            aria-label={props.state.reviewLabel}
            aria-expanded={props.state.reviewOpened}
            aria-controls="review-panel"
            icon={<IconV2 name="sidebar-right" />}
          />
        </TooltipV2>
      </Show>
    </div>
  )
}
