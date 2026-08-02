import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { createMemo, For, Show } from "solid-js"
import {
  PREVIEW_PLAYTEST_RUN_NOTE_MAX_LENGTH,
  previewPlaytestRunComplete,
  previewPlaytestScenarioSteps,
  type PreviewPlaytestRun,
  type PreviewPlaytestStepState,
} from "./game-preview-run"
import type { PreviewPlaytestScenario } from "./game-preview-scenarios"

export function GamePreviewRunPanel(props: {
  chinese: boolean
  scenario: PreviewPlaytestScenario
  run: PreviewPlaytestRun
  capturing: boolean
  captureAvailable: boolean
  onCheck: (index: number, state: Exclude<PreviewPlaytestStepState, "">) => void
  onExpected: (state: Exclude<PreviewPlaytestStepState, "">) => void
  onNote: (note: string) => void
  onReset: () => void
  onCapture: () => void
  onClose: () => void
}) {
  const copy = createMemo(() =>
    props.chinese
      ? {
          title: "场景试玩",
          description: "按场景步骤操作当前 Demo，逐项记录结果，最后截图交给 AI 复盘。",
          progress: "已测试",
          pass: "通过",
          fail: "有问题",
          expected: "预期结果",
          expectedPass: "符合预期",
          expectedFail: "未符合",
          note: "策划备注",
          notePlaceholder: "记录操作手感、异常表现或复现条件（可选）",
          reset: "重新测试",
          capture: "截图并交给 AI",
          capturing: "正在截图…",
          incomplete: "完成全部步骤并判断预期结果后即可提交。",
          incompleteSteps: "完成全部步骤后即可提交。",
          unavailable: "桌面端截图能力不可用，暂时无法提交结果。",
          close: "关闭",
        }
      : {
          title: "Scenario playtest",
          description: "Play the current demo step by step, record each result, then send a captured result to AI.",
          progress: "Tested",
          pass: "Pass",
          fail: "Issue",
          expected: "Expected result",
          expectedPass: "Expectation met",
          expectedFail: "Not met",
          note: "Designer note",
          notePlaceholder: "Record feel, unexpected behavior, or reproduction details (optional)",
          reset: "Run again",
          capture: "Capture and send to AI",
          capturing: "Capturing…",
          incomplete: "Complete every step and assess the expected result before submitting.",
          incompleteSteps: "Complete every step before submitting.",
          unavailable: "Desktop capture is unavailable, so this result cannot be submitted yet.",
          close: "Close",
        },
  )
  const steps = createMemo(() => previewPlaytestScenarioSteps(props.scenario))
  const completed = createMemo(() => steps().filter((_, index) => !!props.run.checks[index]).length)
  const ready = createMemo(() => previewPlaytestRunComplete(props.run, props.scenario))

  return (
    <aside
      data-component="game-preview-scenario-run"
      class="absolute bottom-4 left-4 top-4 z-20 flex w-[380px] max-w-[calc(100%_-_2rem)] flex-col overflow-hidden rounded-[12px] border border-v2-border-border-base bg-v2-background-bg-base shadow-xl"
    >
      <header class="flex shrink-0 items-start gap-3 border-b border-v2-border-border-base px-3 py-3">
        <div class="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-v2-background-bg-layer-02">
          <IconV2 name="check" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-[13px] text-v2-text-text-strong [font-weight:580]">{props.scenario.name}</div>
          <div class="mt-0.5 text-[10px] text-v2-text-text-faint">
            {copy().title} · {copy().progress} {completed()}/{steps().length}
          </div>
        </div>
        <ButtonV2 data-action="game-preview-run-close" variant="ghost-muted" size="small" onClick={props.onClose}>
          {copy().close}
        </ButtonV2>
      </header>
      <div data-scrollable class="min-h-0 flex-1 overflow-y-auto p-3">
        <p class="text-[11px] leading-4 text-v2-text-text-muted">{copy().description}</p>
        <div class="mt-3 space-y-2">
          <For each={steps()}>
            {(step, index) => (
              <div
                class="rounded-[9px] border border-v2-border-border-base bg-v2-background-bg-layer-01 p-2.5"
                classList={{ "opacity-65": !!props.run.checks[index()] && index() !== completed() }}
              >
                <div class="flex items-start gap-2">
                  <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-v2-background-bg-layer-02 text-[10px] text-v2-text-text-muted">
                    {index() + 1}
                  </span>
                  <span class="min-w-0 flex-1 whitespace-pre-wrap text-[11px] leading-5 text-v2-text-text-base">
                    {step}
                  </span>
                </div>
                <div class="mt-2 flex justify-end gap-1.5">
                  <ButtonV2
                    data-action="game-preview-run-step-pass"
                    data-index={index()}
                    variant={props.run.checks[index()] === "pass" ? "contrast" : "neutral"}
                    size="small"
                    aria-pressed={props.run.checks[index()] === "pass"}
                    onClick={() => props.onCheck(index(), "pass")}
                  >
                    {copy().pass}
                  </ButtonV2>
                  <ButtonV2
                    data-action="game-preview-run-step-fail"
                    data-index={index()}
                    variant={props.run.checks[index()] === "fail" ? "contrast" : "neutral"}
                    size="small"
                    aria-pressed={props.run.checks[index()] === "fail"}
                    onClick={() => props.onCheck(index(), "fail")}
                  >
                    {copy().fail}
                  </ButtonV2>
                </div>
              </div>
            )}
          </For>
        </div>
        <Show when={props.scenario.expected}>
          <div class="mt-3 rounded-[9px] border border-v2-border-border-base bg-v2-background-bg-layer-02 p-3">
            <div class="text-[10px] uppercase tracking-wide text-v2-text-text-faint">{copy().expected}</div>
            <div class="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-v2-text-text-base">
              {props.scenario.expected}
            </div>
            <div class="mt-2 flex justify-end gap-1.5">
              <ButtonV2
                data-action="game-preview-run-expected-pass"
                variant={props.run.expected === "pass" ? "contrast" : "neutral"}
                size="small"
                aria-pressed={props.run.expected === "pass"}
                onClick={() => props.onExpected("pass")}
              >
                {copy().expectedPass}
              </ButtonV2>
              <ButtonV2
                data-action="game-preview-run-expected-fail"
                variant={props.run.expected === "fail" ? "contrast" : "neutral"}
                size="small"
                aria-pressed={props.run.expected === "fail"}
                onClick={() => props.onExpected("fail")}
              >
                {copy().expectedFail}
              </ButtonV2>
            </div>
          </div>
        </Show>
        <label class="mt-3 block text-[11px] text-v2-text-text-muted">
          <span>{copy().note}</span>
          <textarea
            value={props.run.note}
            maxLength={PREVIEW_PLAYTEST_RUN_NOTE_MAX_LENGTH}
            placeholder={copy().notePlaceholder}
            class="mt-1 min-h-20 w-full resize-y rounded-[8px] border border-v2-border-border-base bg-v2-background-bg-deep px-2.5 py-2 text-[11px] leading-4 text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus"
            onInput={(event) => props.onNote(event.currentTarget.value)}
          />
        </label>
      </div>
      <footer class="shrink-0 border-t border-v2-border-border-base p-3">
        <Show when={!ready() || !props.captureAvailable}>
          <div class="mb-2 text-[10px] leading-4 text-v2-text-text-faint">
            {props.captureAvailable
              ? props.scenario.expected
                ? copy().incomplete
                : copy().incompleteSteps
              : copy().unavailable}
          </div>
        </Show>
        <div class="flex items-center gap-2">
          <ButtonV2
            data-action="game-preview-run-reset"
            variant="ghost-muted"
            size="small"
            disabled={props.capturing}
            onClick={props.onReset}
          >
            {copy().reset}
          </ButtonV2>
          <div class="flex-1" />
          <ButtonV2
            data-action="game-preview-run-capture"
            variant="contrast"
            size="normal"
            disabled={!ready() || !props.captureAvailable || props.capturing}
            onClick={props.onCapture}
          >
            {props.capturing ? copy().capturing : copy().capture}
          </ButtonV2>
        </div>
      </footer>
    </aside>
  )
}
