
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { OzCtx } from './OzCommon'
import { oz } from '../lib/ozone'

type Period = {
  id: string
  title: string
  status: string
  startsAt: string
  endsAt: string
  registrationOpensAt: string
  registrationClosesAt: string
  aspirantFeeKsh: number
}

type Position = {
  id: string
  name: string
  level: string
  facultyCode: string
  description: string
}

type Profile = {
  id: string
  positionId: string
  displayName: string
  facultyCode: string
  course: string
  yearOfStudy: string
  bio: string
}

type PublicData = {
  period: Period | null
  positions: Position[]
  aspirants: Profile[]
}

type PoliticalQuestion = {
  id: string
  positionId: string
  question: string
  answer: string
  answerAt: string
  createdAt: string
}

type AdminData = {
  periods: Period[]
  positions: Position[]
  applications: Array<Record<string, string>>
}

type PolPoll = {
  id: string
  question: string
  options: string[]
  closesAt: string
  status: string
  total: number
  counts: number[] | null
  myVote: number | null
}

type TelegramStatus = {
  configured: boolean
  channelConfigured: boolean
  pollingTrigger: boolean
}

const emptyForm = {
  fullName: '',
  registrationNumber: '',
  facultyCode: '',
  course: '',
  yearOfStudy: '1',
  phone: '',
  manifesto: '',
  paymentReference: '',
}

