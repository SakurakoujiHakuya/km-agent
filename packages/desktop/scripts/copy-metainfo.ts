import { resolveChannel } from "./utils"
import { PRODUCT_APP_IDS, PRODUCT_NAMES } from "../src/main/brand"

const arg = process.argv[2]
const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const appId = PRODUCT_APP_IDS[channel]
const productName = PRODUCT_NAMES[channel]
const summary = `AI game design and rapid prototyping workbench${channel !== "prod" ? ` (${channel})` : ""}`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${appId}</id>

  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>

  <name>${productName}</name>
  <summary>${summary}</summary>

  <developer id="com.sakurakoujihakuya">
    <name>SakurakoujiHakuya</name>
  </developer>

  <description>
    <p>
      KM Agent combines an AI coding agent, a live design whiteboard, and project tools to help game teams turn ideas into playable prototypes.
    </p>
  </description>

  <launchable type="desktop-id">${appId}.desktop</launchable>

  <content_rating type="oars-1.1" />

  <url type="bugtracker">https://github.com/SakurakoujiHakuya/km-agent/issues</url>
  <url type="homepage">https://github.com/SakurakoujiHakuya/km-agent</url>
  <url type="vcs-browser">https://github.com/SakurakoujiHakuya/km-agent</url>
</component>
`

await Bun.write(`resources/${appId}.metainfo.xml`, xml)
console.log(`Generated metainfo for ${channel} at resources/${appId}.metainfo.xml`)
