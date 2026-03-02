(function(){
  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));

  const $tabCamera = qs('#tabCamera');
  const $tabAdmin = qs('#tabAdmin');
  const $pageCamera = qs('#pageCamera');
  const $pageAdmin = qs('#pageAdmin');
  const $status = qs('#status');
  const $log = qs('#log');
  const $cam = qs('#cam');
  const $authModal = qs('#authModal');
  const $adminPin = qs('#adminPin');
  const $adminLoginBtn = qs('#adminLoginBtn');
  const $authError = qs('#authError');

  const ADMIN_PIN = '1234'; // Default admin PIN - should match backend SETTINGS
  let isAdminAuthed = false;

  function checkAdminAuth(){
    const stored = localStorage.getItem('klingi_admin_auth');
    return stored === 'true';
  }

  function setAdminAuth(authed){
    isAdminAuthed = authed;
    if(authed){
      localStorage.setItem('klingi_admin_auth', 'true');
      $authModal.classList.add('hidden');
    }else{
      localStorage.removeItem('klingi_admin_auth');
      $authModal.classList.remove('hidden');
    }
  }

  isAdminAuthed = checkAdminAuth();

  $adminLoginBtn?.addEventListener('click', ()=>{
    const pin = $adminPin.value.trim();
    if(pin === ADMIN_PIN){
      setAdminAuth(true);
      $adminPin.value = '';
      $authError.textContent = '';
    }else{
      $authError.textContent = 'Invalid PIN';
      $adminPin.value = '';
    }
  });

  $adminPin?.addEventListener('keypress', (e)=>{
    if(e.key === 'Enter'){
      $adminLoginBtn?.click();
    }
  });

  function goTab(page){
    if(page==='admin'){
      if(!isAdminAuthed){
        $authModal.classList.remove('hidden');
        $adminPin.focus();
        return;
      }
      $pageAdmin.classList.remove('hidden');
      $pageCamera.classList.add('hidden');
      $tabAdmin.classList.add('active');
      $tabCamera.classList.remove('active');
    } else {
      $pageCamera.classList.remove('hidden');
      $pageAdmin.classList.add('hidden');
      $tabCamera.classList.add('active');
      $tabAdmin.classList.remove('active');
      $authModal.classList.add('hidden');
    }
  }

  $tabCamera.addEventListener('click', ()=>goTab('camera'));
  $tabAdmin.addEventListener('click', ()=>goTab('admin'));

  async function apiPost(path, body){
    try{
      const res = await fetch(path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      return await res.json();
    }catch(e){
      console.error(e);return {ok:false,error:'network'};
    }
  }

  qs('#pinBtn')?.addEventListener('click', async ()=>{
    const pin = qs('#pin').value;
    const res = await apiPost('/api/auth/pin', {pin});
    appendLog('PIN '+(res.ok? 'granted':'denied'));
  });

  qs('#unlockBtn')?.addEventListener('click', async ()=>{
    const res = await apiPost('/api/door/unlock', {reason:'manual'});
    appendLog('Unlock: '+(res.ok?'success':'failed'));
  });



  qs('#enrollBtn')?.addEventListener('click', async ()=>{
    const name = qs('#enrollName')?.value?.trim();
    if(!name){
      appendLog('Enroll: name required');
      return;
    }
    
    // Request liveness check (capture multiple frames)
    appendLog('Starting liveness detection...');
    const livenessRes = await captureLivenessFrames();
    
    if(!livenessRes.is_live){
      appendLog('Liveness check failed - please look at camera and move your face');
      return;
    }
    
    appendLog('Liveness confirmed (confidence: '+livenessRes.confidence+'%)');
    
    // Once liveness confirmed, enroll with first frame
    try{
      const frameRes = await fetch('/frame.jpg');
      const blob = await frameRes.blob();
      const reader = new FileReader();
      reader.onload = async ()=>{
        const b64 = reader.result.split(',')[1];
        const res = await apiPost('/api/faces/enroll', {name, image_b64:b64});
        if(res.ok){
          appendLog('Face enrolled: '+name);
          qs('#enrollName').value = '';
          loadFaces();
        }else{
          appendLog('Enroll failed: '+(res.error||'unknown'));
        }
      };
      reader.readAsDataURL(blob);
    }catch(e){
      appendLog('Enroll error: '+e.message);
    }
  });

  async function captureLivenessFrames(){
    // Capture 8 frames over ~1.6 seconds for blink detection
    appendLog('Liveness check: please blink naturally or move your head slightly');
    const frames = [];
    for(let i=0; i<8; i++){
      try{
        const frameRes = await fetch('/frame.jpg');
        const blob = await frameRes.blob();
        const reader = new FileReader();
        const b64 = await new Promise((resolve)=>{
          reader.onload = ()=>resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
        frames.push(b64);
        await new Promise(resolve => setTimeout(resolve, 200));
      }catch(e){
        console.error('Frame capture error:', e);
      }
    }
    
    if(frames.length < 3){
      appendLog('Liveness check: insufficient frames captured');
      return {ok:false, is_live:false, error:'insufficient frames'};
    }
    
    try{
      const res = await apiPost('/api/liveness/check', {frames});
      if(res.is_live){
        appendLog('Liveness confirmed: blink detected');
      } else {
        appendLog('Liveness check failed: please blink or move your head');
      }
      return res;
    }catch(e){
      appendLog('Liveness check error: '+e.message);
      return {ok:false, is_live:false, error:e.message};
    }
  }

  async function loadFaces(){
    try{
      const res = await fetch('/api/faces');
      const data = await res.json();
      const $list = qs('#facesList');
      $list.innerHTML = '';
      if(!data.faces || data.faces.length === 0){
        $list.innerHTML = '<div style="color:var(--muted);">No faces enrolled</div>';
        return;
      }
      data.faces.forEach((face)=>{
        const $item = document.createElement('div');
        $item.className = 'item';
        const $name = document.createElement('span');
        $name.textContent = face.name;
        const $del = document.createElement('button');
        $del.className = 'btn';
        $del.textContent = 'Delete';
        $del.style.flex = '0';
        $del.addEventListener('click', async ()=>{
          const msg = 'Are you sure you want to delete "'+face.name+'" from the system?\n\nThey will need to register again.';
          if(!confirm(msg)) return;
          try{
            const delRes = await fetch('/api/faces/'+face.id, {method:'DELETE'});
            const data = await delRes.json();
            if(data.ok){
              appendLog('Face deleted: '+face.name);
              loadFaces();
            }else{
              appendLog('Delete failed: '+(data.error||'unknown'));
            }
          }catch(e){
            appendLog('Delete error: '+e.message);
          }
        });
        $item.appendChild($name);
        $item.appendChild($del);
        $list.appendChild($item);
      });
    }catch(e){
      appendLog('Load faces error: '+e.message);
    }
  }

  async function loadLogs(){
    try{
      const res = await fetch('/api/logs');
      const data = await res.json();
      const $list = qs('#logsList');
      $list.innerHTML = '';
      if(!data.logs || data.logs.length === 0){
        $list.innerHTML = '<div style="color:var(--muted);">No events</div>';
        return;
      }
      data.logs.forEach((log)=>{
        const $item = document.createElement('div');
        $item.className = 'item';
        const time = log.ts.substring(11,19);
        $item.innerHTML = '<span style="color:var(--muted);font-size:12px;">'+time+'</span> <span>'+log.event+': '+log.detail+'</span>';
        $list.appendChild($item);
      });
    }catch(e){
      appendLog('Load logs error: '+e.message);
    }
  }

  qs('#refreshFaces')?.addEventListener('click', loadFaces);
  qs('#refreshLogs')?.addEventListener('click', loadLogs);

  function appendLog(msg){
    const el = document.createElement('div');
    el.textContent = (new Date()).toLocaleTimeString() + ' — ' + msg;
    $log.prepend(el);
  }

  // Simple status updater (try websocket connection)
  (function tryWs(){
    let ws;
    try{
      ws = new WebSocket((location.protocol==='https:'?'wss':'ws') + '://' + location.host + '/ws');
      ws.onopen = ()=>{ $status.textContent='online'; $status.classList.add('good'); };
      ws.onclose = ()=>{ $status.textContent='offline'; $status.classList.remove('good'); setTimeout(tryWs,2000); };
    }catch(e){ $status.textContent='offline'; setTimeout(tryWs,2000); }
  })();

  // Init
  goTab('camera');
  if(!isAdminAuthed) $authModal.classList.add('hidden');
  // clear any stale log entries
  $log.innerHTML = '';
  
  // Load camera using polling (frame.jpg) for best browser compatibility
  appendLog('Camera stream active');
  const poll = async ()=>{
    try{
      const r = await fetch('/frame.jpg');
      if(r.ok){
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        $cam.src = url;
      }
    }catch(e){ }
    setTimeout(poll, 100);
  };
  poll();
})();