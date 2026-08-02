import type { Session } from "@opencode-ai/sdk/v2/client"
import { Binary } from "@opencode-ai/core/util/binary"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { useNavigate, useSearchParams } from "@solidjs/router"
import { createEffect, startTransition, untrack } from "solid-js"
import { promptImageAttachment } from "@/components/prompt-input/attachments"
import { sendFollowupDraft } from "@/components/prompt-input/submit"
import { usePromptInputV2Controller } from "@/components/prompt-input-v2"
import {
  whiteboardChatContext,
  whiteboardChatPrompt,
  type WhiteboardChatSendInput,
} from "@/components/whiteboard/whiteboard-chat"
import {
  clearWhiteboardSessionHandoff,
  queueWhiteboardSessionHandoff,
} from "@/components/whiteboard/whiteboard-session-handoff"
import { useComments } from "@/context/comments"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useLocal } from "@/context/local"
import { usePrompt } from "@/context/prompt"
import { useSDK } from "@/context/sdk"
import { useServerSync } from "@/context/server-sync"
import { useSync } from "@/context/sync"
import { useTabs } from "@/context/tabs"
import { createPromptInputController, createPromptProjectControls } from "@/pages/session/composer"
import { createPromptModelSelection } from "@/pages/session/composer/prompt-model-selection"
import { useSessionKey } from "@/pages/session/session-layout"
import { useComposerCommands } from "@/pages/session/use-composer-commands"
import { formatServerError } from "@/utils/server-errors"
import { normalizeSessionInfo } from "@/utils/session"
import { showToast } from "@/utils/toast"
import { Worktree as WorktreeState } from "@/utils/worktree"

