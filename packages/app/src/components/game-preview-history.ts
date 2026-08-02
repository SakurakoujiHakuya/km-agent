import { uuid } from "@/utils/uuid"
import { normalizePreviewPlaytestRun, type PreviewPlaytestRun } from "./game-preview-run"
import { normalizePreviewPlaytestScenario, type PreviewPlaytestScenario } from "./game-preview-scenarios"

export const PREVIEW_HISTORY_MAX_FRAMES = 12
export const PREVIEW_HISTORY_MAX_BYTES = 32 * 1024 * 1024
export const PREVIEW_FRAME_NOTE_MAX_LENGTH = 1000
export const PREVIEW_ISSUE_TAGS = ["guidance", "puzzle", "feedback", "pacing", "visual", "bug"] as const
export const PREVIEW_ACCEPTANCE_CRITERIA = ["launch", "controls", "goal", "response", "retry", "completion"] as const
export const PREVIEW_ACCEPTANCE_STATES = ["pass", "fail"] as const

const DATABASE = "km-agent-game-preview"
const STORE = "frames"
const VERSION = 1

export type PreviewIssueTag = (typeof PREVIEW_ISSUE_TAGS)[number]
export type PreviewAcceptanceCriterion = (typeof PREVIEW_ACCEPTANCE_CRITERIA)[number]
export type PreviewAcceptanceState = (typeof PREVIEW_ACCEPTANCE_STATES)[number]
export type PreviewAcceptanceChecks = Partial<Record<PreviewAcceptanceCriterion, PreviewAcceptanceState>>

export type GamePreviewFrame = {
  id: string
  directory: string
  url: string
  createdAt: number
  image: Blob
  note: string
  tags: PreviewIssueTag[]
  checks: PreviewAcceptanceChecks
  scenario?: PreviewPlaytestScenario
  run?: PreviewPlaytestRun
}

type StoredGamePreviewFrame = Omit<GamePreviewFrame, "note" | "tags" | "checks" | "scenario" | "run"> & {
  note?: unknown
  tags?: unknown
  checks?: unknown
  scenario?: unknown
  run?: unknown
}

const issueTags = new Set<string>(PREVIEW_ISSUE_TAGS)
const acceptanceCriteria = new Set<string>(PREVIEW_ACCEPTANCE_CRITERIA)
const acceptanceStates = new Set<string>(PREVIEW_ACCEPTANCE_STATES)

export function normalizePreviewFrame(frame: StoredGamePreviewFrame): GamePreviewFrame {
  const tags = Array.isArray(frame.tags) ? frame.tags : []
  const entries =
    frame.checks && typeof frame.checks === "object"
      ? Object.entries(frame.checks).filter(
          (entry): entry is [PreviewAcceptanceCriterion, PreviewAcceptanceState] =>
            acceptanceCriteria.has(entry[0]) && typeof entry[1] === "string" && acceptanceStates.has(entry[1]),
        )
      : []
  const scenario = normalizePreviewPlaytestScenario(frame.scenario)
  return {
    ...frame,
    note: typeof frame.note === "string" ? frame.note.slice(0, PREVIEW_FRAME_NOTE_MAX_LENGTH) : "",
    tags: [...new Set(tags.filter((tag): tag is PreviewIssueTag => typeof tag === "string" && issueTags.has(tag)))],
    checks: Object.fromEntries(entries),
    scenario,
    run: scenario ? normalizePreviewPlaytestRun(frame.run, scenario) : undefined,
  }
}

export function retainedPreviewFrames(
  frames: GamePreviewFrame[],
  limits: { count: number; bytes: number } = {
    count: PREVIEW_HISTORY_MAX_FRAMES,
    bytes: PREVIEW_HISTORY_MAX_BYTES,
  },
) {
  const sorted = [...frames].sort((a, b) => b.createdAt - a.createdAt)
  const retained: GamePreviewFrame[] = []
  let bytes = 0
  for (const frame of sorted) {
    if (retained.length >= limits.count) break
    if (bytes + frame.image.size > limits.bytes) continue
    retained.push(frame)
    bytes += frame.image.size
  }
  return retained
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true })
    request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB request failed")), {
      once: true,
    })
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true })
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("IndexedDB transaction aborted")),
      {
        once: true,
      },
    )
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("IndexedDB transaction failed")),
      {
        once: true,
      },
    )
  })
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION)
    request.addEventListener(
      "upgradeneeded",
      () => {
        const database = request.result
        if (database.objectStoreNames.contains(STORE)) return
        const store = database.createObjectStore(STORE, { keyPath: "id" })
        store.createIndex("directory", "directory")
      },
      { once: true },
    )
    request.addEventListener("success", () => resolve(request.result), { once: true })
    request.addEventListener("error", () => reject(request.error ?? new Error("Could not open playtest history")), {
      once: true,
    })
  })
}

async function useDatabase<T>(run: (database: IDBDatabase) => Promise<T>) {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB is unavailable")
  const database = await openDatabase()
  try {
    return await run(database)
  } finally {
    database.close()
  }
}

export function listPreviewFrames(directory: string) {
  return useDatabase(async (database) => {
    const transaction = database.transaction(STORE, "readonly")
    const done = transactionDone(transaction)
    const request = transaction.objectStore(STORE).index("directory").getAll(directory)
    const frames = (await requestValue<StoredGamePreviewFrame[]>(request)).map(normalizePreviewFrame)
    await done
    return frames.sort((a, b) => b.createdAt - a.createdAt)
  })
}

export async function savePreviewFrame(input: {
  directory: string
  url: string
  file: File
  scenario?: PreviewPlaytestScenario
  run?: PreviewPlaytestRun
}) {
  const frame: GamePreviewFrame = {
    id: uuid(),
    directory: input.directory,
    url: input.url,
    createdAt: Date.now(),
    image: input.file.slice(0, input.file.size, "image/png"),
    note: "",
    tags: [],
    checks: {},
    scenario: input.scenario ? { ...input.scenario } : undefined,
    run: input.run ? { ...input.run, checks: [...input.run.checks] } : undefined,
  }
  await useDatabase(async (database) => {
    const transaction = database.transaction(STORE, "readwrite")
    transaction.objectStore(STORE).put(frame)
    await transactionDone(transaction)
  })
  const frames = await listPreviewFrames(input.directory)
  const retained = retainedPreviewFrames(frames)
  const keep = new Set(retained.map((item) => item.id))
  const expired = frames.filter((item) => !keep.has(item.id))
  if (expired.length === 0) return retained
  await useDatabase(async (database) => {
    const transaction = database.transaction(STORE, "readwrite")
    const store = transaction.objectStore(STORE)
    expired.forEach((item) => store.delete(item.id))
    await transactionDone(transaction)
  })
  return retained
}

export function deletePreviewFrame(id: string) {
  return useDatabase(async (database) => {
    const transaction = database.transaction(STORE, "readwrite")
    transaction.objectStore(STORE).delete(id)
    await transactionDone(transaction)
  })
}

export function updatePreviewFrame(
  frame: GamePreviewFrame,
  patch: { note: string; tags: PreviewIssueTag[]; checks: PreviewAcceptanceChecks },
) {
  const next = normalizePreviewFrame({ ...frame, ...patch })
  return useDatabase(async (database) => {
    const transaction = database.transaction(STORE, "readwrite")
    transaction.objectStore(STORE).put(next)
    await transactionDone(transaction)
    return next
  })
}

export function previewFrameFile(frame: GamePreviewFrame) {
  return new File([frame.image], `game-preview-${new Date(frame.createdAt).toISOString().replaceAll(":", "-")}.png`, {
    type: "image/png",
  })
}
