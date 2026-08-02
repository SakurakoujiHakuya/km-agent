import type { Session } from "@opencode-ai/sdk/v2/client"
import { type Accessor, createEffect, createMemo, For, Show, Suspense } from "solid-js"
import { createStore } from "solid-js/store"
import { Spinner } from "@opencode-ai/ui/spinner"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"
import { ServerConnection } from "@/context/server"
import { SessionTabAvatarView } from "@/pages/layout/session-tab-avatar"
import { sessionTitle } from "@/utils/session-title"
import { shouldOpenSessionInBackground } from "../home-session-open"
import { matchesHomeSessionFilter, type HomeSessionFilter } from "./home-session-filter"
import {
  HomeSessionStatusController,
  homeSessionSearchKey,
  type HomeSessionGroup,
  type HomeSessionRecord,
  type OpenSessionOptions,
} from "./home-sessions-controller"

const SHOW_HOME_SESSION_ARCHIVE = false
const HOME_SECTION_LABEL = "text-v2-text-text-muted [font-weight:440]"
const HOME_SESSION_SEARCH_RESULTS_ID = "home-session-search-results"

// Middle-click or Cmd+click on macOS (Ctrl+click elsewhere) opens a session
// tab in the background without navigating, matching browser conventions.
function isBackgroundOpen(event: MouseEvent) {
  return shouldOpenSessionInBackground({
    button: event.button,
    mac: typeof navigator === "object" && /(Mac|iPod|iPhone|iPad)/.test(navigator.platform),
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
  })
}

export type HomeSessionsViewProps = {
  language: ReturnType<typeof useLanguage>
  groups: Accessor<HomeSessionGroup[]>
  showProjectName: Accessor<boolean>
  server: Accessor<ServerConnection.Key>
  canCreateSession: Accessor<boolean>
  searchValue: Accessor<string>
  searchPlaceholder: Accessor<string>
  searchOpen: Accessor<boolean>
  searchLoading: Accessor<boolean>
  searchResults: Accessor<HomeSessionRecord[]>
  searchActive: Accessor<string>
  searchNoResultsLabel: Accessor<string>
  titleOpacity: (id: HomeSessionGroup["id"]) => number
  isOpenTab: (record: HomeSessionRecord) => boolean
  onCreateSession: () => void
  onAddProject: () => void
  addProjectLabel: string
  onOpenSession: (session: Session, options?: OpenSessionOptions) => void
  onArchiveSession: (session: Session) => Promise<void>
  onSetHoverTarget: (element: HTMLElement) => void
  onSetThumbTrack: (element: HTMLDivElement) => void
  onSetContent: (element: HTMLDivElement) => void
  onSetHeader: (id: HomeSessionGroup["id"], element: HTMLDivElement) => void
  onWheel: (event: WheelEvent) => void
  onSetSearchRoot: (element: HTMLDivElement) => void
  onSetSearchInput: (element: HTMLInputElement) => void
  onSetSearchList: (element: HTMLDivElement) => void
  onSearchFocus: () => void
  onSearchInput: (value: string) => void
  onSearchClose: () => void
  onSearchMove: (delta: number) => void
  onSearchSelectActive: () => void
  onSearchHighlight: (record: HomeSessionRecord) => void
  onSearchSelect: (record: HomeSessionRecord, options?: OpenSessionOptions) => void
}

