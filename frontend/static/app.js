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

  let isAdminAuthed = false;
  let lastRecognizedName = null;
  let clearWelcomeTimer = null;
  let pendingPageRequest = null;
  let lastRingAt = 0;
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

  // Admin login: use backend /api/admin/login to validate (separate from door PIN)
  $adminLoginBtn?.addEventListener('click', async ()=>{
    const pin = $adminPin.value ? $adminPin.value.trim() : '';
    if(!pin){
      $authError.textContent = 'Enter PIN';
      return;
    }
    $authError.textContent = '';
    showLoader(true);
    try{
      const res = await fetch('/api/admin/login', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({pin})});
      const j = await res.json();
      if(j.ok){
        setAdminAuth(true);
        $adminPin.value = '';
        $authError.textContent = '';
        showToast('Admin authenticated');
        // if user requested a page (e.g., Settings) before auth, navigate there now
        if(pendingPageRequest){
          goToPage(pendingPageRequest);
          pendingPageRequest = null;
        }
      } else {
        $authError.textContent = 'Invalid PIN';
      }
    }catch(e){
      console.error('admin login error', e);
      $authError.textContent = 'Network error';
      showBanner('Backend offline');
    }finally{
      showLoader(false);
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
      // If user requests Settings and is not authed, prompt for admin login first
      if(pageId === 'pageSettings' && !isAdminAuthed){
        pendingPageRequest = pageId;
        $authModal.classList.remove('hidden');
        return;
      }
      goToPage(pageId);
    });
  });

  // ===== Camera Polling =====
  let pollInterval;
  let lastBlobUrl;

  function startCameraPolling(){
    if(pollInterval) return;
    // refresh ~12.5 fps (80ms) to reduce load
    pollInterval = setInterval(pollCamera, 80);
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
        // If backend returned a recognized name with the detect call, display it
        const name = data.name || data.recognized_name || data.label || null;
        if(name){
          setTemporaryRecognition(name);
        }
        drawBoundingBoxWithStatus(data.bbox);

        // If detect did not include a name, attempt a lightweight recognition call
        // but throttle to avoid overloading backend (once per 3s)
        if(!name){
          try{
            const now = Date.now();
            if(now - lastRingAt > 3000){
              lastRingAt = now;
              // fire-and-forget but handle response to update UI
              apiPost('/api/ring', {}).then(rj => {
                if(rj && rj.ok){
                  const rname = rj.name || '';
                  if(rname) setTemporaryRecognition(rname);
                }
              }).catch(e => {
                console.debug('auto ring failed', e);
              });
            }
          }catch(e){ console.debug('auto-recog error', e); }
        }
      } else {
        if($overlay) $overlay.innerHTML = '';
      }
    }catch(e){
      console.debug('face tracking error', e);
    }
  }

  // Show a recognized name temporarily (clears after timeout)
  function setTemporaryRecognition(name){
    lastRecognizedName = name;
    // clear previous timeout
    if(recognitionTimeout) clearTimeout(recognitionTimeout);
    recognitionTimeout = setTimeout(()=>{
      lastRecognizedName = null;
    }, 3000);
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

  // Track face recognition status
  let lastUnknownDetected = false;
  let recognitionTimeout = null;

  function updateFaceRecognitionStatus(name){
    lastRecognizedName = name;
    lastUnknownDetected = false;
    // Clear any existing timeout
    if(recognitionTimeout) clearTimeout(recognitionTimeout);
  }

  function markFaceAsUnknown(){
    lastRecognizedName = null;
    lastUnknownDetected = true;
    // Clear any existing timeout
    if(recognitionTimeout) clearTimeout(recognitionTimeout);
  }

  function drawBoundingBoxWithStatus(bbox){
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
    
    // Determine status and colors
    let statusText = 'Unknown';
    let boxColor = '#ef4444';      // Red for unknown
    let labelBg = 'rgba(239,68,68,0.9)';  // Red background
    
    if(lastRecognizedName){
      statusText = lastRecognizedName;
      boxColor = '#10b981';      // Green for recognized
      labelBg = 'rgba(16,185,129,0.9)';  // Green background
    }

    // Position label below the box (centered)
    const labelY = boxY + size + 10;
    const labelX = cx;

    // estimate label width from text length to keep it centered
    const approxCharWidth = 8; // px
    const padding = 24;
    const maxWidth = Math.min(280, size * 1.2 + 40);
    let labelWidth = Math.min(maxWidth, Math.max(80, statusText.length * approxCharWidth + padding));

    const rectX = labelX - labelWidth / 2;

    // Single centered text (includes icon) to avoid misalignment on long names
    const displayText = (lastRecognizedName ? '✅ ' : '❌ ') + statusText;

    const svg = `<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">
      <!-- Bounding box -->
      <rect x="${boxX}" y="${boxY}" width="${size}" height="${size}" fill="none" stroke="${boxColor}" stroke-width="3" rx="8"/>
      <!-- Name/Status label background (centered) -->
      <rect x="${rectX}" y="${labelY}" width="${labelWidth}" height="28" fill="${labelBg}" rx="6"/>
      <!-- Centered text -->
      <text x="${labelX}" y="${labelY + 18}" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="system-ui">${displayText}</text>
    </svg>`;

    $overlay.innerHTML = svg;
  }

  // Track last recognized face name to display under bbox
  let lastFaceName = null;
  let faceTimeout = null;

  function updateFaceBoxWithName(name){
    lastFaceName = name;
    // Clear any existing timeout
    if(faceTimeout) clearTimeout(faceTimeout);
    // Clear name after 3 seconds
    faceTimeout = setTimeout(()=>{
      lastFaceName = null;
    }, 3000);
  }

  function drawBoundingBoxWithName(bbox, name){
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
    
    // Position name label below the box
    const labelY = boxY + size + 10;
    const labelX = cx;
    
    const svg = `<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">
      <!-- Bounding box -->
      <rect x="${boxX}" y="${boxY}" width="${size}" height="${size}" fill="none" stroke="#10b981" stroke-width="3" rx="8"/>
      <!-- Name label background -->
      <rect x="${labelX - 50}" y="${labelY}" width="100" height="24" fill="rgba(16,185,129,0.9)" rx="4"/>
      <!-- Name text -->
      <text x="${labelX}" y="${labelY + 16}" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="system-ui">${name}</text>
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
      showBanner('Backend offline');
      return { ok: false, error: 'network' };
    }
  }

  // UI helpers: loader, banner, toast, welcome
  function showLoader(visible){
    let el = document.getElementById('globalLoader');
    if(!el){
      el = document.createElement('div');
      el.id = 'globalLoader';
      el.className = 'globalLoader hidden';
      el.innerHTML = '<div class="spinner"></div>';
      document.body.appendChild(el);
    }
    if(visible) el.classList.remove('hidden'); else el.classList.add('hidden');
  }

  function showBanner(msg){
    let b = document.getElementById('backendBanner');
    if(!b){
      b = document.createElement('div');
      b.id = 'backendBanner';
      b.className = 'backendBanner';
      document.body.appendChild(b);
    }
    b.textContent = msg;
    b.classList.remove('hidden');
  }

  function hideBanner(){
    const b = document.getElementById('backendBanner');
    if(b) b.classList.add('hidden');
  }

  function showToast(msg){
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(()=>{ t.classList.add('visible'); }, 20);
    setTimeout(()=>{ t.classList.remove('visible'); setTimeout(()=>t.remove(),300); }, 3000);
  }

  // Capture prompt overlay shown during enrollment guidance
  function showCapturePrompt(text){
    let el = document.getElementById('capturePrompt');
    if(!el){
      el = document.createElement('div');
      el.id = 'capturePrompt';
      el.className = 'capturePrompt';
      document.querySelector('.cameraContainer')?.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('visible');
  }

  function hideCapturePrompt(){
    const el = document.getElementById('capturePrompt');
    if(el) el.classList.remove('visible');
  }

  function setWelcomeName(name){
    try{ hideBanner(); }catch(e){}
    lastRecognizedName = name;
    const el = document.getElementById('welcomeName');
    if(el){
      el.textContent = name ? `Welcome, ${name}` : '';
    }
    if(clearWelcomeTimer) clearTimeout(clearWelcomeTimer);
    if(name){
      clearWelcomeTimer = setTimeout(()=>{
        lastRecognizedName = null;
        if(el) el.textContent = '';
      }, 10000);
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
      // Check secure context: microphone requires HTTPS except on localhost
      const host = location.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
      const isSecureContext = location.protocol === 'https:' || isLocal;
      if(!isSecureContext){
        // show guidance banner and stop
        showBanner('Microphone requires a secure connection (HTTPS). Use ngrok or HTTPS. See /HTTPS_SETUP.md');
        return;
      }

      // Check if getUserMedia is supported and available
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
        $audioStatus.textContent = 'Microphone API not available';
        $audioStatus.style.backgroundColor = 'rgba(239,68,68,0.1)';
        $audioStatus.style.borderColor = '#ef4444';
        $audioStatus.style.color = '#ef4444';
        alert('Your browser does not support microphone access. Please use Chrome, Firefox, Safari, or Edge.');
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
      
      // Create MediaRecorder to capture audio and stream small chunks to backend for low latency
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus'
      ];
      let mime = '';
      for(const t of preferredTypes){ if(MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)){ mime = t; break; } }
      try{
        mediaRecorder = mime ? new MediaRecorder(audioStream, { mimeType: mime }) : new MediaRecorder(audioStream);
      }catch(e){
        console.warn('MediaRecorder creation failed for mime', mime, e);
        mediaRecorder = new MediaRecorder(audioStream);
      }

      // Send each dataavailable chunk immediately to backend to play on door speaker
      mediaRecorder.ondataavailable = async (event)=>{
        try{
          if(!event.data || event.data.size === 0) return;
          const chunk = event.data;
          const formData = new FormData();
          // set filename with timestamp
          const filename = `audio_${Date.now()}.webm`;
          formData.append('audio', chunk, filename);
          // fire-and-forget but still await to show status
          $audioStatus.textContent = 'Sending audio chunk...';
          const res = await fetch('/api/audio', { method: 'POST', body: formData });
          if(res.ok){
            $audioStatus.textContent = 'Streaming audio...';
          } else {
            $audioStatus.textContent = 'Failed to send chunk';
          }
        }catch(err){
          console.error('chunk send error', err);
          showBanner('Backend offline');
        }
      };

      mediaRecorder.onstop = ()=>{
        // indicate finished
        $audioStatus.textContent = 'Finished recording';
        addActivity('Two-way audio sent', '🎤');
      };

      // Start with small timeslice (150ms) for lower latency
      try{ mediaRecorder.start(150); } catch(e){ mediaRecorder.start(); }
      
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
    showLoader(true);
    try{
      const res = await apiPost('/api/ring', {});
      if(res.ok){
        const name = res.name || '';
        setWelcomeName(name);
        showToast('✓ ' + (name || 'Recognized'));
        addActivity('Face recognized: ' + (name || 'unknown'), '🟢');
      } else {
        showToast('✗ Unknown face');
        addActivity('Unknown face detected', '🔴');
      }
    }catch(e){
      console.error('recognize error', e);
      showBanner('Backend offline');
    }finally{
      showLoader(false);
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
    const enrollBtn = qs('#enrollBtn');
    const nameInput = qs('#enrollName');
    const enrollError = qs('#enrollError');

    if(!isAdminAuthed){
      // prompt admin login
      $authModal.classList.remove('hidden');
      return;
    }

    const name = nameInput ? nameInput.value.trim() : '';
    if(!name){
      if(enrollError){ enrollError.style.display='block'; enrollError.textContent='Enter a person name'; }
      return;
    }
    if(enrollError){ enrollError.style.display='none'; enrollError.textContent=''; }

    if(enrollBtn) enrollBtn.disabled = true;
    // Switch user to Home so they can align with the camera for capture
    goToPage('pageHome');
    showToast('Switched to Home. Follow the on-screen prompts to capture.');
    // give camera a moment to start updating frames (short)
    await new Promise(r => setTimeout(r, 400));
    try{
      const livenessRes = await captureLivenessFrames(4, enrollError);
      if(!livenessRes || !livenessRes.is_live){
        if(enrollError){ enrollError.style.display='block'; enrollError.textContent='Liveness check failed. Try again.'; }
        return;
      }

      // reuse last captured frame from liveness to avoid extra fetch and speed up
      const frames = (livenessRes && livenessRes.frames) || [];
      const b64 = frames.length ? frames[frames.length - 1] : null;
      if(!b64){
        if(enrollError){ enrollError.style.display='block'; enrollError.textContent='Failed to capture frame'; }
        return;
      }

      showLoader(true);
      const res = await apiPost('/api/faces/enroll', { name, image_b64: b64 });
      if(res.ok){
        showToast('Face enrolled: ' + name);
        if(nameInput) nameInput.value = '';
        await loadFaces();
        // Try to tell backend to reload face models (if supported)
        try{
          const reload = await apiPost('/api/faces/reload', {});
          if(reload && reload.ok){
            showToast('Face model reloaded');
          }
        }catch(e){
          // ignore if endpoint not present
          console.debug('faces reload not available', e);
        }

        // Attempt an immediate recognition on the current frame to verify enrollment
        try{
          const ringRes = await apiPost('/api/ring', {});
          if(ringRes && ringRes.ok){
            const rname = ringRes.name || '';
            setWelcomeName(rname);
            showToast('✓ ' + (rname || 'Recognized'));
            addActivity('Face recognized: ' + (rname || 'unknown'), '🟢');
          } else {
            showToast('Enrollment complete — move in front of the camera to verify');
          }
        }catch(e){
          console.debug('auto-recognize after enroll failed', e);
          showToast('Enrollment complete — move in front of the camera to verify');
        }
      } else {
        const msg = res.error || 'Enrollment failed';
        if(enrollError){ enrollError.style.display='block'; enrollError.textContent = msg; }
      }
    }catch(e){
      console.error('Enrollment error', e);
      showBanner('Backend offline');
      if(enrollError){ enrollError.style.display='block'; enrollError.textContent = e.message || 'Enrollment error'; }
    }finally{
      if(enrollBtn) enrollBtn.disabled = false;
      showLoader(false);
    }
  });

  // capture liveness frames; default to 4 frames for faster enrollment
  async function captureLivenessFrames(frameCount = 3, statusElement = null){
    // Do not show global loader during guided capture so user can see prompts/camera
    const frames = [];
    try{
      // friendly prompts for the controller to guide movement/blink
      const prompts = [];
      // more explicit guidance: instruct to follow instructions, blink twice, turn head left/right, etc.
      const basePrompts = [
        '(Follow instructions) Blink twice',
        'Turn head left',
        'Turn head right',
        'Look center and smile'
      ];
      for(let i=0;i<frameCount;i++) prompts.push(basePrompts[i] || 'Hold still');

      for(let i = 0; i < frameCount; i++){
        try{
          const prompt = prompts[i] || `Frame ${i+1}/${frameCount}`;
          // show a larger capture prompt near the camera feed
          showCapturePrompt(prompt);
          if(statusElement) statusElement.textContent = `${prompt} (${i+1}/${frameCount})`;

          // small jitter-proofing: add timestamp and attempt fast fetch
          const frameRes = await fetch('/frame.jpg?ts=' + Date.now());
          if(!frameRes.ok) throw new Error('frame fetch failed');
          const blob = await frameRes.blob();
          const reader = new FileReader();
          const b64 = await new Promise((resolve, reject)=>{
            reader.onload = ()=>resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          frames.push(b64);
          // small pause between captures to allow movement to complete
          await new Promise(r => setTimeout(r, 150));
          hideCapturePrompt();
        }catch(e){
          console.error('Frame capture error', e);
          hideCapturePrompt();
        }
      }

      if(frames.length < 3) return { ok: false, is_live: false, frames };

      // send to backend liveness check
      const lres = await apiPost('/api/liveness/check', { frames });
      if(statusElement){
        if(lres && lres.ok && lres.is_live) statusElement.textContent = 'Liveness passed';
        else statusElement.textContent = 'Liveness failed';
      }
      // attach frames so caller can reuse last frame for enrollment
      if(lres && typeof lres === 'object') lres.frames = frames;
      return lres;
    }catch(e){
      console.error('liveness error', e);
      showBanner('Backend offline');
      return { ok: false, is_live: false, frames };
    }finally{
      showLoader(false);
    }
  }

  // ===== Face Management =====
  async function loadFaces(){
    showLoader(true);
    try{
      const res = await fetch('/api/faces');
      if(!res.ok) throw new Error('fetch failed');
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
          if(!isAdminAuthed){
            // require admin authentication
            $authModal.classList.remove('hidden');
            return;
          }
          showLoader(true);
          try{
            const delRes = await fetch('/api/faces/' + face.id, { method: 'DELETE' });
            if(delRes.ok){
              await loadFaces();
              showToast('Face deleted');
            } else {
              const dj = await delRes.json();
              alert('Delete failed: ' + (dj.error || delRes.statusText));
            }
          }catch(e){
            console.error('Delete error', e);
            showBanner('Backend offline');
          }finally{ showLoader(false); }
        });
        $item.appendChild($name);
        $item.appendChild($del);
        $list.appendChild($item);
      });
    }catch(e){
      console.error('Load faces error', e);
      showBanner('Backend offline');
    }finally{
      showLoader(false);
    }
  }

  qs('#refreshFaces')?.addEventListener('click', loadFaces);

  // ===== Logs =====
  async function loadLogs(){
    showLoader(true);
    try{
      const res = await fetch('/api/logs');
      if(!res.ok) throw new Error('fetch failed');
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
      showBanner('Backend offline');
    }finally{
      showLoader(false);
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
            // Update welcome header and overlay
            setWelcomeName(msg.detail);
            showRecognizedFace(msg.detail);
            showToast('Welcome, ' + msg.detail);
            // Auto-unlock after a short delay
            setTimeout(()=>{ autoUnlock(msg.detail); }, 500);
          } else if(msg.event === 'deny'){
            addActivity('Access denied', '❌');
            // Mark face as unknown
            markFaceAsUnknown();
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