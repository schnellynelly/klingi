import React, { useEffect, useState } from 'react'

type Props = { onRecognized?: (name: string)=>void }

export default function Settings({ onRecognized }: Props){
  const [faces, setFaces] = useState<any[]>([])
  const [name, setName] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [authed, setAuthed] = useState<boolean>(!!localStorage.getItem('adminAuthed'))

  useEffect(()=>{ refreshFaces() }, [])

  const refreshFaces = async ()=>{
    try{
      const res = await fetch('/api/faces')
      const j = await res.json()
      if(j.ok) setFaces(j.faces)
    }catch(e){}
  }

  const doLogin = async ()=>{
    try{
      const res = await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pin:adminPin})})
      const j = await res.json()
      if(j.ok){ localStorage.setItem('adminAuthed','1'); setAuthed(true); alert('Admin authenticated') }
      else alert('Invalid PIN')
    }catch(e){ alert('Error') }
  }

  const captureFrameB64 = async ()=>{
    const r = await fetch(`/frame.jpg?ts=${Date.now()}`)
    const blob = await r.blob()
    return await new Promise<string>((resolve)=>{
      const reader = new FileReader()
      reader.onloadend = ()=>{ resolve((reader.result as string).split(',')[1]) }
      reader.readAsDataURL(blob)
    })
  }

  const enroll = async ()=>{
    if(!name) return alert('Enter person name')
    const frames: string[] = []
    for(let i=0;i<8;i++){
      const b64 = await captureFrameB64()
      frames.push(b64)
      await new Promise(r=>setTimeout(r,200))
    }
    const liveRes = await fetch('/api/liveness/check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({frames})})
    const liveJson = await liveRes.json()
    if(!liveJson.ok || !liveJson.is_live) return alert('Liveness failed')
    // capture one more frame for enroll
    const enrollImg = await captureFrameB64()
    const enr = await fetch('/api/faces/enroll',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,image_b64:enrollImg})})
    const ej = await enr.json()
    if(ej.ok){ alert('Face enrolled') ; setName(''); refreshFaces(); if(ej.name && onRecognized) onRecognized(ej.name)}
    else alert('Enroll failed')
  }

  const delFace = async (id:number)=>{
    if(!authed) return alert('Admin required')
    try{
      const res = await fetch(`/api/faces/${id}`,{method:'DELETE'})
      const j = await res.json()
      if(j.ok) refreshFaces()
    }catch(e){}
  }

  return (
    <div className="card">
      <h3>Settings</h3>

      {!authed && (
        <div className="panel">
          <h4>Admin Login</h4>
          <input placeholder="PIN" value={adminPin} onChange={e=>setAdminPin(e.target.value)} />
          <button className="btn" onClick={doLogin}>Login</button>
        </div>
      )}

      <div className="panel">
        <h4>Enroll New Face</h4>
        <input placeholder="Person name" value={name} onChange={e=>setName(e.target.value)} />
        <button className="btn primary" onClick={enroll}>Capture & Enroll</button>
      </div>

      <div className="panel">
        <h4>Enrolled Faces</h4>
        <ul className="faces-list">
          {faces.map(f=> (
            <li key={f.id} className="face-item">
              <div>{f.name}</div>
              <div className="face-actions"><button className="btn" onClick={()=>delFace(f.id)}>Delete</button></div>
            </li>
          ))}
        </ul>
        <button className="btn" onClick={refreshFaces}>Refresh</button>
      </div>

    </div>
  )
}
