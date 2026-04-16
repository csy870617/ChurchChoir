import { getDocs, addDoc, updateDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { groupsCollection } from "./config.js";
import { state } from "./state.js";
import { loadShortcutLinks, syncLinksFromDB } from "./links.js";
import { hashPassword } from "./utils.js";

export async function createGroup() {
    const name = document.getElementById('login-church').value.trim();
    const pw = document.getElementById('login-pw').value.trim();
    if (!name || !pw) { alert("교회 이름과 비밀번호를 모두 입력한 후 버튼을 눌러주세요."); return; }
    try {
        const hashedPw = await hashPassword(pw);

        // 중복 확인: 해시된 비밀번호와 기존 평문 모두 검사 (마이그레이션 기간 대응)
        const q1 = query(groupsCollection, where("churchName", "==", name), where("password", "==", hashedPw));
        const q2 = query(groupsCollection, where("churchName", "==", name), where("password", "==", pw));
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        if (!snap1.empty || !snap2.empty) {
            alert("이미 존재하는 그룹입니다. 다른 아이디나 비밀번호를 입력해주세요.");
            return;
        }

        await addDoc(groupsCollection, {
            churchName: name,
            password: hashedPw, // 해시 저장
            createdAt: new Date().toISOString(),
            shortcuts: {},
            partLinks: {}
        });
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
        const hashedPw = await hashPassword(inputPw);
        let querySnapshot;
        let finalPasswordHash = hashedPw;

        if (window.isMagicLogin) {
            // 매직 링크: URL의 pw 값이 해시(신규)이거나 평문(구형)일 수 있음
            // 1차: 값을 그대로 사용 (신규 링크는 해시가 DB 해시와 일치)
            const q = query(groupsCollection, where("churchName", "==", inputName), where("password", "==", inputPw));
            querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                finalPasswordHash = inputPw; // URL의 값이 곧 DB의 해시
            } else {
                // 2차: URL에 평문이 있는 구형 링크 + 신규 DB(해시 저장)
                const q2 = query(groupsCollection, where("churchName", "==", inputName), where("password", "==", hashedPw));
                querySnapshot = await getDocs(q2);
                finalPasswordHash = hashedPw;
            }
        } else {
            // 일반 로그인: 입력값을 해시하여 조회
            const q = query(groupsCollection, where("churchName", "==", inputName), where("password", "==", hashedPw));
            querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                // 마이그레이션: 기존 평문 비밀번호가 저장된 그룹 처리
                const qPlain = query(groupsCollection, where("churchName", "==", inputName), where("password", "==", inputPw));
                querySnapshot = await getDocs(qPlain);
                if (!querySnapshot.empty) {
                    // 평문 → 해시로 자동 업그레이드
                    try {
                        await updateDoc(doc(groupsCollection, querySnapshot.docs[0].id), { password: hashedPw });
                    } catch (migrateErr) {
                        console.error("비밀번호 마이그레이션 실패:", migrateErr);
                    }
                }
            }
        }

        if (querySnapshot.empty) {
            if (!localStorage.getItem('choir_auto_login') && !window.isMagicLogin) {
                alert("교회 이름 또는 비밀번호가 올바르지 않습니다.\n아직 그룹이 없다면 [그룹 만들기]를 먼저 해주세요.");
            }
            return;
        }

        const groupDoc = querySnapshot.docs[0];
        const groupData = groupDoc.data();
        state.currentGroupId = groupDoc.id;
        state.currentChurchName = groupData.churchName;
        state.currentLoginPw = finalPasswordHash; // 해시를 state에 저장

        // 매직 링크 로그인은 로컬 저장 정보를 변경하지 않음
        if (!window.isMagicLogin) {
            if (rememberMe) {
                localStorage.setItem('choir_remembered', JSON.stringify({ name: inputName, pw: inputPw }));
            } else if (!autoLogin) {
                localStorage.removeItem('choir_remembered');
            }
            if (autoLogin) {
                localStorage.setItem('choir_auto_login', 'true');
                localStorage.setItem('choir_remembered', JSON.stringify({ name: inputName, pw: inputPw }));
                document.getElementById('remember-me').checked = true;
            } else {
                localStorage.removeItem('choir_auto_login');
            }
        }

        document.getElementById('login-section').style.display = 'none';
        document.getElementById('main-content-section').style.display = 'block';
        const btnWrite = document.getElementById('btn-show-write');
        if (btnWrite) btnWrite.style.display = 'block';

        const boardModule = await import("./board.js");
        boardModule.loadPosts();
        syncLinksFromDB(groupData);
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
    if (btnWrite) btnWrite.style.display = 'none';
    window.history.replaceState({}, document.title, window.location.pathname);
}

export async function inviteMember() {
    let shareUrl = 'https://csy870617.github.io/ChurchChoir/';
    let title = '성가대 연습실';
    let text = '찬양곡 연습하러 오세요!';

    if (state.currentGroupId && state.currentChurchName && state.currentLoginPw) {
        const baseUrl = 'https://csy870617.github.io/ChurchChoir/';
        // state.currentLoginPw는 해시값이므로 평문 비밀번호 없이도 자동 로그인 가능
        const params = `?church=${encodeURIComponent(state.currentChurchName)}&pw=${encodeURIComponent(state.currentLoginPw)}`;
        shareUrl = baseUrl + params;
        title = `[${state.currentChurchName} 성가대]`;
        text = `👇 링크를 누르면 자동으로 로그인됩니다.`;
    }

    if (navigator.share) {
        try {
            await navigator.share({ title, text, url: shareUrl });
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Share failed:', err);
        }
    } else {
        copyToClipboard(shareUrl);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => alert("초대 링크가 복사되었습니다!\n카톡이나 문자에 '붙여넣기' 하세요."))
        .catch(() => prompt("이 링크를 복사해서 공유하세요:", text));
}
