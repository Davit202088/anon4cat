const findBtn = document.getElementById('findBtn');
const leaveBtn = document.getElementById('leaveBtn');
const nextBtn = document.getElementById('nextBtn');
const muteBtn = document.getElementById('muteBtn');
const statusEl = document.getElementById('status');
const remoteAudio = document.getElementById('remoteAudio');
const swipeArea = document.getElementById('swipeArea');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeModal = document.getElementById('closeModal');
const saveSettings = document.getElementById('saveSettings');

let ws;
let pc;
let localStream;
let isInitiator = false;
let isMuted = false;
let touchStartX = 0;
let touchEndX = 0;
let userSettings = {
  nickname: '',
  avatar: null,
  soundNotif: true,
  autoSearch: false
};

// Загрузка настроек из localStorage
function loadSettings() {
  const saved = localStorage.getItem('userSettings');
  if (saved) {
    userSettings = { ...userSettings, ...JSON.parse(saved) };
    document.getElementById('nickname').value = userSettings.nickname || '';
    document.getElementById('soundNotif').checked = userSettings.soundNotif;
    document.getElementById('autoSearch').checked = userSettings.autoSearch;
  }
}

// Сохранение настроек
function saveUserSettings() {
  userSettings.nickname = document.getElementById('nickname').value;
  userSettings.soundNotif = document.getElementById('soundNotif').checked;
  userSettings.autoSearch = document.getElementById('autoSearch').checked;

  localStorage.setItem('userSettings', JSON.stringify(userSettings));
  alert('✅ Настройки сохранены!');
  settingsModal.classList.remove('active');
}

// Модальное окно
settingsBtn.onclick = () => {
  settingsModal.classList.add('active');
};

closeModal.onclick = () => {
  settingsModal.classList.remove('active');
};

settingsModal.onclick = (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('active');
  }
};

saveSettings.onclick = saveUserSettings;

// Загружаем настройки при запуске
loadSettings();

function setStatus(text) {
  statusEl.textContent = text;
  console.log('Status:', text);
}

function toggleMute() {
  if (!localStream) return;

  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = !isMuted;
  });

  if (isMuted) {
    muteBtn.innerHTML = '🔇 МИК ВКЛ';
    muteBtn.classList.add('muted');
  } else {
    muteBtn.innerHTML = '🔊 МИК ВЫКЛ';
    muteBtn.classList.remove('muted');
  }

  console.log('Mute toggled:', isMuted);
}

function nextPartner() {
  console.log('🔄 Switching to next partner');
  setStatus('>> ПОИСК СЛЕДУЮЩЕГО СОБЕСЕДНИКА...');
  endCall(false);
  setTimeout(() => {
    connectWS();
  }, 500);
}

function connectWS() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);
  
  ws.onopen = () => {
    console.log('✅ WebSocket connected');
    setStatus('>> ПОИСК СОБЕСЕДНИКА...');
  };

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      console.log('📩 WS message:', msg);

      if (msg.type === 'waiting') {
        setStatus('>> ОЖИДАНИЕ СОБЕСЕДНИКА...');

      } else if (msg.type === 'match') {
        isInitiator = msg.initiator;
        setStatus('>> CONNECTION ESTABLISHED');
        await startCall();

      } else if (msg.type === 'signal') {
        await handleSignal(msg.data);

      } else if (msg.type === 'partner_disconnected') {
        setStatus('>> СОБЕСЕДНИК ОТКЛЮЧИЛСЯ');
        endCall();
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  ws.onclose = () => {
    console.log('🔌 WebSocket disconnected');
    setStatus('>> CONNECTION CLOSED');
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
    setStatus('>> ERROR: CONNECTION FAILED');
  };
}

