import { useScreenshotThumb } from '../../hooks/useScreenshots'
import type { Screenshot } from '../../types/screenshots'
import { color, radius } from '../../tokens'

/**
 * A capture that has just landed, on the same banner everything else uses.
 *
 * This is the one announcement whose *point* is the hover rather than the reading.
 * A notification banner is finished the moment you have read it; a screenshot
 * banner is a handle — the instant after PrtScn is precisely when you want to drag
 * the thing somewhere, and the banner puts the grid one dwell away instead of
 * behind a folder. That is why `useNotchState` lets this kind dwell through to the
 * card, alongside media, performance and reminders, rather than merely holding
 * itself up to be read.
 *
 * The picture is fetched here rather than being carried in the announcement, for
 * the reason the notification logo is: a slow thumbnail should cost a thumbnail
 * and never the banner. The hook's cache means the grid behind it, which is about
 * to draw the same tile, pays nothing for this.
 */
export default function ScreenshotAnnounce({ shot }: { shot: Screenshot }) {
  const thumb = useScreenshotThumb(shot.path)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: color.text.strong,
      }}
    >
      {/* 64×36 — a 16:9 window, which is what the file is. The notification
          banner's square logo slot would letterbox every capture into a third of
          its own area, and the thumbnail is the whole reason this banner is
          better than a line of text saying a screenshot was saved. */}
      <div
        style={{
          width: 64,
          height: 36,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          borderRadius: radius.small,
          overflow: 'hidden',
          background: color.inset,
        }}
      >
        {thumb && (
          <img
            src={thumb}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
            draggable={false}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: color.text.muted,
          }}
        >
          Screenshot saved
        </div>

        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: color.text.strong,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {shot.name}
        </div>

        {/* The line that makes the banner worth hovering rather than just
            reading. Without it the dwell is a thing you discover by accident. */}
        <div style={{ marginTop: 1, fontSize: 10.5, color: color.text.muted }}>
          Hover to drag it somewhere
        </div>
      </div>
    </div>
  )
}
