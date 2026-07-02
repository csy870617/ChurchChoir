import { closeModalWithHistory, escapeInAppBrowser } from "./utils.js";
import { searchAndRedirect } from "./search.js";

// 카카오톡/네이버/인스타그램 등 인앱 브라우저에서는 새 탭 열기 등이 제한될 수 있어 외부 브라우저로 유도
escapeInAppBrowser();

// --- 전역 함수 등록 ---
window.searchAndRedirect = searchAndRedirect;

// 키보드 이벤트 (검색 결과 선택 팝업 닫기)
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        closeModalWithHistory();
    }
});
