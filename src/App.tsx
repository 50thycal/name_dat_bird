import { useEffect, useMemo, useRef, useState } from 'react'
import { BIRDS, SAMPLE_LIST } from './birds'
import { makeBird, parseList, search, type Mode, type Verdict } from './match'
import { useSpeech } from './useSpeech'

const LIST_KEY = 'ndb.customList'
const PULLED_KEY = 'ndb.pulled'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode); state just won't persist.
  }
}

export default function App() {
  const [customList, setCustomList] = useState<string[] | null>(() => load(LIST_KEY, null))
  const [pulled, setPulled] = useState<Set<string>>(() => new Set(load<string[]>(PULLED_KEY, [])))
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('typed')
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const names = customList ?? BIRDS
  const birds = useMemo(
    () => names.map(makeBird).sort((a, b) => a.name.localeCompare(b.name)),
    [names],
  )
  const { results, verdict, ignored } = useMemo(() => search(query, birds, mode), [query, birds, mode])

  const speech = useSpeech((text) => {
    setMode('voice')
    setQuery(text.trim())
  })

  useEffect(() => save(PULLED_KEY, [...pulled]), [pulled])

  const togglePulled = (name: string) => {
    setPulled((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const clear = () => {
    setQuery('')
    setMode('typed')
    inputRef.current?.focus()
  }

  const pulledCount = birds.filter((b) => pulled.has(b.name)).length

  return (
    <div className="app">
      <header className="top">
        <div className="titlebar">
          <h1>Name Dat Bird</h1>
          <span className="count" title="Pulled from the original deck">
            {pulledCount}/{birds.length} pulled
          </span>
          <button className="ghost" onClick={() => setEditing(true)}>
            List
          </button>
        </div>

        <div className="searchrow">
          <input
            ref={inputRef}
            className="search"
            type="search"
            inputMode="search"
            placeholder={speech.listening ? 'Listening… say a bird' : 'Type a few letters…'}
            value={query}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => {
              setMode('typed')
              setQuery(e.target.value)
            }}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') clear()
              if (e.key === 'Enter' && verdict.kind === 'match') {
                if (!pulled.has(verdict.bird.name)) togglePulled(verdict.bird.name)
                clear()
              }
            }}
          />
          {query && (
            <button className="clear" aria-label="Clear" onClick={clear}>
              ×
            </button>
          )}
          {speech.supported && (
            <button
              className={`mic ${speech.listening ? 'on' : ''}`}
              aria-label={speech.listening ? 'Stop listening' : 'Start listening'}
              aria-pressed={speech.listening}
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
            >
              <MicIcon />
            </button>
          )}
        </div>

        <VerdictBar verdict={verdict} pulled={verdict.kind === 'match' && pulled.has(verdict.bird.name)} />
        {speech.error && <p className="note error">{speech.error}</p>}
        {mode === 'voice' && ignored.length > 0 && (
          <p className="note">Not on list: {ignored.join(', ')}</p>
        )}
        {!customList && SAMPLE_LIST && (
          <p className="note">
            Using a sample list. Tap <b>List</b> to paste the real one.
          </p>
        )}
      </header>

      <ul className="results">
        {results.map((b) => {
          const isPulled = pulled.has(b.name)
          const isMatch = verdict.kind === 'match' && verdict.bird === b
          return (
            <li key={b.name}>
              <button
                className={`row ${isPulled ? 'pulled' : ''} ${isMatch ? 'hit' : ''}`}
                onClick={() => togglePulled(b.name)}
              >
                <span className="check" aria-hidden>
                  {isPulled ? '✓' : ''}
                </span>
                <span className="name">{b.name}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {editing && (
        <ListEditor
          current={names}
          isCustom={!!customList}
          pulledCount={pulledCount}
          onClose={() => setEditing(false)}
          onSave={(list) => {
            setCustomList(list)
            save(LIST_KEY, list)
            setEditing(false)
          }}
          onRestore={() => {
            setCustomList(null)
            save(LIST_KEY, null)
            setEditing(false)
          }}
          onResetPulled={() => setPulled(new Set())}
        />
      )}
    </div>
  )
}

function VerdictBar({ verdict, pulled }: { verdict: Verdict; pulled: boolean }) {
  if (verdict.kind === 'idle') return <div className="verdict idle">Type or speak a bird name</div>
  if (verdict.kind === 'none')
    return (
      <div className="verdict keep">
        <strong>Not on list</strong> <span>keep it in the deck</span>
      </div>
    )
  if (verdict.kind === 'match')
    return (
      <div className="verdict pull">
        <strong>{pulled ? 'Already pulled' : 'Pull it'}</strong> <span>{verdict.bird.name}</span>
      </div>
    )
  return (
    <div className="verdict maybe">
      <strong>
        {verdict.count} possible match{verdict.count === 1 ? '' : 'es'}
      </strong>{' '}
      <span>check the name</span>
    </div>
  )
}

function ListEditor(props: {
  current: string[]
  isCustom: boolean
  pulledCount: number
  onClose: () => void
  onSave: (list: string[]) => void
  onRestore: () => void
  onResetPulled: () => void
}) {
  const [text, setText] = useState(props.current.join('\n'))
  const parsed = parseList(text)

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Bird list</h2>
        <p className="note">
          One bird per line (or comma separated). Numbering and bullets are stripped. Saved on this device.
        </p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        <p className="note">{parsed.length} birds</p>
        <div className="actions">
          <button className="primary" disabled={!parsed.length} onClick={() => props.onSave(parsed)}>
            Save list
          </button>
          {props.isCustom && <button onClick={props.onRestore}>Restore built-in list</button>}
          <button
            disabled={!props.pulledCount}
            onClick={() => {
              if (confirm(`Clear all ${props.pulledCount} pulled checkmarks?`)) props.onResetPulled()
            }}
          >
            Reset pulled
          </button>
          <button className="ghost" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}
