import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal Web Speech API typings; not all TS lib.dom versions ship them.
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } }
type RecognitionEvent = { results: ArrayLike<RecognitionResult> }
type RecognitionErrorEvent = { error: string }
interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

function getCtor(): RecognitionCtor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function useSpeech(onText: (text: string, isFinal: boolean) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<Recognition | null>(null)
  const wantRef = useRef(false)
  const onTextRef = useRef(onText)
  useEffect(() => {
    onTextRef.current = onText
  })

  const supported = typeof window !== 'undefined' && !!getCtor()

  const stop = useCallback(() => {
    wantRef.current = false
    setListening(false)
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) return
    setError(null)
    if (!recRef.current) {
      const rec = new Ctor()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'
      rec.maxAlternatives = 1
      rec.onresult = (e) => {
        // Only the latest phrase matters: each card is a fresh utterance.
        const r = e.results[e.results.length - 1]
        if (r) onTextRef.current(r[0].transcript, r.isFinal)
      }
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          wantRef.current = false
          setListening(false)
          setError('Microphone access was blocked. Allow it in your browser settings.')
        } else if (e.error === 'audio-capture') {
          wantRef.current = false
          setListening(false)
          setError('No microphone found.')
        }
        // 'no-speech', 'network', 'aborted': onend restarts if still wanted.
      }
      rec.onend = () => {
        // Browsers end sessions after silence; keep the mic "always on".
        if (wantRef.current) {
          try {
            rec.start()
          } catch {
            setTimeout(() => {
              if (!wantRef.current) return
              try {
                rec.start()
              } catch {
                // Give up this cycle; the user can tap the mic again.
              }
            }, 250)
          }
        } else {
          setListening(false)
        }
      }
      recRef.current = rec
    }
    wantRef.current = true
    try {
      recRef.current.start()
    } catch {
      // Already started.
    }
    setListening(true)
  }, [])

  useEffect(() => () => {
    wantRef.current = false
    recRef.current?.abort()
  }, [])

  return { supported, listening, error, start, stop }
}