export function createNewSessionDraftController(workspace: { worktree: () => string; resetWorktree: () => void }) {
  const prompt = usePrompt()
  const serverSync = useServerSync()
  const sync = useSync()
  const sdk = useSDK()
  const comments = useComments()
  const local = useLocal()
  const layout = useLayout()
  const language = useLanguage()
  const navigate = useNavigate()
  const tabs = useTabs()
  const route = useSessionKey()
  const [searchParams, setSearchParams] = useSearchParams<{ draftId?: string; prompt?: string }>()
  const model = createPromptModelSelection({ agent: () => local.agent.current() })

  useComposerCommands({ model })

  const controls = createPromptInputController({
    sessionKey: route.sessionKey,
    sessionID: () => route.params.id,
    queryOptions: serverSync().queryOptions,
    model,
  })
  const projectControls = createPromptProjectControls()
  const input = usePromptInputV2Controller({
    get controls() {
      return controls()
    },
    get newSessionWorktree() {
      return workspace.worktree()
    },
    onNewSessionWorktreeReset: workspace.resetWorktree,
    onSubmit: comments.clear,
  })

  createEffect(() => {
    if (!prompt.ready()) return
    untrack(() => {
      const text = searchParams.prompt
      if (!text) return
      prompt.set([{ type: "text", content: text, start: 0, end: text.length }], text.length)
      setSearchParams({ ...searchParams, prompt: undefined })
    })
  })

  const seed = (directory: string, info: Session) => {
    serverSync().session.remember(info)
    const [, setStore] = serverSync().child(directory)
    setStore("session", (list: Session[]) => {
      const result = Binary.search(list, info.id, (item) => item.id)
      const next = [...list]
      if (result.found) next[result.index] = info
      else next.splice(result.index, 0, info)
      return next
    })
  }

  const errorMessage = (error: unknown) => formatServerError(error, language.t, language.t("common.requestFailed"))

  const startWhiteboardChat = async (request: WhiteboardChatSendInput) => {
    const model = local.model.current()
    const agent = sync().data.agent.find((item) => item.name === "plan") ?? local.agent.current()
    if (!model || !agent) {
      showToast({
        title: language.t("prompt.toast.modelAgentRequired.title"),
        description: language.t("prompt.toast.modelAgentRequired.description"),
      })
      return false
    }
    const variant = local.model.variant.current()

    const projectDirectory = sdk().directory
    const worktreeSelection = workspace.worktree() || "main"
    let sessionDirectory = projectDirectory

    if (worktreeSelection === "create") {
      const createdWorktree = await sdk()
        .client.worktree.create({ directory: projectDirectory })
        .then((response) => response.data)
        .catch((error: unknown) => {
          showToast({
            title: language.t("prompt.toast.worktreeCreateFailed.title"),
            description: errorMessage(error),
          })
          return undefined
        })
      if (!createdWorktree?.directory) return false
      WorktreeState.pending(sdk().scope, createdWorktree.directory)
      sessionDirectory = createdWorktree.directory
    } else if (worktreeSelection !== "main") {
      sessionDirectory = worktreeSelection
    }

    if (sessionDirectory !== projectDirectory) serverSync().child(sessionDirectory)
    workspace.resetWorktree()

    const attachment =
      request.image && model.capabilities.input.image
        ? await promptImageAttachment(request.image).catch(() => undefined)
        : undefined
    const created = await sdk()
      .api.session.create({
        agent: agent.name,
        model: { id: model.id, providerID: model.provider.id, variant },
        location: { directory: sessionDirectory },
      })
      .then(normalizeSessionInfo)
      .catch((error: unknown) => {
        showToast({
          title: language.t("prompt.toast.sessionCreateFailed.title"),
          description: errorMessage(error),
        })
        return undefined
      })
    if (!created) return false
    seed(sessionDirectory, created)

    const chinese = language.locale() === "zh" || language.locale() === "zht"
    const text = whiteboardChatPrompt(request.request, chinese)
    const draftIntent = input.value().trim()
    const context = [
      whiteboardChatContext(request.boardName, request.sceneContext, chinese, request.scope),
      draftIntent
        ? `${chinese ? "新任务草稿中的补充意图" : "Additional intent from the new-task draft"}:\n${draftIntent.slice(0, 4_000)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n")
    const draftImages = prompt
      .capture()
      .current()
      .filter((part) => part.type === "image")
    const waitForWorktree = async () => {
      const worktree = WorktreeState.get(sdk().scope, sessionDirectory)
      if (!worktree || worktree.status !== "pending") return true
      const result = await WorktreeState.wait(sdk().scope, sessionDirectory)
      if (result.status === "failed") throw new Error(result.message)
      return true
    }
    const accepted = await sendFollowupDraft({
      api: sdk().api.session,
      serverSync: serverSync(),
      sync: sync(),
      optimisticBusy: sessionDirectory === projectDirectory,
      delivery: "steer",
      messageID: request.messageID,
      before: waitForWorktree,
      draft: {
        sessionID: created.id,
        sessionDirectory,
        prompt: [
          { type: "text", content: text, start: 0, end: text.length },
          ...draftImages,
          ...(attachment ? [attachment] : []),
        ],
        context: [],
        agent: agent.name,
        model: { providerID: model.provider.id, modelID: model.id },
        variant,
      },
      syntheticText: context,
    }).catch((error: unknown) => {
      showToast({
        title: language.t("prompt.toast.promptSendFailed.title"),
        description: errorMessage(error),
      })
      return false
    })
    if (!accepted) return false

    queueWhiteboardSessionHandoff(created.id)
    local.agent.set(agent.name)
    try {
      await startTransition(() => {
        local.session.promote(sessionDirectory, created.id, {
          agent: agent.name,
          model: { providerID: model.provider.id, modelID: model.id },
          variant: variant ?? null,
        })
        layout.handoff.setTabs(base64Encode(sessionDirectory), created.id)
        const draftID = searchParams.draftId
        if (draftID) tabs.promoteDraft(draftID, { server: tabs.draft(draftID).server, sessionId: created.id })
        else navigate(`/${base64Encode(sessionDirectory)}/session/${created.id}`)
      })
    } catch (error) {
      clearWhiteboardSessionHandoff(created.id)
      showToast({ title: language.t("common.requestFailed"), description: errorMessage(error) })
      return false
    }
    return true
  }

  return {
    input,
    whiteboard: {
      startChat: startWhiteboardChat,
    },
    prompt: {
      ready: prompt.ready,
      readyPromise: () => prompt.ready.promise,
    },
    project: {
      controls: projectControls,
    },
  }
}

export type NewSessionDraftController = ReturnType<typeof createNewSessionDraftController>
