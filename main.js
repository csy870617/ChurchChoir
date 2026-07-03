import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./config.js";
import { closeModalWithHistory, escapeInAppBrowser, toggleCollapsible } from "./utils.js";
import { searchAndRedirect } from "./search.js";
import { toggleTheme } from "./theme.js";
import { openRoomModal, closeRoomModal, createRoom, loginRoom, logoutRoom, inviteMembers, tryAutoLoginFromUrl, tryAutoLoginFromStorage } from "./auth.js";
import { showWriteForm, showBoardList, savePost, deletePostFromForm, tryEditPost, loadMorePosts } from "./board.js";
import {
    closeSongModal,
    closePlayModal,
    openSongEditModal,
    openSongPlayModal,
    openDirectLink,
    saveSongLink,
    deleteSongLink,
    searchJoongangArt,
    searchMySongs
} from "./songs.js";

// 카카오톡/네이버/인스타그램 등 인앱 브라우저에서는 새 탭 열기 등이 제한될 수 있어 외부 브라우저로 유도
escapeInAppBrowser();

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await signInAnonymously(auth);
    } catch (e) {
        console.error("익명 로그인 실패:", e);
    }
    const cameFromInviteLink = await tryAutoLoginFromUrl();
    if (!cameFromInviteLink) {
        tryAutoLoginFromStorage();
    }
});

// --- 전역 함수 등록 ---
window.searchAndRedirect = searchAndRedirect;
window.toggleCollapsible = toggleCollapsible;
window.toggleTheme = toggleTheme;

window.openRoomModal = openRoomModal;
window.closeRoomModal = closeRoomModal;
window.createRoom = createRoom;
window.loginRoom = loginRoom;
window.logoutRoom = logoutRoom;
window.inviteMembers = inviteMembers;

window.showWriteForm = showWriteForm;
window.showBoardList = showBoardList;
window.savePost = savePost;
window.deletePostFromForm = deletePostFromForm;
window.tryEditPost = tryEditPost;
window.loadMorePosts = loadMorePosts;

window.closeSongModal = closeSongModal;
window.closePlayModal = closePlayModal;
window.openSongEditModal = openSongEditModal;
window.openSongPlayModal = openSongPlayModal;
window.openDirectLink = openDirectLink;
window.saveSongLink = saveSongLink;
window.deleteSongLink = deleteSongLink;
window.searchJoongangArt = searchJoongangArt;
window.searchMySongs = searchMySongs;

// 키보드 이벤트 (모달 닫기)
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        closeModalWithHistory();
    }
});
