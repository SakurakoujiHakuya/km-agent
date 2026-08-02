import { describe, expect, test } from "bun:test"
import { DESKTOP_MENU } from "./desktop-menu"

describe("desktop menu", () => {
  test("uses the KM Agent product identity and support repository", () => {
    expect(DESKTOP_MENU.find((menu) => menu.id === "app")?.label).toBe("KM Agent")

    const links = DESKTOP_MENU.flatMap((menu) => menu.items ?? [])
      .filter((item) => item.type === "item" && item.href)
      .map((item) => (item.type === "item" ? item.href : undefined))

    expect(links).toHaveLength(3)
    expect(links.every((href) => href?.startsWith("https://github.com/SakurakoujiHakuya/km-agent"))).toBe(true)
  })

  test("exports logs through the desktop command registry", () => {
    const items = DESKTOP_MENU.flatMap((menu) => menu.items ?? []).filter(
      (item) => item.type === "item" && item.label === "Export Logs...",
    )

    expect(items).toHaveLength(2)
    expect(items.every((item) => item.type === "item" && item.command === "logs.export" && !item.action)).toBe(true)
  })
})
