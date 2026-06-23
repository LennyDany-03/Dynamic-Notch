import { useState, useEffect } from 'react'
import NotchWidget from './components/NotchWidget'
import AppleNotch from './components/AppleNotch'

type Template = 'cyberpunk' | 'apple'

const STORAGE_KEY = 'dynamic-notch-template'

function getInitialTemplate(): Template {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'cyberpunk' || saved === 'apple') return saved
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
      ) : (
        <AppleNotch currentTemplate={template} onSwitchTemplate={handleSwitch} />
      )}
    </div>
  )
}