async function startCall() {
  try {
    console.log('🎙️ Starting call, initiator:', isInitiator);

    // Create peer connection with better ICE configuration
    pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });

    // Handle ICE candidates with buffering
    let iceCandidatesBuffer = [];
    let remoteDescriptionSet = false;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('📤 ICE candidate:', event.candidate.type);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'signal',
            data: { candidate: event.candidate }
          }));
        }
      } else {
        console.log('✅ ICE gathering complete');
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected') {
        console.log('✅ ICE connection established');
        setStatus('>> VOICE CHAT ACTIVE');
      } else if (pc.iceConnectionState === 'disconnected') {
        console.log('⚠️ ICE disconnected');
      } else if (pc.iceConnectionState === 'failed') {
        console.log('❌ ICE connection failed');
        setStatus('>> ERROR: CONNECTION FAILED');
        // Попробуем рестарт ICE
        if (pc) {
          pc.restartIce();
        }
      }
    };

    // Handle incoming audio stream
    pc.ontrack = (event) => {
      console.log('🎧 Received remote stream');
      remoteAudio.srcObject = event.streams[0];
      setStatus('>> VOICE CHAT ACTIVE');
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setStatus('>> VOICE CHAT ACTIVE');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setStatus('>> CONNECTION LOST');
        endCall();
      }
    };

    // Get local audio stream
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
    
    console.log('🎤 Got local stream');
    
    // Add local stream to peer connection
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
      console.log('Added track:', track.kind);
    });

    // If initiator, create and send offer
    if (isInitiator) {
      console.log('📤 Creating offer...');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        voiceActivityDetection: true
      });
      await pc.setLocalDescription(offer);

      console.log('✅ Local description set (offer)');

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'signal',
          data: { type: 'offer', sdp: offer.sdp }
        }));
        console.log('✅ Offer sent');
      }
    }

    // Update UI
    findBtn.style.display = 'none';
    leaveBtn.style.display = 'inline-block';
    nextBtn.style.display = 'inline-block';
    muteBtn.style.display = 'inline-block';
    
  } catch (error) {
    console.error('❌ Start call error:', error);
    setStatus('>> ERROR: MICROPHONE ACCESS DENIED');
    alert('⚠️ Пожалуйста, разрешите доступ к микрофону для использования чата');
    endCall();
  }
}

async function handleSignal(data) {
  try {
    if (!pc) {
      console.warn('⚠️ No peer connection yet');
      return;
    }

    // Handle offer
    if (data.type === 'offer') {
      console.log('📥 Received offer');

      if (pc.signalingState !== 'stable') {
        console.log('⚠️ Signaling state not stable, waiting...');
        await Promise.all([
          pc.setLocalDescription({ type: 'rollback' }),
          pc.setRemoteDescription(new RTCSessionDescription(data))
        ]);
      } else {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
      }

      console.log('✅ Remote description set (offer)');

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('✅ Local description set (answer)');

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'signal',
          data: { type: 'answer', sdp: answer.sdp }
        }));
        console.log('✅ Answer sent');
      }

    // Handle answer
    } else if (data.type === 'answer') {
      console.log('📥 Received answer');

      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        console.log('✅ Remote description set (answer)');
      } else {
        console.warn('⚠️ Unexpected signaling state:', pc.signalingState);
      }

    // Handle ICE candidate
    } else if (data.candidate) {
      console.log('📥 Received ICE candidate');
      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log('✅ ICE candidate added');
        } else {
          console.log('⏳ Buffering ICE candidate (no remote description yet)');
          // Buffer the candidate if remote description isn't set yet
          if (!pc.candidateBuffer) {
            pc.candidateBuffer = [];
          }
          pc.candidateBuffer.push(data.candidate);
        }
      } catch (e) {
        console.error('❌ Error adding ICE candidate:', e);
      }
    }

    // Process buffered candidates if remote description is now set
    if (pc.remoteDescription && pc.candidateBuffer && pc.candidateBuffer.length > 0) {
      console.log('📦 Processing buffered ICE candidates:', pc.candidateBuffer.length);
      for (const candidate of pc.candidateBuffer) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('❌ Error adding buffered candidate:', e);
        }
      }
      pc.candidateBuffer = [];
    }

  } catch (error) {
    console.error('❌ Signal handling error:', error);
  }
}

function endCall(resetUI = true) {
  console.log('🛑 Ending call');
  
  // Close peer connection
  if (pc) {
    pc.close();
    pc = null;
  }
  
  // Stop local stream
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      track.stop();
      console.log('Stopped track:', track.kind);
    });
    localStream = null;
  }
  
  // Clear remote audio
  if (remoteAudio.srcObject) {
    remoteAudio.srcObject = null;
  }
  
  // Close WebSocket
  if (ws) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'leave' }));
    }
    ws.close();
    ws = null;
  }
  
  // Reset UI
  if (resetUI) {
    findBtn.style.display = 'inline-block';
    leaveBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    muteBtn.style.display = 'none';
    muteBtn.classList.remove('muted');
    isMuted = false;
  }
  
  isInitiator = false;
}

