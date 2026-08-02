import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { createEffect, createMemo, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import {
  WHITEBOARD_CHAT_REQUEST_MAX_LENGTH,
  whiteboardChatDisplayText,
  type WhiteboardChatMessage,
} from "./whiteboard-chat"
import type { WhiteboardProposal } from "./whiteboard-proposal"
import {
  reviewWhiteboardProposal,
  type WhiteboardProposalReview,
} from "./whiteboard-proposal-review"
import type { WhiteboardSceneSummary } from "./whiteboard-scene"

export function WhiteboardChatPanel(props: {
  chinese: boolean
  messages: readonly WhiteboardChatMessage[]
  working: boolean
  sending: boolean
  applied: readonly string[]
  scene?: WhiteboardSceneSummary
  reviews?: Readonly<Record<string, WhiteboardProposalReview | undefined>>
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
                      <ProposalReview
                        chinese={props.chinese}
                        proposal={message.proposal!}
                        current={props.scene}
                        review={props.reviews?.[message.id]}
                      />
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

function ProposalReview(props: {
  chinese: boolean
  proposal: WhiteboardProposal
  current?: WhiteboardSceneSummary
  review?: WhiteboardProposalReview
}) {
  const value = createMemo(() => props.review ?? (props.current ? reviewWhiteboardProposal(props.current, props.proposal) : undefined))
  const copy = createMemo(() =>
    props.chinese
      ? {
          changes: "相对当前白板",
          nodes: "节点",
          connections: "连接",
          notes: "备注",
          added: "新增",
          removed: "移除",
          flow: "方案结构",
          starts: "起点",
          ends: "终点",
          branches: "分支",
          cycles: "循环",
          healthy: "未发现明显流程风险",
          disconnected: "孤立节点",
          unreachable: "不可达节点",
          incompleteDecisions: "不足两个出口的判定",
          unexpectedDeadEnds: "意外断头路",
          terminalFailures: "无重试出口的失败",
        }
      : {
          changes: "Compared with current board",
          nodes: "nodes",
          connections: "links",
          notes: "notes",
          added: "Added",
          removed: "Removed",
          flow: "Proposal structure",
          starts: "starts",
          ends: "ends",
          branches: "branches",
          cycles: "cycles",
          healthy: "No obvious flow risks detected",
          disconnected: "Disconnected nodes",
          unreachable: "Unreachable nodes",
          incompleteDecisions: "Decisions with fewer than two exits",
          unexpectedDeadEnds: "Unexpected dead ends",
          terminalFailures: "Failures without a retry exit",
        },
  )
  const issues = createMemo(() => {
    const review = value()
    if (!review) return []
    const disconnected = new Set(review.flow.disconnected)
    return [
      proposalIssue(copy().disconnected, review.flow.disconnected, props.chinese),
      proposalIssue(
        copy().unreachable,
        review.flow.unreachable.filter((label) => !disconnected.has(label)),
        props.chinese,
      ),
      proposalIssue(copy().incompleteDecisions, review.flow.incompleteDecisions, props.chinese),
      proposalIssue(copy().unexpectedDeadEnds, review.flow.unexpectedDeadEnds, props.chinese),
      proposalIssue(copy().terminalFailures, review.flow.terminalFailures, props.chinese),
    ].filter((issue) => !!issue)
  })

  return (
    <Show when={value()}>
      {(review) => (
        <div
          data-component="whiteboard-proposal-review"
          class="mb-2 space-y-1.5 rounded-[7px] bg-v2-background-bg-layer-02 px-2.5 py-2 text-[10px] leading-4 text-v2-text-text-muted"
        >
          <div>
            <span class="text-v2-text-text-base [font-weight:560]">{copy().changes}</span>
            <span class="ml-1.5">
              {copy().nodes} {proposalDelta(review().changes.nodes.added.length, review().changes.nodes.removed.length)}
              {" · "}
              {copy().connections}{" "}
              {proposalDelta(review().changes.connections.added, review().changes.connections.removed)}
              {" · "}
              {copy().notes} {proposalDelta(review().changes.notes.added, review().changes.notes.removed)}
            </span>
          </div>
          <Show when={review().changes.nodes.added.length > 0}>
            <div title={review().changes.nodes.added.join(" · ")}>
              <span class="text-v2-text-text-base">+ {copy().added}：</span>
              {proposalLabels(review().changes.nodes.added, props.chinese)}
            </div>
          </Show>
          <Show when={review().changes.nodes.removed.length > 0}>
            <div title={review().changes.nodes.removed.join(" · ")}>
              <span class="text-v2-text-text-base">− {copy().removed}：</span>
              {proposalLabels(review().changes.nodes.removed, props.chinese)}
            </div>
          </Show>
          <div>
            <span class="text-v2-text-text-base [font-weight:560]">{copy().flow}</span>
            <span class="ml-1.5">
              {review().flow.starts.length} {copy().starts} · {review().flow.ends.length} {copy().ends} ·{" "}
              {review().flow.branches.length} {copy().branches} · {review().flow.cycles.length} {copy().cycles}
            </span>
          </div>
          <Show
            when={issues().length > 0}
            fallback={
              <div class="flex items-center gap-1 text-v2-text-text-base">
                <IconV2 name="check" size="small" />
                {copy().healthy}
              </div>
            }
          >
            <For each={issues()}>{(issue) => <div>⚠ {issue}</div>}</For>
          </Show>
        </div>
      )}
    </Show>
  )
}

function proposalDelta(added: number, removed: number) {
  if (added === 0 && removed === 0) return "0"
  return [added > 0 ? `+${added}` : "", removed > 0 ? `−${removed}` : ""].filter(Boolean).join(" / ")
}

function proposalLabels(labels: readonly string[], chinese: boolean) {
  const visible = labels.slice(0, 3).join(chinese ? "、" : ", ")
  if (labels.length <= 3) return visible
  return chinese ? `${visible} 等 ${labels.length} 项` : `${visible} and ${labels.length - 3} more`
}

function proposalIssue(label: string, nodes: readonly string[], chinese = true) {
  if (nodes.length === 0) return ""
  return `${label}${chinese ? "：" : ": "}${proposalLabels(nodes, chinese)}`
}
