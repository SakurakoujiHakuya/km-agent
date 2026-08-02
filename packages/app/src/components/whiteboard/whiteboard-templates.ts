import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform"

export type WhiteboardTemplateId = "level-flow" | "puzzle-logic" | "core-loop" | "narrative-branch"

export type WhiteboardTemplate = {
  id: WhiteboardTemplateId
  title: string
  description: string
  elements: ExcalidrawElementSkeleton[]
}

const palette = {
  blue: { backgroundColor: "#e7f5ff", strokeColor: "#1971c2" },
  green: { backgroundColor: "#ebfbee", strokeColor: "#2b8a3e" },
  orange: { backgroundColor: "#fff4e6", strokeColor: "#d9480f" },
  purple: { backgroundColor: "#f3f0ff", strokeColor: "#7048e8" },
  yellow: { backgroundColor: "#fff9db", strokeColor: "#f08c00" },
} as const

const node = (
  id: string,
  type: "rectangle" | "diamond" | "ellipse",
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  color: keyof typeof palette,
): ExcalidrawElementSkeleton => ({
  id,
  type,
  x,
  y,
  width,
  height,
  label: { text, fontSize: 20 },
  backgroundColor: palette[color].backgroundColor,
  strokeColor: palette[color].strokeColor,
  fillStyle: "solid",
  roughness: 1,
  roundness: type === "rectangle" ? { type: 3 } : null,
  strokeWidth: 2,
})

const arrow = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  start: string,
  end: string,
  label?: string,
): ExcalidrawElementSkeleton => ({
  id,
  type: "arrow",
  x,
  y,
  width,
  height,
  endArrowhead: "arrow",
  strokeColor: "#495057",
  strokeWidth: 2,
  start: { id: start },
  end: { id: end },
  label: label ? { text: label, fontSize: 16 } : undefined,
})

const heading = (id: string, text: string): ExcalidrawElementSkeleton => ({
  id,
  type: "text",
  text,
  x: 40,
  y: 24,
  fontSize: 30,
  strokeColor: "#1b1b1f",
})

function levelFlow(chinese: boolean): WhiteboardTemplate {
  const text = chinese
    ? {
        title: "关卡流程",
        description: "从玩家目标到教学、考验、变化和通关条件。",
        goal: "玩家目标\n到达出口",
        teach: "安全教学\n认识核心机制",
        test: "首次考验\n独立运用机制",
        twist: "机制变化\n组合或反转",
        finish: "通关检查\n目标与反馈",
        checkpoint: "检查点 / 重生点",
        optional: "可选探索 / 奖励",
        fail: "失败反馈\n提示并重试",
        retry: "重试",
      }
    : {
        title: "Level flow",
        description: "Map the player goal, teaching, tests, twists, and completion condition.",
        goal: "Player goal\nReach the exit",
        teach: "Safe teaching\nLearn the mechanic",
        test: "First test\nUse it alone",
        twist: "Mechanic twist\nCombine or invert",
        finish: "Completion check\nGoal and feedback",
        checkpoint: "Checkpoint / respawn",
        optional: "Optional path / reward",
        fail: "Failure feedback\nHint and retry",
        retry: "Retry",
      }

  return {
    id: "level-flow",
    title: text.title,
    description: text.description,
    elements: [
      heading("level-title", text.title),
      node("level-goal", "ellipse", 40, 130, 190, 100, text.goal, "blue"),
      node("level-teach", "rectangle", 330, 130, 220, 100, text.teach, "green"),
      node("level-test", "diamond", 650, 115, 220, 130, text.test, "orange"),
      node("level-twist", "rectangle", 970, 130, 220, 100, text.twist, "purple"),
      node("level-finish", "ellipse", 1290, 130, 210, 100, text.finish, "green"),
      arrow("level-arrow-1", 230, 180, 100, 0, "level-goal", "level-teach"),
      arrow("level-arrow-2", 550, 180, 100, 0, "level-teach", "level-test"),
      arrow("level-arrow-3", 870, 180, 100, 0, "level-test", "level-twist"),
      arrow("level-arrow-4", 1190, 180, 100, 0, "level-twist", "level-finish"),
      node("level-checkpoint", "rectangle", 650, 350, 220, 80, text.checkpoint, "blue"),
      node("level-optional", "rectangle", 970, 350, 220, 80, text.optional, "yellow"),
      node("level-fail", "rectangle", 650, 560, 220, 90, text.fail, "orange"),
      arrow("level-arrow-checkpoint", 760, 245, 0, 105, "level-test", "level-checkpoint"),
      arrow("level-arrow-optional", 870, 390, 100, 0, "level-checkpoint", "level-optional"),
      arrow("level-arrow-return", 1080, 350, 0, -120, "level-optional", "level-twist"),
      arrow("level-arrow-fail", 760, 245, 0, 315, "level-test", "level-fail"),
      arrow("level-arrow-retry", 650, 605, -320, -375, "level-fail", "level-teach", text.retry),
    ],
  }
}

