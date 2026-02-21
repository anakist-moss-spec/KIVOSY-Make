// ============================================================
// KIVOSY App Factory — factory-ui.js
// UI Controller Module (Processor Memory)
// ============================================================

// ── Global Variables ────────────────────────────────────────
let _lastUUID = null;
let _lastHTML = null;

// ── Initialization ──────────────────────────────────────────
function initFactoryTab() {
  updateQuotaDisplay();
  renderAppHistory();
}

// ── Quota Display ───────────────────────────────────────────
function updateQuotaDisplay() {
  if (!window.KivosyFactory) return;
  
  // RateLimiter에서 사용량만 가져옴 (remaining은 더 이상 표시 안 함)
  const { RateLimiter } = window.KivosyFactory;
  const usage = RateLimiter.getUsage();
  const used = usage.count;

  // quota-used 요소가 있으면 업데이트 (헤더용)
  const usedEl = document.getElementById('quota-used');
  if (usedEl) usedEl.textContent = used;
  
  // daily-usage 요소가 있으면 업데이트 (헤더용)
  const dailyUsageEl = document.getElementById('daily-usage');
  if (dailyUsageEl) dailyUsageEl.textContent = used;
  
}

// ── Prompt Helpers ─────────────────────────────────────────
function setFactoryPrompt(text) {
  const ta = document.getElementById('factory-prompt');
  if (ta) { 
    ta.value = text; 
    ta.focus(); 
  }
}

// ── Progress Steps ─────────────────────────────────────────
// 일반 진행 메시지 추가
function addProgressStep(msg, done = false) {
  const container = document.getElementById('progress-steps');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'progress-step' + (done ? ' done' : '');
  el.textContent = msg;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

// 타이머용: 마지막 메시지 업데이트 (같은 줄)
function updateProgressStep(msg) {
  const container = document.getElementById('progress-steps');
  if (!container) return;
  const lastEl = container.lastElementChild;
  if (lastEl && lastEl.classList.contains('progress-step')) {
    lastEl.textContent = msg;
  } else {
    // 마지막 요소가 없으면 새로 생성
    addProgressStep(msg);
  }
  container.scrollTop = container.scrollHeight;
}

// ── API Key Loader (compatible with index.html) ────────────
function getApiKeys() {
  // 1. lab의 통합 설정에서 키 가져오기 시도
  const savedConfig = localStorage.getItem('kivosy_ai_config');
  if (savedConfig) {
    try {
      const config = JSON.parse(savedConfig);
      return {
        gemini: config.geminiKey || '',
        groq: config.groqKey || ''
      };
    } catch (e) {
      console.warn('Failed to parse kivosy_ai_config', e);
    }
  }
  
  // 2. 개별 키 가져오기 (fallback)
  return {
    gemini: localStorage.getItem('geminiApiKey') || '',
    groq: localStorage.getItem('groqApiKey') || ''
  };
}

// ── Main Generate Handler ───────────────────────────────────
async function handleFactoryGenerate() {
  const prompt = document.getElementById('factory-prompt')?.value?.trim();
  if (!prompt) {
    alert('앱 설명을 입력해 주세요.');
    return;
  }

  // API 키 가져오기
  const apiKeys = getApiKeys();

  if (!apiKeys.gemini && !apiKeys.groq) {
    alert('⚠️ Gemini 또는 Groq API 키를 먼저 설정해 주세요.\n(상단의 Set API Key 버튼을 클릭하세요)');
    return;
  }

  // UI 초기화
  const btn = document.getElementById('factory-generate-btn');
  const spinner = document.getElementById('factory-spinner');
  const btnText = document.getElementById('factory-btn-text');
  const progressEl = document.getElementById('factory-progress');
  const errorEl = document.getElementById('factory-error');
  const resultEl = document.getElementById('factory-result');

  btn.disabled = true;
  spinner.style.display = 'block';
  btnText.textContent = '생성 중...';
  progressEl.style.display = 'block';
  errorEl.style.display = 'none';
  resultEl.style.display = 'none';
  document.getElementById('progress-steps').innerHTML = '';

  // 타이머 시작
  const startTime = Date.now();
  let lastUpdateMsg = '';
  
  const timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = minutes > 0 
      ? `${minutes}분 ${seconds}초` 
      : `${seconds}초`;
    
    // 마지막 메시지가 있으면 그 앞에 타이머 표시, 없으면 새로 생성
    if (lastUpdateMsg) {
      updateProgressStep(`⏱️ ${lastUpdateMsg}... ${timeStr} 경과`);
    } else {
      updateProgressStep(`⏱️ 생성 중... ${timeStr} 경과`);
    }
  }, 1000);

  try {
    // 진행 콜백 래퍼 - 타이머 메시지 업데이트를 위해 lastUpdateMsg 저장
    const progressCallback = (msg) => {
      lastUpdateMsg = msg;
      addProgressStep(msg);
    };

    const { uuid, meta, html } = await window.KivosyFactory.createAppFromPrompt(
      prompt,
      apiKeys,
      progressCallback
    );

    clearInterval(timerInterval);
    _lastUUID = uuid;
    _lastHTML = html;

    // 미리보기
    const iframe = document.getElementById('result-preview');
    const blob = new Blob([html], { type: 'text/html' });
    iframe.src = URL.createObjectURL(blob);

    // 메타 정보
    document.getElementById('result-meta').textContent =
      `앱 ID: ${uuid.slice(0, 8)}  |  크기: ${meta.sizeKB}KB  |  생성: ${new Date(meta.createdAt).toLocaleString('ko-KR')}`;

    resultEl.style.display = 'block';
    resultEl.scrollIntoView({ behavior: 'smooth' });

    updateQuotaDisplay();
    renderAppHistory();

  } catch (err) {
    clearInterval(timerInterval);
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
    addProgressStep('❌ 실패: ' + err.message);
    console.error('Generation error:', err);
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
    btnText.textContent = '⚡ 앱 생성하기';
  }
}

