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
  // Corner clip CSS — use on ALL main containers
  // clip-path: polygon(10px 0%, 100% 0%, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0% 100%, 0% 10px)
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