function puzzleLogic(chinese: boolean): WhiteboardTemplate {
  const text = chinese
    ? {
        title: "机关谜题",
        description: "梳理线索、推理、输入、状态变化、反馈和重置。",
        clueA: "线索 A\n环境信息",
        clueB: "线索 B\n规则提示",
        infer: "玩家推理\n形成假设",
        input: "机关输入\n操作 / 顺序",
        change: "状态变化\n门 / 电源 / 路径",
        success: "成功反馈\n揭示新区域",
        wrong: "错误反馈\n可理解但不泄底",
        reset: "重置条件\n保留已学信息",
        no: "不正确",
        retry: "再次尝试",
      }
    : {
        title: "Puzzle logic",
        description: "Connect clues, inference, input, state changes, feedback, and reset behavior.",
        clueA: "Clue A\nWorld information",
        clueB: "Clue B\nRule hint",
        infer: "Player inference\nForm a hypothesis",
        input: "Mechanism input\nAction / sequence",
        change: "State change\nDoor / power / path",
        success: "Success feedback\nReveal new space",
        wrong: "Failure feedback\nReadable, no spoiler",
        reset: "Reset condition\nKeep learned info",
        no: "Incorrect",
        retry: "Try again",
      }

  return {
    id: "puzzle-logic",
    title: text.title,
    description: text.description,
    elements: [
      heading("puzzle-title", text.title),
      node("puzzle-clue-a", "rectangle", 40, 120, 220, 90, text.clueA, "blue"),
      node("puzzle-clue-b", "rectangle", 40, 300, 220, 90, text.clueB, "blue"),
      node("puzzle-infer", "diamond", 390, 200, 240, 140, text.infer, "purple"),
      node("puzzle-input", "rectangle", 760, 220, 230, 100, text.input, "yellow"),
      node("puzzle-change", "diamond", 1120, 200, 250, 140, text.change, "orange"),
      node("puzzle-success", "rectangle", 1500, 220, 230, 100, text.success, "green"),
      node("puzzle-wrong", "rectangle", 1120, 470, 250, 100, text.wrong, "orange"),
      node("puzzle-reset", "rectangle", 760, 470, 230, 100, text.reset, "blue"),
      arrow("puzzle-arrow-clue-a", 260, 165, 150, 90, "puzzle-clue-a", "puzzle-infer"),
      arrow("puzzle-arrow-clue-b", 260, 345, 150, -70, "puzzle-clue-b", "puzzle-infer"),
      arrow("puzzle-arrow-infer", 630, 270, 130, 0, "puzzle-infer", "puzzle-input"),
      arrow("puzzle-arrow-input", 990, 270, 130, 0, "puzzle-input", "puzzle-change"),
      arrow("puzzle-arrow-success", 1370, 270, 130, 0, "puzzle-change", "puzzle-success"),
      arrow("puzzle-arrow-wrong", 1245, 340, 0, 130, "puzzle-change", "puzzle-wrong", text.no),
      arrow("puzzle-arrow-reset", 1120, 520, -130, 0, "puzzle-wrong", "puzzle-reset"),
      arrow("puzzle-arrow-retry", 875, 470, -365, -130, "puzzle-reset", "puzzle-infer", text.retry),
    ],
  }
}

function coreLoop(chinese: boolean): WhiteboardTemplate {
  const text = chinese
    ? {
        title: "核心循环",
        description: "明确玩家决策、系统结算、反馈、资源和循环升级。",
        observe: "观察目标\n读取局势",
        decide: "选择行动\n风险与收益",
        resolve: "系统结算\n规则与数值",
        feedback: "即时反馈\n视听与手感",
        reward: "奖励 / 资源\n解锁新可能",
        escalate: "难度升级\n新约束或组合",
        failure: "失败条件\n快速复盘",
        success: "阶段目标\n继续或完成",
        repeat: "下一轮",
      }
    : {
        title: "Core loop",
        description: "Define player decisions, resolution, feedback, resources, and escalation.",
        observe: "Observe goal\nRead the state",
        decide: "Choose action\nRisk and reward",
        resolve: "System resolves\nRules and values",
        feedback: "Immediate feedback\nFeel and clarity",
        reward: "Reward / resource\nUnlock options",
        escalate: "Escalation\nNew constraint or combo",
        failure: "Failure condition\nFast learning",
        success: "Milestone goal\nContinue or finish",
        repeat: "Next cycle",
      }

  return {
    id: "core-loop",
    title: text.title,
    description: text.description,
    elements: [
      heading("loop-title", text.title),
      node("loop-observe", "ellipse", 100, 160, 220, 100, text.observe, "blue"),
      node("loop-decide", "rectangle", 480, 100, 230, 100, text.decide, "yellow"),
      node("loop-resolve", "rectangle", 850, 100, 230, 100, text.resolve, "purple"),
      node("loop-feedback", "rectangle", 1220, 160, 230, 100, text.feedback, "orange"),
      node("loop-reward", "rectangle", 850, 370, 230, 100, text.reward, "green"),
      node("loop-escalate", "rectangle", 480, 370, 230, 100, text.escalate, "purple"),
      arrow("loop-arrow-1", 320, 200, 160, -50, "loop-observe", "loop-decide"),
      arrow("loop-arrow-2", 710, 150, 140, 0, "loop-decide", "loop-resolve"),
      arrow("loop-arrow-3", 1080, 150, 140, 50, "loop-resolve", "loop-feedback"),
      arrow("loop-arrow-4", 1220, 250, -140, 170, "loop-feedback", "loop-reward"),
      arrow("loop-arrow-5", 850, 420, -140, 0, "loop-reward", "loop-escalate"),
      arrow("loop-arrow-6", 480, 420, -270, -160, "loop-escalate", "loop-observe", text.repeat),
      node("loop-failure", "diamond", 850, 620, 230, 130, text.failure, "orange"),
      node("loop-success", "diamond", 1220, 620, 230, 130, text.success, "green"),
      arrow("loop-arrow-failure", 965, 470, 0, 150, "loop-reward", "loop-failure"),
      arrow("loop-arrow-success", 1080, 420, 255, 200, "loop-reward", "loop-success"),
    ],
  }
}