// Event listeners
findBtn.onclick = () => {
  console.log('🔍 Find button clicked');
  setStatus('>> CONNECTING...');
  connectWS();
};

leaveBtn.onclick = () => {
  console.log('👋 Leave button clicked');
  endCall();
  setStatus('>> READY TO SEARCH');
};

nextBtn.onclick = () => {
  nextPartner();
};

muteBtn.onclick = () => {
  toggleMute();
};

// Swipe functionality
swipeArea.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
});

swipeArea.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
});

// Mouse swipe for desktop
let mouseDown = false;
let startX = 0;

swipeArea.addEventListener('mousedown', (e) => {
  mouseDown = true;
  startX = e.clientX;
  swipeArea.style.cursor = 'grabbing';
});

swipeArea.addEventListener('mousemove', (e) => {
  if (!mouseDown) return;
  const diff = e.clientX - startX;
  if (Math.abs(diff) > 10) {
    swipeArea.style.transform = `translateX(${diff * 0.3}px)`;
  }
});

swipeArea.addEventListener('mouseup', (e) => {
  if (!mouseDown) return;
  mouseDown = false;
  swipeArea.style.cursor = 'grab';
  
  const diff = e.clientX - startX;
  swipeArea.style.transform = '';
  
  if (Math.abs(diff) > 100) {
    handleSwipeDirection(diff);
  }
});

swipeArea.addEventListener('mouseleave', () => {
  if (mouseDown) {
    mouseDown = false;
    swipeArea.style.cursor = 'grab';
    swipeArea.style.transform = '';
  }
});

function handleSwipe() {
  const diff = touchStartX - touchEndX;
  if (Math.abs(diff) > 50) {
    handleSwipeDirection(diff);
  }
}

function handleSwipeDirection(diff) {
  // Check if in active call
  if (!pc || !ws || ws.readyState !== WebSocket.OPEN) return;
  
  if (diff > 0) {
    // Swipe left - next partner
    console.log('👈 Swiped left - next partner');
    nextPartner();
  } else {
    // Swipe right - also next partner (or could be different action)
    console.log('👉 Swiped right - next partner');
    nextPartner();
  }
}

// Initial status
setStatus('>> PRESS BUTTON TO START');

// ==================== USER MANAGEMENT ====================
let currentUser = null;

// Initialize user on page load
async function initUser() {
  try {
    // Get Telegram WebApp init data
    if (window.Telegram && window.Telegram.WebApp) {
      const initData = window.Telegram.WebApp.initData;

      if (initData) {
        const response = await fetch('/api/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData })
        });

        const data = await response.json();

        if (data.ok && data.user) {
          currentUser = data.user;
          updateUserStatusDisplay();

          // Show admin button if user is admin
          if (currentUser.role === 'admin') {
            showAdminButton();
          }
        }
      }
    }
  } catch (error) {
    console.error('Error initializing user:', error);
  }
}

// Update user status display
function updateUserStatusDisplay() {
  if (!currentUser) return;

  const statusBadge = document.getElementById('userStatusBadge');
  const statusText = document.getElementById('userStatusText');

  if (statusBadge && statusText) {
    let badgeText = '';
    let badgeColor = '';

    if (currentUser.role === 'admin') {
      badgeText = '👑 ADMIN';
      badgeColor = '#ff00ff';
    } else if (currentUser.premiumStatus === 'premium') {
      badgeText = '⭐ PREMIUM';
      badgeColor = '#00f2fe';
    } else {
      badgeText = '👤 FREE';
      badgeColor = '#a0a8ff';
    }

    statusText.textContent = badgeText;
    statusBadge.style.borderColor = badgeColor;
    statusBadge.style.display = 'block';
    statusBadge.style.boxShadow = `0 0 20px ${badgeColor}40`;
  }

  // Update premium features
  updatePremiumFeatures();
}

// Update premium features availability
function updatePremiumFeatures() {
  if (!currentUser) return;

  const isPremium = currentUser.premiumStatus === 'premium';
  const lockedFeatures = document.querySelectorAll('.locked-feature');

  if (isPremium) {
    lockedFeatures.forEach(feature => {
      feature.classList.remove('locked-feature');
      const inputs = feature.querySelectorAll('input, select');
      inputs.forEach(input => {
        input.disabled = false;
        input.style.pointerEvents = 'auto';
        input.style.opacity = '1';
      });
    });
  }
}

