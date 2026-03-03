(function(){
  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));

  // ===== UI Elements =====
  const $app = qs('.app');
  const $pages = qsa('.page');
  const $navItems = qsa('.navItem');
  const $cam = qs('#cam');
  const $overlay = qs('#overlay');
  const $authModal = qs('#authModal');
  const $adminPin = qs('#adminPin');
  const $adminLoginBtn = qs('#adminLoginBtn');
  const $authError = qs('#authError');
  const $audioModal = qs('#audioModal');
  const $audioStatus = qs('#audioStatus');
  const $audioButtonText = qs('#audioButtonText');
  const $activityList = qs('#activityList');
  const $facesList = qs('#facesList');
  const $logsList = qs('#logsList');

  const ADMIN_PIN = '1234';
  let isAdminAuthed = false;
  let currentFrameBlob = null;
  let faceTrackingActive = false;
  let audioStream = null;
  let mediaRecorder = null;
  let isRecording = false;

  // ===== Admin Auth =====
  function checkAdminAuth(){
    return localStorage.getItem('klingi_admin_auth') === 'true';
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
  if(!isAdminAuthed) $authModal.classList.remove('hidden');

  $adminLoginBtn?.addEventListener('click', ()=>{
    const pin = $adminPin.value.trim();
    if(pin === ADMIN_PIN){
      setAdminAuth(true);
      $adminPin.value = '';
      $authError.textContent = '';
    }else{
      $authError.textContent = 'Invalid PIN';
    }
  });

  $adminPin?.addEventListener('keypress', (e)=>{
    if(e.key === 'Enter') $adminLoginBtn?.click();
  });

  // ===== Page Navigation =====
  function goToPage(pageId){
    $pages.forEach(p => p.classList.remove('active'));
    $navItems.forEach(n => n.classList.remove('active'));
    
    const $page = qs('#' + pageId);
    if($page) $page.classList.add('active');
    
    const $navItem = qs(`[data-page="${pageId}"]`);
    if($navItem) $navItem.classList.add('active');

    if(pageId === 'pageHome'){
      startCameraPolling();
      startFaceTracking();
    } else {
      stopFaceTracking();
    }
  }

  $navItems.forEach(item => {
    item.addEventListener('click', ()=>{
      const pageId = item.dataset.page;
      goToPage(pageId);
    });
  });

  // ===== Camera Polling =====
  let pollInterval;
  let lastBlobUrl;

  function startCameraPolling(){
    if(pollInterval) return;
    pollInterval = setInterval(pollCamera, 50);
  }

  function stopCameraPolling(){
    if(pollInterval) clearInterval(pollInterval);
    pollInterval = null;
  }

  async function pollCamera(){
    try{
      const res = await fetch('/frame.jpg');
      if(!res.ok) return;
      
      const blob = await res.blob();
      currentFrameBlob = blob;
      
      // Create new blob URL and validate before using
      const newUrl = URL.createObjectURL(blob);
      const img = new Image();
      
      img.onload = ()=>{
        if($cam) $cam.src = newUrl;
        if(lastBlobUrl && lastBlobUrl !== newUrl){
          URL.revokeObjectURL(lastBlobUrl);
        }
        lastBlobUrl = newUrl;
      };
      
      img.onerror = ()=>{
        URL.revokeObjectURL(newUrl);
      };
      
      img.src = newUrl;
    }catch(e){
      console.debug('frame.jpg error', e);
    }
  }

  // ===== Face Tracking =====
  let trackingInterval;

  function startFaceTracking(){
    if(trackingInterval) return;
    faceTrackingActive = true;
    trackingInterval = setInterval(trackFace, 200);
  }

  function stopFaceTracking(){
    faceTrackingActive = false;
    if(trackingInterval) clearInterval(trackingInterval);
    trackingInterval = null;
    if($overlay) $overlay.innerHTML = '';
  }

  async function trackFace(){
    try{
      const res = await fetch('/api/detect');
      if(!res.ok) return;
      const data = await res.json();
      
      if(data.ok && data.bbox){
        drawBoundingBox(data.bbox);
      } else {
        if($overlay) $overlay.innerHTML = '';
      }
    }catch(e){
      console.debug('face tracking error', e);
    }
  }

  function drawBoundingBox(bbox){
    if(!bbox || !$cam || !$overlay) return;
    
    const [x1, y1, x2, y2] = bbox;
    
    // Get the actual displayed image dimensions
    const imgRect = $cam.getBoundingClientRect();
    const imgW = imgRect.width;
    const imgH = imgRect.height;
    
    // Get original image dimensions from the image element
    const origW = $cam.naturalWidth || 640;
    const origH = $cam.naturalHeight || 480;
    
    // Calculate scale factors
    const scaleX = imgW / origW;
    const scaleY = imgH / origH;
    
    // Scale bounding box coordinates
    const sx1 = x1 * scaleX;
    const sy1 = y1 * scaleY;
    const sx2 = x2 * scaleX;
    const sy2 = y2 * scaleY;
    
    const w = sx2 - sx1;
    const h = sy2 - sy1;
    
    // Create square bounding box centered on face
    const size = Math.max(w, h);
    const cx = (sx1 + sx2) / 2;
    const cy = (sy1 + sy2) / 2;
    const boxX = cx - size / 2;
    const boxY = cy - size / 2;
    
    const svg = `<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">
      <rect x="${boxX}" y="${boxY}" width="${size}" height="${size}" fill="none" stroke="#10b981" stroke-width="3" rx="8"/>
    </svg>`;
    
    $overlay.innerHTML = svg;
  }

  // ===== API Calls =====
  async function apiPost(path, body){
    try{
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await res.json();
    }catch(e){
      console.error(e);
      return { ok: false, error: 'network' };
    }
  }

  // ===== Button Handlers =====
  qs('#talkBtn')?.addEventListener('click', async ()=>{
    $audioModal.classList.remove('hidden');
    $audioStatus.textContent = 'Ready to speak';
    $audioButtonText.textContent = '🎤 Start';
  });

  qs('#closeAudioBtn')?.addEventListener('click', ()=>{
    if(isRecording) stopAudioRecording();
    $audioModal.classList.add('hidden');
  });

  qs('#startAudioBtn')?.addEventListener('click', async ()=>{
    if(isRecording){
      stopAudioRecording();
    } else {
      startAudioRecording();
    }
  });

  async function startAudioRecording(){
    try{
      // Check if getUserMedia is supported and available
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
        $audioStatus.textContent = 'Microphone API not available';
        $audioStatus.style.backgroundColor = 'rgba(239,68,68,0.1)';
        $audioStatus.style.borderColor = '#ef4444';
        $audioStatus.style.color = '#ef4444';
        
        // Show helpful error message
        const isHTTP = location.protocol === 'http:';
        const message = isHTTP 
          ? 'Microphone requires HTTPS connection for security reasons. Please use HTTPS.'
          : 'Your browser does not support microphone access. Please use Chrome, Firefox, Safari, or Edge.';
        alert(message);
        return;
      }
      
      $audioStatus.textContent = 'Accessing microphone...';
      
      // Request microphone access
      audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      isRecording = true;
      $audioButtonText.textContent = '⏹️ Stop';
      $audioStatus.textContent = 'Recording... speak now';
      $audioStatus.style.backgroundColor = 'rgba(239,68,68,0.1)';
      $audioStatus.style.borderColor = '#ef4444';
      $audioStatus.style.color = '#ef4444';
      
      // Create MediaRecorder to capture audio
      mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
      const audioChunks = [];
      
      mediaRecorder.ondataavailable = (event)=>{
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = async ()=>{
        // Create blob from audio chunks
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        try{
          $audioStatus.textContent = 'Sending audio...';
          
          // Send audio to backend
          const formData = new FormData();
          formData.append('audio', audioBlob, 'audio.webm');
          
          const res = await fetch('/api/audio', {
            method: 'POST',
            body: formData
          });
          
          const data = await res.json();
          
          if(res.ok){
            $audioStatus.textContent = 'Audio sent successfully';
            $audioStatus.style.backgroundColor = 'rgba(16,185,129,0.1)';
            $audioStatus.style.borderColor = '#10b981';
            $audioStatus.style.color = '#10b981';
            addActivity('Two-way audio sent', '🎤');
          } else {
            $audioStatus.textContent = 'Failed to send audio';
          }
        }catch(e){
          $audioStatus.textContent = 'Error: ' + e.message;
          console.error('Audio send error', e);
        }
      };
      
      mediaRecorder.start();
      
      // Auto-stop after 30 seconds
      setTimeout(()=>{
        if(isRecording && mediaRecorder && mediaRecorder.state === 'recording'){
          stopAudioRecording();
        }
      }, 30000);
      
    }catch(e){
      isRecording = false;
      
      // Provide helpful error messages based on error type
      let errorMsg = e.message;
      
      if(e.name === 'NotAllowedError'){
        errorMsg = 'Microphone access denied. Please allow microphone access in browser settings.';
      } else if(e.name === 'NotFoundError'){
        errorMsg = 'No microphone found on this device.';
      } else if(e.name === 'NotReadableError'){
        errorMsg = 'Microphone is already in use by another app.';
      } else if(e.name === 'SecurityError'){
        errorMsg = 'Microphone access requires a secure HTTPS connection.';
      }
      
      $audioStatus.textContent = 'Error: ' + errorMsg;
      $audioStatus.style.backgroundColor = 'rgba(239,68,68,0.1)';
      $audioStatus.style.borderColor = '#ef4444';
      $audioStatus.style.color = '#ef4444';
      console.error('Audio error', e);
    }
  }

  function stopAudioRecording(){
    if(mediaRecorder && mediaRecorder.state === 'recording'){
      mediaRecorder.stop();
    }
    
    if(audioStream){
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }
    
    isRecording = false;
    $audioButtonText.textContent = '🎤 Start';
    $audioStatus.textContent = 'Processing...';
  }

  qs('#unlockBtn')?.addEventListener('click', async ()=>{
    if(confirm('Unlock the door?')){
      const res = await apiPost('/api/door/unlock', { reason: 'manual' });
      if(res.ok) showNotification('Door unlocked');
      else alert('Failed to unlock');
    }
  });

  qs('#sirenBtn')?.addEventListener('click', async ()=>{
    if(confirm('Activate siren?')){
      const res = await apiPost('/api/speak', { text: 'ALARM' });
      if(!res.ok) alert('Failed to activate siren');
    }
  });

  qs('#sirenDeviceBtn')?.addEventListener('click', async ()=>{
    if(confirm('Activate siren?')){
      const res = await apiPost('/api/speak', { text: 'ALARM' });
      if(!res.ok) alert('Failed to activate siren');
    }
  });

  qs('#recognizeBtn')?.addEventListener('click', async ()=>{
    showNotification('Recognizing face...');
    const res = await apiPost('/api/ring', {});
    if(res.ok){
      showNotification('✓ ' + res.name);
      addActivity('Face recognized: ' + res.name, '🟢');
    } else {
      showNotification('✗ Unknown face');
      addActivity('Unknown face detected', '🔴');
    }
  });

  qs('#pinBtn')?.addEventListener('click', async ()=>{
    const pin = qs('#pin')?.value?.trim();
    if(!pin){
      alert('Enter a PIN');
      return;
    }
    const res = await apiPost('/api/auth/pin', { pin });
    if(res.ok){
      showNotification('PIN accepted');
      addActivity('PIN unlock granted', '🟢');
      qs('#pin').value = '';
    } else {
      alert('Invalid PIN');
      addActivity('PIN unlock denied', '🔴');
    }
  });

  qs('#enrollBtn')?.addEventListener('click', async ()=>{
    if(!isAdminAuthed){
      alert('Admin authentication required');
      return;
    }
    const name = qs('#enrollName')?.value?.trim();
    if(!name){
      alert('Enter a name');
      return;
    }
    
    showNotification('Starting enrollment...');
    const livenessRes = await captureLivenessFrames();
    
    if(!livenessRes.is_live){
      alert('Liveness check failed. Try again.');
      return;
    }
    
    try{
      const frameRes = await fetch('/frame.jpg');
      const blob = await frameRes.blob();
      const reader = new FileReader();
      reader.onload = async ()=>{
        const b64 = reader.result.split(',')[1];
        const res = await apiPost('/api/faces/enroll', { name, image_b64: b64 });
        if(res.ok){
          showNotification('Face enrolled: ' + name);
          qs('#enrollName').value = '';
          loadFaces();
        } else {
          alert('Enrollment failed');
        }
      };
      reader.readAsDataURL(blob);
    }catch(e){
      alert('Enrollment error: ' + e.message);
    }
  });

  async function captureLivenessFrames(){
    const frames = [];
    for(let i = 0; i < 8; i++){
      try{
        const frameRes = await fetch('/frame.jpg');
        const blob = await frameRes.blob();
        const reader = new FileReader();
        const b64 = await new Promise((resolve)=>{
          reader.onload = ()=>resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
        frames.push(b64);
        await new Promise(r => setTimeout(r, 200));
      }catch(e){
        console.error('Frame capture error', e);
      }
    }
    
    if(frames.length < 3) return { ok: false, is_live: false };
    
    try{
      return await apiPost('/api/liveness/check', { frames });
    }catch(e){
      return { ok: false, is_live: false };
    }
  }

  // ===== Face Management =====
  async function loadFaces(){
    try{
      const res = await fetch('/api/faces');
      const data = await res.json();
      const $list = qs('#facesList');
      if(!$list) return;
      
      $list.innerHTML = '';
      if(!data.faces || data.faces.length === 0){
        $list.innerHTML = '<div class="emptyState"><div class="emptyIcon">👤</div><div class="emptyText">No faces enrolled</div></div>';
        return;
      }
      
      data.faces.forEach((face)=>{
        const $item = document.createElement('div');
        $item.className = 'item';
        const $name = document.createElement('div');
        $name.className = 'itemName';
        $name.textContent = face.name;
        const $del = document.createElement('button');
        $del.className = 'itemDelete';
        $del.textContent = 'Delete';
        $del.addEventListener('click', async ()=>{
          if(!confirm('Delete "' + face.name + '"?')) return;
          try{
            const delRes = await fetch('/api/faces/' + face.id, { method: 'DELETE' });
            if(delRes.ok){
              loadFaces();
              showNotification('Face deleted');
            }
          }catch(e){
            alert('Delete error: ' + e.message);
          }
        });
        $item.appendChild($name);
        $item.appendChild($del);
        $list.appendChild($item);
      });
    }catch(e){
      console.error('Load faces error', e);
    }
  }

  qs('#refreshFaces')?.addEventListener('click', loadFaces);

  // ===== Logs =====
  async function loadLogs(){
    try{
      const res = await fetch('/api/logs');
      const data = await res.json();
      const $list = qs('#logsList');
      if(!$list) return;
      
      $list.innerHTML = '';
      if(!data.logs || data.logs.length === 0){
        $list.innerHTML = '<div class="emptyState"><div class="emptyIcon">📭</div><div class="emptyText">No events</div></div>';
        return;
      }
      
      data.logs.slice(0, 20).forEach((log)=>{
        const $item = document.createElement('div');
        $item.className = 'item';
        const time = log.ts?.substring(11, 19) || 'unknown';
        $item.innerHTML = `<div style="flex:1"><div style="font-weight:600;font-size:13px">${log.event}</div><div style="font-size:11px;color:var(--text-secondary)">${log.detail}</div></div><div style="font-size:11px;color:var(--text-secondary)">${time}</div>`;
        $list.appendChild($item);
      });
    }catch(e){
      console.error('Load logs error', e);
    }
  }

  qs('#refreshLogs')?.addEventListener('click', loadLogs);

  // ===== Activity Log =====
  function addActivity(text, icon = '📍'){
    const $list = qs('#activityList');
    if(!$list) return;
    
    if($list.querySelector('.emptyState')){
      $list.innerHTML = '';
    }
    
    const $item = document.createElement('div');
    $item.className = 'activityItem';
    $item.innerHTML = `<div class="activityIcon">${icon}</div><div class="activityContent"><div class="activityTitle">${text}</div><div class="activityTime">${new Date().toLocaleTimeString()}</div></div>`;
    $list.prepend($item);
    
    // Keep only last 50 items
    while($list.children.length > 50){
      $list.removeChild($list.lastChild);
    }
  }

  // ===== Notifications =====
  function showNotification(text){
    // Simple visual feedback - could be enhanced with a toast
    console.log('notification:', text);
  }

  // ===== WebSocket =====
  function connectWebSocket(){
    try{
      const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(wsProto + '://' + location.host + '/ws');
      
      ws.onopen = ()=>{
        console.log('ws connected');
      };
      
      ws.onmessage = (ev)=>{
        try{
          const msg = JSON.parse(ev.data);
          console.debug('ws message', msg);
          
          if(msg.event === 'recognized'){
            addActivity('Face recognized: ' + msg.detail, '✅');
            // Show name overlay on camera feed
            showRecognizedFace(msg.detail);
            // Auto-unlock after a short delay
            setTimeout(()=>{
              autoUnlock(msg.detail);
            }, 500);
          } else if(msg.event === 'deny'){
            addActivity('Access denied', '❌');
            showDeniedFace();
          } else if(msg.event === 'face_enrolled'){
            addActivity('Face enrolled: ' + msg.detail, '👤');
            loadFaces();
          } else if(msg.event === 'face_deleted'){
            addActivity('Face deleted', '🗑️');
            loadFaces();
          } else if(msg.event === 'unlock'){
            addActivity('Door unlocked', '🔓');
          }
        }catch(e){
          console.error('ws parse error', e);
        }
      };
      
      ws.onclose = ()=>{
        console.log('ws disconnected, reconnecting...');
        setTimeout(connectWebSocket, 2000);
      };
      
      ws.onerror = (e)=>{
        console.error('ws error', e);
      };
    }catch(e){
      console.error('ws error', e);
      setTimeout(connectWebSocket, 2000);
    }
  }

  // ===== Recognition Display =====
  function showRecognizedFace(name){
    if(!$overlay) return;
    
    const html = `
      <div style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%);background:rgba(16,185,129,0.95);color:white;padding:12px 24px;border-radius:20px;font-weight:600;font-size:16px;white-space:nowrap;backdrop-filter:blur(10px);box-shadow:0 8px 24px rgba(0,0,0,0.3);">
        ✅ ${name}
      </div>
    `;
    
    const $div = document.createElement('div');
    $div.innerHTML = html;
    $div.style.position = 'absolute';
    $div.style.inset = '0';
    $div.style.pointerEvents = 'none';
    $overlay.appendChild($div);
    
    // Remove after 3 seconds
    setTimeout(()=>{
      $div.remove();
    }, 3000);
  }

  function showDeniedFace(){
    if(!$overlay) return;
    
    const html = `
      <div style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%);background:rgba(239,68,68,0.95);color:white;padding:12px 24px;border-radius:20px;font-weight:600;font-size:16px;white-space:nowrap;backdrop-filter:blur(10px);box-shadow:0 8px 24px rgba(0,0,0,0.3);">
        ❌ Access Denied
      </div>
    `;
    
    const $div = document.createElement('div');
    $div.innerHTML = html;
    $div.style.position = 'absolute';
    $div.style.inset = '0';
    $div.style.pointerEvents = 'none';
    $overlay.appendChild($div);
    
    // Remove after 3 seconds
    setTimeout(()=>{
      $div.remove();
    }, 3000);
  }

  async function autoUnlock(name){
    // Auto-unlock the door when face is recognized
    try{
      const res = await apiPost('/api/door/unlock', { reason: `face: ${name}` });
      if(res.ok){
        addActivity('Auto-unlock granted: ' + name, '🔓');
        console.log('Auto-unlocked for:', name);
      }
    }catch(e){
      console.error('Auto-unlock error', e);
    }
  }

  // ===== Init =====
  function init(){
    goToPage('pageHome');
    connectWebSocket();
    loadFaces();
    loadLogs();
  }

  // Start on load
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on unload
  window.addEventListener('beforeunload', ()=>{
    stopCameraPolling();
    stopFaceTracking();
    if(lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
  });

})();