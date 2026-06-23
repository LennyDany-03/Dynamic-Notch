import { useState } from 'react'
import { motion } from 'framer-motion'
import { apple } from '../tokens'

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return { firstDay, daysInMonth }
}

const EVENT_DAYS: Record<number, string> = {
  24: apple.blue,
  25: apple.orange,
  26: apple.green,
  30: apple.purple,
}

const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function CalendarIsland() {
  const now = new Date()
  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const today = now.getDate()
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()

  const { firstDay, daysInMonth } = buildCalendar(year, month)
  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={apple.spring.expand}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '12px 14px 14px',
        width: '100%',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <button
          className="apple-active-feedback"
          onClick={prevMonth}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: apple.text2,
            cursor: 'pointer',
            background: apple.fill4,
            border: 'none',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = apple.fill2}
          onMouseLeave={(e) => e.currentTarget.style.background = apple.fill4}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <span style={{
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: '14px',
          fontWeight: 600,
          color: apple.text1,
          letterSpacing: '-0.02em',
        }}>
          {monthName}
        </span>

        <button
          className="apple-active-feedback"
          onClick={nextMonth}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: apple.text2,
            cursor: 'pointer',
            background: apple.fill4,
            border: 'none',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = apple.fill2}
          onMouseLeave={(e) => e.currentTarget.style.background = apple.fill4}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {dayNames.map(d => (
          <div key={d} style={{
            textAlign: 'center',
            fontFamily: "'Inter', sans-serif",
            fontSize: '10px',
            fontWeight: 600,
            color: apple.text3,
            paddingBottom: '4px',
          }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px',
      }}>
        {cells.map((day, idx) => {
          const isToday = isCurrentMonth && day === today
          const dotColor = day !== null ? EVENT_DAYS[day] : undefined
          const isEmpty = day === null

          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                aspectRatio: '1',
                borderRadius: '50%',
                background: isToday ? apple.red : 'transparent',
                fontFamily: "'Inter', sans-serif",
                fontSize: '11px',
                fontWeight: isToday ? 600 : 400,
                color: isToday ? apple.white : isEmpty ? 'transparent' : apple.text1,
                cursor: isEmpty ? 'default' : 'pointer',
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={(e) => {
                if (!isToday && !isEmpty) e.currentTarget.style.background = apple.fill3
              }}
              onMouseLeave={(e) => {
                if (!isToday && !isEmpty) e.currentTarget.style.background = 'transparent'
              }}
            >
              {day || ''}
              {dotColor && !isToday && (
                <div style={{
                  position: 'absolute',
                  bottom: '3px',
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
