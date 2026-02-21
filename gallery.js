// ============================================================
// KIVOSY Make — gallery.js
// Gallery UI Controller Module
// ============================================================

// 전역 변수
let allApps = [];

// 갤러리 로드
function loadGallery() {
    const grid = document.getElementById('gallery-grid');
    
    if (!window.KivosyFactory?.AppStorage) {
        grid.innerHTML = `<div class="gallery-empty">앱 저장소를 불러올 수 없습니다.<br><a href="index.html">앱 만들기로 이동</a></div>`;
        return;
    }

    allApps = window.KivosyFactory.AppStorage.getIndex();
    
    // 통계 업데이트
    document.getElementById('app-count').textContent = allApps.length;
    
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = allApps.filter(app => app.createdAt.slice(0, 10) === today).length;
    document.getElementById('today-count').textContent = todayCount;

    renderGallery(allApps);
}

// 앱의 실제 미리보기 이미지 생성 (HTML을 이미지처럼 보이게)
function getAppPreviewHtml(uuid) {
    // 저장된 앱 HTML 가져오기
    const html = window.KivosyFactory.AppStorage.get(uuid);
    if (!html) return null;
    
    // HTML에서 body 내용만 추출 (간단한 파싱)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (!bodyMatch) return null;
    
    let bodyContent = bodyMatch[1];
    
    // 스타일 추출
    const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const styleContent = styleMatch ? styleMatch[1] : '';
    
    // 너무 길면 자르기 (미리보기용)
    if (bodyContent.length > 500) {
        bodyContent = bodyContent.substring(0, 500) + '...';
    }
    
    return {
        style: styleContent,
        body: bodyContent
    };
}

// 앱 타입 감지 (아이콘 및 설명용)
function detectAppType(prompt) {
    const prompt_lower = prompt.toLowerCase();
    
    if (prompt_lower.includes('할일') || prompt_lower.includes('todo') || prompt_lower.includes('task')) {
        return { 
            icon: '✅', 
            type: '할일 관리',
            color: '#3b82f6'
        };
    } else if (prompt_lower.includes('계산기') || prompt_lower.includes('calculator')) {
        return { 
            icon: '🧮', 
            type: '계산기',
            color: '#10b981'
        };
    } else if (prompt_lower.includes('날씨') || prompt_lower.includes('weather')) {
        return { 
            icon: '☀️', 
            type: '날씨 앱',
            color: '#f59e0b'
        };
    } else if (prompt_lower.includes('메모') || prompt_lower.includes('note')) {
        return { 
            icon: '📝', 
            type: '메모장',
            color: '#8b5cf6'
        };
    } else if (prompt_lower.includes('채팅') || prompt_lower.includes('chat')) {
        return { 
            icon: '💬', 
            type: '채팅 앱',
            color: '#ec4899'
        };
    } else if (prompt_lower.includes('아키텍처') || prompt_lower.includes('모놀리식') || prompt_lower.includes('마이크로서비스')) {
        return { 
            icon: '🏗️', 
            type: '아키텍처 문서',
            color: '#64748b'
        };
    } else {
        return { 
            icon: '📱', 
            type: '일반 앱',
            color: '#6366f1'
        };
    }
}

// 프롬프트에서 주요 기능 추출
function extractFeatures(prompt, maxFeatures = 2) {
    const features = [];
    
    if (prompt.includes('localStorage') || prompt.includes('저장')) {
        features.push('💾 저장');
    }
    if (prompt.includes('추가') || prompt.includes('add')) {
        features.push('➕ 추가');
    }
    if (prompt.includes('삭제') || prompt.includes('delete')) {
        features.push('🗑️ 삭제');
    }
    if (prompt.includes('완료') || prompt.includes('check')) {
        features.push('✅ 완료');
    }
    if (prompt.includes('수정') || prompt.includes('edit')) {
        features.push('✏️ 수정');
    }
    if (prompt.includes('검색') || prompt.includes('search')) {
        features.push('🔍 검색');
    }
    if (prompt.includes('필터') || prompt.includes('filter')) {
        features.push('🎯 필터');
    }
    
    return features.slice(0, maxFeatures);
}