function narrativeBranch(chinese: boolean): WhiteboardTemplate {
  const text = chinese
    ? {
        title: "叙事分支",
        description: "组织情境、角色目标、玩家选择、状态变化和可追溯结果。",
        setup: "事件入口\n时间 / 地点",
        conflict: "角色目标与冲突\n玩家为何介入",
        choice: "玩家选择\n意图与代价",
        optionA: "选择 A\n支持 / 冒险",
        optionB: "选择 B\n拒绝 / 保守",
        resultA: "结果 A\n角色反应与反馈",
        resultB: "结果 B\n角色反应与反馈",
        state: "记录状态\n关系 / 资源 / 标记",
        next: "下一事件\n回收选择后果",
        chooseA: "选择 A",
        chooseB: "选择 B",
      }
    : {
        title: "Narrative branch",
        description: "Map setup, character goals, player choices, state changes, and traceable outcomes.",
        setup: "Event entry\nTime / place",
        conflict: "Character goal and conflict\nWhy the player acts",
        choice: "Player choice\nIntent and cost",
        optionA: "Choice A\nSupport / risk",
        optionB: "Choice B\nRefuse / caution",
        resultA: "Outcome A\nReaction and feedback",
        resultB: "Outcome B\nReaction and feedback",
        state: "Persist state\nRelation / resource / flag",
        next: "Next event\nPay off the choice",
        chooseA: "Choose A",
        chooseB: "Choose B",
      }

  return {
    id: "narrative-branch",
    title: text.title,
    description: text.description,
    elements: [
      heading("narrative-title", text.title),
      node("narrative-setup", "ellipse", 40, 220, 210, 100, text.setup, "blue"),
      node("narrative-conflict", "rectangle", 350, 220, 250, 100, text.conflict, "purple"),
      node("narrative-choice", "diamond", 720, 190, 250, 150, text.choice, "yellow"),
      node("narrative-option-a", "rectangle", 1100, 80, 230, 100, text.optionA, "blue"),
      node("narrative-option-b", "rectangle", 1100, 390, 230, 100, text.optionB, "orange"),
      node("narrative-result-a", "rectangle", 1450, 80, 250, 100, text.resultA, "green"),
      node("narrative-result-b", "rectangle", 1450, 390, 250, 100, text.resultB, "orange"),
      node("narrative-state", "diamond", 1820, 220, 250, 150, text.state, "purple"),
      node("narrative-next", "ellipse", 2190, 245, 220, 100, text.next, "green"),
      arrow("narrative-arrow-setup", 250, 270, 100, 0, "narrative-setup", "narrative-conflict"),
      arrow("narrative-arrow-conflict", 600, 270, 120, 0, "narrative-conflict", "narrative-choice"),
      arrow("narrative-arrow-option-a", 970, 235, 130, -105, "narrative-choice", "narrative-option-a", text.chooseA),
      arrow("narrative-arrow-option-b", 970, 295, 130, 145, "narrative-choice", "narrative-option-b", text.chooseB),
      arrow("narrative-arrow-result-a", 1330, 130, 120, 0, "narrative-option-a", "narrative-result-a"),
      arrow("narrative-arrow-result-b", 1330, 440, 120, 0, "narrative-option-b", "narrative-result-b"),
      arrow("narrative-arrow-state-a", 1700, 130, 120, 145, "narrative-result-a", "narrative-state"),
      arrow("narrative-arrow-state-b", 1700, 440, 120, -145, "narrative-result-b", "narrative-state"),
      arrow("narrative-arrow-next", 2070, 295, 120, 0, "narrative-state", "narrative-next"),
    ],
  }
}

export function whiteboardTemplates(chinese: boolean): WhiteboardTemplate[] {
  return [levelFlow(chinese), puzzleLogic(chinese), coreLoop(chinese), narrativeBranch(chinese)]
}

export function whiteboardTemplate(id: WhiteboardTemplateId, chinese: boolean) {
  return whiteboardTemplates(chinese).find((template) => template.id === id)
}

export function whiteboardTemplateNeedsConfirmation(
  hasContent: boolean,
  pendingTemplate: WhiteboardTemplateId | undefined,
  template: WhiteboardTemplateId,
) {
  return hasContent && pendingTemplate !== template
}
