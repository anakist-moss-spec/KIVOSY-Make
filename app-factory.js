// ============================================================
// KIVOSY App Factory — app-factory.js
// Chief Claude Officer @ KIVOSY Factory
// ============================================================

// ── 보안 코어 (KIVOSY v4.2.0 Security Core) ──────────────────
const KivosySecurityCore = {
  // 위험 패턴 목록
  dangerousPatterns: [
    /\brm\s+-rf\b/i,
    /\bexec\s*\(/i,
    /\beval\s*\(/i,
    /document\.cookie/i,
    /localStorage\.getItem\s*\(\s*['"]kivosy_keys/i, // 다른 탭의 API 키 접근 차단
    /fetch\s*\(\s*['"](?!https:\/\/(cdn\.|fonts\.|cdnjs\.|unpkg\.|jsdelivr\.))/i,
    /XMLHttpRequest/i,
    /navigator\.sendBeacon/i,
    /window\.open\s*\(\s*['"](?!#)/i,
    /<script\s+src\s*=\s*['"](?!https:\/\/(cdn\.|fonts\.|cdnjs\.|unpkg\.|jsdelivr\.))/i,
    /atob\s*\(/i,
    /btoa\s*\(.*fetch/is,
  ],

  // 허용 CDN 화이트리스트
  allowedCDNs: [
    'cdn.jsdelivr.net',
    'unpkg.com',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.tailwindcss.com',
    'code.jquery.com',
    'stackpath.bootstrapcdn.com',
  ],

  validate(code) {
    const issues = [];

    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(code)) {
        issues.push(`위험 패턴 감지: ${pattern.toString().slice(0, 40)}...`);
      }
    }

    // 파일 크기 제한 (500KB)
    const sizeKB = new Blob([code]).size / 1024;
    if (sizeKB > 500) {
      issues.push(`파일 크기 초과: ${sizeKB.toFixed(1)}KB (최대 500KB)`);
    }

    return {
      safe: issues.length === 0,
      issues,
      sizeKB: sizeKB.toFixed(1),
    };
  },

  // 프롬프트 인젝션 감지
  detectPromptInjection(userInput) {
    const injectionPatterns = [
      /ignore previous instructions/i,
      /disregard.*system/i,
      /you are now/i,
      /새로운 역할/i,
      /이전 지시.*무시/i,
    ];
    return injectionPatterns.some((p) => p.test(userInput));
  },
};

// ── 일일 사용 제한 (Rate Limiter) ────────────────────────────
const RateLimiter = {
  MAX_PER_DAY: 10,
  KEY: 'kivosy_factory_usage',

  getUsage() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return { count: 0, date: this._today() };
      const data = JSON.parse(raw);
      if (data.date !== this._today()) return { count: 0, date: this._today() };
      return data;
    } catch {
      return { count: 0, date: this._today() };
    }
  },

  increment() {
    const usage = this.getUsage();
    usage.count++;
    localStorage.setItem(this.KEY, JSON.stringify(usage));
  },

  canGenerate() {
    return this.getUsage().count < this.MAX_PER_DAY;
  },

  remaining() {
    return Math.max(0, this.MAX_PER_DAY - this.getUsage().count);
  },

  _today() {
    return new Date().toISOString().slice(0, 10);
  },
};

// ── 앱 저장소 ────────────────────────────────────────────────
const AppStorage = {
  PREFIX: 'kivosy_app_',
  INDEX_KEY: 'kivosy_app_index',

  save(uuid, htmlCode, prompt) {
    const meta = {
      uuid,
      prompt: prompt.slice(0, 100),
      createdAt: new Date().toISOString(),
      sizeKB: (new Blob([htmlCode]).size / 1024).toFixed(1),
    };
    localStorage.setItem(this.PREFIX + uuid, htmlCode);
    // 인덱스 업데이트
    const index = this.getIndex();
    index.unshift(meta);
    if (index.length > 50) index.pop(); // 최대 50개 유지
    localStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
    return meta;
  },

  get(uuid) {
    return localStorage.getItem(this.PREFIX + uuid);
  },

  getIndex() {
    try {
      return JSON.parse(localStorage.getItem(this.INDEX_KEY) || '[]');
    } catch {
      return [];
    }
  },

  delete(uuid) {
    localStorage.removeItem(this.PREFIX + uuid);
    const index = this.getIndex().filter((a) => a.uuid !== uuid);
    localStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
  },
};

// ── UUID 생성 ─────────────────────────────────────────────────
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── AdSense 슬롯 삽입 ────────────────────────────────────────
function buildAdSenseSlot() {
  // 공장장님: 아래 data-ad-client와 data-ad-slot을 실제 AdSense 값으로 교체하세요
  return `
  <!-- KIVOSY AdSense -->
  <div style="text-align:center;margin:16px 0;">
    <ins class="adsbygoogle"
         style="display:block"
         data-ad-client="ca-pub-XXXXXXXXXXXXXXXXX"
         data-ad-slot="XXXXXXXXXX"
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  </div>`;
}

// ── KIVOSY 푸터 삽입 ─────────────────────────────────────────
function buildKivosyFooter(prompt, uuid) {
  return `
  <footer style="margin-top:40px;padding:16px;text-align:center;font-size:12px;color:#888;border-top:1px solid #eee;">
    ⚡ Made with <a href="https://lab.kivosy.com" target="_blank" style="color:#6366f1;text-decoration:none;font-weight:600;">KIVOSY Labs</a>
    &nbsp;|&nbsp; App ID: <code style="font-size:10px;">${uuid.slice(0, 8)}</code>
    &nbsp;|&nbsp; <span title="${prompt}">AI Generated</span>
  </footer>`;
}

// ── 코드 생성 프롬프트 템플릿 ────────────────────────────────
function buildSystemPrompt(userPrompt) {
  return `You are an expert frontend developer. Generate a COMPLETE, self-contained HTML page.

REQUIREMENTS:
- Single HTML file with embedded CSS and JavaScript
- No external dependencies EXCEPT CDN from: cdn.jsdelivr.net, unpkg.com, cdnjs.cloudflare.com, fonts.googleapis.com, cdn.tailwindcss.com
- Must work offline after initial CDN load
- Clean, modern, responsive UI
- Fully functional — not a mockup
- NO eval(), NO exec(), NO document.cookie, NO fetch to unknown domains
- Korean UI labels preferred if the app is for Korean users

USER REQUEST: "${userPrompt}"

Output ONLY raw HTML code. No markdown fences, no explanation, no comments outside the code.`;
}

// ── 생성된 코드에 KIVOSY 요소 주입 ──────────────────────────
function injectKivosyElements(rawHtml, prompt, uuid) {
  let html = rawHtml.trim();

  // </body> 바로 앞에 AdSense + 푸터 삽입
  const injection = buildAdSenseSlot() + buildKivosyFooter(prompt, uuid);
  const adSenseScript = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>`;

  if (html.includes('</body>')) {
    html = html.replace('</body>', `${injection}</body>`);
  } else {
    html += injection;
  }

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${adSenseScript}</head>`);
  }

  return html;
}

// ── 메인: 앱 생성 함수 ───────────────────────────────────────
async function createAppFromPrompt(userPrompt, apiKeys, onProgress) {
  // 1. 프롬프트 인젝션 검사
  if (KivosySecurityCore.detectPromptInjection(userPrompt)) {
    throw new Error('⚠️ 프롬프트 인젝션 시도가 감지되었습니다. 입력을 수정해 주세요.');
  }

  // 2. 일일 사용량 확인
  if (!RateLimiter.canGenerate()) {
    throw new Error(`⚠️ 오늘의 앱 생성 한도(${RateLimiter.MAX_PER_DAY}개)에 도달했습니다. 내일 다시 시도해 주세요.`);
  }

  onProgress?.('🤖 AI 앙상블에 코드 생성 요청 중...');

  // 3. 멀티모델 앙상블 — 가능한 모델 순서대로 시도
  let generatedCode = null;
  const systemPrompt = buildSystemPrompt(userPrompt);
  const errors = [];

  // Gemini 시도
  if (!generatedCode && apiKeys.gemini) {
    try {
      onProgress?.('✨ Gemini로 생성 시도 중...');
      generatedCode = await callGeminiForCode(apiKeys.gemini, systemPrompt);
    } catch (e) {
      errors.push(`Gemini: ${e.message}`);
    }
  }

  // Groq 시도 (Gemini 실패 시 폴백)
  if (!generatedCode && apiKeys.groq) {
    try {
      onProgress?.('⚡ Groq로 생성 시도 중...');
      generatedCode = await callGroqForCode(apiKeys.groq, systemPrompt);
    } catch (e) {
      errors.push(`Groq: ${e.message}`);
    }
  }

  if (!generatedCode) {
    throw new Error(`❌ 코드 생성 실패. 오류: ${errors.join(' / ')}\nGemini 또는 Groq API 키를 설정해 주세요.`);
  }

  // 마크다운 코드 펜스 제거
  generatedCode = cleanCodeOutput(generatedCode);

  // 4. 보안 검증
  onProgress?.('🔒 보안 검증 중 (KIVOSY Security Core v4.2.0)...');
  const validation = KivosySecurityCore.validate(generatedCode);
  if (!validation.safe) {
    throw new Error(`🚫 보안 검증 실패:\n${validation.issues.map((i) => '• ' + i).join('\n')}`);
  }

  // 5. KIVOSY 요소 주입
  const uuid = generateUUID();
  const finalHtml = injectKivosyElements(generatedCode, userPrompt, uuid);

  // 6. 저장
  onProgress?.('💾 앱 저장 중...');
  const meta = AppStorage.save(uuid, finalHtml, userPrompt);
  RateLimiter.increment();

  onProgress?.(`✅ 완료! 앱 ID: ${uuid.slice(0, 8)}`);

  return { uuid, meta, html: finalHtml };
}

// ============================================================
// lab.kivosy.com의 검증된 Gemini 함수 (그대로 복사)
// ============================================================
async function callGeminiForCode(apiKey, systemPrompt) {
    // lab의 모델명 사용
    const model = 'gemini-2.5-flash';  // ← lab과 동일!
    
    // lab의 URL 형식 사용
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    
    // lab의 payload 구조 사용
    const payload = {
        contents: [{
            parts: [{ text: systemPrompt }]
        }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        console.error('Gemini API Error:', e);
        throw e;  // 에러를 상위로 전달
    }
}

// ── Groq API 호출 ────────────────────────────────────────────
async function callGroqForCode(apiKey, systemPrompt) {
    const model = 'llama-3.3-70b-versatile';  // lab과 동일
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    
    const payload = {
        model: model,
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.2,
        max_tokens: 8192
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (e) {
        console.error('Groq API Error:', e);
        throw e;
    }
}

// ── 코드 출력 정제 (마크다운 펜스 제거) ─────────────────────
function cleanCodeOutput(raw) {
  return raw
    .replace(/^```html\n?/i, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

// ── 생성된 앱을 새 탭에서 열기 ──────────────────────────────
function openGeneratedApp(uuid) {
  const html = AppStorage.get(uuid);
  if (!html) {
    alert('앱을 찾을 수 없습니다.');
    return;
  }
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// 전역 export
window.KivosyFactory = {
  createAppFromPrompt,
  openGeneratedApp,
  AppStorage,
  RateLimiter,
  KivosySecurityCore,
};