type PromptPlaceholderInput = {
  mode: "normal" | "shell"
  commentCount: number
  example: string
  suggest: boolean
  t: (
    key:
      | "prompt.placeholder.shell"
      | "prompt.placeholder.normal"
      | "prompt.placeholder.simple"
      | "prompt.placeholder.summarizeComments"
      | "prompt.placeholder.summarizeComment",
    params?: { example: string },
  ) => string
}

export function promptPlaceholder(input: PromptPlaceholderInput) {
  if (input.mode === "shell") return input.t("prompt.placeholder.shell", { example: input.example })
  if (input.commentCount > 1) return input.t("prompt.placeholder.summarizeComments")
  if (input.commentCount === 1) return input.t("prompt.placeholder.summarizeComment")
  if (!input.suggest) return input.t("prompt.placeholder.simple")
  return input.t("prompt.placeholder.normal", { example: input.example })
}

export function promptDesignPlaceholder(mode: PromptPlaceholderInput["mode"], placeholder: string) {
  if (mode === "shell") return placeholder
  return "Ask anything, / for commands, @ for context..."
}
