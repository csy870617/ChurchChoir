import { escapeInAppBrowser, toggleBoard, toggleIntegrated, openModalWithHistory, closeModalWithHistory } from "./utils.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./config.js";
import { createGroup, boardLogin, boardLogout, inviteMember } from "./auth.js";
import { showWriteForm, showBoardList, savePost, tryDeletePost, tryEditPost } from "./board.js";
import { 
    loadShortcutLinks, openShortcutLink, openShortcutManager, configureShortcut, clearShortcut, removeLink, searchAndSetLink, 
    openDirectLink, loadPartLinks, openPartLinkModal, searchGroupLinks, searchSharedLinks, applySharedData, reportSharedLink, 
    savePartLink, sharePartLink, removePartLink, handleLinkClick, refreshShortcutManager, 
    closePartLinkModal, closeShortcutManager, closeLinkActionModal, openPlayModal, closePlayModal, 
    openPartManager, closePartManager, configurePart, clearPart, sendErrorReport, syncLinksFromDB 
} from "./links.js"; 
import { searchAndRedirect } from "./search.js";

// --- 익명 로그인 ---
signInAnonymously(auth).then(() => console.log("Auth Success")).catch((e) => console.error("Auth Fail", e));

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

// ✨ 찬양곡/오류신고 관련 함수 등록
window.openPlayModal = openPlayModal;
window.closePlayModal = closePlayModal;
window.openPartManager = openPartManager;
window.closePartManager = closePartManager;
window.configurePart = configurePart;
window.clearPart = clearPart;
window.sendErrorReport = sendErrorReport; 

// 모달 닫기 헬퍼들
window.closeShortcutManager = closeShortcutManager;
window.closeLinkActionModal = closeLinkActionModal;
window.closePartLinkModal = closePartLinkModal;

// --- 초기화 이벤트 ---
window.addEventListener('DOMContentLoaded', () => {
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

    loadShortcutLinks();
    loadPartLinks(); 
});

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        closeModalWithHistory();
    }
});