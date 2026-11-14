
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  MapPin,
} from 'lucide-react'

import {
  labsApi,
  type CalEvent,
  type EventKind,
  type EventsResult,
} from '../lib/labs'

/* ---------- Date helpers ---------- */

// Use plain YYYY-MM-DD strings to avoid timezone date shifts.
const pad = (n: number): string => String(n).padStart(2, '0')

const addDays = (key: string, amount: number): string => {
  const date = new Date(`${key}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

const todayKey = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const fmtDay = (key: string, long = false): string =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: long ? 'long' : undefined,
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })

const monthTitle = (year: number, month: number): string =>
  new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

const WEEK: string[] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
]

/* ---------- Event labels ---------- */

const KIND_LABEL: Record<EventKind, string> = {
  exam: 'Exam',
  cat: 'CAT',
  important: 'Important',
  event: 'Event',
}

const FILTERS: { key: 'all' | EventKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'exam', label: 'Exams' },
  { key: 'cat', label: 'CATs' },
  { key: 'important', label: 'Important dates' },
]

/* ---------- Event formatting ---------- */

function whenLabel(event: CalEvent): string {
  const startDate = event.start.slice(0, 10)
  const endDate = event.end.slice(0, 10)

  if (event.allDay) {
    return startDate === endDate
      ? `${fmtDay(startDate, true)} · all day`
      : `${fmtDay(startDate)} – ${fmtDay(endDate)}`
  }

  const startTime = event.start.slice(11, 16)
  const endTime = event.end.slice(11, 16)

  if (startDate === endDate) {
    return `${fmtDay(startDate, true)} · ${startTime}${
      endTime && endTime !== startTime ? ` – ${endTime}` : ''
    }`
  }

  return `${fmtDay(startDate)} ${startTime} – ${fmtDay(endDate)} ${endTime}`
}

/**
 * Builds a Google Calendar event link.
 * This adds the individual event to the user's calendar,
 * rather than opening the owner's calendar.
 */
function addLink(event: CalEvent): string {
  const compact = (value: string): string =>
    value.replace(/[-:]/g, '').slice(0, event.allDay ? 8 : 15)

  const dates = event.allDay
    ? `${compact(event.start)}/${compact(
        addDays(event.end.slice(0, 10), 1),
      )}`
    : `${compact(event.start)}/${compact(event.end)}`

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates,
    ctz: 'Africa/Nairobi',
  })

  if (event.location) {
    params.set('location', event.location)
  }

  if (event.description) {
    params.set('details', event.description)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/* ---------- Calendar component ---------- */

export default function LabsCalendar() {
  const now = todayKey()

  const [ym, setYm] = useState<{ y: number; m: number }>({
    y: Number(now.slice(0, 4)),
    m: Number(now.slice(5, 7)) - 1,
  })

  const [res, setRes] = useState<EventsResult | null>(null)
  const [err, setErr] = useState<string>('')
  const [filter, setFilter] = useState<'all' | EventKind>('all')
  const [selected, setSelected] = useState<string | null>(null)

  const cache = useRef<Map<string, EventsResult>>(new Map())

  /* ---------- Calculate calendar grid ---------- */

  // Always display six weeks beginning on Monday.
  const { cells, from, to, monthStart, monthEnd } = useMemo(() => {
    const first = `${ym.y}-${pad(ym.m + 1)}-01`

    const dayOfWeek =
      (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7

    const gridStart = addDays(first, -dayOfWeek)

    const last = new Date(
      Date.UTC(ym.y, ym.m + 1, 0),
    )
      .toISOString()
      .slice(0, 10)

    return {
      cells: Array.from(
        { length: 42 },
        (_, index): string => addDays(gridStart, index),
      ),
      from: gridStart,
      to: addDays(gridStart, 41),
      monthStart: first,
      monthEnd: last,
    }
  }, [ym])

  /* ---------- Fetch calendar events ---------- */

  useEffect(() => {
    let live = true

    const cacheKey = `${from}_${to}`
    const cached = cache.current.get(cacheKey)

    if (cached) {
      setRes(cached)
      setErr('')
      return
    }

    setRes(null)
    setErr('')

    labsApi
      .events(from, to)
      .then((result: EventsResult) => {
        cache.current.set(cacheKey, result)

        if (live) {
          setRes(result)
        }
      })
      .catch((error: unknown) => {
        if (live) {
          setErr(
            error instanceof Error
              ? error.message
              : 'Could not load the calendar.',
          )
        }
      })

    return () => {
      live = false
    }
  }, [from, to])

  /* ---------- Filter events ---------- */

  const events = useMemo(
    (): CalEvent[] =>
      (res?.events ?? []).filter(
        (event: CalEvent) =>
          filter === 'all' || event.kind === filter,
      ),
    [res, filter],
  )

  /* ---------- Group events by date ---------- */

  const byDay = useMemo(() => {
    const grouped = new Map<string, CalEvent[]>()

    for (const event of events) {
      let currentDate =
        event.start.slice(0, 10) < from
          ? from
          : event.start.slice(0, 10)

      const stopDate =
        event.end.slice(0, 10) > to
          ? to
          : event.end.slice(0, 10)

      for (
        let index = 0;
        index < 45 && currentDate <= stopDate;
        index++, currentDate = addDays(currentDate, 1)
      ) {
        const existing = grouped.get(currentDate) ?? []
        grouped.set(currentDate, [...existing, event])
      }
    }

    return grouped
  }, [events, from, to])

  /* ---------- Current month and event list ---------- */

  const isThisMonth =
    ym.y === Number(now.slice(0, 4)) &&
    ym.m === Number(now.slice(5, 7)) - 1

  const listed = useMemo((): CalEvent[] => {
    if (selected) {
      return byDay.get(selected) ?? []
    }

    return events.filter(
      (event: CalEvent) =>
        event.end.slice(0, 10) >=
          (isThisMonth ? now : monthStart) &&
        event.start.slice(0, 10) <= monthEnd,
    )
  }, [
    selected,
    byDay,
    events,
    isThisMonth,
    now,
    monthStart,
    monthEnd,
  ])

  /* ---------- Month navigation ---------- */

  function go(delta: number): void {
    setSelected(null)

    setYm(({ y, m }) => {
      const date = new Date(Date.UTC(y, m + delta, 1))

      return {
        y: date.getUTCFullYear(),
        m: date.getUTCMonth(),
      }
    })
  }

  function goToday(): void {
    setSelected(null)

    setYm({
      y: Number(now.slice(0, 4)),
      m: Number(now.slice(5, 7)) - 1,
    })
  }

  /* ---------- Calendar not configured ---------- */

  if (res && !res.configured) {
    return (
      <section className="sl-cal sl-card">
        <div className="sl-cal-head">
          <h2>
            <CalendarDays size={18} />
            Important dates &amp; exams
          </h2>
        </div>

        <p className="sl-sub">
          The calendar is not connected yet. An admin needs
          to add the calendar ID in the Apps Script settings.
        </p>
      </section>
    )
  }

  /* ---------- Main calendar ---------- */

  return (
    <section
      className="sl-cal sl-card"
      aria-label="Important dates and exams calendar"
    >
      <div className="sl-cal-head">
        <h2>
          <CalendarDays size={18} />
          Important dates &amp; exams
        </h2>

        <div className="sl-cal-nav">
          <button
            type="button"
            className="sl-icon-btn"
            onClick={() => go(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>

          <strong>{monthTitle(ym.y, ym.m)}</strong>

          <button
            type="button"
            className="sl-icon-btn"
            onClick={() => go(1)}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>

          {!isThisMonth && (
            <button
              type="button"
              className="sl-mini ghost"
              onClick={goToday}
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Event filters */}

      <div className="sl-cal-filters">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sl-chipbtn ${
              filter === item.key ? 'on' : ''
            } k-${item.key}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="sl-cal-body">
        {/* Calendar grid */}

        <div className="sl-cal-grid-wrap">
          <div className="sl-cal-grid" role="grid">
            {WEEK.map((day) => (
              <span
                key={day}
                className="sl-cal-dow"
                role="columnheader"
              >
                {day}
              </span>
            ))}

            {cells.map((key) => {
              const dayEvents: CalEvent[] =
                byDay.get(key) ?? []

              const kinds: EventKind[] = Array.from(
                new Set(
                  dayEvents.map(
                    (event: CalEvent) => event.kind,
                  ),
                ),
              )

              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  aria-label={`${fmtDay(key, true)}${
                    dayEvents.length
                      ? `, ${dayEvents.length} event${
                          dayEvents.length > 1 ? 's' : ''
                        }`
                      : ''
                  }`}
                  aria-pressed={key === selected}
                  className={[
                    'sl-cal-day',
                    key.slice(0, 7) !==
                    monthStart.slice(0, 7)
                      ? 'out'
                      : '',
                    key === now ? 'today' : '',
                    key === selected ? 'sel' : '',
                    dayEvents.length ? 'has' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() =>
                    setSelected(
                      key === selected ? null : key,
                    )
                  }
                >
                  <span>{Number(key.slice(8))}</span>

                  {kinds.length > 0 && (
                    <i className="sl-cal-dots">
                      {kinds.map((kind) => (
                        <b
                          key={kind}
                          className={`d-${kind}`}
                        />
                      ))}
                    </i>
                  )}
                </button>
              )
            })}
          </div>

          {!res && !err && (
            <div className="sl-cal-loading">
              <LoaderCircle
                className="sl-spin"
                size={20}
              />
            </div>
          )}
        </div>

        {/* Event list */}

        <div className="sl-cal-list">
          <h3>
            {selected
              ? fmtDay(selected, true)
              : isThisMonth
                ? 'Coming up this month'
                : `Events in ${monthTitle(ym.y, ym.m)}`}

            {selected && (
              <button
                type="button"
                className="sl-mini ghost"
                onClick={() => setSelected(null)}
              >
                Show month
              </button>
            )}
          </h3>

          {err && (
            <p className="sl-reject">{err}</p>
          )}

          {!err && res && listed.length === 0 && (
            <p className="sl-sub">
              {selected
                ? 'Nothing on this day.'
                : 'No events to show.'}
            </p>
          )}

          <ul>
            {listed.map((event: CalEvent) => (
              <li
                key={`${event.id}${event.start}`}
                className={`ev k-${event.kind}`}
              >
                <span className="ev-kind">
                  {KIND_LABEL[event.kind]}
                </span>

                <strong>{event.title}</strong>

                <small>{whenLabel(event)}</small>

                {event.location && (
                  <small className="ev-loc">
                    <MapPin size={11} />
                    {event.location}
                  </small>
                )}

                {event.description && (
                  <p>{event.description}</p>
                )}

                <a
                  href={addLink(event)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <ExternalLink size={11} />
                  Add to my calendar
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
