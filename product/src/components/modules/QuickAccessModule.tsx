import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { color, font, radius, sectionLabel, spring } from '../../tokens'
import { QUICK_ACCESS_DEVICE_TYPES, type QuickAccessDeviceType } from '../../types/devices'
import { useQuickAccessDevices } from '../../hooks/useQuickAccessDevices'

/**
 * Height of one role row. Pinned, and read by `size.quickAccess` in `tokens.ts`
 * — a row that measured itself would leave a stripe of empty Mica under the
 * card's contents, which holds the notch open over nothing (see `layout.ts`).
 */
const ROW_HEIGHT = 56

function DeviceGlyph({ type }: { type: QuickAccessDeviceType }) {
  if (type === 'microphone') {
    return (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
      </>
    )
  }
  return (
    <>
      <path d="M4 9h3l5-4v14l-5-4H4z" />
      <path d="M16 9.5a4 4 0 0 1 0 5" />
      <path d="M18.6 6.6a8 8 0 0 1 0 10.8" />
    </>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        flex: 'none',
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 140ms ease',
      }}
    >
      <path d="M6 9.5l6 6 6-6" />
    </svg>
  )
}

function DeviceRow({
  type,
  label,
  name,
  muted,
  open,
  onOpen,
}: {
  type: QuickAccessDeviceType
  label: string
  name: string
  /** The row has nothing routed — the name is a placeholder, not a device. */
  muted: boolean
  open: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onOpen}
      style={{
        width: '100%',
        height: ROW_HEIGHT,
        flex: 'none',
        padding: '0 11px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderRadius: radius.tile,
        background: color.tile,
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: 27,
          height: 27,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          borderRadius: radius.small,
          color: color.accent,
          background: color.accentWash,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={16}
          height={16}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <DeviceGlyph type={type} />
        </svg>
      </span>

      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 10.5, color: color.text.muted }}>{label}</span>
        <span
          style={{
            // Two lines rather than an ellipsis: endpoint names are long and
            // written back to front — "Headphones (Realtek(R) Audio)" — so the
            // half that gets cut is the half that identifies the device.
            display: '-webkit-box',
            marginTop: 1,
            overflow: 'hidden',
            overflowWrap: 'anywhere',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            lineHeight: 1.2,
            fontSize: 12,
            color: muted ? color.text.muted : color.text.primary,
          }}
        >
          {name}
        </span>
      </span>

      <span style={{ display: 'flex', color: color.text.icon }}>
        <Chevron open={open} />
      </span>
    </button>
  )
}

/**
 * The endpoint list for one role.
 *
 * A sheet taking the whole card, like `NotificationDetail` and `AppPicker`, and
 * for the same hard reason: the overlay's interactive bounds are exactly the card
 * that is drawn, so a menu hanging out of it sits on a click-through region,
 * takes no clicks, and collapses the notch the moment the cursor moves onto it.
 * A dropdown anchored to the row cannot work either — a machine with six
 * endpoints needs more list than the 60px under the second row, and growing the
 * card to reserve that space would leave the same empty stripe the rest of the
 * time.
 */
