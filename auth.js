import { getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { groupsCollection } from "./config.js";
import { state } from "./state.js";
import { loadPosts } from "./board.js"; 
import { loadShortcutLinks, syncLinksFromDB } from "./links.js";

// 그룹 만들기
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

// ✨ 카카오톡 공유하기 (이미지 테스트 버전)
export function inviteMember() {
    if (!Kakao.isInitialized()) {
        Kakao.init('c3fad3332df7403992db3c02afd081fa'); 
    }

    let shareUrl = 'https://csy870617.github.io/ChurchChoir/';
    let title = '성가대 연습실';
    let description = '찬양곡 연습하러 오세요!';
    
    if (state.currentGroupId && state.currentChurchName && state.currentLoginPw) {
        const baseUrl = 'https://csy870617.github.io/ChurchChoir/';
        const params = `?church=${encodeURIComponent(state.currentChurchName)}&pw=${encodeURIComponent(state.currentLoginPw)}`;
        
        shareUrl = baseUrl + params;
        title = `${state.currentChurchName} 성가대`;
        description = '👇 버튼을 누르면 자동으로 로그인됩니다.';
    }

    Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
            title: title,
            description: description,
            // ✨ [테스트] 카카오 라이언 이미지 (이게 나오면 코드는 정상, 목사님 파일이 문제임)
            imageUrl: 'https://k.kakaocdn.net/14/dn/btq831qcgZ/k87fHk0Kk9e97o9499p9k0/o.jpg',
            link: {
                mobileWebUrl: shareUrl,
                webUrl: shareUrl,
            },
        },
        buttons: [
            {
                title: '입장하기', 
                link: {
                    mobileWebUrl: shareUrl,
                    webUrl: shareUrl,
                },
            },
        ],
    });
}
