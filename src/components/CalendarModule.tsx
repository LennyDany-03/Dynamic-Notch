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
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function CalendarModule() {
  const t = tokens
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 24))
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 5, 24))

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayIndex = new Date(year, month, 1).getDay()

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))

  const getDateKey = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()

  const selectedKey = getDateKey(selectedDate)
  const selectedEvents = EVENTS_BY_DATE[selectedKey] || []

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      padding: '8px 10px 6px',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '24px',
        marginBottom: '2px',
      }}>
        <button onClick={prevMonth} style={{
          color: '#00f0ff',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 240, 255, 0.04)',
          border: '1px solid rgba(0, 240, 255, 0.15)',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 240, 255, 0.12)'; e.currentTarget.style.borderColor = '#00f0ff' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 240, 255, 0.04)'; e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.15)' }}
        >
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="3" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <span style={{
          fontFamily: t.fonts.sans,
          fontSize: '9px',
          fontWeight: 600,
          color: t.colors.textPrimary,
          letterSpacing: '0.12em',
        }}>{monthLabel}</span>

        <button onClick={nextMonth} style={{
          color: '#00f0ff',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 240, 255, 0.04)',
          border: '1px solid rgba(0, 240, 255, 0.15)',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 240, 255, 0.12)'; e.currentTarget.style.borderColor = '#00f0ff' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 240, 255, 0.04)'; e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.15)' }}
        >
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="3" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        textAlign: 'center',
        borderBottom: `1px solid ${t.colors.divider}`,
        paddingBottom: '3px',
        marginBottom: '3px',
      }}>
        {WEEKDAYS.map((day, idx) => (
          <span key={idx} style={{
            fontFamily: t.fonts.mono,
            fontSize: '7.5px',
            fontWeight: 700,
            color: idx === 0 || idx === 6 ? '#ff007f' : '#3A3A52',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>{day}</span>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        flex: 1,
        alignContent: 'start',
      }}>
        {Array.from({ length: firstDayIndex }).map((_, idx) => (
          <div key={`prev-${idx}`} style={{
            textAlign: 'center',
            fontSize: '8px',
            fontFamily: t.fonts.mono,
            color: '#1A1A2E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '18px',
          }}>
            {new Date(year, month, 0 - (firstDayIndex - 1 - idx)).getDate()}
          </div>
        ))}

        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const dayNum = idx + 1
          const dayDate = new Date(year, month, dayNum)
          const isToday = dayNum === 24 && month === 5 && year === 2026
          const isSelected = dayNum === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()
          const dateKey = getDateKey(dayDate)
          const hasEvents = !!EVENTS_BY_DATE[dateKey]

          return (
            <button
              key={`day-${dayNum}`}
              onClick={() => setSelectedDate(dayDate)}
              style={{
                background: isSelected ? 'rgba(0, 240, 255, 0.1)' : isToday ? 'rgba(255, 0, 127, 0.1)' : 'transparent',
                border: isSelected ? '1px solid #00f0ff' : isToday ? '1px solid #ff007f' : '1px solid transparent',
                color: isSelected ? '#00f0ff' : isToday ? '#ff007f' : '#8E8EA8',
                fontSize: '8.5px',
                fontFamily: t.fonts.mono,
                textAlign: 'center',
                position: 'relative',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '18px',
                outline: 'none',
                transition: 'all 0.12s ease',
                fontWeight: isSelected || isToday ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (!isSelected && !isToday) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
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
              {hasEvents && !isSelected && !isToday && (
                <div style={{
                  position: 'absolute',
                  bottom: '1px',
                  width: '3px',
                  height: '3px',
                  background: '#00f0ff',
                  boxShadow: '0 0 4px #00f0ff',
                }} />
              )}
              {hasEvents && (isSelected || isToday) && (
                <div style={{
                  position: 'absolute',
                  bottom: '1px',
                  width: '3px',
                  height: '3px',
                  background: isSelected ? '#00f0ff' : '#ff007f',
                  boxShadow: isSelected ? '0 0 4px #00f0ff' : '0 0 4px #ff007f',
                }} />
              )}
            </button>
          )
        })}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '4px',
        fontFamily: t.fonts.mono,
        fontSize: '7px',
        color: '#4A4A62',
        letterSpacing: '0.03em',
        borderTop: `1px solid ${t.colors.divider}`,
        paddingTop: '3px',
        height: '14px',
      }}>
        <span style={{ color: selectedEvents.length > 0 ? '#00f0ff' : '#4A4A62' }}>
          {'> '}{selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase()}
        </span>
        <span style={{
          color: selectedEvents.length > 0 ? '#ff007f' : '#3A3A52',
        }}>
          {selectedEvents.length > 0 ? `${selectedEvents.length} EVENT${selectedEvents.length > 1 ? 'S' : ''}` : 'NO EVENTS'}
        </span>
      </div>
    </div>
  )
}
