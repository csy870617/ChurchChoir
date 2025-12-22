import { getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { groupsCollection } from "./config.js";
import { state } from "./state.js";
import { loadPosts } from "./board.js"; 
import { loadShortcutLinks, syncLinksFromDB } from "./links.js";

// ... (createGroup, boardLogin, boardLogout 기존 코드 유지 - 생략 없이 전체 코드 제공) ...

export async function createGroup() {
    const name = document.getElementById('login-church').value.trim();
    const pw = document.getElementById('login-pw').value.trim();
    if (!name || !pw) { alert("교회 이름과 비밀번호를 모두 입력한 후 버튼을 눌러주세요."); return; }
    try {
        const q = query(groupsCollection, where("churchName", "==", name), where("password", "==", pw));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) { alert("이미 존재하는 그룹입니다. 다른 아이디나 비밀번호를 입력해주세요."); return; }
        await addDoc(groupsCollection, { churchName: name, password: pw, createdAt: new Date().toISOString(), shortcuts: {}, partLinks: {} });
        alert(`'${name}' 그룹이 생성되었습니다! 이제 [로그인] 버튼을 눌러 입장하세요.`);
    } catch (e) { console.error(e); alert("그룹 생성 중 오류가 발생했습니다."); }
}

export async function boardLogin() {
    const inputName = document.getElementById('login-church').value.trim();
    const inputPw = document.getElementById('login-pw').value.trim();
    const rememberMe = document.getElementById('remember-me').checked;
    const autoLogin = document.getElementById('auto-login').checked;
    if (!inputName || !inputPw) { if (!rememberMe) { alert("정보를 입력해주세요."); return; } }
    try {
        const q = query(groupsCollection, where("churchName", "==", inputName), where("password", "==", inputPw));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) { 
            if(!localStorage.getItem('choir_auto_login') && !window.isMagicLogin) {
                alert("교회 이름 또는 비밀번호가 올바르지 않습니다.\n아직 그룹이 없다면 [그룹 만들기]를 먼저 해주세요.");
            }
            return; 
        }
        const groupDoc = querySnapshot.docs[0];
        const groupData = groupDoc.data();
        state.currentGroupId = groupDoc.id; 
        state.currentChurchName = groupData.churchName;
        state.currentLoginPw = inputPw; 
        if (rememberMe) localStorage.setItem('choir_remembered', JSON.stringify({ name: inputName, pw: inputPw }));
        else if (!autoLogin) localStorage.removeItem('choir_remembered');
        if (autoLogin) {
            localStorage.setItem('choir_auto_login', 'true');
            localStorage.setItem('choir_remembered', JSON.stringify({ name: inputName, pw: inputPw }));
            document.getElementById('remember-me').checked = true; 
        } else {
            localStorage.removeItem('choir_auto_login');
        }
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('main-content-section').style.display = 'block';
        const btnWrite = document.getElementById('btn-show-write');
        if(btnWrite) btnWrite.style.display = 'block';
        const boardModule = await import("./board.js");
        boardModule.loadPosts();
        syncLinksFromDB(groupData);
    } catch (e) { console.error(e); alert("로그인 중 오류가 발생했습니다."); }
}

export function boardLogout() {
    state.currentGroupId = null; state.currentChurchName = null; state.currentLoginPw = null; 
    localStorage.removeItem('choir_auto_login');
    document.getElementById('auto-login').checked = false;
    document.getElementById('main-content-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
    const btnWrite = document.getElementById('btn-show-write');
    if(btnWrite) btnWrite.style.display = 'none';
    window.history.replaceState({}, document.title, window.location.pathname);
}

// ✨ [완전 변경] 모바일 표준 공유 (가장 안정적)
export async function inviteMember() {
    let shareUrl = 'https://csy870617.github.io/ChurchChoir/';
    let title = '성가대 연습실';
    let text = '찬양곡 연습하러 오세요!';

    // 매직 링크 생성
    if (state.currentGroupId && state.currentChurchName && state.currentLoginPw) {
        const baseUrl = 'https://csy870617.github.io/ChurchChoir/';
        const params = `?church=${encodeURIComponent(state.currentChurchName)}&pw=${encodeURIComponent(state.currentLoginPw)}`;
        
        shareUrl = baseUrl + params;
        title = `[${state.currentChurchName} 성가대]`;
        text = `👇 링크를 누르면 자동으로 로그인됩니다.`;
    }

    // 1. 모바일 '공유하기' 패널 열기 (카톡, 문자 등 선택 가능)
    if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: text,
                url: shareUrl,
            });
            console.log("공유 성공");
        } catch (err) {
            // 사용자가 공유 창을 닫거나 취소한 경우 (에러 아님)
            if (err.name !== 'AbortError') {
                console.log('공유 실패:', err);
                copyToClipboard(shareUrl);
            }
        }
    } else {
        // 2. PC에서는 클립보드 복사
        copyToClipboard(shareUrl);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => alert("초대 링크가 복사되었습니다!\n카톡이나 문자에 '붙여넣기' 하세요."))
        .catch(() => prompt("이 링크를 복사해서 공유하세요:", text));
}