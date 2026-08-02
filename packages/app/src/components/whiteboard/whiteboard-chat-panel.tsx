import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { createEffect, createMemo, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import {
  WHITEBOARD_CHAT_REQUEST_MAX_LENGTH,
  whiteboardChatDisplayText,
  type WhiteboardChatMessage,
} from "./whiteboard-chat"

export function WhiteboardChatPanel(props: {
  chinese: boolean
  messages: readonly WhiteboardChatMessage[]
  working: boolean
  sending: boolean
  applied: readonly string[]
  autoApply: boolean
  disabledReason?: string
  onAutoApplyChange: (value: boolean) => void
  onSend: (request: string) => Promise<boolean | void>
  onApply: (message: WhiteboardChatMessage, target: "revision" | "current") => void
  onClose: () => void
}) {
  const [state, setState] = createStore({ input: "" })
  const copy = createMemo(() =>
    props.chinese
      ? {
          title: "AI 白板共创",
          description: "描述修改，AI 会读取当前画布并返回可编辑版本。",
          empty: "试试让 AI 补全关卡流程、增加失败反馈，或检查谜题软锁。",
          placeholder: "例如：增加一条可恢复的失败分支，并保留现有主流程",
          send: "发送",
          thinking: "AI 正在调整当前白板…",
          autoApply: "自动生成新版本",
          revision: "应用为新版本",
          current: "替换当前白板",
          applied: "已应用",
          proposal: "可编辑方案",
          hints: ["补全流程", "增加失败反馈", "检查软锁", "优化新手引导"],
        }
      : {
          title: "AI board copilot",
          description: "Describe an edit. AI reads the current canvas and returns an editable revision.",
          empty: "Ask AI to complete the level flow, add failure feedback, or check the puzzle for soft locks.",
          placeholder: "For example: add a recoverable failure branch while preserving the main flow",
          send: "Send",
          thinking: "AI is adjusting the current board…",
          autoApply: "Auto-create a revision",
          revision: "Apply as revision",
          current: "Replace current board",
          applied: "Applied",
          proposal: "Editable proposal",
          hints: ["Complete the flow", "Add failure feedback", "Check soft locks", "Improve onboarding"],
        },
  )
  const pending = createMemo(() => props.sending || props.working)
  let scroll: HTMLDivElement | undefined

  createEffect(() => {
    props.messages.length
    pending()
    queueMicrotask(() => scroll?.scrollTo({ top: scroll.scrollHeight, behavior: "smooth" }))
  })

  const send = async () => {
    const request = state.input.trim()
    if (!request || pending() || props.disabledReason) return
    const accepted = await props.onSend(request)
    if (accepted === false) return
    setState("input", "")
  }

  return (
    <aside
      data-component="whiteboard-ai-chat"
      class="flex h-full w-[380px] max-w-[45vw] shrink-0 flex-col border-l border-v2-border-border-base bg-v2-background-bg-layer-01"
      aria-label={copy().title}
    >
      <header class="flex shrink-0 items-start gap-2 border-b border-v2-border-border-base px-3 py-3">
        <div class="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-v2-background-bg-layer-02">
          <IconV2 name="branch" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[13px] text-v2-text-text-strong [font-weight:580]">{copy().title}</div>
          <div class="mt-0.5 text-[11px] leading-4 text-v2-text-text-muted">{copy().description}</div>
        </div>
        <ButtonV2 data-action="whiteboard-chat-close" variant="ghost-muted" size="small" onClick={props.onClose}>
          ×
        </ButtonV2>
      </header>

      <label class="flex shrink-0 cursor-pointer items-center gap-2 border-b border-v2-border-border-base px-3 py-2 text-[11px] text-v2-text-text-base">
        <input
          data-action="whiteboard-chat-auto-apply"
          type="checkbox"
          checked={props.autoApply}
          onChange={(event) => props.onAutoApplyChange(event.currentTarget.checked)}
        />
        {copy().autoApply}
      </label>

      <div ref={scroll} class="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <Show
          when={props.messages.length > 0}
          fallback={<p class="text-[12px] leading-5 text-v2-text-text-muted">{copy().empty}</p>}
        >
          <For each={props.messages}>
            {(message) => (
              <div class={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  class={`max-w-[92%] rounded-[10px] px-3 py-2 text-[12px] leading-5 ${
                    message.role === "user"
                      ? "bg-v2-background-bg-layer-03 text-v2-text-text-strong"
                      : "border border-v2-border-border-base bg-v2-background-bg-base text-v2-text-text-base"
                  }`}
                >
                  <div class="whitespace-pre-wrap break-words">{whiteboardChatDisplayText(message, props.chinese)}</div>
                  <Show when={message.role === "assistant" && message.proposal}>
                    <div class="mt-2 border-t border-v2-border-border-base pt-2">
                      <div class="mb-2 flex items-center gap-1.5 text-[11px] text-v2-text-text-muted">
                        <IconV2 name="grid-plus" size="small" />
                        {copy().proposal} · {message.proposal?.title}
                      </div>
                      <Show
                        when={!props.applied.includes(message.id)}
                        fallback={<span class="text-[11px] text-v2-text-text-muted">{copy().applied}</span>}
                      >
                        <div class="flex flex-wrap gap-1.5">
                          <ButtonV2
                            data-action="whiteboard-chat-apply-revision"
                            variant="contrast"
                            size="small"
                            onClick={() => props.onApply(message, "revision")}
                          >
                            {copy().revision}
                          </ButtonV2>
                          <ButtonV2
                            data-action="whiteboard-chat-apply-current"
                            variant="ghost-muted"
                            size="small"
                            onClick={() => props.onApply(message, "current")}
                          >
                            {copy().current}
                          </ButtonV2>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </Show>
        <Show when={pending()}>
          <div class="flex items-center gap-2 text-[11px] text-v2-text-text-muted">
            <span class="size-1.5 animate-pulse rounded-full bg-v2-background-bg-accent" />
            {copy().thinking}
          </div>
        </Show>
      </div>

      <div class="shrink-0 border-t border-v2-border-border-base p-3">
        <Show when={props.disabledReason}>
          <div class="mb-2 rounded-[7px] bg-v2-background-bg-layer-02 px-2.5 py-2 text-[11px] leading-4 text-v2-text-text-muted">
            {props.disabledReason}
          </div>
        </Show>
        <div class="mb-2 flex flex-wrap gap-1.5">
          <For each={copy().hints}>
            {(hint) => (
              <button
                type="button"
                class="rounded-full border border-v2-border-border-base bg-v2-background-bg-base px-2 py-1 text-[10px] text-v2-text-text-muted hover:text-v2-text-text-base"
                disabled={pending() || !!props.disabledReason}
                onClick={() => setState("input", hint)}
              >
                {hint}
              </button>
            )}
          </For>
        </div>
        <textarea
          data-action="whiteboard-chat-input"
          class="h-20 w-full resize-none rounded-[8px] border border-v2-border-border-base bg-v2-background-bg-base px-3 py-2 text-[12px] leading-5 text-v2-text-text-base outline-none placeholder:text-v2-text-text-muted focus:border-v2-border-border-focus"
          aria-label={copy().placeholder}
          placeholder={copy().placeholder}
          value={state.input}
          maxLength={WHITEBOARD_CHAT_REQUEST_MAX_LENGTH}
          disabled={pending() || !!props.disabledReason}
          onInput={(event) => setState("input", event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return
            event.preventDefault()
            void send()
          }}
        />
        <div class="mt-2 flex items-center justify-between gap-2">
          <span class="text-[10px] text-v2-text-text-muted">
            {state.input.length}/{WHITEBOARD_CHAT_REQUEST_MAX_LENGTH} · Enter
          </span>
          <ButtonV2
            data-action="whiteboard-chat-send"
            variant="contrast"
            size="small"
            disabled={!state.input.trim() || pending() || !!props.disabledReason}
            onClick={() => void send()}
          >
            {copy().send}
          </ButtonV2>
        </div>
      </div>
    </aside>
  )
}