// Show admin button
function showAdminButton() {
  const adminBtn = document.createElement('button');
  adminBtn.id = 'adminBtn';
  adminBtn.className = 'settings-btn';
  adminBtn.style.left = '20px';
  adminBtn.style.right = 'auto';
  adminBtn.innerHTML = '👑 АДМИН';
  adminBtn.onclick = openAdminPanel;
  document.body.appendChild(adminBtn);
}

// ==================== ADMIN PANEL ====================
const adminModal = document.getElementById('adminModal');
const closeAdminModal = document.getElementById('closeAdminModal');
const refreshUsers = document.getElementById('refreshUsers');

function openAdminPanel() {
  if (!currentUser || currentUser.role !== 'admin') {
    alert('⛔ Доступ запрещен');
    return;
  }

  adminModal.classList.add('active');
  loadUsersList();
}

if (closeAdminModal) {
  closeAdminModal.onclick = () => {
    adminModal.classList.remove('active');
  };
}

if (adminModal) {
  adminModal.onclick = (e) => {
    if (e.target === adminModal) {
      adminModal.classList.remove('active');
    }
  };
}

if (refreshUsers) {
  refreshUsers.onclick = loadUsersList;
}

async function loadUsersList() {
  if (!currentUser) return;

  const container = document.getElementById('usersListContainer');
  container.innerHTML = '<div style="text-align: center; padding: 20px; opacity: 0.5;">Загрузка...</div>';

  try {
    const response = await fetch(`/api/admin/users?adminId=${currentUser.userId}`);
    const data = await response.json();

    if (data.ok && data.users) {
      displayUsersList(data.users);
    } else {
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff00ff;">⛔ Ошибка загрузки</div>';
    }
  } catch (error) {
    console.error('Error loading users:', error);
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff00ff;">⛔ Ошибка подключения</div>';
  }
}

function displayUsersList(users) {
  const container = document.getElementById('usersListContainer');

  if (users.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; opacity: 0.5;">Пользователей пока нет</div>';
    return;
  }

  const usersHTML = users.map(user => `
    <div class="setting-item" style="flex-direction: column; align-items: stretch; padding: 20px; margin-bottom: 15px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <div>
          <div style="font-size: 1.1rem; font-weight: 600; color: #00f2fe; margin-bottom: 5px;">
            ${user.firstName || 'Без имени'} ${user.lastName || ''}
          </div>
          <div style="font-size: 0.9rem; opacity: 0.7;">
            @${user.username || user.userId} • ID: ${user.userId}
          </div>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <span style="padding: 5px 10px; border-radius: 5px; font-size: 0.8rem; font-weight: 600; ${user.role === 'admin' ? 'background: rgba(255, 0, 255, 0.2); border: 1px solid #ff00ff; color: #ff00ff;' : 'background: rgba(160, 168, 255, 0.2); border: 1px solid #a0a8ff; color: #a0a8ff;'}">
            ${user.role === 'admin' ? '👑 ADMIN' : '👤 USER'}
          </span>
          <span style="padding: 5px 10px; border-radius: 5px; font-size: 0.8rem; font-weight: 600; ${user.premiumStatus === 'premium' ? 'background: rgba(0, 242, 254, 0.2); border: 1px solid #00f2fe; color: #00f2fe;' : 'background: rgba(160, 168, 255, 0.1); border: 1px solid #a0a8ff; color: #a0a8ff;'}">
            ${user.premiumStatus === 'premium' ? '⭐ PREMIUM' : '👤 FREE'}
          </span>
        </div>
      </div>

      <div style="display: flex; gap: 10px;">
        <button onclick="togglePremium(${user.userId}, '${user.premiumStatus}')" style="flex: 1; padding: 10px; font-size: 0.9rem; background: rgba(0, 242, 254, 0.1); border: 1px solid #00f2fe; color: #00f2fe; border-radius: 5px; cursor: pointer; transition: all 0.3s;">
          ${user.premiumStatus === 'premium' ? '↓ Убрать Premium' : '↑ Дать Premium'}
        </button>
        ${currentUser.userId !== user.userId ? `
        <button onclick="toggleRole(${user.userId}, '${user.role}')" style="flex: 1; padding: 10px; font-size: 0.9rem; background: rgba(255, 0, 255, 0.1); border: 1px solid #ff00ff; color: #ff00ff; border-radius: 5px; cursor: pointer; transition: all 0.3s;">
          ${user.role === 'admin' ? '↓ Снять Admin' : '↑ Дать Admin'}
        </button>
        ` : '<div style="flex: 1; padding: 10px; text-align: center; opacity: 0.5; font-size: 0.8rem;">Это вы</div>'}
      </div>
    </div>
  `).join('');

  container.innerHTML = usersHTML;
}

