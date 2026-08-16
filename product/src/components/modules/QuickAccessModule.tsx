import { useState } from 'react'
import { color, font, radius, sectionLabel } from '../../tokens'
import { QUICK_ACCESS_DEVICE_TYPES, type QuickAccessDeviceType } from '../../types/devices'
import { useQuickAccessDevices } from '../../hooks/useQuickAccessDevices'

function DeviceGlyph({ type }: { type: QuickAccessDeviceType }) {
  if (type === 'microphone') {
    return <><rect x="8" y="3" width="8" height="12" rx="4" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" /></>
  }
  return <><path d="M4 10h16v9H4zM7 10V7h10v3M8 14h8M8 17h5" /></>
}

function DeviceRow({
  type,
  name,
  options,
  open,
  openUpward,
  onToggle,
  onAssign,
}: {
  type: QuickAccessDeviceType
  name: string
  options: { id: string; name: string }[]
  open: boolean
  openUpward: boolean
  onToggle: () => void
  onAssign: (id: string) => void
}) {
  const definition = QUICK_ACCESS_DEVICE_TYPES.find((entry) => entry.type === type)!

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={onToggle}
        style={{
          width: '100%', height: 58, padding: '0 11px', display: 'flex', alignItems: 'center', gap: 10,
          borderRadius: radius.tile, background: open ? color.hover : color.tile, textAlign: 'left',
          transition: 'background 100ms ease',
        }}
      >
        <span style={{ width: 27, height: 27, display: 'grid', placeItems: 'center', borderRadius: radius.small, color: color.accent, background: color.accentWash }}>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><DeviceGlyph type={type} /></svg>
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 10.5, color: color.text.muted }}>{definition.label}</span>
          <span
            style={{
              display: '-webkit-box',
              marginTop: 1,
              overflow: 'hidden',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              lineHeight: 1.2,
              fontSize: 12,
              color: color.text.primary,
            }}
          >
            {name}
          </span>
        </span>
        <span style={{ color: color.text.muted, fontSize: 15 }}>{open ? '⌃' : '⌄'}</span>
      </button>
      {open && (
        <div role="listbox" aria-label={`Choose ${definition.label.toLowerCase()}`} style={{ position: 'absolute', zIndex: 3, left: 6, right: 6, ...(openUpward ? { bottom: 60 } : { top: 60 }), maxHeight: 100, overflowY: 'auto', padding: 4, borderRadius: radius.tile, background: '#000000', boxShadow: color.popShadow }}>
          {options.length ? options.map((option) => (
            <button key={option.id} type="button" role="option" aria-selected={option.name === name} onClick={() => onAssign(option.id)} style={{ width: '100%', minHeight: 32, padding: '7px 9px', borderRadius: radius.small, textAlign: 'left', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.35, background: option.name === name ? color.accentWash : 'transparent', color: color.text.primary, fontSize: 11.5 }}>
              {option.name}
            </button>
          )) : <span style={{ display: 'block', padding: '8px 9px', color: color.text.muted, fontSize: 11.5 }}>{definition.emptyLabel}</span>}
        </div>
      )}
    </div>
  )
}

export default function QuickAccessModule() {
  const { devices, assigned, assign } = useQuickAccessDevices()
  const [openType, setOpenType] = useState<QuickAccessDeviceType | null>(null)
  const rows = QUICK_ACCESS_DEVICE_TYPES.map((definition) => {
    const options = devices.filter((device) => device.type === definition.type)
    const selectedId = assigned.get(definition.type)
    const selected = options.find((device) => device.isDefault) ?? options.find((device) => device.id === selectedId) ?? options[0]
    return { ...definition, options, selected }
  })

  return (
    <div style={{ width: '100%', height: '100%', padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={sectionLabel}>Audio routing</span>
        <span style={{ fontFamily: font.mono, fontSize: 10, color: color.text.muted }}>2 assignments</span>
      </div>
      <div style={{ display: 'grid', gap: 5 }}>
        {rows.map((row, index) => (
          <DeviceRow key={row.type} type={row.type} name={row.selected?.name ?? row.emptyLabel} options={row.options} open={openType === row.type} openUpward={index === rows.length - 1} onToggle={() => setOpenType((current) => current === row.type ? null : row.type)} onAssign={(id) => { void assign(row.type, id); setOpenType(null) }} />
        ))}
      </div>
    </div>
  )
}