export default function OzPolitics({
  ctx,
  admin: adminRoute = false,
  apply: applyRoute = false,
}: {
  ctx: OzCtx
  admin?: boolean
  apply?: boolean
}) {
  const [data, setData] = useState<PublicData | null>(null)
  const [mine, setMine] = useState<Record<string, string> | null>(null)
  const [admin, setAdmin] = useState<AdminData | null>(null)

  const [form, setForm] = useState(emptyForm)
  const [positionId, setPositionId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [periodForm, setPeriodForm] = useState({
    title: '',
    status: 'draft',
    aspirantFeeKsh: '0',
    registrationOpensAt: '',
    registrationClosesAt: '',
    startsAt: '',
    endsAt: '',
  })

  const [positionForm, setPositionForm] = useState({
    electionId: '',
    name: '',
    level: 'university',
    facultyCode: '',
    description: '',
  })

  const [reviewNote, setReviewNote] = useState<Record<string, string>>({})
  const [questions, setQuestions] = useState<PoliticalQuestion[]>([])
  const [questionText, setQuestionText] = useState('')
  const [questionPosition, setQuestionPosition] = useState('')
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({})

  const [polls, setPolls] = useState<PolPoll[]>([])
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState('')
  const [pollClose, setPollClose] = useState('')

  // Telegram state declarations
  const [tgStatus, setTgStatus] = useState<TelegramStatus | null>(null)
  const [tgCode, setTgCode] = useState('')
  const [tgBot, setTgBot] = useState('')
  const [tgAnnouncement, setTgAnnouncement] = useState('')
  const [tgBusy, setTgBusy] = useState(false)

  const [guestToken] = useState(() => {
    const key = 'oz-politics-guest-voter'
    let value = sessionStorage.getItem(key)

    if (!value) {
      value = crypto.randomUUID() + crypto.randomUUID()
      sessionStorage.setItem(key, value)
    }

    return value
  })

  const isAdmin = adminRoute && Boolean(ctx.me?.isAdmin)

  async function load() {
    try {
      const result = await oz<PublicData>('politics_public')
      setData(result)

      if (result.period) {
        const questionResult = await oz<{ questions: PoliticalQuestion[] }>(
          'politics_questions',
          { electionId: result.period.id },
        )
        setQuestions(questionResult.questions)

        const pollResult = await oz<{ polls: PolPoll[] }>(
          'politics_polls',
          { electionId: result.period.id },
        )
        setPolls(pollResult.polls)
      } else {
        setQuestions([])
        setPolls([])
      }

      if (ctx.user) {
        const mineResult = await oz<{
          application: Record<string, string> | null
        }>('politics_mine')

        setMine(mineResult.application)
      } else {
        setMine(null)
      }

      if (isAdmin && ctx.me?.isAdmin) {
        setAdmin(await oz<AdminData>('politics_admin'))

        const telegramStatus = await oz<TelegramStatus>(
          'admin_telegram_status',
        )
        setTgStatus(telegramStatus)
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [ctx.user, ctx.me?.isAdmin, isAdmin])

  useEffect(() => {
    if (!applyRoute) return
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById('oz-politics-apply')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [applyRoute, data])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')

    try {
      const result = await oz<{ message: string }>('politics_apply', {
        electionId: data?.period?.id,
        positionId,
        ...form,
      })

      setMessage(result.message)
      setForm(emptyForm)
      await load()
    } catch (x) {
      setError((x as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function savePeriod(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      await oz('admin_politics_period_save', periodForm)
      setMessage('Election period saved.')
      await load()
    } catch (x) {
      setError((x as Error).message)
    }
  }

  async function savePosition(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      await oz('admin_politics_position_save', positionForm)
      setMessage('Position saved.')
      await load()
    } catch (x) {
      setError((x as Error).message)
    }
  }

  async function review(id: string, decision: string) {
    try {
      await oz('admin_politics_application_review', {
        applicationId: id,
        decision,
        note: reviewNote[id] || '',
      })

      setMessage(`Application ${decision}.`)
      await load()
    } catch (x) {
      setError((x as Error).message)
    }
  }

  async function verify(id: string, verified: boolean) {
    try {
      await oz('admin_politics_payment_verify', {
        applicationId: id,
        verified,
        note: reviewNote[id] || '',
      })

      setMessage('Payment review saved.')
      await load()
    } catch (x) {
      setError((x as Error).message)
    }
  }

  async function submitQuestion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      await oz('politics_question_submit', {
        electionId: data?.period?.id,
        positionId: questionPosition,
        question: questionText,
      })

      setQuestionText('')
      setMessage('Question published.')
      await load()
    } catch (x) {
      setError((x as Error).message)
    }
  }

  async function votePoll(pollId: string, optionIndex: number) {
    try {
      const result = await oz<{ message: string }>('politics_poll_vote', {
        pollId,
        optionIndex,
        guestToken,
      })

      setMessage(result.message)
      await load()
    } catch (x) {
      setError((x as Error).message)
    }
  }

  async function createPoll(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      await oz('admin_politics_poll_save', {
        electionId: positionForm.electionId || admin?.periods[0]?.id,
        question: pollQuestion,
        options: pollOptions
          .split('\n')
          .map((option) => option.trim())
          .filter(Boolean),
        closesAt: pollClose,
      })

      setPollQuestion('')
      setPollOptions('')
      setMessage('Poll published.')
      await load()
    } catch (x) {
      setError((x as Error).message)
    }
  }

  async function closePoll(id: string) {
    try {
      await oz('admin_politics_poll_close', { pollId: id })
      setMessage('Poll closed.')
      await load()
    } catch (x) {
      setError((x as Error).message)
    }
  }

  async function answerQuestion(id: string) {
    try {
      await oz('politics_question_answer', {
        questionId: id,
        answer: answerDrafts[id] || '',
      })

      setAnswerDrafts({ ...answerDrafts, [id]: '' })
      setMessage('Answer published.')
      await load()
    } catch (x) {
      setError((x as Error).message)
    }
  }

  // Generate a Telegram account-linking code
  async function linkTelegram() {
    setTgBusy(true)
    setError('')

    try {
      const result = await oz<{
        code: string
        expiresInMinutes: number
        botUsername: string
      }>('politics_telegram_link_code')

      setTgCode(result.code)
      setTgBot(result.botUsername)
      setMessage(
        'Link code created. Open your Telegram bot and send the command shown below.',
      )
    } catch (x) {
      setError((x as Error).message)
    } finally {
      setTgBusy(false)
    }
  }

  // Publish a public poll to the Telegram channel
  async function publishTelegramPoll(id: string) {
    setTgBusy(true)

    try {
      await oz('admin_telegram_publish_poll', { pollId: id })
      setMessage('Poll published to Telegram.')
    } catch (x) {
      setError((x as Error).message)
    } finally {
      setTgBusy(false)
    }
  }

  // Publish a Telegram channel announcement
  async function publishTelegramAnnouncement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTgBusy(true)

    try {
      await oz('admin_telegram_publish_announcement', {
        text: tgAnnouncement,
      })

      setTgAnnouncement('')
      setMessage('Announcement published to Telegram.')
    } catch (x) {
      setError((x as Error).message)
    } finally {
      setTgBusy(false)
    }
  }

  if (adminRoute && !ctx.user) {
    return (
      <div className="cpl-home oz-politics">
        <a className="cpl-link" href="#/ozone">← Back to Chuka O-Zone</a>
        <h1>🏛️ Chuka Politics Admin</h1>
        <p>Sign in with your Google account to continue.</p>
        <button type="button" onClick={() => void ctx.signIn()}>
          Sign in with Google
        </button>
      </div>
    )
  }

  if (adminRoute && !ctx.me) {
    return (
      <div className="cpl-home oz-politics">
        <a className="cpl-link" href="#/ozone">← Back to Chuka O-Zone</a>
        <p className="cpl-empty">Checking admin access…</p>
      </div>
    )
  }

  if (adminRoute && !ctx.me?.isAdmin) {
    return (
      <div className="cpl-home oz-politics">
        <a className="cpl-link" href="#/ozone">← Back to Chuka O-Zone</a>
        <p className="cpl-err" role="alert">This area is for O-Zone admins only.</p>
      </div>
    )
  }

  return (
    <div className="cpl-home oz-politics">
      <a className="cpl-link" href="#/ozone">
        ← Back to Chuka O-Zone
      </a>

      <h1>🏛️ Chuka Politics</h1>
      <p>Student leadership, aspirants, public questions and community polls.</p>

      {ctx.me?.isAdmin && (
        <a
          className="cpl-link"
          href="#/ozone/politics/admin"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 18px',
            margin: '12px 0 18px',
            borderRadius: '10px',
            background: '#173f35',
            color: '#ffffff',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          🛡️ Manage Chuka Politics
        </a>
      )}

      {error && (
        <p className="cpl-err" role="alert">
          {error}
        </p>
      )}

      {message && <p className="oz-success">{message}</p>}

      {isAdmin ? (
        <>
          <h2>Telegram connection</h2>

          <section className="cpl-card">
            <p>
              Bot: {tgStatus?.configured ? 'Token configured' : 'Not configured'}
              {' · '}
              Channel:{' '}
              {tgStatus?.channelConfigured
                ? 'Configured'
                : 'Not configured'}
              {' · '}
              Polling:{' '}
              {tgStatus?.pollingTrigger
                ? 'Active trigger'
                : 'No trigger detected'}
            </p>

            <p className="cpl-empty">
              Keep the bot token in Apps Script Script Properties. Never paste
              it here or into the frontend.
            </p>

            <form
              className="oz-pol-form"
              onSubmit={publishTelegramAnnouncement}
            >
              <textarea
                required
                minLength={3}
                maxLength={3500}
                placeholder="Write a Telegram channel announcement"
                value={tgAnnouncement}
                onChange={(e) => setTgAnnouncement(e.target.value)}
              />

              <button
                disabled={
                  tgBusy ||
                  !tgStatus?.configured ||
                  !tgStatus?.channelConfigured
                }
              >
                {tgBusy ? 'Publishing…' : 'Publish announcement to Telegram'}
              </button>
            </form>
          </section>

          <h2>Election periods</h2>

          <form
            className="cpl-card oz-pol-form"
            onSubmit={savePeriod}
          >
            <input
              required
              placeholder="Election period title"
              value={periodForm.title}
              onChange={(e) =>
                setPeriodForm({ ...periodForm, title: e.target.value })
              }
            />

            <input
              type="number"
              min="0"
              placeholder="Aspirant fee (KSh)"
              value={periodForm.aspirantFeeKsh}
              onChange={(e) =>
                setPeriodForm({
                  ...periodForm,
                  aspirantFeeKsh: e.target.value,
                })
              }
            />

            <select
              value={periodForm.status}
              onChange={(e) =>
                setPeriodForm({ ...periodForm, status: e.target.value })
              }
            >
              <option value="draft">Draft</option>
              <option value="registration">Registration open</option>
              <option value="campaigning">Campaigning</option>
              <option value="voting">Voting</option>
              <option value="results">Results</option>
              <option value="closed">Closed</option>
            </select>

            <label>
              Registration opens
              <input
                type="datetime-local"
                value={periodForm.registrationOpensAt}
                onChange={(e) =>
                  setPeriodForm({
                    ...periodForm,
                    registrationOpensAt: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Registration closes
              <input
                type="datetime-local"
                value={periodForm.registrationClosesAt}
                onChange={(e) =>
                  setPeriodForm({
                    ...periodForm,
                    registrationClosesAt: e.target.value,
                  })
                }
              />
            </label>

            <button disabled={busy}>Save election period</button>
          </form>

          <h2>Add position</h2>

          <form
            className="cpl-card oz-pol-form"
            onSubmit={savePosition}
          >
            <select
              required
              value={positionForm.electionId}
              onChange={(e) =>
                setPositionForm({
                  ...positionForm,
                  electionId: e.target.value,
                })
              }
            >
              <option value="">Choose election period</option>
              {admin?.periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.title}
                </option>
              ))}
            </select>

            <input
              required
              placeholder="Position name"
              value={positionForm.name}
              onChange={(e) =>
                setPositionForm({ ...positionForm, name: e.target.value })
              }
            />

            <select
              value={positionForm.level}
              onChange={(e) =>
                setPositionForm({ ...positionForm, level: e.target.value })
              }
            >
              <option value="university">University-wide</option>
              <option value="faculty">Faculty</option>
              <option value="school">School</option>
              <option value="department">Department</option>
            </select>

            <input
              placeholder="Faculty code (optional)"
              value={positionForm.facultyCode}
              onChange={(e) =>
                setPositionForm({
                  ...positionForm,
                  facultyCode: e.target.value,
                })
              }
            />

            <button>Save position</button>
          </form>

          <h2>
            Aspirant applications ({admin?.applications.length || 0})
          </h2>

          {admin?.applications.map((application) => (
            <article className="cpl-card" key={application.id}>
              <strong>{application.fullName}</strong>

              <p>
                {application.studentEmail} · {application.course} ·{' '}
                {application.facultyCode}
              </p>

              <p>
                Payment: {application.paymentStatus} · Eligibility:{' '}
                {application.eligibilityStatus} · {application.status}
              </p>

              <p>
                Ref: {application.paymentReference || 'No fee required'}
              </p>

              <textarea
                placeholder="Admin note"
                value={reviewNote[application.id] || ''}
                onChange={(e) =>
                  setReviewNote({
                    ...reviewNote,
                    [application.id]: e.target.value,
                  })
                }
              />

              <div className="oz-pol-actions">
                <button onClick={() => void verify(application.id, true)}>
                  Verify payment
                </button>

                <button onClick={() => void verify(application.id, false)}>
                  Reject payment
                </button>

                <button
                  onClick={() => void review(application.id, 'approved')}
                >
                  Approve
                </button>

                <button
                  onClick={() =>
                    void review(application.id, 'needs_information')
                  }
                >
                  Request info
                </button>

                <button
                  onClick={() => void review(application.id, 'rejected')}
                >
                  Reject application
                </button>
              </div>
            </article>
          ))}

          <h2>Manage public polls</h2>

          <form
            className="cpl-card oz-pol-form"
            onSubmit={createPoll}
          >
            <select
              required
              value={positionForm.electionId}
              onChange={(e) =>
                setPositionForm({
                  ...positionForm,
                  electionId: e.target.value,
                })
              }
            >
              <option value="">Choose election period</option>
              {admin?.periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.title}
                </option>
              ))}
            </select>

            <input
              required
              minLength={8}
              placeholder="Poll question"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
            />

            <textarea
              required
              placeholder="One option per line (2–8 options)"
              value={pollOptions}
              onChange={(e) => setPollOptions(e.target.value)}
            />

            <label>
              Voting closes
              <input
                type="datetime-local"
                value={pollClose}
                onChange={(e) => setPollClose(e.target.value)}
              />
            </label>

            <button>Publish poll</button>
          </form>

          {polls.map((poll) => (
            <article className="cpl-card" key={poll.id}>
              <strong>{poll.question}</strong>
              <p>
                {poll.total} votes · {poll.status}
              </p>

              <div className="oz-pol-actions">
                <button
                  disabled={
                    tgBusy ||
                    !tgStatus?.configured ||
                    !tgStatus?.channelConfigured ||
                    poll.status !== 'published'
                  }
                  onClick={() => void publishTelegramPoll(poll.id)}
                >
                  Publish to Telegram
                </button>

                <button onClick={() => void closePoll(poll.id)}>
                  Close poll
                </button>
              </div>
            </article>
          ))}

          <h2>Public student questions ({questions.length})</h2>

          {questions.map((question) => (
            <article className="cpl-card" key={question.id}>
              <strong>
                {admin?.positions.find(
                  (position) => position.id === question.positionId,
                )?.name || 'Position'}
              </strong>

              <p>{question.question}</p>

              {question.answer && (
                <p>
                  <b>Answer:</b> {question.answer}
                </p>
              )}

              <textarea
                placeholder="Admin answer"
                value={answerDrafts[question.id] || ''}
                onChange={(e) =>
                  setAnswerDrafts({
                    ...answerDrafts,
                    [question.id]: e.target.value,
                  })
                }
              />

              <button onClick={() => void answerQuestion(question.id)}>
                Publish answer
              </button>
            </article>
          ))}
        </>
      ) : (
        <>
          {ctx.user && (
            <section className="cpl-card">
              <h2>Connect Telegram</h2>

              <p>
                Link your Telegram account to help connect your app identity
                with Telegram poll participation.
              </p>

              <button
                disabled={tgBusy}
                onClick={() => void linkTelegram()}
              >
                {tgBusy
                  ? 'Please wait…'
                  : 'Generate Telegram linking code'}
              </button>

              {tgCode && (
                <div>
                  <p>Your one-time code (expires in 10 minutes):</p>
                  <strong className="oz-tg-code">{tgCode}</strong>

                  <p>In your Telegram bot chat, send:</p>
                  <code>/start {tgCode}</code>

                  {tgBot && (
                    <p>
                      <a
                        href={`https://t.me/${tgBot}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open the Chuka O-Zone Telegram bot
                      </a>
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {data?.period ? (
            <section className="cpl-card">
              <h2>{data.period.title}</h2>

              <p>
                Current stage: <strong>{data.period.status}</strong>
              </p>

              <p>
                Aspirant registration fee:{' '}
                <strong>KSh {data.period.aspirantFeeKsh}</strong>
              </p>

              {data.period.registrationClosesAt && (
                <small>
                  Registration closes:{' '}
                  {new Date(
                    data.period.registrationClosesAt,
                  ).toLocaleString()}
                </small>
              )}
            </section>
          ) : (
            <p className="cpl-empty">
              No active election period has been published yet.
            </p>
          )}

          <h2>Community polls</h2>

          {polls.length ? (
            polls.map((poll) => (
              <article className="cpl-card" key={poll.id}>
                <strong>{poll.question}</strong>

                <p>
                  {poll.total} votes
                  {poll.closesAt
                    ? ` · Closes ${new Date(
                        poll.closesAt,
                      ).toLocaleString()}`
                    : ''}
                </p>

                {poll.options.map((option, index) => (
                  <button
                    key={index}
                    disabled={
                      poll.myVote !== null || poll.status !== 'published'
                    }
                    onClick={() => void votePoll(poll.id, index)}
                  >
                    {option}
                    {poll.counts
                      ? ` · ${poll.counts[index]} (${
                          poll.total
                            ? Math.round(
                                (poll.counts[index] / poll.total) * 100,
                              )
                            : 0
                        }%)`
                      : ''}
                  </button>
                ))}

                {poll.myVote !== null && (
                  <small>Your vote is recorded.</small>
                )}
              </article>
            ))
          ) : (
            <p className="cpl-empty">
              No community polls have been published yet.
            </p>
          )}

          <h2>Leadership positions</h2>

          {data?.positions.map((position) => (
            <article className="cpl-card" key={position.id}>
              <strong>{position.name}</strong>

              <p>
                {position.level}
                {position.facultyCode ? ` · ${position.facultyCode}` : ''}
              </p>

              {position.description && <small>{position.description}</small>}
            </article>
          ))}

          <h2>Approved O-Zone aspirants</h2>

          {data?.aspirants.map((aspirant) => (
            <article className="cpl-card" key={aspirant.id}>
              <strong>{aspirant.displayName}</strong>

              <p>
                {data.positions.find(
                  (position) => position.id === aspirant.positionId,
                )?.name || 'Leadership position'}{' '}
                · {aspirant.course} · Year {aspirant.yearOfStudy}
              </p>

              <p>{aspirant.bio}</p>
            </article>
          ))}

          <h2>Ask the aspirants</h2>

          <p>
            Questions are public. Your account details are not displayed.
          </p>

          {ctx.user ? (
            <form
              className="cpl-card oz-pol-form"
              onSubmit={submitQuestion}
            >
              <select
                required
                value={questionPosition}
                onChange={(e) => setQuestionPosition(e.target.value)}
              >
                <option value="">Choose a position</option>

                {data?.positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>

              <textarea
                required
                minLength={10}
                maxLength={1000}
                placeholder="Ask a clear question (10–1,000 characters)"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
              />

              <button disabled={!data?.period}>Publish question</button>
            </form>
          ) : (
            <div className="cpl-card">
              <p>Sign in with your university account to ask a question.</p>
              <button onClick={() => void ctx.signIn()}>
                Sign in with Google
              </button>
            </div>
          )}

          <h3>Community questions and answers</h3>

          {questions.length ? (
            questions.map((question) => (
              <article className="cpl-card" key={question.id}>
                <strong>
                  {data?.positions.find(
                    (position) => position.id === question.positionId,
                  )?.name || 'Position'}
                </strong>

                <p>{question.question}</p>

                {question.answer ? (
                  <p>
                    <b>Aspirant response:</b> {question.answer}
                  </p>
                ) : (
                  <p className="cpl-empty">
                    Awaiting an answer from the aspirant.
                  </p>
                )}

                {ctx.user &&
                  data?.aspirants.some(
                    (aspirant) =>
                      aspirant.positionId === question.positionId,
                  ) && (
                    <>
                      <textarea
                        placeholder="Write an answer (only approved aspirants for this position can publish)"
                        value={answerDrafts[question.id] || ''}
                        onChange={(e) =>
                          setAnswerDrafts({
                            ...answerDrafts,
                            [question.id]: e.target.value,
                          })
                        }
                      />

                      <button
                        onClick={() => void answerQuestion(question.id)}
                      >
                        Publish answer
                      </button>
                    </>
                  )}
              </article>
            ))
          ) : (
            <p className="cpl-empty">
              No questions yet. Be the first to ask.
            </p>
          )}

          <h2 id="oz-politics-apply">Apply to become an aspirant</h2>

          {!ctx.user ? (
            <div className="cpl-card">
              <p>
                Sign in with your verified university Google account to apply.
              </p>

              <button onClick={() => void ctx.signIn()}>
                Sign in with Google
              </button>
            </div>
          ) : mine ? (
            <div className="cpl-card">
              <strong>Your application: {mine.status}</strong>

              <p>
                Payment: {mine.paymentStatus} · Eligibility:{' '}
                {mine.eligibilityStatus}
              </p>

              {mine.adminNote && <p>Admin note: {mine.adminNote}</p>}

              <small>
                One application per person per election period.
              </small>
            </div>
          ) : data?.period?.status === 'registration' ? (
            <form className="cpl-card oz-pol-form" onSubmit={submit}>
              <select
                required
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
              >
                <option value="">Select one position</option>

                {data.positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>

              <input
                required
                placeholder="Full name"
                value={form.fullName}
                onChange={(e) =>
                  setForm({ ...form, fullName: e.target.value })
                }
              />

              <input
                required
                placeholder="Student registration number"
                value={form.registrationNumber}
                onChange={(e) =>
                  setForm({ ...form, registrationNumber: e.target.value })
                }
              />

              <input
                required
                placeholder="Faculty code (e.g. FENG)"
                value={form.facultyCode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    facultyCode: e.target.value.toUpperCase(),
                  })
                }
              />

              <input
                required
                placeholder="Course"
                value={form.course}
                onChange={(e) =>
                  setForm({ ...form, course: e.target.value })
                }
              />

              <select
                value={form.yearOfStudy}
                onChange={(e) =>
                  setForm({ ...form, yearOfStudy: e.target.value })
                }
              >
                {Array.from({ length: 10 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    Year {index + 1}
                  </option>
                ))}
              </select>

              <input
                required
                placeholder="Phone number"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
              />

              <textarea
                required
                minLength={30}
                placeholder="Manifesto (at least 30 characters; max 500 words)"
                value={form.manifesto}
                onChange={(e) =>
                  setForm({ ...form, manifesto: e.target.value })
                }
              />

              {data.period.aspirantFeeKsh > 0 && (
                <>
                  <p>
                    Pay KSh {data.period.aspirantFeeKsh} using the official
                    payment instructions provided by O-Zone admin, then enter
                    the M-Pesa transaction reference.
                  </p>

                  <input
                    required
                    placeholder="M-Pesa transaction reference"
                    value={form.paymentReference}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        paymentReference: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </>
              )}

              <label>
                <input type="checkbox" required />
                I confirm these details are accurate and agree to the election
                platform rules.
              </label>

              <button disabled={busy}>
                {busy ? 'Submitting…' : 'Submit aspirant application'}
              </button>
            </form>
          ) : (
            <p className="cpl-empty">Applications are currently closed.</p>
          )}
        </>
      )}

      <p className="oz-pol-disclaimer">
        O-Zone aspirant listings and community polls are not official
        university election results or a substitute for university eligibility
        clearance.
      </p>
    </div>
  )
}