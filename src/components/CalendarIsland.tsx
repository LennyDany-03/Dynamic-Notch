import { motion } from 'framer-motion'
import { apple } from '../tokens'

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return { firstDay, daysInMonth }
}

// Days that have events (for dot indicators only)
const EVENT_DAYS: Record<number, string> = {
  // key = day-of-month, value = dot color
}

export default function CalendarIsland() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()

  const { firstDay, daysInMonth } = buildCalendar(year, month)
  const monthName = now.toLocaleString('en-US', { month: 'long' })
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={apple.spring.expand}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '14px 16px 16px',
        width: '100%',
      }}
    >
      {/* Month + Year header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
        <span style={{
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: '15px',
          fontWeight: 600,
          color: apple.text1,
          letterSpacing: '-0.02em',
        }}>
          {monthName}
        </span>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '13px',
          color: apple.text3,
        }}>
          {year}
        </span>
      </div>

      {/* Day column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {dayNames.map(d => (
          <div key={d} style={{
            textAlign: 'center',
            fontFamily: "'Inter', sans-serif",
            fontSize: '10px',
            fontWeight: 600,
            color: apple.text3,
            paddingBottom: '3px',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar date grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '3px',
      }}>
        {cells.map((day, idx) => {
          const isToday = day === today
          const dotColor = day !== null ? EVENT_DAYS[day] : undefined

          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '26px',
                borderRadius: '50%',
                background: isToday ? apple.red : 'transparent',
                fontFamily: "'Inter', sans-serif",
                fontSize: '11px',
                fontWeight: isToday ? 600 : 400,
                color: isToday
                  ? apple.white
                  : day
                  ? apple.text1
                  : 'transparent',
                cursor: day ? 'pointer' : 'default',
                transition: 'background 0.15s ease',
              }}
            >
              {day || ''}

              {/* Event indicator dot — only shown if day has events and is not today */}
              {dotColor && !isToday && (
                <div style={{
                  position: 'absolute',
                  bottom: '2px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: dotColor,
                }} />
              )}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
