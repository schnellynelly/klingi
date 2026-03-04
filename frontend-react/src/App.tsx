import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import Home from './pages/Home'
import Activity from './pages/Activity'
import Devices from './pages/Devices'
import Settings from './pages/Settings'
import './styles.css'

export default function App(){
  const [lastRecognized, setLastRecognized] = useState<string | null>(sessionStorage.getItem('lastRecognized'))

  useEffect(()=>{
    const handleRing = (e: any) => {
      // placeholder for websocket in future
    }
    window.addEventListener('ring', handleRing)
    return ()=> window.removeEventListener('ring', handleRing)
  },[])

  const onRecognized = (name: string) =>{
    sessionStorage.setItem('lastRecognized', name)
    setLastRecognized(name)
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="brand">Klingi</div>
        <div className="welcome">{lastRecognized ? `Welcome, ${lastRecognized}` : ''}</div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home onRecognized={onRecognized} />} />
          <Route path="/activity" element={<Activity/>} />
          <Route path="/devices" element={<Devices/>} />
          <Route path="/settings" element={<Settings onRecognized={onRecognized}/>} />
        </Routes>
      </main>

      <nav className="bottom-nav">
        <Link to="/" className="nav-item">Home</Link>
        <Link to="/activity" className="nav-item">Activity</Link>
        <Link to="/devices" className="nav-item">Devices</Link>
        <Link to="/settings" className="nav-item">Settings</Link>
      </nav>
    </div>
  )
}
