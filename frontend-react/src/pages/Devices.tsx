import React, { useEffect, useState } from 'react'

export default function Devices(){
  const [status, setStatus] = useState<any>(null)

  useEffect(()=>{
    const load = async ()=>{
      try{
        const res = await fetch('/api/cam_status')
        const j = await res.json()
        if(j.ok) setStatus(j.status)
      }catch(e){}
    }
    load()
  },[])

  return (
    <div className="card">
      <h3>Devices</h3>
      <div className="device">
        <div className="device-title">Front Door Camera</div>
        <div className="device-row">Status: {status ? (status.frame ? 'online' : 'no frame') : 'unknown'}</div>
        {status && status.frame && <div className="device-row">Resolution: {status.frame.width}x{status.frame.height}</div>}
      </div>
    </div>
  )
}
