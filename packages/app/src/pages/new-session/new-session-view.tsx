import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { WordmarkV2 } from "@opencode-ai/ui/v2/wordmark-v2"
import { For, Show, createMemo, createSignal, lazy, type Accessor } from "solid-js"
import { createStore } from "solid-js/store"
import { Portal } from "solid-js/web"
import createPresence from "solid-presence"
import { PromptInputV2Composer } from "@/components/prompt-input-v2"
import { GamePrototypeKitDialog } from "@/components/game-prototype-kit-dialog"
import {
  gamePrototypeKit,
  gamePrototypeKitPrompt,
  gamePrototypeKits,
  mergeGamePrototypeKitAcceptancePlan,
  upsertGamePrototypeKitScenario,
  type GamePrototypeKit,
  type GamePrototypeKitId,
} from "@/components/game-prototype-kit"
import {
  mergePreviewFeedbackText,
  previewFeedbackAppendPrompt,
  shouldAppendPreviewFeedback,
} from "@/components/game-preview"
import { parsePreviewAcceptancePlan, previewAcceptancePlanStorageKey } from "@/components/game-preview-plan"
import { mergePreviewProjectText, previewProjectContext } from "@/components/game-preview-project"
import { loadPreviewProjectProfile } from "@/components/game-preview-project-loader"
import {
  parsePreviewPlaytestScenarios,
  PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT,
  previewPlaytestScenariosStorageKey,
} from "@/components/game-preview-scenarios"
import { type WhiteboardChatSendInput } from "@/components/whiteboard/whiteboard-chat"
import {
  mergeWhiteboardText,
  type WhiteboardHandoffIntent,
  whiteboardAgent,
  whiteboardPrompt,
} from "@/components/whiteboard/whiteboard-prompt"
import type { WhiteboardTemplateId } from "@/components/whiteboard/whiteboard-templates"
import {
  parseWhiteboardWorkspace,
  WHITEBOARD_BOARD_MAX_COUNT,
  whiteboardWorkspaceStorageKey,
} from "@/components/whiteboard/whiteboard-workspace"
import { PromptGitStatus, PromptWorkspaceSelector } from "@/components/prompt-workspace-selector"
import {
  PromptProjectAddButton,
  PromptProjectSelector,
  type PromptProjectController,
} from "@/components/prompt-project-selector"
import { StatusPopoverV2 } from "@/components/status-popover"
import { useLanguage } from "@/context/language"
import { useLocal } from "@/context/local"
import { useSDK } from "@/context/sdk"
import { useServerSync } from "@/context/server-sync"
import { useProviders } from "@/hooks/use-providers"
import { NEW_SESSION_CONTENT_WIDTH } from "@/pages/session/new-session-layout"
import { Persist, persisted } from "@/utils/persist"
import type { NewSessionDraftController } from "./new-session-draft-controller"
import type { NewSessionWorkspaceController } from "./new-session-workspace-controller"

const providerTipDismissalDuration = 30 * 24 * 60 * 60 * 1000
const WhiteboardDialog = lazy(() => import("@/components/whiteboard/whiteboard-dialog"))
const GamePreviewDialog = lazy(() => import("@/components/game-preview-dialog"))

