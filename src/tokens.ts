export const tokens = {
  colors: {
    bgDeep:       '#07070E',
    bgSurface:    '#0D0D18',
    bgHover:      '#12121F',
    borderDefault:'rgba(255,255,255,0.08)',
    borderAccent: 'rgba(167,139,250,0.4)',
    textPrimary:  '#E8E8F0',
    textSecondary:'#4A4A62',
    textMuted:    '#28283A',
    accentPurple: '#A78BFA',
    accentBlue:   '#60A5FA',
    accentGreen:  '#4ADE80',
    accentOrange: '#FB923C',
    accentRed:    '#F87171',
    divider:      'rgba(255,255,255,0.06)',
  },
  fonts: {
    sans: "'Space Grotesk', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  clipPath: {
    default: 'polygon(10px 0%, 100% 0%, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0% 100%, 0% 10px)',
    small:   'polygon(6px 0%, 100% 0%, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0% 100%, 0% 6px)',
    button:  'polygon(4px 0%, 100% 0%, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0% 100%, 0% 4px)',
  },
  glow: {
    purple: '0 0 12px rgba(167,139,250,0.4)',
    blue:   '0 0 12px rgba(96,165,250,0.4)',
    green:  '0 0 12px rgba(74,222,128,0.4)',
    orange: '0 0 12px rgba(251,146,60,0.4)',
    red:    '0 0 12px rgba(248,113,113,0.4)',
  }
}

export const glassmorphism = {
  bg:         'rgba(10, 25, 65, 0.58)',
  bgCard:     'rgba(255, 255, 255, 0.07)',
  bgHover:    'rgba(56, 189, 248, 0.14)',
  border:     'rgba(100, 180, 255, 0.22)',
  borderTop:  'rgba(200, 235, 255, 0.40)',
  blur:       'blur(28px) saturate(160%)',
  text1:      'rgba(255, 255, 255, 0.95)',
  text2:      'rgba(180, 215, 255, 0.65)',
  text3:      'rgba(130, 175, 255, 0.40)',
  accent:     '#38BDF8',
  accent2:    '#818CF8',
  accentGlow: 'rgba(56, 189, 248, 0.30)',
  today:      '#0EA5E9',
  radius:     '22px',
  pillRadius: '50px',
  font:       "'Inter', system-ui, sans-serif",
  spring:     { type: 'spring' as const, stiffness: 440, damping: 30, mass: 0.9 },
}

export const win11 = {
  bg:         'rgba(22, 22, 32, 0.88)',
  bgCard:     'rgba(255, 255, 255, 0.05)',
  bgHover:    'rgba(255, 255, 255, 0.08)',
  bgAccent:   'rgba(96, 205, 255, 0.12)',
  border:     'rgba(255, 255, 255, 0.10)',
  borderTop:  'rgba(255, 255, 255, 0.18)',
  blur:       'blur(40px) saturate(160%)',
  text1:      'rgba(255, 255, 255, 0.95)',
  text2:      'rgba(255, 255, 255, 0.55)',
  text3:      'rgba(255, 255, 255, 0.30)',
  accent:     '#60CDFF',
  accentGlow: 'rgba(96, 205, 255, 0.28)',
  today:      '#0078D4',
  radius:     '12px',
  font:       "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
  spring:     { type: 'spring' as const, stiffness: 360, damping: 28, mass: 1 },
}

export const apple = {
  // Core
  black:        '#000000',
  white:        '#FFFFFF',
  
  // Text hierarchy (exact Apple values)
  text1:        'rgba(255,255,255,1.00)',   // primary
  text2:        'rgba(255,255,255,0.55)',   // secondary  
  text3:        'rgba(255,255,255,0.30)',   // tertiary
  text4:        'rgba(255,255,255,0.18)',   // quaternary
  
  // Fills (Apple system fills)
  fill1:        'rgba(255,255,255,0.20)',
  fill2:        'rgba(255,255,255,0.14)',
  fill3:        'rgba(255,255,255,0.08)',
  fill4:        'rgba(255,255,255,0.05)',
  
  // Separators
  sep:          'rgba(255,255,255,0.10)',
  sepOpaque:    '#38383A',
  
  // System colors (for accents only)
  blue:         '#0A84FF',
  green:        '#32D74B',
  orange:       '#FF9F0A',
  red:          '#FF453A',
  purple:       '#BF5AF2',
  
  // Pill shape
  pillRadius:   '26px',
  innerRadius:  '16px',
  smallRadius:  '10px',
  
  // Springs — type: 'spring' as const is required so Framer Motion TypeScript types accept it
  spring: {
    collapse: { type: 'spring' as const, stiffness: 500, damping: 36, mass: 1 },
    expand:   { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.9 },
    content:  { type: 'spring' as const, stiffness: 460, damping: 34, mass: 0.8 },
    tab:      { duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }
}
