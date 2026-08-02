import type { DirectorySDK } from "@/context/sdk"
import { detectPreviewProject } from "./game-preview-project"

export async function loadPreviewProjectProfile(sdk: DirectorySDK) {
  const entries = await sdk.client.file
    .list({ path: "" })
    .then((result) => result.data ?? [])
    .catch(() => [])
  const files = entries.map((entry) => entry.name)
  const read = (path: string) => {
    if (!files.includes(path)) return Promise.resolve(undefined)
    return sdk.client.file
      .read({ path })
      .then((result) => (result.data?.type === "text" ? result.data.content : undefined))
      .catch(() => undefined)
  }
  const [packageJSON, cargoToml] = await Promise.all([read("package.json"), read("Cargo.toml")])
  return detectPreviewProject({ files, packageJSON, cargoToml })
}
