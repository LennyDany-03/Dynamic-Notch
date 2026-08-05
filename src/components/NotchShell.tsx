import { AnimatePresence, motion } from 'framer-motion'
import CollapsedPill from './CollapsedPill'
import ModulePlaceholder from './ModulePlaceholder'
import NavDots from './NavDots'
import { CARD_TOP, NAV_ROW_TOP, cardSize } from '../layout'
import { radius, spring } from '../tokens'
import type { NotchModule, NotchState } from '../types/notch'

interface Props {
  state: NotchState
  activeModule: NotchModule
  onSelectModule: (module: NotchModule) => void
}

/**
 * The outer window frame: the Mica surface, its spring sizing, and whatever
 * content the current state calls for.
 *
 * Nothing at all renders while hidden. Pointer events are off everywhere except
 * the card and the nav dots, so the transparent canvas never eats a click that
 * belongs to the desktop.
 */
export default function NotchShell({ state, activeModule, onSelectModule }: Props) {
  const { width, height } = cardSize(state, activeModule)
  const isExpanded = state === 'expanded'

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
              initial={{ width: cardSize('peek', activeModule).width, height: cardSize('peek', activeModule).height, opacity: 0, y: -8 }}
              animate={{ width, height, opacity: 1, y: 0 }}
              exit={{ width: cardSize('peek', activeModule).width, height: cardSize('peek', activeModule).height, opacity: 0, y: -8 }}
              transition={isExpanded ? spring.expand : spring.peek}
              style={{ borderRadius: radius.shell, pointerEvents: 'auto' }}
            >
              {/* Sits above .mica::before (noise) and .mica::after (hairline). */}
              <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isExpanded ? activeModule : 'peek'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    style={{ width: '100%', height: '100%' }}
                  >
                    {isExpanded ? <ModulePlaceholder module={activeModule} /> : <CollapsedPill />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="nav"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: NAV_ROW_TOP,
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'auto',
            }}
          >
            <NavDots active={activeModule} onSelect={onSelectModule} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
