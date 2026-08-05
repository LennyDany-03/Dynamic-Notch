import { AnimatePresence, motion } from 'framer-motion'
import CollapsedPill from './CollapsedPill'
import ModulePlaceholder from './ModulePlaceholder'
import NavDots from './NavDots'
import MediaControls from './media/MediaControls'
import FilesModule from './modules/FilesModule'
import LauncherModule from './modules/LauncherModule'
import type { MediaSession } from '../hooks/useMediaSession'
import { CARD_TOP, NAV_STRIP_HEIGHT, cardSize } from '../layout'
import { radius, spring } from '../tokens'
import type { NotchModule, NotchState } from '../types/notch'

interface Props {
  state: NotchState
  activeModule: NotchModule
  onSelectModule: (module: NotchModule) => void
  session: MediaSession
}

function ModuleContent({ module, session }: { module: NotchModule; session: MediaSession }) {
  switch (module) {
    case 'media':
      return <MediaControls session={session} />
    case 'files':
      return <FilesModule />
    case 'launcher':
      return <LauncherModule active />
    default:
      return <ModulePlaceholder module={module} />
  }
}

/**
 * The outer window frame: the Mica surface, its spring sizing, and whatever
 * content the current state calls for.
 *
 * Nothing at all renders while hidden. Pointer events are off everywhere except
 * the card, so the transparent canvas never eats a click that belongs to the
 * desktop.
 */
export default function NotchShell({ state, activeModule, onSelectModule, session }: Props) {
  const { width, height } = cardSize(state, activeModule)
  const isExpanded = state === 'expanded'
  const peek = cardSize('peek', activeModule)

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: CARD_TOP,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <AnimatePresence>
          {state !== 'hidden' && (
            <motion.div
              key="card"
              className="mica"
              initial={{ width: peek.width, height: peek.height, opacity: 0, y: -8 }}
              animate={{ width, height, opacity: 1, y: 0 }}
              exit={{ width: peek.width, height: peek.height, opacity: 0, y: -8 }}
              transition={isExpanded ? spring.expand : spring.peek}
              style={{ borderRadius: radius.shell, pointerEvents: 'auto' }}
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
                        <ModuleContent module={activeModule} session={session} />
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
                    <NavDots active={activeModule} onSelect={onSelectModule} />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
