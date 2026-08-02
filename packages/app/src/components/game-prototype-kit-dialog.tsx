import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { createMemo, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { GAME_PROTOTYPE_KIT_CONCEPT_MAX_LENGTH, type GamePrototypeKit } from "./game-prototype-kit"

export function GamePrototypeKitDialog(props: {
  kit: GamePrototypeKit
  chinese: boolean
  blocked: string[]
  onApply: (concept: string) => void
  onClose: () => void
}) {
  const [state, setState] = createStore({ concept: "" })
  const copy = createMemo(() =>
    props.chinese
      ? {
          title: "创建原型工作台",
          description: "一次准备白板、验收标准、试玩场景和实现任务，已有项目配置不会被覆盖。",
          concept: "补充你的创意",
          conceptPlaceholder: "例如：废弃观测站中的光路谜题；低多边形风格；单局 3 分钟。",
          includes: "将创建",
          board: "独立可编辑白板",
          boardDetail: "从对应策划模板开始，不覆盖已有白板",
          acceptance: "6 项试玩验收标准",
          acceptanceDetail: "只补齐空缺项，保留项目已有自定义标准",
          scenario: "可重复试玩场景",
          scenarioDetail: props.kit.scenario.name,
          workflow: "Build 实现任务",
          workflowDetail: "把结构化原型要求写入输入框，确认后即可发送",
          cancel: "取消",
          apply: "创建工作台",
          blocked: "需要先释放项目容量",
        }
      : {
          title: "Create prototype workbench",
          description:
            "Prepare the board, acceptance criteria, playtest scenario, and implementation task together without overwriting project configuration.",
          concept: "Add your creative brief",
          conceptPlaceholder:
            "Example: A light-routing puzzle in an abandoned observatory; low-poly; three-minute run.",
          includes: "Creates",
          board: "Separate editable board",
          boardDetail: "Starts from the matching design template and keeps existing boards",
          acceptance: "Six playtest criteria",
          acceptanceDetail: "Fills missing criteria while preserving project edits",
          scenario: "Repeatable playtest scenario",
          scenarioDetail: props.kit.scenario.name,
          workflow: "Build implementation task",
          workflowDetail: "Writes a structured prototype request that is ready to review and send",
          cancel: "Cancel",
          apply: "Create workbench",
          blocked: "Project capacity needs attention",
        },
  )
  const items = createMemo(() => [
    { icon: "edit" as const, title: copy().board, detail: copy().boardDetail },
    { icon: "check" as const, title: copy().acceptance, detail: copy().acceptanceDetail },
    { icon: "branch" as const, title: copy().scenario, detail: copy().scenarioDetail },
    { icon: "monitor" as const, title: copy().workflow, detail: copy().workflowDetail },
  ])

  return (
    <div
      data-component="game-prototype-kit-dialog"
      class="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${copy().title}: ${props.kit.title}`}
    >
      <div class="flex max-h-[min(720px,calc(100vh_-_2rem))] w-[560px] max-w-full flex-col overflow-hidden rounded-[14px] border border-v2-border-border-base bg-v2-background-bg-base shadow-2xl">
        <header class="flex shrink-0 items-start gap-3 border-b border-v2-border-border-base px-5 py-4">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-v2-background-bg-layer-02">
            <IconV2 name="edit" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[15px] text-v2-text-text-strong [font-weight:600]">
              {copy().title} · {props.kit.title}
            </div>
            <p class="mt-1 text-[12px] leading-5 text-v2-text-text-muted">{copy().description}</p>
          </div>
          <ButtonV2 variant="ghost-muted" size="small" aria-label={copy().cancel} onClick={props.onClose}>
            ×
          </ButtonV2>
        </header>
        <div data-scrollable class="min-h-0 flex-1 overflow-y-auto p-5">
          <label class="block text-[12px] text-v2-text-text-muted">
            <span class="text-v2-text-text-strong [font-weight:580]">{copy().concept}</span>
            <textarea
              autofocus
              value={state.concept}
              maxLength={GAME_PROTOTYPE_KIT_CONCEPT_MAX_LENGTH}
              placeholder={copy().conceptPlaceholder}
              class="mt-2 min-h-24 w-full resize-y rounded-[9px] border border-v2-border-border-base bg-v2-background-bg-deep px-3 py-2.5 text-[12px] leading-5 text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus"
              onInput={(event) => setState("concept", event.currentTarget.value)}
            />
            <span class="mt-1 block text-right text-[10px] text-v2-text-text-faint">
              {state.concept.length}/{GAME_PROTOTYPE_KIT_CONCEPT_MAX_LENGTH}
            </span>
          </label>
          <div class="mt-4 text-[11px] uppercase tracking-wide text-v2-text-text-faint">{copy().includes}</div>
          <div class="mt-2 grid gap-2 sm:grid-cols-2">
            <For each={items()}>
              {(item) => (
                <div class="rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-layer-01 p-3">
                  <div class="flex items-center gap-2 text-[12px] text-v2-text-text-strong [font-weight:580]">
                    <IconV2 name={item.icon} size="small" />
                    {item.title}
                  </div>
                  <p class="mt-1.5 text-[10px] leading-4 text-v2-text-text-muted">{item.detail}</p>
                </div>
              )}
            </For>
          </div>
          <Show when={props.blocked.length > 0}>
            <div class="mt-4 rounded-[9px] border border-v2-state-border-danger bg-v2-state-bg-danger px-3 py-2.5">
              <div class="text-[11px] text-v2-state-fg-danger [font-weight:580]">{copy().blocked}</div>
              <ul class="mt-1 list-disc pl-4 text-[10px] leading-4 text-v2-state-fg-danger">
                <For each={props.blocked}>{(reason) => <li>{reason}</li>}</For>
              </ul>
            </div>
          </Show>
        </div>
        <footer class="flex shrink-0 items-center justify-end gap-2 border-t border-v2-border-border-base px-5 py-4">
          <ButtonV2 variant="neutral" size="normal" onClick={props.onClose}>
            {copy().cancel}
          </ButtonV2>
          <ButtonV2
            data-action="apply-game-prototype-kit"
            variant="contrast"
            size="normal"
            disabled={props.blocked.length > 0}
            onClick={() => props.onApply(state.concept)}
          >
            {copy().apply}
          </ButtonV2>
        </footer>
      </div>
    </div>
  )
}