// 갤러리 렌더링
function renderGallery(apps) {
    const grid = document.getElementById('gallery-grid');
    
    if (apps.length === 0) {
        grid.innerHTML = `
            <div class="gallery-empty">
                <div style="font-size: 48px; margin-bottom: 16px;">🏗️</div>
                <p style="margin-bottom: 20px;">아직 생성된 앱이 없습니다</p>
                <a href="index.html">첫 번째 앱 만들기 →</a>
            </div>`;
        return;
    }

    grid.innerHTML = apps.map(app => {
        // 날짜 포맷팅
        const date = new Date(app.createdAt);
        const dateStr = date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // 앱 타입 감지
        const appType = detectAppType(app.prompt);
        
        // 실제 앱 미리보기 가져오기
        const preview = getAppPreviewHtml(app.uuid);
        
        // 주요 기능 추출
        const features = extractFeatures(app.prompt);
        const featuresHtml = features.length > 0 
            ? `<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
                ${features.map(f => `<span class="feature-tag">${f}</span>`).join('')}
               </div>`
            : '';
        
        // 프롬프트 미리보기 (첫 줄만)
        const promptFirstLine = app.prompt.split('\n')[0];
        const promptPreview = promptFirstLine.length > 40 
            ? promptFirstLine.slice(0, 40) + '...' 
            : promptFirstLine;
        
        return `
        <div class="gallery-card">
            <!-- 실제 앱 미리보기 (iframe 대신 스타일링된 미리보기) -->
            <div class="app-preview" onclick="openApp('${app.uuid}')" style="cursor: pointer;">
                <div class="preview-header">
                    <span class="preview-dot" style="background: #ff5f56;"></span>
                    <span class="preview-dot" style="background: #ffbd2e;"></span>
                    <span class="preview-dot" style="background: #27c93f;"></span>
                    <span class="preview-title">앱 미리보기</span>
                </div>
                <div class="preview-content" style="font-family: system-ui, -apple-system, sans-serif;">
                    ${preview ? 
                        `<div style="font-size: 11px; color: #666; max-height: 120px; overflow: hidden; position: relative;">
                            ${preview.body.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 200)}...
                            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 40px; background: linear-gradient(transparent, white);"></div>
                         </div>` 
                        : 
                        `<div style="display: flex; align-items: center; justify-content: center; height: 80px; color: #999; font-size: 12px;">
                            ⚡ 앱을 실행해서 확인하세요
                        </div>`
                    }
                </div>
            </div>
            
            <!-- 앱 정보 -->
            <div style="padding: 16px 0 0;">
                <!-- 앱 헤더 -->
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <div style="width: 32px; height: 32px; background: ${appType.color}20; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                        ${appType.icon}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 15px; font-weight: 600; color: #1e293b;">${appType.type}</div>
                        <div style="font-size: 10px; color: #94a3b8;">🆔 ${app.uuid.slice(0, 8)}</div>
                    </div>
                </div>
                
                <!-- 프롬프트 -->
                <div class="card-prompt">
                    "${promptPreview}"
                </div>
                
                <!-- 기능 태그 -->
                ${featuresHtml}
                
                <!-- 메타 정보 -->
                <div class="card-meta">
                    <span>📅 ${dateStr}</span>
                    <span>📦 ${app.sizeKB}KB</span>
                </div>
                
                <!-- 액션 버튼 -->
                <div class="gallery-actions">
                    <button onclick="openApp('${app.uuid}')" class="gallery-btn primary">
                        🚀 실행
                    </button>
                    <button onclick="copyPrompt('${app.uuid}')" class="gallery-btn secondary" title="프롬프트 복사">
                        📋
                    </button>
                    <button onclick="deleteApp('${app.uuid}')" class="gallery-btn danger" title="삭제">
                        🗑️
                    </button>
                </div>
            </div>
        </div>
    `}).join('');
}

// 검색 필터
function filterGallery() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    if (!searchTerm) {
        renderGallery(allApps);
        return;
    }
    
    const filtered = allApps.filter(app => 
        app.prompt.toLowerCase().includes(searchTerm)
    );
    renderGallery(filtered);
}

// 앱 열기
function openApp(uuid) {
    window.KivosyFactory.openGeneratedApp(uuid);
}

// 프롬프트 복사
function copyPrompt(uuid) {
    const app = allApps.find(a => a.uuid === uuid);
    if (!app) return;
    
    navigator.clipboard.writeText(app.prompt).then(() => {
        showToast('✅ 프롬프트가 복사되었습니다!');
    }).catch(() => {
        // fallback
        const textarea = document.createElement('textarea');
        textarea.value = app.prompt;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('✅ 프롬프트가 복사되었습니다!');
    });
}

// 앱 삭제
function deleteApp(uuid) {
    if (!confirm('이 앱을 갤러리에서 삭제할까요?')) return;
    
    window.KivosyFactory.AppStorage.delete(uuid);
    loadGallery(); // 새로고침
    showToast('🗑️ 앱이 삭제되었습니다');
}

// 토스트 메시지
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 2500);
}

// 페이지 로드시 실행
document.addEventListener('DOMContentLoaded', loadGallery);