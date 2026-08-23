/**
 * The one sound Crest makes.
 *
 * Synthesised rather than played from a file: two short notes out of an
 * oscillator are a handful of lines, there is no asset to bundle, no licence to
 * carry, nothing to load and nothing to fail to load. A recorded chime would be
 * warmer and would also be a binary in the repo whose only job is to say "done".
 *
 * **The AudioContext is created on a user gesture, and that is not an
 * optimisation.** WebView2 applies Chromium's autoplay policy: a context
 * constructed without a gesture behind it starts `suspended`, and every
 * `start()` on it is silently dropped — no error, no sound, nothing to debug.
 * The gesture this rides on is the click that *starts the timer*, which is
 * always available because a chime only ever follows a timer somebody started.
 * `arm()` is called from that click; `play()` is called minutes later off a
 * timer callback, where no gesture exists at all.
 *
 * Held for the life of the window rather than built per chime. A browser caps
 * how many contexts a page may open, and a long session is a lot of pomodoros.
 */

type Ctor = typeof AudioContext

let context: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (context) return context

  const Ctx: Ctor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
  if (!Ctx) return null

  try {
    context = new Ctx()
    return context
  } catch {
    // A machine with no audio device at all. The timer is not worth failing over.
    return null
  }
}

/**
 * Create the context while a user gesture is on the stack.
 *
 * Call this from the click that starts a timer. Cheap and idempotent, so calling
 * it on every start is fine — after the first it is a null check.
 */
export function armChime(): void {
  audioContext()
}

/** The two notes. A fifth apart, rising, which is the shape of "finished". */
const NOTES = [
  { frequency: 880, at: 0 },
  { frequency: 1318.5, at: 0.16 },
] as const

/** How long each note rings. Short — this is a full stop, not a doorbell. */
const NOTE_S = 0.42

export function playChime(): void {
  const ctx = audioContext()
  if (!ctx) return

  // Suspended is the normal state for a context that has been sitting idle, and
  // on some Windows builds after the audio device has changed underneath it.
  // Resuming is a promise; the notes below are scheduled against the clock
  // regardless, because `currentTime` is valid either way and the schedule is
  // relative to it.
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})

  const start = ctx.currentTime + 0.02

  for (const note of NOTES) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    // Triangle rather than sine: a pure sine at this pitch and this length reads
    // as a test tone. The triangle's odd harmonics give it just enough body to
    // sound like an object being struck.
    oscillator.type = 'triangle'
    oscillator.frequency.value = note.frequency

    const at = start + note.at

    // A near-instant attack and an exponential decay, which is what every struck
    // thing does. Ramping to a small positive value rather than to zero because
    // `exponentialRampToValueAtTime` is undefined at 0 and throws; the explicit
    // `setValueAtTime` afterwards is what actually silences it.
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.18, at + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_S)
    gain.gain.setValueAtTime(0, at + NOTE_S)

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(at)
    oscillator.stop(at + NOTE_S + 0.02)

    // Nodes are single-use and hold a reference to the graph until they finish.
    // Disconnecting on `ended` is what stops a long session accumulating them.
    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
    }
  }
}
