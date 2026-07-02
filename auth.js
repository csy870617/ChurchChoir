import { getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { groupsCollection } from "./config.js";
import { state } from "./state.js";
import { hashPassword, openModalWithHistory, closeModalWithHistory, copyToClipboard } from "./utils.js";
import { loadPosts } from "./board.js";
import { loadSongs } from "./songs.js";

const SHARE_BASE_URL = 'https://csy870617.github.io/ChurchChoir/';

export function openRoomModal() {
    document.getElementById('room-church').value = '';
    document.getElementById('room-choir').value = '';
    document.getElementById('room-pw').value = '';
    openModalWithHistory('room-modal');
}

export function closeRoomModal() { closeModalWithHistory(); }

function readRoomInputs() {
    return {
        church: document.getElementById('room-church').value.trim(),
        choir: document.getElementById('room-choir').value.trim(),
        pw: document.getElementById('room-pw').value.trim()
    };
}

function buildRoomQuery(hashedPw, church, choir) {
    return query(
        groupsCollection,
        where("churchName", "==", church),
        where("choirName", "==", choir),
        where("password", "==", hashedPw)
    );
}

function applyRoomLogin(roomDoc) {
    const roomData = roomDoc.data();
    state.currentGroupId = roomDoc.id;
    state.currentChurchName = roomData.churchName;
    state.currentChoirName = roomData.choirName;
    state.currentLoginPw = roomData.password;

    document.getElementById('room-title-church').textContent = roomData.churchName;
    document.getElementById('room-title-choir').textContent = roomData.choirName;
    document.getElementById('btn-open-room').style.display = 'none';
    document.getElementById('room-section').style.display = 'block';

    loadPosts();
    loadSongs();
}

export async function createRoom() {
    const { church, choir, pw } = readRoomInputs();
    if (!church || !choir || !pw) { alert("교회 이름, 성가대 이름, 비밀번호를 모두 입력해주세요."); return; }

    try {
        const hashedPw = await hashPassword(pw);
        const snap = await getDocs(buildRoomQuery(hashedPw, church, choir));
        if (!snap.empty) {
            alert("이미 존재하는 연습실입니다. [입장하기]를 눌러주세요.");
            return;
        }

        await addDoc(groupsCollection, {
            churchName: church,
            choirName: choir,
            password: hashedPw,
            createdAt: new Date().toISOString()
        });
        alert(`'${church} ${choir}' 연습실이 생성되었습니다!\n[입장하기]를 눌러 입장하세요.`);
    } catch (e) {
        console.error(e);
        alert("연습실 생성 중 오류가 발생했습니다.");
    }
}

export async function loginRoom() {
    const { church, choir, pw } = readRoomInputs();
    if (!church || !choir || !pw) { alert("교회 이름, 성가대 이름, 비밀번호를 모두 입력해주세요."); return; }

    try {
        const hashedPw = await hashPassword(pw);
        const snap = await getDocs(buildRoomQuery(hashedPw, church, choir));
        if (snap.empty) {
            alert("일치하는 연습실이 없습니다.\n정보를 다시 확인하거나 [만들기]로 새로 만들어주세요.");
            return;
        }

        applyRoomLogin(snap.docs[0]);
        closeRoomModal();
    } catch (e) {
        console.error(e);
        alert("입장 중 오류가 발생했습니다.");
    }
}

// 초대 링크(?church=...&choir=...&pw=...)로 접속했을 때 자동 입장
export async function tryAutoLoginFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const church = params.get('church');
    const choir = params.get('choir');
    const pw = params.get('pw');
    if (!church || !choir || !pw) return;

    // 링크를 다시 열어도 중복 시도되지 않도록 주소창에서 즉시 제거
    history.replaceState({}, document.title, window.location.pathname);

    try {
        const snap = await getDocs(buildRoomQuery(pw, church, choir));
        if (snap.empty) {
            alert("초대 링크가 유효하지 않습니다. 성가대 대표에게 새 초대 링크를 요청해주세요.");
            return;
        }
        applyRoomLogin(snap.docs[0]);
    } catch (e) {
        console.error(e);
    }
}

export async function inviteMembers() {
    if (!state.currentGroupId || !state.currentChurchName || !state.currentChoirName || !state.currentLoginPw) {
        alert("연습실에 입장한 후 이용해주세요.");
        return;
    }

    const params = `?church=${encodeURIComponent(state.currentChurchName)}&choir=${encodeURIComponent(state.currentChoirName)}&pw=${encodeURIComponent(state.currentLoginPw)}`;
    const shareUrl = SHARE_BASE_URL + params;
    const title = `[${state.currentChurchName} ${state.currentChoirName}]`;
    const text = '링크를 누르면 자동으로 연습실에 입장돼요.';

    if (navigator.share) {
        try {
            await navigator.share({ title, text, url: shareUrl });
        } catch (err) {
            if (err.name !== 'AbortError') console.error('공유 실패:', err);
        }
    } else {
        copyToClipboard(shareUrl);
    }
}

export function logoutRoom() {
    state.currentGroupId = null;
    state.currentChurchName = null;
    state.currentChoirName = null;
    state.currentLoginPw = null;
    state.currentSongId = null;
    state.lastVisiblePost = null;
    state.lastVisibleSong = null;

    document.getElementById('room-section').style.display = 'none';
    document.getElementById('btn-open-room').style.display = 'inline-flex';
}
