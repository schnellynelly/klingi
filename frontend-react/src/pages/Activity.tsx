import React, { useEffect, useState } from 'react'

export default function Activity(){
  const [logs, setLogs] = useState<any[]>([])

  useEffect(()=>{
    let mounted = true
    const load = async ()=>{
      try{
        const res = await fetch('/api/logs')
        const j = await res.json()
        if(mounted && j.ok) setLogs(j.logs.slice(0,20))
      }catch(e){}
    }
    load()
  },[])

  return (
    <div className="card">
      <h3>Activity</h3>
      <ul className="logs">
        {logs.map((l,i)=> (
          <li key={i}><div className="ts">{l.ts}</div><div className="ev">{l.event} - {l.detail}</div></li>
        ))}
      </ul>
    </div>
  )
}