export function HomeSessionsView(props: HomeSessionsViewProps) {
  const [state, setState] = createStore({
    filter: "all" as HomeSessionFilter,
    matches: {} as Record<string, boolean>,
  })
  const chinese = () => props.language.locale() === "zh" || props.language.locale() === "zht"
  const filters = createMemo(() =>
    chinese()
      ? [
          { id: "all" as const, label: "全部" },
          { id: "running" as const, label: "进行中" },
          { id: "attention" as const, label: "待处理" },
          { id: "unread" as const, label: "未读" },
        ]
      : [
          { id: "all" as const, label: "All" },
          { id: "running" as const, label: "Running" },
          { id: "attention" as const, label: "Needs input" },
          { id: "unread" as const, label: "Unread" },
        ],
  )
  const visibleCount = createMemo(() => {
    if (state.filter === "all") return props.groups().reduce((total, group) => total + group.sessions.length, 0)
    return props
      .groups()
      .reduce(
        (total, group) => total + group.sessions.filter((record) => state.matches[homeSessionSearchKey(record)]).length,
        0,
      )
  })

  return (
    <section
      ref={props.onSetHoverTarget}
      class="min-h-0 min-w-0 flex-1 flex flex-col"
      aria-label={props.language.t("sidebar.project.recentSessions")}
    >
      <div class="sticky top-0 z-30 shrink-0 bg-v2-background-bg-base pb-3 pt-6 lg:pt-12" onWheel={props.onWheel}>
        <HomeSessionSearch {...props} />
        <div data-component="home-session-filters" class="mt-3 flex h-7 min-w-0 items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-1" role="group" aria-label={chinese() ? "任务状态" : "Task status"}>
            <For each={filters()}>
              {(filter) => (
                <button
                  type="button"
                  data-action={`home-filter-${filter.id}`}
                  aria-pressed={state.filter === filter.id}
                  class={`
                    h-7 rounded-[6px] px-2.5 text-[12px] [font-weight:530]
                    transition-[background-color,color] duration-[120ms]
                  `}
                  classList={{
                    "bg-v2-background-bg-layer-02 text-v2-text-text-strong": state.filter === filter.id,
                    "text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover": state.filter !== filter.id,
                  }}
                  onClick={() => setState("filter", filter.id)}
                >
                  {filter.label}
                </button>
              )}
            </For>
          </div>
          <Suspense>
            <Show when={props.groups().length > 0 && props.canCreateSession()}>
              <ButtonV2
                data-action="home-new-session"
                variant="ghost-muted"
                size="normal"
                icon="edit"
                class="h-7 shrink-0 px-2 [font-weight:530]"
                onClick={props.onCreateSession}
              >
                {props.language.t("command.session.new")}
              </ButtonV2>
            </Show>
          </Suspense>
        </div>
      </div>
      <div class="pointer-events-none sticky top-[120px] z-40 h-0 -mr-3 lg:top-[144px]">
        <div
          ref={props.onSetThumbTrack}
          data-component="home-session-scroll-track"
          class="relative ml-auto h-[calc(100cqh-120px)] w-3 lg:h-[calc(100cqh-144px)]"
        />
      </div>
      <div class="-mr-3 min-h-[calc(100cqh-108px)] lg:min-h-[calc(100cqh-132px)]">
        <Suspense
          fallback={
            <div class="pt-3">
              <HomeSessionSkeleton label={props.language.t("common.loading")} />
            </div>
          }
        >
          <Show
            when={props.groups().length > 0}
            fallback={
              <HomeSessionsEmpty
                onNewSession={props.canCreateSession() ? props.onCreateSession : undefined}
                onAddProject={props.onAddProject}
                addProjectLabel={props.addProjectLabel}
                language={props.language}
              />
            }
          >
            <div ref={props.onSetContent} class="flex flex-col pt-3 pr-3 pb-16">
              <For each={props.groups()}>
                {(group, index) => (
                  <div
                    classList={{
                      hidden:
                        state.filter !== "all" &&
                        !group.sessions.some((record) => state.matches[homeSessionSearchKey(record)]),
                    }}
                  >
                    <HomeSessionGroupHeader
                      title={group.title}
                      titleOpacity={props.titleOpacity(group.id)}
                      onSetRef={(element) => props.onSetHeader(group.id, element)}
                      elevated={index() === 0}
                    />
                    <div
                      class={`flex min-w-0 flex-col gap-px pt-4 ${index() === props.groups().length - 1 ? "" : "mb-6"}`}
                    >
                      <For each={group.sessions}>
                        {(record) => (
                          <HomeSessionRow
                            {...props}
                            record={record}
                            filter={() => state.filter}
                            onMatch={(match) => setState("matches", homeSessionSearchKey(record), match)}
                          />
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
              <Show when={state.filter !== "all" && visibleCount() === 0}>
                <div class="flex min-h-48 items-center justify-center px-6 text-center text-[13px] text-v2-text-text-muted">
                  {chinese() ? "当前没有符合此状态的任务。" : "No tasks match this status."}
                </div>
              </Show>
            </div>
          </Show>
        </Suspense>
      </div>
    </section>
  )
}

function HomeSessionLeadingController(props: {
  server: HomeSessionsViewProps["server"]
  isOpenTab: HomeSessionsViewProps["isOpenTab"]
  record: HomeSessionRecord
  revealProjectOnHover: boolean
}) {
  return (
    <HomeSessionStatusController
      server={props.server}
      record={props.record}
      isOpenTab={props.isOpenTab}
      render={(state) => (
        <HomeSessionLeading
          record={props.record}
          revealProjectOnHover={props.revealProjectOnHover}
          open={state.open()}
          unread={state.unread()}
          loading={state.loading()}
        />
      )}
    />
  )
}

function HomeSessionLeading(props: {
  record: HomeSessionRecord
  revealProjectOnHover: boolean
  open: boolean
  unread: boolean
  loading: boolean
}) {
  return (
    <div class="relative shrink-0">
      <Show when={props.open}>
        <span
          aria-hidden="true"
          class={`
            pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-y-1/2
            rounded-[2px] bg-v2-background-bg-layer-04
          `}
          style={{ right: "calc(100% + 4px)" }}
        />
      </Show>
      <SessionTabAvatarView
        project={props.record.project}
        directory={props.record.session.directory}
        revealProjectOnHover={props.revealProjectOnHover}
        unread={props.unread}
        loading={props.loading}
      />
    </div>
  )
}

function HomeSessionSearch(props: HomeSessionsViewProps) {
  return (
    <div class="w-full">
      <div ref={props.onSetSearchRoot} data-component="home-session-search" class="relative z-30 w-full">
        <Show when={props.searchOpen()}>
          <div
            data-component="home-session-search-panel"
            class={`
              absolute flex flex-col overflow-hidden rounded-[12px]
              bg-v2-background-bg-base shadow-[var(--v2-elevation-floating)]
            `}
            style={{ top: "-6px", left: "-6px", width: "calc(100% + 12px)" }}
          >
            <div class="flex flex-col pt-9">
              <div id={HOME_SESSION_SEARCH_RESULTS_ID} role="listbox" class="flex flex-col gap-4 pt-4">
                <Show
                  when={!props.searchLoading()}
                  fallback={
                    <div class="flex items-center justify-center px-4 py-3 text-v2-text-text-muted [font-weight:440]">
                      <Spinner class="size-4" />
                    </div>
                  }
                >
                  <Show
                    when={props.searchResults().length > 0}
                    fallback={
                      <p
                        class={`
                          my-1.5 px-4 pb-2 text-[13px] leading-4 tracking-[-0.04px]
                          text-v2-text-text-muted [font-weight:440]
                        `}
                      >
                        {props.searchNoResultsLabel()}
                      </p>
                    }
                  >
                    <div class="flex flex-col">
                      <p
                        class={`
                          my-1.5 pl-[18px] pr-6 text-[13px] leading-4 tracking-[-0.04px]
                          text-v2-text-text-muted [font-weight:440]
                        `}
                      >
                        {props.language.t("home.sessions.search.sessions")}
                      </p>
                      <ScrollView class="max-h-80" viewportRef={props.onSetSearchList}>
                        <div class="flex flex-col gap-px pb-2">
                          <For each={props.searchResults()}>
                            {(record) => (
                              <HomeSessionSearchResultRow
                                {...props}
                                record={record}
                                selected={props.searchActive() === homeSessionSearchKey(record)}
                              />
                            )}
                          </For>
                        </div>
                      </ScrollView>
                    </div>
                  </Show>
                </Show>
              </div>
            </div>
          </div>
        </Show>
        <label
          class={`
            relative z-20 flex h-9 w-full items-center gap-2 rounded-[6px] py-1 pl-3 pr-2
            bg-v2-background-bg-layer-02/60 text-v2-icon-icon-muted transition-[background-color,box-shadow]
            duration-[120ms] ease-in-out hover:bg-v2-background-bg-layer-02 focus-within:bg-v2-background-bg-layer-02
          `}
        >
          <IconV2 name="magnifying-glass" />
          <input
            ref={props.onSetSearchInput}
            class={`
              relative z-20 min-w-0 flex-1 border-0 bg-transparent outline-0
              text-v2-text-text-base [font-weight:440] placeholder:text-v2-text-text-faint
            `}
            value={props.searchValue()}
            placeholder={props.searchPlaceholder()}
            aria-label={props.searchPlaceholder()}
            aria-expanded={props.searchOpen()}
            aria-controls={HOME_SESSION_SEARCH_RESULTS_ID}
            aria-autocomplete="list"
            aria-activedescendant={
              props.searchActive() && props.searchOpen()
                ? `home-session-search-option-${props.searchActive()}`
                : undefined
            }
            onFocus={props.onSearchFocus}
            onInput={(event) => props.onSearchInput(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                props.onSearchClose()
                event.currentTarget.blur()
                return
              }
              if (!props.searchOpen() || props.searchResults().length === 0) return
              if (event.altKey || event.metaKey) return
              if (event.key === "ArrowDown") {
                event.preventDefault()
                props.onSearchMove(1)
                return
              }
              if (event.key === "ArrowUp") {
                event.preventDefault()
                props.onSearchMove(-1)
                return
              }
              if (event.key === "Enter" && !event.isComposing) {
                event.preventDefault()
                props.onSearchSelectActive()
              }
            }}
          />
          <Show when={props.searchValue()}>
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="small"
              class="relative z-20 shrink-0"
              icon={<IconV2 name="close" size="large" class="text-v2-icon-icon-muted" />}
              aria-label={props.searchPlaceholder()}
              onClick={() => {
                props.onSearchClose()
                props.onSearchFocus()
              }}
            />
          </Show>
        </label>
      </div>
    </div>
  )
}

function HomeSessionSearchResultRow(
  props: HomeSessionsViewProps & {
    record: HomeSessionRecord
    selected: boolean
  },
) {
  const title = createMemo(() => sessionTitle(props.record.session.title) || props.record.session.id)
  const showProjectName = () => props.showProjectName() && props.record.projectName
  const key = () => homeSessionSearchKey(props.record)

  return (
    <button
      type="button"
      id={`home-session-search-option-${key()}`}
      data-key={key()}
      data-component="home-session-search-row"
      role="option"
      aria-selected={props.selected}
      class={`
        flex h-10 w-full shrink-0 cursor-default items-center gap-2 border-0 py-3 pl-[18px] pr-6 text-left
        transition-[background-color] duration-[120ms] ease-in-out
        hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none
      `}
      classList={{
        "bg-v2-overlay-simple-overlay-hover": props.selected,
        group: !!showProjectName(),
      }}
      onMouseEnter={() => props.onSearchHighlight(props.record)}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault()
      }}
      onClick={(event) => props.onSearchSelect(props.record, { background: isBackgroundOpen(event) })}
      onAuxClick={(event) => {
        if (!isBackgroundOpen(event)) return
        event.preventDefault()
        props.onSearchSelect(props.record, { background: true })
      }}
    >
      <HomeSessionLeadingController
        server={props.server}
        isOpenTab={props.isOpenTab}
        record={props.record}
        revealProjectOnHover={!!showProjectName()}
      />
      <div class="flex min-w-0 flex-1 items-center gap-1.5">
        <HomeSessionTitle title={title()} showProjectName={!!showProjectName()} search />
        <Show when={showProjectName()}>
          <HomeSessionProjectName name={props.record.projectName} search />
        </Show>
      </div>
    </button>
  )
}

function HomeSessionGroupHeader(props: {
  title: string
  titleOpacity: number
  onSetRef: (element: HTMLDivElement) => void
  elevated?: boolean
}) {
  return (
    <div
      ref={props.onSetRef}
      class={`
        pointer-events-none sticky top-[120px] flex h-7 min-w-0 items-center justify-between
        bg-v2-background-bg-base pl-3 lg:top-[144px]
      `}
      classList={{ "home-session-group-header z-[5]": !!props.elevated, "z-10": !props.elevated }}
    >
      <div class={HOME_SECTION_LABEL} style={{ opacity: props.titleOpacity }}>
        {props.title}
      </div>
    </div>
  )
}

function HomeSessionRow(
  props: HomeSessionsViewProps & {
    record: HomeSessionRecord
    filter: Accessor<HomeSessionFilter>
    onMatch: (match: boolean) => void
  },
) {
  return (
    <HomeSessionStatusController
      server={props.server}
      record={props.record}
      isOpenTab={props.isOpenTab}
      render={(status) => (
        <HomeSessionRowView
          {...props}
          status={{
            attention: status.attention,
            loading: status.loading,
            open: status.open,
            unread: status.unread,
            unseen: status.unseen,
          }}
        />
      )}
    />
  )
}

function HomeSessionRowView(
  props: HomeSessionsViewProps & {
    record: HomeSessionRecord
    filter: Accessor<HomeSessionFilter>
    onMatch: (match: boolean) => void
    status: {
      attention: Accessor<boolean>
      loading: Accessor<boolean>
      open: Accessor<boolean>
      unread: Accessor<boolean>
      unseen: Accessor<boolean>
    }
  },
) {
  const title = createMemo(() => sessionTitle(props.record.session.title) || props.record.session.id)
  const showProjectName = () => props.showProjectName() && props.record.projectName
  const match = createMemo(() =>
    matchesHomeSessionFilter(props.filter(), {
      attention: props.status.attention(),
      loading: props.status.loading(),
      unseen: props.status.unseen(),
    }),
  )
  const statusLabel = createMemo(() => {
    const chinese = props.language.locale() === "zh" || props.language.locale() === "zht"
    if (props.status.attention()) return chinese ? "待处理" : "Needs input"
    if (props.status.loading()) return chinese ? "进行中" : "Running"
    if (props.status.unseen()) return chinese ? "未读" : "Unread"
  })

  createEffect(() => props.onMatch(match()))

  return (
    <div
      class="group/session relative flex h-10 min-w-0 items-center rounded-[6px]"
      classList={{ group: !!showProjectName() }}
      style={{ display: match() ? undefined : "none" }}
    >
      <button
        type="button"
        data-component="home-session-row"
        class={`
          flex h-10 min-w-0 w-full flex-1 shrink-0 cursor-default items-center gap-2 rounded-[6px] border-0
          bg-transparent py-3 pl-3 pr-3 text-left text-v2-text-text-muted [font-weight:530]
          transition-[background-color,color,box-shadow] duration-[120ms] ease-in-out
          hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none
        `}
        onMouseDown={(event) => {
          if (event.button === 1) event.preventDefault()
        }}
        onClick={(event) => props.onOpenSession(props.record.session, { background: isBackgroundOpen(event) })}
        onAuxClick={(event) => {
          if (!isBackgroundOpen(event)) return
          event.preventDefault()
          props.onOpenSession(props.record.session, { background: true })
        }}
      >
        <HomeSessionLeading
          record={props.record}
          revealProjectOnHover={!!showProjectName()}
          open={props.status.open()}
          unread={props.status.unread()}
          loading={props.status.loading()}
        />
        <HomeSessionTitle title={title()} showProjectName={!!showProjectName()} />
        <Show when={showProjectName()}>
          <HomeSessionProjectName name={props.record.projectName} />
        </Show>
        <Show when={statusLabel()}>
          {(label) => (
            <span
              data-slot="home-session-status"
              class="ml-auto shrink-0 rounded-full bg-v2-background-bg-layer-02 px-2 py-0.5 text-[11px] text-v2-text-text-muted [font-weight:530]"
            >
              {label()}
            </span>
          )}
        </Show>
      </button>
      <Show when={SHOW_HOME_SESSION_ARCHIVE}>
        <div
          class={`
            hover-reveal absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1
            group-hover/session:opacity-100 focus-within:opacity-100
          `}
        >
          <TooltipV2 class="flex shrink-0 items-center" placement="bottom" value={props.language.t("common.archive")}>
            <IconButtonV2
              data-action="home-session-archive"
              variant="ghost-muted"
              size="large"
              icon={<IconV2 name="archive" />}
              aria-label={props.language.t("common.archive")}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void props.onArchiveSession(props.record.session)
              }}
            />
          </TooltipV2>
        </div>
      </Show>
    </div>
  )
}

