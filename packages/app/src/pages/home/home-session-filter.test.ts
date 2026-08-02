import { describe, expect, test } from "bun:test"
import { matchesHomeSessionFilter } from "./home-session-filter"

describe("home session filters", () => {
  test("keeps all sessions in the all view", () => {
    expect(matchesHomeSessionFilter("all", { attention: false, loading: false, unseen: false })).toBe(true)
  })

  test("separates active work, requests, and unread results", () => {
    const activity = { attention: true, loading: false, unseen: true }
    expect(matchesHomeSessionFilter("running", activity)).toBe(false)
    expect(matchesHomeSessionFilter("attention", activity)).toBe(true)
    expect(matchesHomeSessionFilter("unread", activity)).toBe(true)
  })
})
