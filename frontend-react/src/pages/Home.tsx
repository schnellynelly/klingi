import React, { useEffect, useRef, useState } from 'react'

type Props = { onRecognized?: (name: string)=>void }

export default function Home({ onRecognized }: Props){
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [bbox, setBbox] = useState<number[] | null>(null)
  const [fpsInterval] = useState(80) // ~12.5 fps

  useEffect(()=>{
    let t: number | null = null
    const refresh = ()=>{
      const img = imgRef.current
      if(img){
        img.src = `/frame.jpg?ts=${Date.now()}`
      }
    }
    refresh()
    t = window.setInterval(refresh, fpsInterval)
    return ()=>{ if(t) clearInterval(t) }
  },[fpsInterval])

  useEffect(()=>{
    let mounted = true
    const poll = async ()=>{
      try{
        const res = await fetch('/api/detect')
        const j = await res.json()
        if(!mounted) return
        if(j.ok && Array.isArray(j.bbox)) setBbox(j.bbox)
        else setBbox(null)
      }catch(e){ setBbox(null) }
    }
    poll()
    const id = setInterval(poll, 200)
    return ()=>{ mounted=false; clearInterval(id) }
  },[])

  const handleRecognize = async ()=>{
    const res = await fetch('/api/ring',{method:'POST'})
    const j = await res.json()
    if(j.ok && j.name){
      sessionStorage.setItem('lastRecognized', j.name)
      if(onRecognized) onRecognized(j.name)
    }
    alert(j.ok ? `Welcome ${j.name || ''}` : 'Not recognized')
  }

  return (
    <div className="card live-card">
      <div className="video-wrap">
        <img ref={imgRef} className="live-img" alt="camera frame"/>
        {bbox && (
          <div className="bbox" style={{
            left: `${bbox[0]}px`, top: `${bbox[1]}px`, width: `${bbox[2]-bbox[0]}px`, height: `${bbox[3]-bbox[1]}px`
          }} />
        )}
      </div>
      <div className="card-actions">
        <button onClick={handleRecognize} className="btn primary">Recognize</button>
        <a className="btn" href="/static/app.js" target="_blank" rel="noreferrer">Legacy UI</a>
      </div>
    </div>
  )
}
