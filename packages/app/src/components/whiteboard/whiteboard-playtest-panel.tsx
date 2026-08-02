import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { createMemo, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { WhiteboardSceneSummary } from "./whiteboard-scene"
import {
  WHITEBOARD_PLAYTEST_ISSUES,
  WHITEBOARD_PLAYTEST_MAX_STEPS,
  WHITEBOARD_PLAYTEST_NOTE_MAX_LENGTH,
  whiteboardPlaytestChoices,
  whiteboardPlaytestStarts,
  type WhiteboardPlaytestIssue,
  type WhiteboardPlaytestStep,
} from "./whiteboard-playtest"

export function WhiteboardPlaytestPanel(props: {
  chinese: boolean
  graph: WhiteboardSceneSummary
  path: WhiteboardPlaytestStep[]
  disabled: boolean
  onStart: (ref: string) => void
  onAdvance: (connection: number) => void
  onBack: () => void
  onRestart: () => void
  onSaveScenario: () => void
  onReview: () => void
  onImprove?: (issue: WhiteboardPlaytestIssue, note: string) => Promise<boolean | void> | boolean | void
  improving?: boolean
  improveDisabled?: boolean
  onClose: () => void
}) {
  const [state, setState] = createStore({ issue: "guidance" as WhiteboardPlaytestIssue, note: "" })
  const copy = createMemo(() =>
    props.chinese
      ? {
          title: "流程试玩",
          step: "步",
          start: "起点",
          current: "当前节点",
          choices: "选择下一步",
          endpoint: "已到达终点",
          endpointHint: "这个节点没有后继连接。确认它确实是通关、失败或阶段结束条件。",
          noLabel: "未命名节点",
          back: "上一步",
          restart: "重新开始",
          save: "保存场景",
          review: "交给 AI 评审轨迹",
          finding: "标记试玩问题",
          findingHint: "告诉 AI 哪里不对，它会按真实轨迹生成一个安全白板版本。",
          note: "补充复现细节或期望（可选）",
          improve: "AI 优化白板",
          improving: "AI 正在优化…",
          issues: {
            guidance: "引导不清",
            feedback: "反馈不足",
            "soft-lock": "卡住 / 软锁",
            pacing: "节奏问题",
            branch: "分支无意义",
          } satisfies Record<WhiteboardPlaytestIssue, string>,
          close: "关闭",
          limit: `已达到 ${WHITEBOARD_PLAYTEST_MAX_STEPS} 步上限，请重新开始或交给 AI 检查循环。`,
        }
      : {
          title: "Flow playtest",
          step: "steps",
          start: "Start",
          current: "Current node",
          choices: "Choose next step",
          endpoint: "Endpoint reached",
          endpointHint:
            "This node has no outgoing link. Confirm that it is a completion, failure, or stage-end condition.",
          noLabel: "Unlabeled node",
          back: "Back",
          restart: "Restart",
          save: "Save scenario",
          review: "Ask AI to review trace",
          finding: "Flag a playtest issue",
          findingHint: "Tell AI what felt wrong and it will generate a safe board revision from the actual trace.",
          note: "Add reproduction detail or desired behavior (optional)",
          improve: "Improve board with AI",
          improving: "AI is improving…",
          issues: {
            guidance: "Unclear guidance",
            feedback: "Weak feedback",
            "soft-lock": "Stuck / soft lock",
            pacing: "Pacing issue",
            branch: "Weak branch",
          } satisfies Record<WhiteboardPlaytestIssue, string>,
          close: "Close",
          limit: `Reached the ${WHITEBOARD_PLAYTEST_MAX_STEPS}-step limit. Restart or ask AI to inspect the loop.`,
        },
  )
  const nodes = createMemo(() => new Map(props.graph.nodes.map((node) => [node.ref, node])))
  const current = createMemo(() => nodes().get(props.path.at(-1)?.ref ?? ""))
  const choices = createMemo(() => whiteboardPlaytestChoices(props.graph, props.path))
  const starts = createMemo(() => whiteboardPlaytestStarts(props.graph))
  const repeated = createMemo(() => {
    const currentRef = props.path.at(-1)?.ref
    if (!currentRef) return false
    return props.path.filter((step) => step.ref === currentRef).length > 1
  })

  return (
    <aside
      data-component="whiteboard-flow-playtest"
      class="absolute bottom-4 right-4 top-4 z-20 flex w-[360px] max-w-[calc(100%_-_2rem)] flex-col overflow-hidden rounded-[12px] border border-v2-border-border-base bg-v2-background-bg-base shadow-xl"
      onWheel={(event) => event.stopPropagation()}
    >
      <header class="flex h-12 shrink-0 items-center gap-2 border-b border-v2-border-border-base px-3">
        <div class="flex size-7 items-center justify-center rounded-[7px] bg-v2-background-bg-layer-02">
          <IconV2 name="branch" />
        </div>
        <div class="min-w-0 flex-1 text-[13px] text-v2-text-text-strong [font-weight:580]">{copy().title}</div>
        <span class="text-[11px] text-v2-text-text-muted">
          {props.path.length} {copy().step}
        </span>
        <ButtonV2 data-action="whiteboard-playtest-close" variant="ghost-muted" size="small" onClick={props.onClose}>
          {copy().close}
        </ButtonV2>
      </header>
      <div data-scrollable class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <Show when={starts().length > 1}>
          <div class="flex flex-col gap-2">
            <div class="text-[11px] uppercase tracking-wide text-v2-text-text-muted">{copy().start}</div>
            <div class="flex flex-wrap gap-1.5">
              <For each={starts()}>
                {(ref) => (
                  <ButtonV2
                    data-action="whiteboard-playtest-start"
                    variant={props.path[0]?.ref === ref ? "neutral" : "ghost-muted"}
                    size="small"
                    onClick={() => props.onStart(ref)}
                  >
                    {nodes().get(ref)?.label || ref}
                  </ButtonV2>
                )}
              </For>
            </div>
          </div>
        </Show>
        <div class="rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-layer-02 p-4">
          <div class="flex items-center gap-2 text-[11px] text-v2-text-text-muted">
            <span>{copy().current}</span>
            <span>·</span>
            <span>{current()?.ref}</span>
            <Show when={repeated()}>
              <span class="rounded-full bg-v2-background-bg-base px-2 py-0.5">Loop</span>
            </Show>
          </div>
          <div class="mt-2 whitespace-pre-wrap text-[16px] leading-6 text-v2-text-text-strong [font-weight:580]">
            {current()?.label || copy().noLabel}
          </div>
        </div>
        <Show
          when={choices().length > 0 && props.path.length < WHITEBOARD_PLAYTEST_MAX_STEPS}
          fallback={
            <div class="rounded-[10px] border border-v2-border-border-base px-3 py-3">
              <div class="flex items-center gap-2 text-[12px] text-v2-text-text-strong [font-weight:580]">
                <IconV2 name={props.path.length >= WHITEBOARD_PLAYTEST_MAX_STEPS ? "reset" : "check"} />
                {props.path.length >= WHITEBOARD_PLAYTEST_MAX_STEPS ? copy().limit : copy().endpoint}
              </div>
              <Show when={props.path.length < WHITEBOARD_PLAYTEST_MAX_STEPS}>
                <div class="mt-1 text-[11px] leading-5 text-v2-text-text-muted">{copy().endpointHint}</div>
              </Show>
            </div>
          }
        >
          <div class="flex flex-col gap-2">
            <div class="text-[11px] uppercase tracking-wide text-v2-text-text-muted">{copy().choices}</div>
            <For each={choices()}>
              {(choice) => (
                <button
                  type="button"
                  data-action="whiteboard-playtest-choice"
                  class="flex min-w-0 items-center gap-3 rounded-[9px] border border-v2-border-border-base bg-v2-background-bg-layer-01 px-3 py-2.5 text-left transition-colors hover:bg-v2-background-bg-layer-02 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-v2-border-border-focus"
                  onClick={() => props.onAdvance(choice.index)}
                >
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[12px] text-v2-text-text-strong [font-weight:580]">
                      {choice.label}
                    </span>
                    <span class="mt-0.5 block truncate text-[11px] text-v2-text-text-muted">→ {choice.target}</span>
                  </span>
                  <IconV2 name="branch" />
                </button>
              )}
            </For>
          </div>
        </Show>
        <div class="flex flex-wrap gap-1.5">
          <For each={props.path}>
            {(step, index) => (
              <span class="max-w-full truncate rounded-full bg-v2-background-bg-layer-02 px-2 py-1 text-[10px] text-v2-text-text-muted">
                {index() + 1}. {nodes().get(step.ref)?.label || step.ref}
              </span>
            )}
          </For>
        </div>
        <Show when={props.onImprove}>
          <div class="flex flex-col gap-2 rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-layer-01 p-3">
            <div>
              <div class="text-[12px] text-v2-text-text-strong [font-weight:580]">{copy().finding}</div>
              <div class="mt-0.5 text-[11px] leading-4 text-v2-text-text-muted">{copy().findingHint}</div>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <For each={WHITEBOARD_PLAYTEST_ISSUES}>
                {(issue) => (
                  <ButtonV2
                    data-action={`whiteboard-playtest-issue-${issue}`}
                    variant={state.issue === issue ? "neutral" : "ghost-muted"}
                    size="small"
                    disabled={props.improving}
                    onClick={() => setState("issue", issue)}
                  >
                    {copy().issues[issue]}
                  </ButtonV2>
                )}
              </For>
            </div>
            <textarea
              data-action="whiteboard-playtest-issue-note"
              class="h-16 resize-none rounded-[7px] border border-v2-border-border-base bg-v2-background-bg-base px-2.5 py-2 text-[11px] leading-4 text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus"
              value={state.note}
              maxLength={WHITEBOARD_PLAYTEST_NOTE_MAX_LENGTH}
              placeholder={copy().note}
              disabled={props.improving}
              onInput={(event) => setState("note", event.currentTarget.value)}
            />
          </div>
        </Show>
      </div>
      <footer class="flex shrink-0 flex-col gap-2 border-t border-v2-border-border-base p-3">
        <div class="flex items-center gap-2">
          <ButtonV2
            data-action="whiteboard-playtest-back"
            variant="ghost-muted"
            size="small"
            disabled={props.path.length <= 1 || props.disabled}
            onClick={props.onBack}
          >
            {copy().back}
          </ButtonV2>
          <ButtonV2
            data-action="whiteboard-playtest-restart"
            variant="ghost-muted"
            size="small"
            disabled={props.disabled}
            onClick={props.onRestart}
          >
            {copy().restart}
          </ButtonV2>
          <div class="flex-1" />
          <ButtonV2
            data-action="whiteboard-playtest-save-scenario"
            variant="neutral"
            size="small"
            disabled={props.disabled}
            onClick={props.onSaveScenario}
          >
            {copy().save}
          </ButtonV2>
        </div>
        <div class="flex items-center justify-end gap-2">
          <ButtonV2
            data-action="whiteboard-playtest-review"
            variant="ghost-muted"
            size="small"
            disabled={props.disabled || props.improving}
            onClick={props.onReview}
          >
            {copy().review}
          </ButtonV2>
          <Show when={props.onImprove}>
            <ButtonV2
              data-action="whiteboard-playtest-improve"
              variant="contrast"
              size="small"
              disabled={props.disabled || props.improveDisabled || props.improving}
              onClick={() => void props.onImprove?.(state.issue, state.note)}
            >
              {props.improving ? copy().improving : copy().improve}
            </ButtonV2>
          </Show>
        </div>
      </footer>
    </aside>
  )
}