function DevicePicker({
  label,
  devices,
  activeId,
  emptyLabel,
  onPick,
  onClose,
}: {
  label: string
  devices: { id: string; name: string }[]
  activeId: string | undefined
  emptyLabel: string
  onPick: (id: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
      {/* Scrim, and the click-away. It only has to cover the card: outside it the
          overlay is in `setIgnoreCursorEvents`, so a wider backdrop would catch
          nothing. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: color.scrim }}
      />

      <motion.div
        role="dialog"
        aria-label={`Choose ${label.toLowerCase()}`}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.99 }}
        transition={spring.expand}
        style={{
          position: 'absolute',
          inset: '8px 12px',
          borderRadius: radius.tile,
          // Opaque rather than the tile's translucent fill, matching the other
          // two sheets: at .055 the rows underneath read straight through.
          background: 'rgba(46,46,46,.97)',
          boxShadow: color.popShadow,
          display: 'flex',
          flexDirection: 'column',
          padding: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <span style={sectionLabel}>{label}</span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 20,
              height: 20,
              flex: 'none',
              display: 'grid',
              placeItems: 'center',
              borderRadius: radius.small,
              color: color.text.icon,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={12}
              height={12}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: 6 }}>
          {devices.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11.5,
                color: color.text.muted,
              }}
            >
              {emptyLabel}
            </div>
          ) : (
            devices.map((device) => {
              // Matched on id, never on name: two identical headsets, or the same
              // hardware exposed twice, share a name and would both read as live.
              const active = device.id === activeId

              return (
                <button
                  key={device.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onPick(device.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minHeight: 30,
                    padding: '6px 8px',
                    borderRadius: radius.small,
                    textAlign: 'left',
                    background: active ? color.accentWash : 'transparent',
                    color: active ? color.text.strong : color.text.primary,
                    fontSize: 11.5,
                    lineHeight: 1.35,
                    overflowWrap: 'anywhere',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>{device.name}</span>
                  {active && (
                    <svg
                      viewBox="0 0 24 24"
                      width={13}
                      height={13}
                      fill="none"
                      stroke={color.accent}
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flex: 'none' }}
                    >
                      <path d="M5 12.5l4.5 4.5L19 7" />
                    </svg>
                  )}
                </button>
              )
            })
          )}
        </div>
      </motion.div>
    </div>
  )
}

/**
 * Where Windows is sending sound, and where it is listening — the two endpoints
 * everyone changes and nobody can find, four clicks deep in the volume flyout.
 *
 * The rows read the *Windows* default rather than a preference of Crest's, so
 * they stay right when the default is changed anywhere else. See
 * `useQuickAccessDevices`.
 */
export default function QuickAccessModule() {
  const { devices, loaded, unavailable, error, activeId, assign } = useQuickAccessDevices()
  const [openType, setOpenType] = useState<QuickAccessDeviceType | null>(null)

  const open = openType
    ? QUICK_ACCESS_DEVICE_TYPES.find((definition) => definition.type === openType) ?? null
    : null

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        padding: '8px 16px 12px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          height: 14,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span style={sectionLabel}>Audio routing</span>
        {/* The right slot carries the one thing that is actually true at this
            moment — a failed switch while there is one, and otherwise how many
            endpoints there are to choose between. It used to read "2 assignments"
            unconditionally, which is the row count spelled out as a statistic. */}
        <span
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: font.mono,
            fontSize: 10,
            color: error ? color.fileRed : color.text.muted,
          }}
        >
          {error ?? (loaded && !unavailable ? `${devices.length} endpoints` : '')}
        </span>
      </div>

      {unavailable ? (
        <div
          style={{
            flex: 1,
            display: 'grid',
            placeItems: 'center',
            padding: '0 8px',
            textAlign: 'center',
            fontSize: 11.5,
            lineHeight: 1.5,
            color: color.text.muted,
          }}
        >
          Windows would not hand Crest its audio endpoints.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {QUICK_ACCESS_DEVICE_TYPES.map((definition) => {
            const options = devices.filter((device) => device.type === definition.type)
            const selected = options.find((device) => device.id === activeId(definition.type))

            return (
              <DeviceRow
                key={definition.type}
                type={definition.type}
                label={definition.label}
                // Three different things, and the row says which: still reading,
                // read and empty, or a device. `DEFAULTS`-style placeholder rows
                // before the first read land would be snatched back a frame later.
                name={
                  selected?.name ??
                  (!loaded ? 'Reading…' : options.length ? 'Not set' : definition.emptyLabel)
                }
                muted={!selected}
                open={openType === definition.type}
                onOpen={() => setOpenType(definition.type)}
              />
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <DevicePicker
            key={open.type}
            label={open.label}
            devices={devices.filter((device) => device.type === open.type)}
            activeId={activeId(open.type)}
            emptyLabel={open.emptyLabel}
            onPick={(id) => {
              assign(open.type, id)
              setOpenType(null)
            }}
            onClose={() => setOpenType(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
