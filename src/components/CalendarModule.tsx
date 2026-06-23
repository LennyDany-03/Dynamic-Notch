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
  "2027-07-04": [
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

  const selectedKey = getDateKey(selectedDate)
  const selectedEvents = EVENTS_BY_DATE[selectedKey] || []
  const eventCountStr = `${selectedEvents.length} EVENT${selectedEvents.length === 1 ? '' : 'S'} ACTIVE`

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      padding: '6px 10px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
    }}>
      {/* Month switcher header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '22px',
      }}>
        <button onClick={prevMonth} style={{
          color: '#00f0ff',
          fontSize: '9px',
          fontFamily: t.fonts.mono,
          padding: '1px 4px',
          background: 'rgba(0, 240, 255, 0.03)',
          border: '1px solid rgba(0, 240, 255, 0.2)',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#00f0ff'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.2)'}
        >⟨</button>

        <span style={{
          fontFamily: t.fonts.sans,
          fontSize: '9.5px',
          fontWeight: 600,
          color: t.colors.textPrimary,
          letterSpacing: '0.06em',
        }}>{monthLabel}</span>

        <button onClick={nextMonth} style={{
          color: '#00f0ff',
          fontSize: '9px',
          fontFamily: t.fonts.mono,
          padding: '1px 4px',
          background: 'rgba(0, 240, 255, 0.03)',
          border: '1px solid rgba(0, 240, 255, 0.2)',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#00f0ff'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.2)'}
        >⟩</button>
      </div>

      {/* Weekday headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        textAlign: 'center',
        borderBottom: `1px solid ${t.colors.divider}`,
        paddingBottom: '2px',
        marginTop: '2px',
      }}>
        {WEEKDAYS.map((day, idx) => (
          <span key={idx} style={{
            fontFamily: t.fonts.mono,
            fontSize: '8px',
            fontWeight: 600,
            color: '#3A3A52',
          }}>{day}</span>
        ))}
      </div>

      {/* Days grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px',
        marginTop: '4px',
        flex: 1,
      }}>
        {/* Previous Month Pad Days */}
        {Array.from({ length: firstDayIndex }).map((_, idx) => {
          return (
            <div key={`prev-${idx}`} style={{
              textAlign: 'center',
              fontSize: '8.5px',
              fontFamily: t.fonts.mono,
              color: '#1A1A2E',
              opacity: 0.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '16px',
            }}>
              //
            </div>
          )
        })}

        {/* Current Month Days */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const dayNum = idx + 1
          const dayDate = new Date(year, month, dayNum)
          
          // Hardcode target today marker relative to mock data
          const isToday = dayNum === 24 && month === 5 && year === 2026
          
          const isSelected = dayNum === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()
          const dateKey = getDateKey(dayDate)
          const hasEvents = !!EVENTS_BY_DATE[dateKey]

          return (
            <button
              key={`day-${dayNum}`}
              onClick={() => setSelectedDate(dayDate)}
              style={{
                background: isSelected 
                  ? 'rgba(0, 240, 255, 0.08)' 
                  : isToday 
                  ? 'rgba(255, 0, 127, 0.08)' 
                  : 'transparent',
                border: isSelected 
                  ? '1px solid #00f0ff' 
                  : isToday 
                  ? '1px solid #ff007f' 
                  : '1px solid transparent',
                color: isSelected 
                  ? '#00f0ff' 
                  : isToday 
                  ? '#ff007f' 
                  : '#8E8EA8',
                fontSize: '8.5px',
                fontFamily: t.fonts.mono,
                padding: '1px 0',
                textAlign: 'center',
                position: 'relative',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '16px',
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
              
              {/* Glowing Event Dot Indicator */}
              {hasEvents && !isSelected && !isToday && (
                <div style={{
                  position: 'absolute',
                  bottom: '1px',
                  width: '2.5px',
                  height: '2.5px',
                  background: '#00f0ff',
                  boxShadow: '0 0 3px #00f0ff',
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Selected Day Status Ticker */}
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
        paddingTop: '4px',
        height: '14px',
      }}>
        <span>CAL // {selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase()}</span>
        <span style={{
          color: selectedEvents.length > 0 ? '#ff007f' : '#4A4A62',
          fontWeight: selectedEvents.length > 0 ? 600 : 500,
        }}>{eventCountStr}</span>
      </div>
    </div>
  )
}
