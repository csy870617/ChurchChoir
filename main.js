import { escapeInAppBrowser, toggleBoard, toggleIntegrated, openModalWithHistory, closeModalWithHistory } from "./utils.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./config.js";
import { createGroup, boardLogin, boardLogout, inviteMember } from "./auth.js";
import { showWriteForm, showBoardList, savePost, tryDeletePost, tryEditPost, loadPosts } from "./board.js";
import { 
    loadShortcutLinks, openShortcutLink, openShortcutManager, configureShortcut, clearShortcut, removeLink, searchAndSetLink, 
    openDirectLink, loadPartLinks, openPartLinkModal, searchGroupLinks, searchSharedLinks, applySharedData, reportSharedLink, 
    savePartLink, sharePartLink, removePartLink, handleLinkClick, refreshShortcutManager, 
    closePartLinkModal, closeShortcutManager, closeLinkActionModal, openPlayModal, closePlayModal, 
    openPartManager, closePartManager, configurePart, clearPart, sendErrorReport, syncLinksFromDB 
} from "./links.js"; 
import { searchAndRedirect } from "./search.js";

// --- 전역 함수 등록 ---
window.toggleBoard = toggleBoard;
window.toggleIntegrated = toggleIntegrated;
window.createGroup = createGroup;
window.boardLogin = boardLogin;
window.boardLogout = boardLogout;
window.inviteMember = inviteMember;
window.showWriteForm = showWriteForm;
window.showBoardList = showBoardList;
window.savePost = savePost;
window.tryDeletePost = tryDeletePost;
window.tryEditPost = tryEditPost;
window.loadShortcutLinks = loadShortcutLinks;
window.openShortcutLink = openShortcutLink;
window.openShortcutManager = openShortcutManager;
window.configureShortcut = configureShortcut;
window.clearShortcut = clearShortcut;
window.removeLink = removeLink;
window.searchAndSetLink = searchAndSetLink;
window.openDirectLink = openDirectLink;
window.openPartLinkModal = openPartLinkModal;
window.searchGroupLinks = searchGroupLinks;
window.searchSharedLinks = searchSharedLinks;
window.applySharedData = applySharedData;
window.reportSharedLink = reportSharedLink;
window.savePartLink = savePartLink;
window.sharePartLink = sharePartLink;
window.removePartLink = removePartLink;
window.handleLinkClick = handleLinkClick;
window.searchAndRedirect = searchAndRedirect;
window.loadMorePosts = () => loadPosts(true);

window.openPlayModal = openPlayModal;
window.closePlayModal = closePlayModal;
window.openPartManager = openPartManager;
window.closePartManager = closePartManager;
window.configurePart = configurePart;
window.clearPart = clearPart;
window.sendErrorReport = sendErrorReport; 

window.closeShortcutManager = closeShortcutManager;
window.closeLinkActionModal = closeLinkActionModal;
window.closePartLinkModal = closePartLinkModal;

// ✨ 초기화 이벤트 (순서 중요: 인증 -> 로직 실행)
window.addEventListener('DOMContentLoaded', () => {
    
    // 1. 먼저 익명 로그인을 시도합니다.
    signInAnonymously(auth).then(() => {
        console.log("Auth Success"); // 인증 성공!

        // 2. 인증이 성공한 후에야 DB 조회(로그인 시도)를 시작합니다.
        checkAndLogin();
        
        // 3. 로컬에 저장된 기본 링크 정보 로드 (화면 그리기용)
        loadShortcutLinks();
        loadPartLinks(); 

    }).catch((e) => {
        console.error("Auth Fail", e);
        alert("서버 연결에 실패했습니다. 인터넷 상태를 확인하거나 새로고침 해주세요.");
    });
});

// 키보드 이벤트
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        closeModalWithHistory();
    }
});

// ✨ 로그인 상태 체크 및 실행 함수 (분리됨)
function checkAndLogin() {
    // 1. URL 파라미터 확인 (매직 링크)
    const urlParams = new URLSearchParams(window.location.search);
    const linkChurch = urlParams.get('church');
    const linkPw = urlParams.get('pw');

    if (linkChurch && linkPw) {
        // 매직 링크 접속 시
        document.getElementById('login-church').value = linkChurch;
        document.getElementById('login-pw').value = linkPw;
        
        window.isMagicLogin = true; // 경고창 방지 플래그
        
        // 자동 로그인 시도
        boardLogin().then(() => {
            // 성공 시 주소창 깔끔하게 정리
            window.history.replaceState({}, document.title, window.location.pathname);
        });
        
    } else {
        // 2. 기존 저장된 정보 확인 (일반 접속)
        const remembered = localStorage.getItem('choir_remembered');
        if (remembered) {
            const { name, pw } = JSON.parse(remembered);
            document.getElementById('login-church').value = name;
            document.getElementById('login-pw').value = pw;
            document.getElementById('remember-me').checked = true;
        }

        const isAutoLogin = localStorage.getItem('choir_auto_login');
        if (isAutoLogin === 'true' && remembered) {
            document.getElementById('auto-login').checked = true;
            boardLogin(); 
        }
    }
}