// ── App Actions ─────────────────────────────────────────────
function handleOpenApp() {
  if (_lastUUID) window.KivosyFactory.openGeneratedApp(_lastUUID);
}

function handleCopyCode() {
  if (!_lastHTML) return;
  navigator.clipboard.writeText(_lastHTML).then(() => {
    const btn = document.getElementById('result-copy-btn');
    const orig = btn.textContent;
    btn.textContent = '✅ 복사됨!';
    setTimeout(() => (btn.textContent = orig), 1500);
  });
}

function handleDeleteApp() {
  if (!_lastUUID) return;
  if (!confirm('이 앱을 삭제할까요?')) return;
  window.KivosyFactory.AppStorage.delete(_lastUUID);
  _lastUUID = null;
  _lastHTML = null;
  document.getElementById('factory-result').style.display = 'none';
  renderAppHistory();
  updateQuotaDisplay();
}

// ── History Management ──────────────────────────────────────
// renderAppHistory 함수 수정 (약 180번째 줄)
function renderAppHistory() {
  const list = document.getElementById('app-history-list');
  if (!list || !window.KivosyFactory) return;
  const apps = window.KivosyFactory.AppStorage.getIndex();
  if (apps.length === 0) {
    list.innerHTML = '<div class="history-empty">아직 생성된 앱이 없습니다.</div>';
    return;
  }
  list.innerHTML = apps.map(app => `
    <div class="history-item">
      <div class="history-item-info">
        <div class="history-item-prompt" title="${app.prompt}">${app.prompt}</div>
        <div class="history-item-meta">
          ID: ${app.uuid.slice(0, 8)} &nbsp;|&nbsp;
          ${app.sizeKB}KB &nbsp;|&nbsp;
          ${new Date(app.createdAt).toLocaleString('ko-KR')}
        </div>
      </div>
      <div class="history-item-actions">
        <button class="history-action-btn h-open" onclick="window.KivosyFactory.openGeneratedApp('${app.uuid}')">🚀 열기</button>
        <button class="history-action-btn h-open" onclick="loadAppToChat('${app.uuid}')">💬 채팅으로 열기</button>
        <button class="history-action-btn h-del" onclick="deleteHistoryApp('${app.uuid}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

// 기존 앱을 채팅창에 로드하는 함수 추가
function loadAppToChat(uuid) {
  const html = window.KivosyFactory.AppStorage.get(uuid);
  if (!html) {
    alert('앱을 찾을 수 없습니다.');
    return;
  }
  
  // 앱 메타데이터 가져오기
  const apps = window.KivosyFactory.AppStorage.getIndex();
  const app = apps.find(a => a.uuid === uuid);
  
  _lastUUID = uuid;
  _lastHTML = html;
  
  // 미리보기 업데이트
  const iframe = document.getElementById('result-preview');
  const blob = new Blob([html], { type: 'text/html' });
  iframe.src = URL.createObjectURL(blob);
  
  // 메타 정보 업데이트
  if (app) {
    document.getElementById('result-meta').textContent =
      `앱 ID: ${uuid.slice(0, 8)}  |  크기: ${app.sizeKB}KB  |  생성: ${new Date(app.createdAt).toLocaleString('ko-KR')}`;
  }
  
  // 채팅 메시지 초기화
  const chatContainer = document.getElementById('chat-messages');
  if (chatContainer) {
    chatContainer.innerHTML = `
      <div class="chat-message system" style="background: #e8f0fe; padding: 8px 12px; border-radius: 12px; font-size: 13px; color: #1a1a1a; align-self: flex-start; max-width: 85%;">
        기존 앱을 불러왔습니다. 수정할 내용을 입력해 주세요.
      </div>
    `;
  }
  
  // 결과 영역 표시
  document.getElementById('factory-result').style.display = 'block';
  document.getElementById('factory-result').scrollIntoView({ behavior: 'smooth' });
}

// ── DOM Ready Initialization ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 초기 로드시 할당량 표시
  setTimeout(updateQuotaDisplay, 100);
  renderAppHistory();
});


// ============================================================
// 채팅 관련 함수들 (factory-ui.js 하단에 추가)
// ============================================================

// 채팅 메시지 저장 (앱별로)
let _chatHistory = [];

// 채팅 전송
async function sendChat() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    
    if (!_lastUUID) {
        alert('수정할 앱이 없습니다.');
        return;
    }
    
    // 사용자 메시지 추가
    addChatMessage('user', message);
    input.value = '';
    
    // 시스템 메시지 (로딩)
    const loadingMsg = addChatMessage('system', '⏳ AI가 앱을 수정 중입니다...', true);
    
    try {
        // 현재 앱 HTML 가져오기
        const currentHtml = _lastHTML || window.KivosyFactory.AppStorage.get(_lastUUID);
        
        // API 키 가져오기
        const apiKeys = getApiKeys();
        
        // 수정 프롬프트 생성
        const modifyPrompt = `다음 HTML 앱을 수정해주세요.\n\n요청: ${message}\n\n현재 HTML:\n${currentHtml}`;
        
        // AI 호출
        const newHtml = await window.KivosyFactory.createAppFromPrompt(
            modifyPrompt,
            apiKeys,
            (msg) => console.log('Modify progress:', msg)
        );
        
        // 로딩 메시지 제거
        if (loadingMsg) loadingMsg.remove();
        
        // 새 HTML 저장
        _lastHTML = newHtml.html;
        window.KivosyFactory.AppStorage.save(_lastUUID, newHtml.html, `수정: ${message}`);
        
        // 미리보기 업데이트
        const iframe = document.getElementById('result-preview');
        const blob = new Blob([newHtml.html], { type: 'text/html' });
        iframe.src = URL.createObjectURL(blob);
        
        // 성공 메시지
        addChatMessage('system', '✅ 앱이 수정되었습니다!');
        
    } catch (err) {
        // 로딩 메시지 제거
        if (loadingMsg) loadingMsg.remove();
        addChatMessage('system', `❌ 오류: ${err.message}`);
        console.error('Chat error:', err);
    }
}

// 채팅 메시지 추가
function addChatMessage(type, text, isLoading = false) {
    const container = document.getElementById('chat-messages');
    if (!container) return null;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${type}`;
    msgDiv.style.cssText = `
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 13px;
        max-width: 85%;
        word-break: break-word;
        ${type === 'user' 
            ? 'background: #6366f1; color: white; align-self: flex-end;' 
            : 'background: #e8f0fe; color: #1a1a1a; align-self: flex-start;'
        }
        ${isLoading ? 'opacity: 0.7;' : ''}
    `;
    msgDiv.textContent = text;
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    
    return msgDiv;
}

// 미리보기 새로고침
function refreshPreview() {
    if (!_lastHTML) return;
    const iframe = document.getElementById('result-preview');
    const blob = new Blob([_lastHTML], { type: 'text/html' });
    iframe.src = URL.createObjectURL(blob);
}

// 전체화면 토글
function togglePreviewSize() {
    const container = document.querySelector('.split-layout');
    if (container) {
        if (container.style.position === 'fixed') {
            // 원래대로
            container.style.position = '';
            container.style.top = '';
            container.style.left = '';
            container.style.width = '';
            container.style.height = '';
            container.style.zIndex = '';
            container.style.background = '';
        } else {
            // 전체화면
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.zIndex = '10000';
            container.style.background = 'white';
        }
    }
}

// handleFactoryGenerate 함수 내에서 채팅 초기화 추가
// (기존 handleFactoryGenerate 함수의 try 블록 내에 추가)
/*
// 앱 생성 성공 후 채팅 초기화
_lastUUID = uuid;
_lastHTML = html;
_chatHistory = [];  // 채팅 히스토리 초기화

// 채팅 메시지 컨테이너 초기화
const chatContainer = document.getElementById('chat-messages');
if (chatContainer) {
    chatContainer.innerHTML = `
        <div class="chat-message system" style="background: #e8f0fe; padding: 8px 12px; border-radius: 12px; font-size: 13px; color: #1a1a1a; align-self: flex-start; max-width: 85%;">
            앱이 생성되었습니다. 수정할 내용을 입력해 주세요.
        </div>
    `;
}
*/