function HomeSessionTitle(props: { title: string; showProjectName: boolean; search?: boolean }) {
  return (
    <span
      class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-v2-text-text-base [font-weight:530]"
      classList={{
        "text-[13px] leading-4 tracking-[-0.04px]": !!props.search,
        "max-w-[min(70%,480px)] flex-[0_1_auto]": props.showProjectName,
        "flex-[1_1_auto]": !props.showProjectName,
      }}
    >
      {props.title}
    </span>
  )
}

function HomeSessionProjectName(props: { name: string; search?: boolean }) {
  return (
    <span
      class="min-w-0 flex-[1_1_auto] overflow-hidden text-ellipsis whitespace-nowrap text-v2-text-text-muted [font-weight:440]"
      classList={{ "text-[13px] leading-4 tracking-[-0.04px]": !!props.search }}
    >
      {props.name}
    </span>
  )
}

function HomeSessionsEmpty(props: {
  onNewSession?: () => void
  onAddProject: () => void
  addProjectLabel: string
  language: ReturnType<typeof useLanguage>
}) {
  return (
    <div class="flex min-h-[calc(100cqh-108px)] items-center justify-center px-6 pb-24 text-center">
      <div
        data-component="home-empty-launchpad"
        class="flex w-full max-w-[520px] flex-col items-center rounded-[16px] px-8 py-10"
      >
        <div
          class={`
            mb-5 flex size-12 items-center justify-center rounded-[14px]
            bg-v2-background-bg-layer-02 text-v2-icon-icon-base shadow-[var(--v2-elevation-raised)]
          `}
        >
          <IconV2 name="edit" size="large" />
        </div>
        <h1
          class={`
            shrink-0 text-[20px] leading-7 tracking-[-0.2px]
            text-v2-text-text-strong [font-weight:580]
          `}
        >
          {props.language.t("home.sessions.empty")}
        </h1>
        <p
          class={`
            mt-2 max-w-[360px] text-center text-[13px] leading-5 tracking-[-0.04px]
            text-v2-text-text-muted [font-weight:440]
          `}
        >
          {props.language.t("home.sessions.empty.description")}
        </p>
        <div class="mt-6 flex items-center justify-center">
          <Show
            when={props.onNewSession}
            fallback={
              <ButtonV2
                data-action="home-empty-add-project"
                variant="contrast"
                size="normal"
                icon="folder-add-left"
                onClick={props.onAddProject}
              >
                {props.addProjectLabel}
              </ButtonV2>
            }
          >
            {(onNewSession) => (
              <ButtonV2
                data-action="home-new-session"
                variant="contrast"
                size="normal"
                icon="edit"
                onClick={onNewSession()}
              >
                {props.language.t("command.session.new")}
              </ButtonV2>
            )}
          </Show>
        </div>
      </div>
    </div>
  )
}

function HomeSessionSkeleton(props: { label: string }) {
  return (
    <div class="flex min-w-0 flex-col gap-4">
      <div class="flex h-7 min-w-0 items-center justify-between px-4">
        <div class={HOME_SECTION_LABEL}>{props.label}</div>
      </div>
      <div class="flex min-w-0 flex-col gap-px" aria-hidden="true">
        <For each={[0, 1, 2, 3]}>{() => <div class="h-10 rounded-[6px] bg-v2-background-bg-deep opacity-70" />}</For>
      </div>
    </div>
  )
}
