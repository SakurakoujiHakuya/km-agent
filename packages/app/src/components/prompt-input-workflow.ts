export function promptWorkflowLabel(agent: string, chinese: boolean) {
  if (agent === "build") return chinese ? "实现" : "Build"
  if (agent === "plan") return chinese ? "计划" : "Plan"
  return agent
}

export function promptPermissionModeCopy(accepting: boolean, chinese: boolean) {
  if (accepting) {
    return chinese
      ? { label: "自动批准", tooltip: "权限请求会自动批准。点击改为逐项确认。" }
      : { label: "Auto approve", tooltip: "Permission requests are approved automatically. Click to ask first." }
  }
  return chinese
    ? { label: "逐项确认", tooltip: "需要权限时先请求确认。点击改为自动批准。" }
    : { label: "Ask first", tooltip: "Permission requests require confirmation. Click to approve automatically." }
}
