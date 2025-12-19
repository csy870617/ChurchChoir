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

// 유튜브 URL 검사
export function isValidYoutubeUrl(url) {
    if (!url) return false; 
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    return regex.test(url);
}

// 링크 텍스트 변환
export function convertUrlsToLinks(text) {
    if (!text) return '';
    const urlRegex = /(\b(https?:\/\/[^\s]+|www\.[^\s]+))/g;
    return text.replace(urlRegex, function(url) {
        let fullUrl = url;
        if (!url.match(/^https?:\/\//i)) fullUrl = 'http://' + url;
        return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
}

// 클립보드 복사
export function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => { alert("링크가 복사되었습니다."); }).catch(err => { alert("복사 실패"); });
}

// 팝업 열기 (히스토리 추가)
export function openModalWithHistory(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
        el.style.display = 'flex';
        history.pushState({ modal: modalId }, null, null);
    }
}

// 팝업 닫기 (뒤로가기 실행)
export function closeModalWithHistory() {
    history.back(); 
}

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
    // state.js의 값을 가져오기 위해 main에서 주입받거나 단순 토글만 수행
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