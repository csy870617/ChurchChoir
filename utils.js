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
