import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * `useState` that survives its component being unmounted.
 *
 * The notch draws a card only while it is expanded — `NotchShell` swaps the
 * module out at `peek` and the whole card out at `hidden` — so every module is
 * mounted and unmounted on the ordinary hover cycle, several times a minute. For
 * a card that only *reads* something that is fine and is the point: the media
 * card, the meters and the notification list are all views over state owned
 * further up, and remounting them costs nothing.
 *
 * It is not fine for the two cards the user *types into*. Moving the mouse off
 * the notch is a hover-out, not a cancel, and a half-typed task disappearing
 * because the cursor drifted off the card's edge is the notch throwing away work
 * nobody asked it to throw away.
 *
 * The obvious fix — keep the module mounted and hide it with CSS — is the wrong
 * one here. The card is not hidden, it *shrinks*: at `peek` it is a 264×34 pill
 * and `.mica` clips to it, and the panels cross-fade against each other inside
 * that box (see `NotchShell`). A 480px calendar parked inside the pill would be
 * a laid-out, animating subtree behind every collapse, for state that is a
 * string. So the component still unmounts and its draft does not: this is a
 * module-level store the value is written through to, read back by the next
 * mount, and keyed by hand.
 *
 * Deliberately in memory and deliberately not `settings.json`. A draft is not a
 * preference — it is what the user was in the middle of — and the honest
 * lifetime for "in the middle of" is the session. The same reasoning as
 * `timing.snoozeMs`: something restored from disk hours later is not the thing
 * that was interrupted.
 *
 * Keys are namespaced by the card (`calendar.draft`) because the store is one
 * map shared by every module, and a bare `draft` is a name two cards would both
 * reach for.
 */
const store = new Map<string, unknown>()

export function useStickyState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    // `has`, not `?? initial`: `false`, `0` and `''` are all values a card can
    // legitimately have been left in, and the last of those is the notes draft.
    if (store.has(key)) return store.get(key) as T
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })

  // Written through on the way out rather than in an effect, so the store is
  // already right if the component unmounts in the same commit — which is
  // exactly the case this exists for, the notch collapsing on the keystroke
  // that moved the cursor off the card.
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      setValue((current) => {
        const resolved =
          typeof next === 'function' ? (next as (previous: T) => T)(current) : next
        store.set(key, resolved)
        return resolved
      })
    },
    [key],
  )

  return [value, set]
}
