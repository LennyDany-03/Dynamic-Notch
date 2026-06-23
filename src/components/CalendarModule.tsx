import { useState } from 'react'
import { tokens } from '../tokens'

interface CalEvent {
  id: string
  title: string
  timeRange: string
  stripe: string
  badgeLabel: string
  badgeColor: string
}

const EVENTS_BY_DATE: Record<string, CalEvent[]> = {
  "2026-06-24": [
    { id: '1', title: 'SRM Lab Submission', timeRange: '10:00 – 11:00 AM', stripe: '#A78BFA', badgeLabel: 'URGENT', badgeColor: '#F87171' },
    { id: '2', title: 'Nuke Sprint Review', timeRange: '2:30 – 3:30 PM', stripe: '#60A5FA', badgeLabel: 'MEET', badgeColor: '#60A5FA' },
    { id: '3', title: 'Push HRMS to staging', timeRange: '5:00 PM', stripe: '#4ADE80', badgeLabel: 'TASK', badgeColor: '#4ADE80' },
  ],
  "2026-06-25": [
    { id: '4', title: 'Recruitment Sync', timeRange: '11:30 AM – 12:30 PM', stripe: '#60A5FA', badgeLabel: 'SYNC', badgeColor: '#60A5FA' },
    { id: '5', title: 'Database Optimization', timeRange: '3:00 PM', stripe: '#FB923C', badgeLabel: 'TASK', badgeColor: '#FB923C' },
  ],
  "2026-06-26": [
    { id: '6', title: 'Tauri v2 Build Push', timeRange: '10:00 AM', stripe: '#4ADE80', badgeLabel: 'DEPLOY', badgeColor: '#4ADE80' },
  ],
  "2026-06-30": [
    { id: '7', title: 'Nuke Staging Verification', timeRange: '4:00 PM', stripe: '#A78BFA', badgeLabel: 'MEET', badgeColor: '#A78BFA' },
  ],
  "2026-07-04": [
    { id: '8', title: 'Tauri Hackathon Launch', timeRange: '9:00 AM', stripe: '#FB923C', badgeLabel: 'EVENT', badgeColor: '#FB923C' },
  ]
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function CalendarModule() {
  const t = tokens
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 24)) // June 2026
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 5, 24))

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayIndex = new Date(year, month, 1).getDay()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }
  
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const getDateKey = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()

  return (
    <div style={{
      width: '100%',
      height: '210px',
      overflow: 'hidden',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
    }}>
      {/* Header month switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
      }}>
        <button onClick={prevMonth} style={{
          color: t.colors.textSecondary,
          fontSize: '11px',
          fontFamily: t.fonts.mono,
          padding: '2px 8px',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${t.colors.borderDefault}`,
          cursor: 'pointer',
          outline: 'none',
        }}>⟨</button>
        <span style={{
          fontFamily: t.fonts.sans,
          fontSize: '11px',
          fontWeight: 600,
          color: t.colors.textPrimary,
          letterSpacing: '0.08em',
        }}>{monthLabel}</span>
        <button onClick={nextMonth} style={{
          color: t.colors.textSecondary,
          fontSize: '11px',
          fontFamily: t.fonts.mono,
          padding: '2px 8px',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${t.colors.borderDefault}`,
          cursor: 'pointer',
          outline: 'none',
        }}>⟩</button>
      </div>

      {/* Weekday headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        textAlign: 'center',
        borderBottom: `1px solid ${t.colors.divider}`,
        paddingBottom: '4px',
      }}>
        {WEEKDAYS.map((day, idx) => (
          <span key={idx} style={{
            fontFamily: t.fonts.mono,
            fontSize: '9px',
            fontWeight: 600,
            color: '#3A3A52',
          }}>{day}</span>
        ))}
      </div>

      {/* Days grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '4px',
        marginTop: '8px',
        flex: 1,
      }}>
        {/* Prefix pad days */}
        {Array.from({ length: firstDayIndex }).map((_, idx) => {
          const dayNum = prevMonthDays - firstDayIndex + idx + 1
          return (
            <div key={`prev-${idx}`} style={{
              textAlign: 'center',
              fontSize: '10px',
              fontFamily: t.fonts.mono,
              color: '#1C1C30',
              padding: '4px 0',
              opacity: 0.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>{dayNum}</div>
          )
        })}

        {/* Month days */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const dayNum = idx + 1
          const dayDate = new Date(year, month, dayNum)
          const isToday = dayNum === 24 && month === 5 && year === 2026 // Today June 24, 2026
          const isSelected = dayNum === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()
          const dateKey = getDateKey(dayDate)
          const hasEvents = !!EVENTS_BY_DATE[dateKey]

          return (
            <button
              key={`day-${dayNum}`}
              onClick={() => setSelectedDate(dayDate)}
              style={{
                background: isSelected 
                  ? 'rgba(167, 139, 250, 0.12)' 
                  : isToday 
                  ? 'rgba(74, 222, 128, 0.06)' 
                  : 'transparent',
                border: isSelected 
                  ? `1px solid ${t.colors.accentPurple}` 
                  : isToday 
                  ? `1px solid ${t.colors.accentGreen}` 
                  : '1px solid transparent',
                color: isSelected 
                  ? t.colors.accentPurple 
                  : isToday 
                  ? t.colors.accentGreen 
                  : '#8E8EA8',
                fontSize: '10.5px',
                fontFamily: t.fonts.mono,
                padding: '4px 0',
                textAlign: 'center',
                position: 'relative',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '22px',
                outline: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected && !isToday) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                  e.currentTarget.style.color = '#fff'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected && !isToday) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#8E8EA8'
                }
              }}
            >
              <span>{dayNum}</span>
              {/* Event dot */}
              {hasEvents && !isSelected && (
                <div style={{
                  position: 'absolute',
                  bottom: '2px',
                  width: '3.5px', height: '3.5px',
                  background: isToday ? t.colors.accentGreen : t.colors.accentPurple,
                  boxShadow: isToday ? t.glow.green : t.glow.purple,
                }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
