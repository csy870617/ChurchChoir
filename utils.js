// 인앱 브라우저 탈출
export function escapeInAppBrowser() {
    const userAgent = navigator.userAgent.toLowerCase();
    const targetUrl = location.href;
    if (userAgent.match(/kakaotalk|naver|instagram|fban|fbav|line/i)) {
        if (userAgent.match(/android/i)) {
            location.href = 'intent://' + targetUrl.replace(/https?:\/\//i, '') + '#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end';
        }
    }
}

// HTML 이스케이프 (XSS 방지)
export function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// SHA-256 비밀번호 해싱 (Web Crypto API)
export async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 유튜브 URL 검사 (m.youtube.com, music.youtube.com 등 서브도메인 허용)
export function isValidYoutubeUrl(url) {
    if (!url) return false;
    const regex = /^(https?:\/\/)?([a-z0-9-]+\.)*(youtube\.com|youtu\.be)\/.+$/i;
    return regex.test(url);
}

// 프로토콜 없는 주소 보정 (window.open이 상대경로로 열리는 문제 방지)
export function normalizeUrl(url) {
    if (!url) return url;
    return /^https?:\/\//i.test(url) ? url : 'https://' + url;
}

// 링크 텍스트 변환 (XSS 방지: 텍스트는 이스케이프, URL만 링크로 변환)
export function convertUrlsToLinks(text) {
    if (!text) return '';
    // https?:// 로 시작하는 URL만 허용 (javascript: 등 차단)
    const urlRegex = /\bhttps?:\/\/[^\s"<>]+/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
        // URL 앞의 일반 텍스트 이스케이프
        if (match.index > lastIndex) {
            parts.push(escapeHtml(text.slice(lastIndex, match.index)));
        }
        const url = match[0];
        parts.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`);
        lastIndex = match.index + url.length;
    }

    // 남은 텍스트 이스케이프
    if (lastIndex < text.length) {
        parts.push(escapeHtml(text.slice(lastIndex)));
    }

    return parts.join('');
}

// 클립보드 복사 (Clipboard API 미지원 환경 대비)
export function copyToClipboard(text) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
        prompt("이 링크를 복사해서 공유하세요:", text);
        return;
    }
    navigator.clipboard.writeText(text).then(() => { alert("링크가 복사되었습니다."); }).catch(() => { prompt("이 링크를 복사해서 공유하세요:", text); });
}

// 모달용 히스토리 항목은 항상 1개만 유지 (중첩 모달 + 연속 닫기 시 뒤로가기 중복 방지)
let modalStatePushed = false;

// 팝업 열기 (히스토리 추가)
export function openModalWithHistory(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
        el.style.display = 'flex';
        if (modalStatePushed) {
            history.replaceState({ modal: modalId }, '');
        } else {
            history.pushState({ modal: modalId }, '');
            modalStatePushed = true;
        }
    }
}

// 팝업 닫기 (여러 번 호출되어도 history.back은 최대 1회만 실행)
export function closeModalWithHistory() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(el => el.style.display = 'none');
    if (modalStatePushed) {
        modalStatePushed = false;
        if (history.state && history.state.modal) {
            history.back();
        }
    }
}

// 뒤로가기 이벤트 감지 (물리 버튼 대응)
window.addEventListener('popstate', () => {
    modalStatePushed = false;
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(el => el.style.display = 'none');
});

// UI 제어
export function toggleBoard(forceOpen = false, currentGroupId) {
    const wrapper = document.getElementById('integrated-content-wrapper');
    const toggleIcon = document.getElementById('toggle-icon');
    const btnWrite = document.getElementById('btn-show-write');

    if (forceOpen || wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        toggleIcon.innerText = '▲';
        if (currentGroupId && btnWrite) { btnWrite.style.display = 'block'; }
    } else {
        wrapper.style.display = 'none';
        toggleIcon.innerText = '▼';
        if(btnWrite) btnWrite.style.display = 'none';
    }
}

export function toggleIntegrated() {
    const wrapper = document.getElementById('integrated-content-wrapper');
    const toggleIcon = document.getElementById('toggle-icon');
    if (wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        toggleIcon.innerText = '▲';
    } else {
        wrapper.style.display = 'none';
        toggleIcon.innerText = '▼';
    }
}
