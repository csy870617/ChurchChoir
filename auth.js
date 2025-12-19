import { getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { groupsCollection } from "./config.js";
import { state } from "./state.js";
import { loadPosts } from "./board.js"; 
import { loadShortcutLinks } from "./links.js";

// ✨ 그룹 만들기 (확인 팝업 삭제, 문구 수정)
export async function createGroup() {
    const name = document.getElementById('login-church').value.trim();
    const pw = document.getElementById('login-pw').value.trim();
    
    if (!name || !pw) { 
        alert("교회 이름과 비밀번호를 모두 입력한 후 버튼을 눌러주세요."); 
        return; 
    }

    try {
        const q = query(groupsCollection, where("churchName", "==", name), where("password", "==", pw));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) { 
            // ✨ 수정된 문구
            alert("이미 존재하는 그룹입니다. 다른 아이디나 비밀번호를 입력해주세요."); 
            return; 
        }
        
        await addDoc(groupsCollection, { churchName: name, password: pw, createdAt: new Date().toISOString() });
        alert(`'${name}' 그룹이 생성되었습니다! 이제 [로그인] 버튼을 눌러 입장하세요.`);
        
    } catch (e) { 
        console.error(e);
        alert("그룹 생성 중 오류가 발생했습니다."); 
    }
}

export async function boardLogin() {
    const inputName = document.getElementById('login-church').value.trim();
    const inputPw = document.getElementById('login-pw').value.trim();
    const rememberMe = document.getElementById('remember-me').checked;
    const autoLogin = document.getElementById('auto-login').checked;

    if (!inputName || !inputPw) { 
        if (!rememberMe) { alert("정보를 입력해주세요."); return; }
    }

    try {
        const q = query(groupsCollection, where("churchName", "==", inputName), where("password", "==", inputPw));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) { 
            if(!localStorage.getItem('choir_auto_login')) alert("교회 이름 또는 비밀번호가 올바르지 않습니다.\n아직 그룹이 없다면 [그룹 만들기]를 먼저 해주세요.");
            return; 
        }

        const groupDoc = querySnapshot.docs[0];
        state.currentGroupId = groupDoc.id; 
        state.currentChurchName = groupDoc.data().churchName;
        state.currentLoginPw = inputPw; 
        
        if (rememberMe) localStorage.setItem('choir_remembered', JSON.stringify({ name: inputName, pw: inputPw }));
        else localStorage.removeItem('choir_remembered');

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
        
        const linksModule = await import("./links.js");
        linksModule.loadShortcutLinks();
    } catch (e) { console.error(e); alert("로그인 중 오류가 발생했습니다."); }
}

export function boardLogout() {
    state.currentGroupId = null; 
    state.currentChurchName = null; 
    state.currentLoginPw = null; 
    localStorage.removeItem('choir_auto_login');
    document.getElementById('auto-login').checked = false;
    document.getElementById('main-content-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
    const btnWrite = document.getElementById('btn-show-write');
    if(btnWrite) btnWrite.style.display = 'none';
}

export async function inviteMember() {
    const shareData = { title: '[성가대 연습실] 찬양곡 미리듣기', text: '', url: 'https://csy870617.github.io/faiths/' };
    if (navigator.share) { try { await navigator.share(shareData); } catch (err) { if (err.name !== 'AbortError') navigator.clipboard.writeText(shareData.url).then(() => alert("링크 복사 완료")); } } else { navigator.clipboard.writeText(shareData.url).then(() => alert("링크 복사 완료")); }
}