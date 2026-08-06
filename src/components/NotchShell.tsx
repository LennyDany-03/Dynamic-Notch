import { AnimatePresence, motion } from 'framer-motion'
import CollapsedPill from './CollapsedPill'
import ModulePlaceholder from './ModulePlaceholder'
import NavArrows from './NavArrows'
import MediaControls from './media/MediaControls'
import FilesModule from './modules/FilesModule'
import LauncherModule from './modules/LauncherModule'
import type { MediaSession } from '../hooks/useMediaSession'
import type { FileShelfState } from '../hooks/useFileShelf'
import { NAV_STRIP_HEIGHT } from '../layout'
import { radius } from '../tokens'
import type { NotchModule, NotchState } from '../types/notch'

interface Props {
  state: NotchState
  activeModule: NotchModule
  onPreviousModule: () => void
  onNextModule: () => void
  session: MediaSession
  shelf: FileShelfState
}

function ModuleContent({
  module,
  session,
  shelf,
}: {
  module: NotchModule
  session: MediaSession
  shelf: FileShelfState
}) {
  switch (module) {
    case 'media':
      return <MediaControls session={session} />
    case 'files':
      return <FilesModule shelf={shelf} />
    case 'launcher':
      return <LauncherModule active />
    default:
      return <ModulePlaceholder module={module} />
  }
}

/**
 * Card contents.
 *
 * The native window *is* the card — it is resized and hidden by `useNotchWindow`,
 * because Mica is a whole-window backdrop and cannot be scoped to a region. So
 * there is no size animation here and no centring to do: this simply fills the
 * window, and the size transition is the window's own.
 */
export default function NotchShell({
  state,
  activeModule,
  onPreviousModule,
  onNextModule,
  session,
  shelf,
}: Props) {
  const isExpanded = state === 'expanded'

  if (state === 'hidden') return null

  return (
    <div
      className="mica"
      style={{
        width: '100%',
        height: '100%',
        borderRadius: radius.shell,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Sits above .mica::before (noise) and .mica::after (hairline). */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, minHeight: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={isExpanded ? activeModule : 'peek'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              style={{ width: '100%', height: '100%' }}
            >
              {isExpanded ? (
                <ModuleContent module={activeModule} session={session} shelf={shelf} />
              ) : (
                <CollapsedPill session={session} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {isExpanded && (
          <div
            style={{
              height: NAV_STRIP_HEIGHT,
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <NavArrows active={activeModule} onPrev={onPreviousModule} onNext={onNextModule} />
          </div>
        )}
      </div>
    </div>
  )
}
