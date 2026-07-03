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

// 중앙아트(joongangart.kr) URL 검사
export function isValidJoongangArtUrl(url) {
    if (!url) return false;
    const regex = /^(https?:\/\/)?([a-z0-9-]+\.)*joongangart\.kr\/.+$/i;
    return regex.test(url);
}

// 합창 링크는 유튜브 또는 중앙아트 링크 둘 다 허용
export function isValidChoirLink(url) {
    return isValidYoutubeUrl(url) || isValidJoongangArtUrl(url);
}

// 프로토콜 없는 주소 보정 (window.open이 상대경로로 열리는 문제 방지)
export function normalizeUrl(url) {
    if (!url) return url;
    return /^https?:\/\//i.test(url) ? url : 'https://' + url;
}

// URL 끝에 붙은 문장부호(마침표, 쉼표, 닫는 괄호 등)는 링크에서 제외하고 본문 텍스트로 되돌림
// (괄호는 URL 안에 짝이 맞는 여는 괄호가 있으면 보존)
function trimTrailingPunctuation(url) {
    let trimmed = url.replace(/[.,!?;:'"]+$/, '');
    while (trimmed.endsWith(')')) {
        const openCount = (trimmed.match(/\(/g) || []).length;
        const closeCount = (trimmed.match(/\)/g) || []).length;
        if (closeCount > openCount) {
            trimmed = trimmed.slice(0, -1);
        } else {
            break;
        }
    }
    return trimmed;
}

// 링크 텍스트 변환 (XSS 방지: 텍스트는 이스케이프, URL만 링크로 변환)
export function convertUrlsToLinks(text) {
    if (!text) return '';
    // https?:// 로 시작하는 URL만 허용 (javascript: 등 차단)
    // 한글(자모/음절)이 공백 없이 바로 이어질 경우 URL이 거기서 끊기도록 제외 (예: "...com입니다")
    const urlRegex = /\bhttps?:\/\/[^\s"'<>ㄱ-ㆎ가-힣]+/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(escapeHtml(text.slice(lastIndex, match.index)));
        }
        const url = trimTrailingPunctuation(match[0]);
        parts.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`);
        lastIndex = match.index + url.length;
    }

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
    navigator.clipboard.writeText(text)
        .then(() => alert("초대 링크가 복사되었습니다!\n카톡이나 문자에 '붙여넣기' 하세요."))
        .catch(() => prompt("이 링크를 복사해서 공유하세요:", text));
}

// 이전에 입력했던 유튜브 링크를 기억해두었다가 다음 입력 시 자동완성으로 불러올 수 있게 함
const URL_HISTORY_KEY = 'choir_url_history';
const URL_HISTORY_MAX = 30;

export function addUrlToHistory(url) {
    if (!url) return;
    try {
        const list = getUrlHistory().filter(u => u !== url);
        list.unshift(url);
        localStorage.setItem(URL_HISTORY_KEY, JSON.stringify(list.slice(0, URL_HISTORY_MAX)));
    } catch (e) {}
}

export function getUrlHistory() {
    try {
        const raw = localStorage.getItem(URL_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}

// 이전에 입력했던 곡 제목을 기억해두었다가 다음 입력 시 자동완성으로 불러올 수 있게 함
const TITLE_HISTORY_KEY = 'choir_title_history';
const TITLE_HISTORY_MAX = 30;

export function addTitleToHistory(title) {
    if (!title) return;
    try {
        const list = getTitleHistory().filter(t => t !== title);
        list.unshift(title);
        localStorage.setItem(TITLE_HISTORY_KEY, JSON.stringify(list.slice(0, TITLE_HISTORY_MAX)));
    } catch (e) {}
}

export function getTitleHistory() {
    try {
        const raw = localStorage.getItem(TITLE_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}

// 입력란에 이전 기록 자동완성 드롭다운을 붙인다.
// 네이티브 <datalist>는 사파리(iOS 포함)에서 지원되지 않아 선택해도 값이 채워지지 않는 문제가 있어,
// 직접 만든 드롭다운으로 모든 브라우저에서 동일하게 동작하도록 한다.
export function attachAutocomplete(inputEl, getItems) {
    if (!inputEl || inputEl.dataset.autocompleteAttached) return;
    inputEl.dataset.autocompleteAttached = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete-wrapper';
    inputEl.parentElement.insertBefore(wrapper, inputEl);
    wrapper.appendChild(inputEl);

    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    dropdown.style.display = 'none';
    wrapper.appendChild(dropdown);

    function render() {
        const term = inputEl.value.trim().toLowerCase();
        const items = getItems().filter(v => !term || v.toLowerCase().includes(term)).slice(0, 8);

        dropdown.innerHTML = '';
        if (items.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        items.forEach(value => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = value;
            // blur보다 먼저 실행되도록 mousedown 단계에서 선택을 처리
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                inputEl.value = value;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
    }

    inputEl.addEventListener('focus', render);
    inputEl.addEventListener('input', render);
    inputEl.addEventListener('blur', () => {
        setTimeout(() => { dropdown.style.display = 'none'; }, 150);
    });
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

// 우클릭(데스크톱)/롱프레스(모바일)로 항목 관리 동작을 여는 헬퍼
// 짧은 탭/클릭은 onTap, 길게 누르거나 우클릭하면 onLongPress를 호출한다
export function bindPressActions(el, { onTap, onLongPress }) {
    const LONG_PRESS_MS = 550;
    let pressTimer = null;
    let longPressFired = false;

    const clearPressTimer = () => {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    };

    el.addEventListener('touchstart', () => {
        longPressFired = false;
        clearPressTimer();
        pressTimer = setTimeout(() => {
            longPressFired = true;
            onLongPress();
        }, LONG_PRESS_MS);
    }, { passive: true });

    el.addEventListener('touchmove', clearPressTimer);
    el.addEventListener('touchend', clearPressTimer);
    el.addEventListener('touchcancel', clearPressTimer);

    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // 모바일에서 롱프레스로 이미 처리된 제스처는 contextmenu로 중복 실행되지 않도록 방지
        if (longPressFired) { longPressFired = false; return; }
        onLongPress();
    });

    el.addEventListener('click', () => {
        if (longPressFired) { longPressFired = false; return; }
        onTap();
    });
}

// 선택 사항 섹션(파트별 링크 등)의 펼침 상태를 지정
export function setCollapsibleState(targetId, btnEl, open) {
    const target = document.getElementById(targetId);
    if (target) target.style.display = open ? 'block' : 'none';
    if (btnEl) {
        btnEl.classList.toggle('open', open);
        btnEl.textContent = (open ? '▾' : '▸') + btnEl.textContent.slice(1);
    }
}

// 선택 사항 섹션 펼치기/접기 (버튼 클릭용)
export function toggleCollapsible(targetId, btnEl) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const willOpen = target.style.display === 'none' || !target.style.display;
    setCollapsibleState(targetId, btnEl, willOpen);
}
