import { normalizePreviewAcceptancePlan, type PreviewAcceptancePlan } from "./game-preview-plan"
import {
  upsertPreviewPlaytestScenario,
  type PreviewPlaytestScenario,
  type PreviewPlaytestScenarios,
} from "./game-preview-scenarios"
import type { WhiteboardTemplateId } from "./whiteboard/whiteboard-templates"

export const GAME_PROTOTYPE_KIT_CONCEPT_MAX_LENGTH = 800

export type GamePrototypeKitId = "level" | "puzzle" | "core-loop" | "narrative"

export type GamePrototypeKit = {
  id: GamePrototypeKitId
  title: string
  description: string
  prompt: string
  template: WhiteboardTemplateId
  acceptance: PreviewAcceptancePlan
  scenario: PreviewPlaytestScenario
}

export function gamePrototypeKits(chinese: boolean): GamePrototypeKit[] {
  return chinese
    ? [
        {
          id: "level",
          title: "关卡原型",
          description: "空间、目标与节奏",
          prompt:
            "设计并实现一个可运行的关卡原型。先明确玩家目标、空间结构、关键交互、难度曲线和通关条件，再在当前项目中完成可以直接试玩的 Demo。",
          template: "level-flow",
          acceptance: normalizePreviewAcceptancePlan({
            criteria: {
              launch: "打开后 3 秒内进入可操作状态",
              controls: "移动、观察和关键交互均有明确响应",
              goal: "玩家无需额外说明即可识别当前目标与前进方向",
              response: "关键操作、区域变化和阻挡状态都有可感知反馈",
              retry: "失败后 2 秒内可以重新开始当前关卡",
              completion: "到达终点后显示完成反馈并提供下一步",
            },
          }),
          scenario: {
            id: "prototype-kit:level",
            name: "关卡首轮通关",
            steps:
              "1. 从起点开始，不阅读额外说明\n2. 找到关键交互并进入主要区域\n3. 遭遇一次阻挡或失败后重试\n4. 到达关卡终点",
            expected: "目标与路线可理解，操作反馈清楚，失败可恢复，并能完成关卡。",
          },
        },
        {
          id: "puzzle",
          title: "机关谜题",
          description: "状态、线索与解法",
          prompt:
            "设计并实现一个机关谜题 Demo。请梳理机关状态、触发条件、玩家可观察线索、错误反馈、重置逻辑和完整解法，并保证玩家可以独立推理完成。",
          template: "puzzle-logic",
          acceptance: normalizePreviewAcceptancePlan({
            criteria: {
              launch: "进入 Demo 后可以立即观察谜题空间与机关状态",
              controls: "观察、交互、取消和重置操作都稳定可用",
              goal: "玩家能通过环境线索推断机关目标而不是依赖外部说明",
              response: "正确与错误操作产生不同且不泄底的反馈",
              retry: "错误解法不会软锁，重置后保留玩家已经学到的信息",
              completion: "正确解法触发明确结果并开放后续区域",
            },
          }),
          scenario: {
            id: "prototype-kit:puzzle",
            name: "错误解法与重试",
            steps:
              "1. 观察线索但先执行一个错误解法\n2. 记录机关、门和线索的反馈\n3. 重置谜题并使用正确解法\n4. 验证完成状态",
            expected: "错误操作可理解但不泄底，谜题不会软锁，正确解法能够稳定完成。",
          },
        },
        {
          id: "core-loop",
          title: "核心循环",
          description: "操作、反馈与成长",
          prompt:
            "把一个游戏核心循环实现成可玩的 Demo。定义玩家的主要操作、即时反馈、资源变化、失败与成功条件，以及促使玩家继续尝试的短期目标。",
          template: "core-loop",
          acceptance: normalizePreviewAcceptancePlan({
            criteria: {
              launch: "打开后 3 秒内可以开始第一次核心操作",
              controls: "主要操作连续执行时响应稳定且手感一致",
              goal: "玩家能理解每一轮要做什么以及为什么继续",
              response: "操作结果、资源变化与风险收益都有即时反馈",
              retry: "失败后可以快速重开且不会残留错误状态",
              completion: "至少完成两轮循环并展示升级或阶段目标",
            },
          }),
          scenario: {
            id: "prototype-kit:core-loop",
            name: "连续两轮核心循环",
            steps:
              "1. 完成一次主要操作并观察反馈\n2. 使用获得的资源或新选项\n3. 完成第二轮并承担更高风险\n4. 触发一次失败后重新开始",
            expected: "循环目标明确、反馈及时、资源变化可理解，并能驱动玩家再次尝试。",
          },
        },
        {
          id: "narrative",
          title: "叙事事件",
          description: "选择、分支与结果",
          prompt:
            "实现一个可交互的叙事事件 Demo，包含角色目标、玩家选择、至少两个分支结果、状态记录和清晰的视觉反馈，并方便后续继续扩展内容。",
          template: "narrative-branch",
          acceptance: normalizePreviewAcceptancePlan({
            criteria: {
              launch: "进入后立即看到角色、冲突和当前情境",
              controls: "对话推进、选项选择和回看操作稳定可用",
              goal: "每个选择的意图与潜在代价对玩家可理解",
              response: "选择后角色反应、状态变化和分支结果清晰可见",
              retry: "可以重放事件并选择另一条分支",
              completion: "至少两个分支都能抵达明确且不同的结果",
            },
          }),
          scenario: {
            id: "prototype-kit:narrative",
            name: "双分支结果验证",
            steps:
              "1. 阅读事件背景并选择第一个选项\n2. 记录角色反应与状态变化\n3. 重放事件并选择另一选项\n4. 对比两个结果",
            expected: "两个选择产生清晰、不同且可追溯的结果，重放不会污染初始状态。",
          },
        },
      ]
    : [
        {
          id: "level",
          title: "Level prototype",
          description: "Space, goals, and pacing",
          prompt:
            "Design and implement a playable level prototype. Define the player goal, spatial layout, key interactions, difficulty curve, and completion condition before building a demo that can be played immediately.",
          template: "level-flow",
          acceptance: normalizePreviewAcceptancePlan({
            criteria: {
              launch: "Reach an interactive state within 3 seconds",
              controls: "Movement, camera, and key interactions respond clearly",
              goal: "The player can identify the goal and route without extra instructions",
              response: "Key actions, area changes, and blocked states have perceptible feedback",
              retry: "Restart the current level within 2 seconds of failure",
              completion: "Reaching the exit shows completion feedback and a next action",
            },
          }),
          scenario: {
            id: "prototype-kit:level",
            name: "First level completion",
            steps:
              "1. Start without reading extra instructions\n2. Find the key interaction and enter the main area\n3. Recover from one obstacle or failure\n4. Reach the level exit",
            expected:
              "The goal and route are readable, feedback is clear, failure is recoverable, and the level can be completed.",
          },
        },
        {
          id: "puzzle",
          title: "Puzzle mechanic",
          description: "States, clues, and solution",
          prompt:
            "Design and implement a puzzle mechanic demo. Map its states, triggers, observable clues, failure feedback, reset behavior, and complete solution so a player can reason through it independently.",
          template: "puzzle-logic",
          acceptance: normalizePreviewAcceptancePlan({
            criteria: {
              launch: "Enter with the puzzle space and mechanism state immediately visible",
              controls: "Inspect, interact, cancel, and reset actions remain reliable",
              goal: "Environmental clues reveal the objective without external instructions",
              response: "Correct and incorrect actions have distinct feedback without spoilers",
              retry: "Wrong solutions never soft-lock and reset preserves learned information",
              completion: "The correct solution clearly resolves and opens the next area",
            },
          }),
          scenario: {
            id: "prototype-kit:puzzle",
            name: "Wrong solution and retry",
            steps:
              "1. Inspect clues, then try one wrong solution\n2. Record mechanism, door, and clue feedback\n3. Reset and enter the correct solution\n4. Verify completion",
            expected:
              "Failure is readable without spoilers, never soft-locks, and the correct solution completes reliably.",
          },
        },
        {
          id: "core-loop",
          title: "Core loop",
          description: "Actions, feedback, growth",
          prompt:
            "Implement a playable game core loop. Define the primary action, immediate feedback, resource changes, success and failure conditions, and the short-term goal that motivates another attempt.",
          template: "core-loop",
          acceptance: normalizePreviewAcceptancePlan({
            criteria: {
              launch: "Begin the first core action within 3 seconds",
              controls: "Repeated primary actions respond consistently",
              goal: "The player understands each round and why to continue",
              response: "Outcomes, resource changes, and risk versus reward are immediate",
              retry: "Restart quickly after failure without stale state",
              completion: "Complete two loops and reveal an upgrade or milestone",
            },
          }),
          scenario: {
            id: "prototype-kit:core-loop",
            name: "Two consecutive core loops",
            steps:
              "1. Complete the primary action and observe feedback\n2. Spend the reward or use the new option\n3. Complete a higher-risk second round\n4. Trigger one failure and restart",
            expected: "The loop, feedback, resources, and motivation for another attempt are all clear.",
          },
        },
        {
          id: "narrative",
          title: "Narrative event",
          description: "Choices, branches, outcomes",
          prompt:
            "Implement an interactive narrative event demo with character goals, player choices, at least two outcomes, persistent state, and clear visual feedback, structured for easy content expansion.",
          template: "narrative-branch",
          acceptance: normalizePreviewAcceptancePlan({
            criteria: {
              launch: "Immediately present the characters, conflict, and current situation",
              controls: "Advance, choose, and review dialogue reliably",
              goal: "Each choice communicates its intent and possible cost",
              response: "Character reactions, state changes, and outcomes are visible",
              retry: "Replay the event and choose another branch",
              completion: "At least two branches reach clear and distinct outcomes",
            },
          }),
          scenario: {
            id: "prototype-kit:narrative",
            name: "Two-branch outcome check",
            steps:
              "1. Read the setup and choose the first option\n2. Record the reaction and state change\n3. Replay and choose the other option\n4. Compare both outcomes",
            expected: "Both choices produce distinct, traceable outcomes and replay starts from a clean state.",
          },
        },
      ]
}

export function gamePrototypeKit(id: GamePrototypeKitId, chinese: boolean) {
  return gamePrototypeKits(chinese).find((kit) => kit.id === id)
}

export function gamePrototypeKitPrompt(kit: GamePrototypeKit, concept: string, chinese: boolean) {
  const detail = concept.trim().slice(0, GAME_PROTOTYPE_KIT_CONCEPT_MAX_LENGTH)
  if (!detail) return kit.prompt
  return `${kit.prompt}\n\n${chinese ? "创意补充" : "Creative brief"}:\n${detail}`
}

export function mergeGamePrototypeKitAcceptancePlan(current: PreviewAcceptancePlan, kit: GamePrototypeKit) {
  return normalizePreviewAcceptancePlan({
    criteria: { ...kit.acceptance.criteria, ...current.criteria },
  })
}

export function upsertGamePrototypeKitScenario(current: PreviewPlaytestScenarios, kit: GamePrototypeKit) {
  return upsertPreviewPlaytestScenario(current, kit.scenario)
}
