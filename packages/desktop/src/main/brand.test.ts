import { describe, expect, test } from "bun:test"
import {
  compatibleUserDataID,
  LEGACY_APP_IDS,
  PRODUCT_APP_IDS,
  PRODUCT_NAME,
  PRODUCT_NAMES,
  PRODUCT_PROTOCOLS,
} from "./brand"

describe("KM Agent desktop identity", () => {
  test("uses a dedicated product name and signing identity for every channel", () => {
    expect(PRODUCT_NAME).toBe("KM Agent")
    expect(PRODUCT_NAMES).toEqual({ dev: "KM Agent Dev", beta: "KM Agent Beta", prod: "KM Agent" })
    expect(new Set(Object.values(PRODUCT_APP_IDS)).size).toBe(3)
    expect(Object.values(PRODUCT_APP_IDS).every((id) => id.startsWith("com.sakurakoujihakuya.kmagent"))).toBeTrue()
    expect(PRODUCT_PROTOCOLS).toEqual(["km-agent", "opencode"])
  })

  test("adopts existing OpenCode data without using it for a fresh install", () => {
    expect(compatibleUserDataID("prod", new Set([LEGACY_APP_IDS.prod]))).toBe(LEGACY_APP_IDS.prod)
    expect(compatibleUserDataID("prod", new Set())).toBe(PRODUCT_APP_IDS.prod)
    expect(compatibleUserDataID("prod", new Set([LEGACY_APP_IDS.prod, PRODUCT_APP_IDS.prod]))).toBe(
      PRODUCT_APP_IDS.prod,
    )
  })
})
