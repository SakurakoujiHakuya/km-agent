export type HomeSessionFilter = "all" | "running" | "attention" | "unread"

export type HomeSessionActivity = {
  attention: boolean
  loading: boolean
  unseen: boolean
}

export function matchesHomeSessionFilter(filter: HomeSessionFilter, activity: HomeSessionActivity) {
  if (filter === "running") return activity.loading
  if (filter === "attention") return activity.attention
  if (filter === "unread") return activity.unseen
  return true
}