async function togglePremium(userId, currentStatus) {
  if (!currentUser || currentUser.role !== 'admin') return;

  const newStatus = currentStatus === 'premium' ? 'free' : 'premium';

  try {
    const response = await fetch('/api/admin/update-premium', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminId: currentUser.userId,
        userId: userId,
        premiumStatus: newStatus
      })
    });

    const data = await response.json();

    if (data.ok) {
      alert(`✅ Premium статус изменен на: ${newStatus.toUpperCase()}`);
      loadUsersList();

      // If it's current user, update their status
      if (userId === currentUser.userId) {
        currentUser.premiumStatus = newStatus;
        updateUserStatusDisplay();
      }
    } else {
      alert(`⛔ Ошибка: ${data.error}`);
    }
  } catch (error) {
    console.error('Error updating premium:', error);
    alert('⛔ Ошибка подключения');
  }
}

async function toggleRole(userId, currentRole) {
  if (!currentUser || currentUser.role !== 'admin') return;

  const newRole = currentRole === 'admin' ? 'user' : 'admin';

  if (!confirm(`Вы уверены, что хотите изменить роль на ${newRole.toUpperCase()}?`)) {
    return;
  }

  try {
    const response = await fetch('/api/admin/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminId: currentUser.userId,
        userId: userId,
        role: newRole
      })
    });

    const data = await response.json();

    if (data.ok) {
      alert(`✅ Роль изменена на: ${newRole.toUpperCase()}`);
      loadUsersList();
    } else {
      alert(`⛔ Ошибка: ${data.error}`);
    }
  } catch (error) {
    console.error('Error updating role:', error);
    alert('⛔ Ошибка подключения');
  }
}

// Initialize user when page loads
initUser();

// ==================== PERSONAL CABINET ====================

// Add Cabinet button
function addCabinetButton() {
  const cabinetBtn = document.createElement('button');
  cabinetBtn.id = 'cabinetBtn';
  cabinetBtn.className = 'settings-btn';
  cabinetBtn.style.right = '70px';
  cabinetBtn.innerHTML = '👤 КАБИНЕТ';
  cabinetBtn.onclick = openCabinet;
  document.body.appendChild(cabinetBtn);
  console.log('Cabinet button added');
}

// Open cabinet
function openCabinet() {
  const cabinetUrl = '/cabinet.html';

  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.openLink(cabinetUrl);
  } else {
    window.open(cabinetUrl, '_blank');
  }
}

// Add button after page loads
setTimeout(addCabinetButton, 1000);
// Cabinet button click handler
document.addEventListener('DOMContentLoaded', function() {
  const cabinetBtn = document.getElementById('cabinetBtn');
  if (cabinetBtn) {
    cabinetBtn.addEventListener('click', function() {
      console.log('Cabinet button clicked');
      const cabinetUrl = '/cabinet.html';
      
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.openLink(cabinetUrl);
      } else {
        window.open(cabinetUrl, '_blank');
      }
    });
    console.log('Cabinet button initialized');
  } else {
    console.warn('Cabinet button not found');
  }
});

// Also handle if button is added after load
window.addEventListener('load', function() {
  setTimeout(function() {
    const cabinetBtn = document.getElementById('cabinetBtn');
    if (cabinetBtn && !cabinetBtn.onclick) {
      cabinetBtn.onclick = function() {
        const cabinetUrl = '/cabinet.html';
        if (window.Telegram && window.Telegram.WebApp) {
          window.Telegram.WebApp.openLink(cabinetUrl);
        } else {
          window.open(cabinetUrl, '_blank');
        }
      };
    }
  }, 100);
});