export function NewSessionView(props: {
  input: NewSessionDraftController["input"]
  project: PromptProjectController
  workspace: NewSessionWorkspaceController
  onWhiteboardChatSend: (input: WhiteboardChatSendInput) => Promise<boolean>
}) {
  const language = useLanguage()
  const local = useLocal()
  const sdk = useSDK()
  const [whiteboard, setWhiteboard] = createStore({
    open: false,
    initialTemplate: undefined as WhiteboardTemplateId | undefined,
    initialBoardName: "",
  })
  const [preview, setPreview] = createStore({ open: false })
  const [kit, setKit] = createStore({ open: false, id: undefined as GamePrototypeKitId | undefined })
  const chinese = createMemo(() => language.locale() === "zh" || language.locale() === "zht")
  const whiteboardLabel = createMemo(() => (chinese() ? "创意白板" : "Idea board"))
  const gameStarters = createMemo(() => gamePrototypeKits(chinese()))
  const selectedKit = createMemo(() => (kit.id ? gamePrototypeKit(kit.id, chinese()) : undefined))
  const kitBlocked = createMemo(() => {
    const selected = selectedKit()
    if (!selected || typeof localStorage !== "object") return []
    const storageKey = `km-agent.whiteboard.v1:${props.workspace.project.root()}`
    const workspace = parseWhiteboardWorkspace(
      localStorage.getItem(whiteboardWorkspaceStorageKey(storageKey)),
      chinese(),
    )
    const scenarios = parsePreviewPlaytestScenarios(
      localStorage.getItem(previewPlaytestScenariosStorageKey(props.workspace.project.root())),
    )
    return [
      workspace.boards.length >= WHITEBOARD_BOARD_MAX_COUNT
        ? chinese()
          ? `白板已达到 ${WHITEBOARD_BOARD_MAX_COUNT} 个上限，请先删除一个。`
          : `The ${WHITEBOARD_BOARD_MAX_COUNT}-board limit is full. Delete one board first.`
        : "",
      scenarios.items.length >= PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT &&
      !scenarios.items.some((scenario) => scenario.id === selected.scenario.id)
        ? chinese()
          ? `试玩场景已达到 ${PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT} 个上限，请先删除一个。`
          : `The ${PREVIEW_PLAYTEST_SCENARIOS_MAX_COUNT}-scenario limit is full. Delete one scenario first.`
        : "",
    ].filter(Boolean)
  })

  const applyPrototypeKit = (selected: GamePrototypeKit, concept: string) => {
    const directory = props.workspace.project.root()
    if (typeof localStorage === "object") {
      const planKey = previewAcceptancePlanStorageKey(directory)
      localStorage.setItem(
        planKey,
        JSON.stringify(
          mergeGamePrototypeKitAcceptancePlan(parsePreviewAcceptancePlan(localStorage.getItem(planKey)), selected),
        ),
      )
      const scenarioKey = previewPlaytestScenariosStorageKey(directory)
      localStorage.setItem(
        scenarioKey,
        JSON.stringify(
          upsertGamePrototypeKitScenario(parsePreviewPlaytestScenarios(localStorage.getItem(scenarioKey)), selected),
        ),
      )
    }
    props.input.onInput(gamePrototypeKitPrompt(selected, concept, chinese()))
    local.agent.set("build")
    setKit({ open: false, id: undefined })
    setWhiteboard({ open: true, initialTemplate: selected.template, initialBoardName: selected.title })
  }

  return (
    <div class="@container relative flex flex-col min-h-0 h-full flex-1">
      <div
        data-component="session-new-design"
        class="relative flex-1 min-h-0 overflow-hidden rounded-[10px] bg-v2-background-bg-deep"
      >
        <div class="absolute right-4 top-4 z-20 flex items-center gap-2">
          <ButtonV2
            data-action="open-game-preview"
            variant="neutral"
            size="normal"
            icon="monitor"
            onClick={() => setPreview("open", true)}
          >
            {chinese() ? "Demo 预览" : "Demo preview"}
          </ButtonV2>
          <ButtonV2
            data-action="open-whiteboard"
            variant="neutral"
            size="normal"
            icon="edit"
            onClick={() => setWhiteboard({ open: true, initialTemplate: undefined, initialBoardName: "" })}
          >
            {whiteboardLabel()}
          </ButtonV2>
        </div>
        <div class="absolute inset-x-0 top-[18%] flex justify-center px-6">
          <div class={NEW_SESSION_CONTENT_WIDTH}>
            <WordmarkV2 class="h-auto w-full text-v2-background-bg-inverse" />
            <div class="mt-6 flex flex-col gap-6">
              <PromptInputV2Composer controller={props.input} />
              <Show when={props.project.empty()}>
                <PromptProjectAddButton controller={props.project} />
              </Show>
              <Show when={props.project.selected()}>
                <div class="flex min-h-7 min-w-0 flex-col items-center justify-center gap-0 text-v2-text-text-faint sm:flex-row">
                  <PromptProjectSelector controller={props.project} placement="bottom" />
                  <Show
                    when={props.workspace.bar.visible()}
                    fallback={
                      <PromptGitStatus branch={props.workspace.bar.branch()} noGit={!props.workspace.project.git()} />
                    }
                  >
                    <PromptWorkspaceSelector
                      value={props.workspace.selection.value()}
                      projectRoot={props.workspace.project.root()}
                      workspaces={props.workspace.project.workspaces()}
                      branch={props.workspace.bar.branch()}
                      onChange={props.workspace.selection.set}
                      onDone={props.input.restoreFocus}
                    />
                  </Show>
                </div>
              </Show>
              <Show when={!props.input.value().trim() && props.input.attachments().length === 0}>
                <div data-component="game-idea-starters" class="flex flex-col items-center gap-3">
                  <div class="text-[12px] text-v2-text-text-faint [font-weight:440]">
                    {chinese() ? "从一个游戏创意开始" : "Start from a game idea"}
                  </div>
                  <div class="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
                    <For each={gameStarters()}>
                      {(item) => (
                        <button
                          type="button"
                          data-action="game-idea-starter"
                          class={`
                            flex min-w-0 flex-col items-start rounded-[10px] border border-v2-border-border-base
                            bg-v2-background-bg-base px-3 py-2.5 text-left transition-[background-color,border-color]
                            duration-150 hover:bg-v2-background-bg-layer-02 focus-visible:outline-none
                            focus-visible:ring-1 focus-visible:ring-v2-border-border-focus
                          `}
                          onClick={() => setKit({ open: true, id: item.id })}
                        >
                          <span class="truncate text-[12px] text-v2-text-text-base [font-weight:580]">
                            {item.title}
                          </span>
                          <span class="mt-0.5 truncate text-[11px] text-v2-text-text-faint">{item.description}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </div>
        <ProviderTip />
      </div>
      <Show when={kit.open && selectedKit()} keyed>
        {(selected) => (
          <GamePrototypeKitDialog
            kit={selected}
            chinese={chinese()}
            blocked={kitBlocked()}
            onApply={(concept) => applyPrototypeKit(selected, concept)}
            onClose={() => {
              setKit({ open: false, id: undefined })
              props.input.restoreFocus()
            }}
          />
        )}
      </Show>
      <Show when={whiteboard.open}>
        <WhiteboardDialog
          directory={props.workspace.project.root()}
          storageKey={`km-agent.whiteboard.v1:${props.workspace.project.root()}`}
          initialTemplate={whiteboard.initialTemplate}
          initialBoardName={whiteboard.initialBoardName}
          chatMessages={[]}
          chatWorking={false}
          onChatSend={props.onWhiteboardChatSend}
          onInitialTemplateApplied={() => setWhiteboard({ initialTemplate: undefined, initialBoardName: "" })}
          onClose={() => {
            setWhiteboard({ open: false, initialTemplate: undefined, initialBoardName: "" })
            props.input.restoreFocus()
          }}
          onAttach={async (file, sceneContext, intent: WhiteboardHandoffIntent = "implement") => {
            props.input.addAttachments([file])
            local.agent.set(whiteboardAgent(intent))
            const profile = await loadPreviewProjectProfile(sdk())
            const stackContext = profile.kind === "unknown" ? "" : previewProjectContext(profile, chinese())
            const context = [sceneContext?.trim(), stackContext].filter(Boolean).join("\n\n")
            const next = mergeWhiteboardText(
              props.input.value(),
              whiteboardPrompt(chinese(), intent),
              context || undefined,
            )
            if (next !== props.input.value()) props.input.onInput(next)
            setWhiteboard({ open: false, initialTemplate: undefined, initialBoardName: "" })
            props.input.restoreFocus()
            return true
          }}
        />
      </Show>
      <Show when={preview.open}>
        <GamePreviewDialog
          directory={props.workspace.project.root()}
          onCapture={(files, intent, annotation) => {
            props.input.addAttachments(files)
            const current = props.input.value()
            const generated = previewFeedbackAppendPrompt(current, chinese(), intent, annotation)
            const next = mergePreviewFeedbackText(current, generated, shouldAppendPreviewFeedback(intent, annotation))
            if (next !== props.input.value()) props.input.onInput(next)
            setPreview("open", false)
            props.input.restoreFocus()
            return true
          }}
          onRequestPrototype={(content) => {
            const next = mergePreviewProjectText(props.input.value(), content)
            if (next !== props.input.value()) props.input.onInput(next)
            setPreview("open", false)
            props.input.restoreFocus()
            return true
          }}
          onClose={() => {
            setPreview("open", false)
            props.input.restoreFocus()
          }}
        />
      </Show>
    </div>
  )
}

export function NewSessionStatus(props: { mount: Accessor<HTMLElement | null>; visible: Accessor<boolean> }) {
  const language = useLanguage()

  return (
    <Show when={props.mount()} keyed>
      {(mount) => (
        <Portal mount={mount}>
          <Show when={props.visible()}>
            <Tooltip placement="bottom" value={language.t("status.popover.trigger")}>
              <StatusPopoverV2 />
            </Tooltip>
          </Show>
        </Portal>
      )}
    </Show>
  )
}

function ProviderTip() {
  const language = useLanguage()
  const dialog = useDialog()
  const sdk = useSDK()
  const serverSync = useServerSync()
  const providers = useProviders(() => sdk().directory)
  const [persistedState, setPersistedState, , persistedReady] = persisted(
    Persist.global("new-session.provider-tip"),
    createStore({ dismissedAt: 0 }),
  )
  const visible = createMemo(
    () =>
      serverSync().child(sdk().directory)[0].provider_ready &&
      persistedReady() &&
      providers.paid().length === 0 &&
      Date.now() - persistedState.dismissedAt >= providerTipDismissalDuration,
  )
  const [ref, setRef] = createSignal<HTMLDivElement>()
  const presence = createPresence({
    show: visible,
    element: () => ref() ?? null,
  })
  const openProviders = () => {
    void import("@/components/dialog-connect-provider").then(({ DialogConnectProvider }) => {
      void dialog.show(() => <DialogConnectProvider directory={() => sdk().directory} />)
    })
  }

  return (
    <Show when={presence.present()}>
      <div class="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-10">
        <div
          ref={setRef}
          data-component="provider-tip"
          data-visible={visible()}
          class="group/provider-tip pointer-events-auto relative flex h-6 max-w-full items-center transition-[opacity,transform] duration-[250ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] motion-reduce:transition-none"
          classList={{ "data-[visible=false]:animate-out fade-out slide-out-to-bottom-4": true }}
        >
          <button
            type="button"
            class="flex h-6 min-w-0 items-center rounded-[4px] pl-1.5 text-[13px] leading-none tracking-[-0.04px] text-v2-text-text-faint transition-[background-color,color] duration-150 ease-in-out hover:bg-v2-overlay-simple-overlay-hover hover:text-v2-text-text-muted focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:text-v2-text-text-muted focus-visible:outline-none"
            onClick={openProviders}
          >
            <span class="truncate">{language.t("home.providerTip")}</span>
            <span class="flex size-6 shrink-0 items-center justify-center" aria-hidden="true">
              <IconV2 name="chevron-down" size="small" class="-rotate-90" />
            </span>
          </button>
          <TooltipV2
            class="hover-reveal absolute left-full top-0 flex h-6 w-7 items-center justify-end delay-0 duration-0 group-hover/provider-tip:delay-[250ms] group-hover/provider-tip:duration-150 group-hover/provider-tip:opacity-100 focus-within:delay-0 focus-within:duration-0 focus-within:opacity-100"
            placement="top"
            openDelay={1000}
            value={language.t("common.dismiss")}
          >
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded-[4px] text-v2-icon-icon-muted transition-[background-color,color] duration-150 ease-in-out hover:bg-v2-overlay-simple-overlay-hover hover:text-v2-icon-icon-base focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:text-v2-icon-icon-base focus-visible:outline-none"
              aria-label={language.t("common.dismiss")}
              onClick={() => setPersistedState("dismissedAt", Date.now())}
            >
              <IconV2 name="xmark-small" />
            </button>
          </TooltipV2>
        </div>
      </div>
    </Show>
  )
}
