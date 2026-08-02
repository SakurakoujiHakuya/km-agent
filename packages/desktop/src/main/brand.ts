export type ProductChannel = "dev" | "beta" | "prod"

export const PRODUCT_NAME = "KM Agent"
export const PRODUCT_NAMES: Record<ProductChannel, string> = {
  dev: "KM Agent Dev",
  beta: "KM Agent Beta",
  prod: PRODUCT_NAME,
}
export const PRODUCT_APP_IDS: Record<ProductChannel, string> = {
  dev: "com.sakurakoujihakuya.kmagent.dev",
  beta: "com.sakurakoujihakuya.kmagent.beta",
  prod: "com.sakurakoujihakuya.kmagent",
}
export const LEGACY_APP_IDS: Record<ProductChannel, string> = {
  dev: "ai.opencode.desktop.dev",
  beta: "ai.opencode.desktop.beta",
  prod: "ai.opencode.desktop",
}
export const PRODUCT_PROTOCOLS = ["km-agent", "opencode"] as const

export function compatibleUserDataID(channel: ProductChannel, existing: ReadonlySet<string>) {
  const current = PRODUCT_APP_IDS[channel]
  if (existing.has(current) || !existing.has(LEGACY_APP_IDS[channel])) return current
  return LEGACY_APP_IDS[channel]
}
