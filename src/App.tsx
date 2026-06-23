import { useState, useEffect } from 'react'
import NotchWidget from './components/NotchWidget'
import AppleNotch from './components/AppleNotch'
import GlassNotch from './components/GlassNotch'
import Win11Notch from './components/Win11Notch'

type Template = 'cyberpunk' | 'apple' | 'glass' | 'win11'

const STORAGE_KEY = 'dynamic-notch-template'

function getInitialTemplate(): Template {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'cyberpunk' || saved === 'apple' || saved === 'glass' || saved === 'win11') return saved
  } catch {}
  return 'cyberpunk'
}

export default function App() {
  const [template, setTemplate] = useState<Template>(getInitialTemplate)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, template)
    } catch {}
  }, [template])

  const handleSwitch = (t: Template) => {
    setTemplate(t)
  }

  return (
    <div
      className={template === 'cyberpunk' ? 'cyberpunk-theme' : ''}
      style={{
        width: '100vw',
        height: '100vh',
        background: 'transparent',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {template === 'cyberpunk' ? (
        <NotchWidget currentTemplate={template} onSwitchTemplate={handleSwitch} />
      ) : template === 'glass' ? (
        <GlassNotch currentTemplate={template} onSwitchTemplate={handleSwitch} />
      ) : template === 'win11' ? (
        <Win11Notch currentTemplate={template} onSwitchTemplate={handleSwitch} />
      ) : (
        <AppleNotch currentTemplate={template} onSwitchTemplate={handleSwitch} />
      )}
    </div>
  )
}
