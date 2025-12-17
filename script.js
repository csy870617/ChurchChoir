import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc, query, orderBy, where, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// -----------------------------------------------------------
// 1. 인앱 브라우저 탈출 및 설정
// -----------------------------------------------------------
function escapeInAppBrowser() {
    const userAgent = navigator.userAgent.toLowerCase();
    const targetUrl = location.href;
    if (userAgent.match(/kakaotalk|naver|instagram|fban|fbav|line/i)) {
        if (userAgent.match(/android/i)) {
            location.href = 'intent://' + targetUrl.replace(/https?:\/\//i, '') + '#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end';
        }
    }
}
escapeInAppBrowser();

const firebaseConfig = {
    apiKey: "AIzaSyBNh4M-nIOKOM5IdSerRFnoHHpyqNkfULA",
    authDomain: "churchchoir-a6099.firebaseapp.com",
    projectId: "churchchoir-a6099",
    storageBucket: "churchchoir-a6099.firebasestorage.app",
    messagingSenderId: "618743210216",
    appId: "1:618743210216:web:565f2c21b911840a26295d",
    measurementId: "G-2R5QJVR77G"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const groupsCollection = collection(db, "choir_groups"); 
const boardCollection = collection(db, "choir_posts");
const sharedLinksCollection = collection(db, "shared_links");
const groupLinksCollection = collection(db, "group_links"); 

// 전역 변수
let currentPostId = null;
let currentChurchName = null;
let currentGroupId = null;
let currentLinkSlot = null; 
let currentLoginPw = null; 
let currentPart = null; 
const partNames = { 'all': '전체', 'sop': '소프라노', 'alt': '알토', 'ten': '테너', 'bas': '베이스' };
let searchResultsCache = {}; 

// -----------------------------------------------------------
// 2. 유틸리티 및 뒤로가기 제어 (Popstate)
// -----------------------------------------------------------
function isValidYoutubeUrl(url) {
    if (!url) return false; 
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    return regex.test(url);
}

// ✨ 뒤로가기 이벤트 감지: 팝업이 열려있으면 닫기만 함
window.addEventListener('popstate', () => {
    const modals = [
        'selection-modal',
        'create-group-modal',
        'link-action-modal',
        'part-link-modal',
        'shortcut-manager-modal'
    ];
    modals.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
});

// ✨ 팝업 열기 헬퍼 (히스토리 추가)
function openModalWithHistory(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
        el.style.display = 'flex';
        history.pushState({ modal: modalId }, null, null);
    }
}

// ✨ 팝업 닫기 헬퍼 (뒤로가기 실행)
function closeModalWithHistory() {
    history.back(); // 뒤로가기를 실행하면 popstate 이벤트가 발생하여 팝업이 닫힘
}

// -----------------------------------------------------------
// 3. UI 및 기능 함수
// -----------------------------------------------------------

function toggleBoard(forceOpen = false) {
    const wrapper = document.getElementById('integrated-content-wrapper');
    const toggleIcon = document.getElementById('toggle-icon');
    const btnWrite = document.getElementById('btn-show-write');
    
    if (forceOpen || wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        toggleIcon.innerText = '▲';
        if (currentGroupId && btnWrite) { btnWrite.style.display = 'block'; }
    } else {
        wrapper.style.display = 'none';
        toggleIcon.innerText = '▼';
        if(btnWrite) btnWrite.style.display = 'none';
    }
}

function toggleManualLinks() {}

function toggleIntegrated(forceOpen = false) {
    toggleBoard(forceOpen);
}

function openDirectLink(part) {
    const linkData = localStorage.getItem(`partLink_${part}`);
    if (linkData) {
        const data = JSON.parse(linkData);
        if(data.url) window.open(data.url, '_blank');
        else alert('등록된 링크가 없습니다.\n[찬양곡 등록 / 수정] 버튼을 눌러 링크를 저장해주세요.');
    } else { alert('등록된 링크가 없습니다.\n[찬양곡 등록 / 수정] 버튼을 눌러 링크를 저장해주세요.'); }
}

async function inviteMember() {
    const shareData = { title: '[성가대 연습실] 찬양곡 미리듣기', text: '', url: 'https://csy870617.github.io/faiths/' };
    if (navigator.share) { try { await navigator.share(shareData); } catch (err) { if (err.name !== 'AbortError') copyToClipboard(shareData.url); } } else { copyToClipboard(shareData.url); }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => { alert("초대 링크가 복사되었습니다.\n카카오톡 등에 붙여넣기 하세요."); }).catch(err => { alert("링크 복사에 실패했습니다."); });
}

// --- Firebase ---
async function createGroup() {
    const name = document.getElementById('new-church-name').value.trim();
    const pw = document.getElementById('new-church-pw').value.trim();
    if (!name || !pw) { alert("이름과 비밀번호를 모두 입력해주세요."); return; }
    try {
        const q = query(groupsCollection, where("churchName", "==", name), where("password", "==", pw));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) { 
            alert("이미 동일한 이름과 비밀번호를 사용하는 그룹이 존재합니다. 비밀번호를 다르게 입력해주세요."); 
            return; 
        }
        await addDoc(groupsCollection, { churchName: name, password: pw, createdAt: new Date().toISOString() });
        alert(`'${name}' 그룹이 생성되었습니다! 로그인해주세요.`);
        closeModalWithHistory(); // ✨ 수정됨
    } catch (e) { alert("그룹 생성 중 오류가 발생했습니다."); }
}

async function boardLogin() {
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
            if(!localStorage.getItem('choir_auto_login')) alert("교회 이름 또는 비밀번호가 올바르지 않습니다.");
            return; 
        }

        const groupDoc = querySnapshot.docs[0];
        currentGroupId = groupDoc.id; 
        currentChurchName = groupDoc.data().churchName;
        currentLoginPw = inputPw; 
        
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
        
        loadShortcutLinks();
        loadPosts(); 
    } catch (e) { console.error(e); alert("로그인 중 오류가 발생했습니다."); }
}

function boardLogout() {
    currentGroupId = null; currentChurchName = null; currentLoginPw = null; 
    localStorage.removeItem('choir_auto_login');
    document.getElementById('auto-login').checked = false;
    document.getElementById('main-content-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
    const btnWrite = document.getElementById('btn-show-write');
    if(btnWrite) btnWrite.style.display = 'none';
}

function convertUrlsToLinks(text) {
    if (!text) return '';
    const urlRegex = /(\b(https?:\/\/[^\s]+|www\.[^\s]+))/g;
    return text.replace(urlRegex, function(url) {
        let fullUrl = url;
        if (!url.match(/^https?:\/\//i)) fullUrl = 'http://' + url;
        return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
}

async function loadPosts() {
    const listEl = document.getElementById('post-items');
    listEl.innerHTML = '<div class="empty-msg">데이터를 불러오는 중입니다...</div>';
    try {
        const q = query(boardCollection, where("groupId", "==", currentGroupId));
        const querySnapshot = await getDocs(q);
        let posts = [];
        
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        querySnapshot.forEach((docSnap) => { 
            const data = docSnap.data();
            const postDate = new Date(data.date);

            if (postDate < sixMonthsAgo) {
                deleteDoc(doc(db, "choir_posts", docSnap.id));
            } else {
                posts.push({ id: docSnap.id, ...data }); 
            }
        });

        posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        listEl.innerHTML = '';
        if (posts.length === 0) { listEl.innerHTML = '<div class="empty-msg">등록된 공지사항이 없습니다.</div>'; return; }
        posts.forEach(post => {
            const div = document.createElement('div');
            div.className = 'post-card';
            div.innerHTML = `
                <div class="post-header"><div class="post-title-group"><span class="post-title">${post.title}</span></div><div class="post-meta"><span>작성자: ${post.author}</span><span>${new Date(post.date).toLocaleDateString()}</span></div></div>
                <div class="post-body">${convertUrlsToLinks(post.content)}</div> 
                <div class="post-footer"><button onclick="tryEditPost('${post.id}')" class="btn-small btn-edit">수정</button><button onclick="tryDeletePost('${post.id}')" class="btn-small btn-delete">삭제</button></div>`;
            listEl.appendChild(div);
        });
    } catch (e) { listEl.innerHTML = '<div class="empty-msg">데이터 로딩 실패.</div>'; }
}

function showWriteForm() {
    document.getElementById('edit-mode-id').value = '';
    document.getElementById('write-title').value = '';
    document.getElementById('write-content').value = '';
    document.getElementById('write-author').value = '';
    document.getElementById('write-pw').value = '';
    document.getElementById('board-list').style.display = 'none';
    document.getElementById('btn-show-write').style.display = 'none';
    document.getElementById('board-write').style.display = 'block';
}

function showBoardList() {
    document.getElementById('board-write').style.display = 'none';
    document.getElementById('board-list').style.display = 'block';
    document.getElementById('btn-show-write').style.display = 'block';
    loadPosts(); 
}

async function savePost() {
    const id = document.getElementById('edit-mode-id').value;
    const title = document.getElementById('write-title').value.trim();
    const content = document.getElementById('write-content').value.trim();
    const author = document.getElementById('write-author').value.trim();
    const pw = document.getElementById('write-pw').value.trim();
    if (!title || !content || !author || !pw) { alert("모든 내용을 입력해주세요."); return; }
    try {
        const postData = { groupId: currentGroupId, churchName: currentChurchName, title: title, content: content, author: author, pw: pw, date: new Date().toISOString() };
        if (id) { await updateDoc(doc(db, "choir_posts", id), postData); alert("수정되었습니다."); } 
        else { await addDoc(boardCollection, postData); alert("등록되었습니다."); }
        showBoardList();
    } catch (e) { alert("저장 중 오류가 발생했습니다."); }
}

async function tryDeletePost(id) {
    const inputPw = prompt("게시글 삭제를 위해 비밀번호를 입력해주세요.");
    if (!inputPw) return; 
    try {
        const docRef = doc(db, "choir_posts", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().pw === inputPw) {
            await deleteDoc(docRef);
            loadPosts(); 
        } else { alert("비밀번호가 일치하지 않습니다."); }
    } catch (e) { console.error(e); }
}

async function tryEditPost(id) {
    const inputPw = prompt("게시글 수정을 위해 비밀번호를 입력해주세요.");
    if (!inputPw) return;
    try {
        const docRef = doc(db, "choir_posts", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().pw === inputPw) {
            const post = docSnap.data();
            document.getElementById('edit-mode-id').value = id;
            document.getElementById('write-title').value = post.title;
            document.getElementById('write-content').value = post.content;
            document.getElementById('write-author').value = post.author;
            document.getElementById('write-pw').value = post.pw;
            document.getElementById('board-list').style.display = 'none';
            document.getElementById('board-write').style.display = 'block';
        } else { alert("비밀번호가 일치하지 않습니다."); }
    } catch (e) { console.error(e); }
}

// --- 즐겨찾기 ---
function loadShortcutLinks() { for (let i = 1; i <= 3; i++) { const linkData = localStorage.getItem(`storedLink${i}`); updateLinkButton(i, linkData ? JSON.parse(linkData) : null); } }
function updateLinkButton(slot, data) { 
    const btn = document.getElementById(`btn-shortcut-${slot}`); 
    if (btn) { 
        btn.style.backgroundColor = '';
        btn.style.color = '';
        btn.style.borderColor = '';

        if (data && data.url) { 
            btn.innerText = data.title; 
            btn.classList.remove('unlinked'); 
        } else { 
            btn.innerText = `즐겨찾기 ${slot}`; 
            btn.classList.add('unlinked'); 
        } 
    } 
}
function openShortcutLink(slot) { const linkData = localStorage.getItem(`storedLink${slot}`); if (linkData) { const data = JSON.parse(linkData); window.open(data.url, '_blank'); } else { alert("등록된 곡이 없습니다.\n[⚙️ 등록/수정] 버튼을 눌러 곡을 등록해주세요."); } }
function openShortcutManager() { 
    refreshShortcutManager(); 
    openModalWithHistory('shortcut-manager-modal'); // ✨ 수정됨
}
function refreshShortcutManager() { for (let i = 1; i <= 3; i++) { const linkData = localStorage.getItem(`storedLink${i}`); const titleEl = document.getElementById(`manage-title-${i}`); if (linkData) { const data = JSON.parse(linkData); titleEl.innerText = data.title; titleEl.style.color = '#333'; } else { titleEl.innerText = "설정안됨"; titleEl.style.color = '#ccc'; } } }
function configureShortcut(slot) { 
    currentLinkSlot = slot; 
    document.getElementById('action-search-input').value = ''; 
    document.getElementById('action-search-message').style.display = 'none'; 
    openModalWithHistory('link-action-modal'); // ✨ 수정됨
}
function clearShortcut(slot) { if(confirm(`즐겨찾기 ${slot}번을 삭제하시겠습니까?`)) { localStorage.removeItem(`storedLink${slot}`); refreshShortcutManager(); loadShortcutLinks(); } }
function handleLinkClick(slot) {}
function removeLink() { 
    const inputPw = document.getElementById('action-link-pw').value.trim(); 
    if (!currentLoginPw) { alert("로그인 후 이용 가능합니다."); return; } 
    if (!inputPw || inputPw !== currentLoginPw) { alert("비밀번호가 일치하지 않습니다."); return; } 
    if(confirm(`정말 즐겨찾기 ${currentLinkSlot}을(를) 해제하시겠습니까?`)) { 
        localStorage.removeItem(`storedLink${currentLinkSlot}`); 
        document.getElementById('action-link-pw').value = ''; 
        updateLinkButton(currentLinkSlot, null); 
        refreshShortcutManager(); 
        closeModalWithHistory(); // ✨ 수정됨
    } 
}
function searchAndSetLink(form) { const userInput = form.setupQuery.value.trim(); document.getElementById('action-search-message').style.display = 'none'; if (!userInput) return false; const matches = performSearch(userInput); if (matches.length === 1) { saveLinkToStorage(currentLinkSlot, matches[0]); alert(`'${matches[0].title}' 곡이 즐겨찾기 ${currentLinkSlot}에 설정되었습니다.`); closeModalWithHistory(); refreshShortcutManager(); loadShortcutLinks(); } else if (matches.length > 1) { showSelectionPopup(matches, true); } else { document.getElementById('action-search-message').innerText = `"${userInput}"에 해당하는 곡을 찾을 수 없습니다.`; document.getElementById('action-search-message').style.display = 'block'; } return false; }
window.selectAndSetLink = function(match) { 
    saveLinkToStorage(currentLinkSlot, match); 
    alert(`'${match.title}' 곡이 즐겨찾기 ${currentLinkSlot}에 설정되었습니다.`); 
    closeModalWithHistory(); // ✨ 수정됨
    closeModalWithHistory(); // ✨ 2단계 닫기 (검색팝업 + 설정팝업) - 이 경우 selection 닫고 action 닫기
    refreshShortcutManager(); 
    loadShortcutLinks(); 
}
function saveLinkToStorage(slot, match) { const data = { title: match.title, url: match.url, collectionName: match.collectionName }; localStorage.setItem(`storedLink${slot}`, JSON.stringify(data)); }

// --- 파트 링크 ---
function loadPartLinks() { ['all', 'sop', 'alt', 'ten', 'bas'].forEach(part => { const linkData = localStorage.getItem(`partLink_${part}`); updatePartButton(part, linkData ? JSON.parse(linkData) : null); }); }
function updatePartButton(part, data) { const btn = document.getElementById(`btn-play-${part}`); if(btn) { if(data && data.url) btn.classList.remove('unlinked'); else btn.classList.add('unlinked'); } }
function openPartLinkModal(part) { 
    currentPart = part; 
    const linkData = localStorage.getItem(`partLink_${part}`); 
    const data = linkData ? JSON.parse(linkData) : null; 
    const partName = partNames[part]; 
    document.getElementById('part-modal-title').innerText = `${partName} 링크 설정`; 
    
    const titleInput = document.getElementById('part-link-title'); 
    const bookInput = document.getElementById('part-link-book'); 
    const extraInputs = document.getElementById('extra-part-inputs'); 
    const sharedSearchArea = document.getElementById('shared-search-area'); 
    const groupSearchArea = document.getElementById('group-search-area'); 

    if (extraInputs) { 
        if (part === 'all') { 
            titleInput.style.display = 'block'; 
            titleInput.value = data ? data.title : ''; 
            const allData = localStorage.getItem('partLink_all') ? JSON.parse(localStorage.getItem('partLink_all')) : null; 
            bookInput.value = (allData && allData.bookTitle) ? allData.bookTitle : ''; 
            bookInput.style.display = 'block'; 
            extraInputs.style.display = 'block'; 
            sharedSearchArea.style.display = 'block'; 
            
            if(currentGroupId) groupSearchArea.style.display = 'block';
            else groupSearchArea.style.display = 'none';

            document.getElementById('shared-search-input').value = '';
            document.getElementById('shared-search-msg').innerText = '';
            document.getElementById('shared-search-msg').style.display = 'none';
            document.getElementById('group-search-input').value = '';
            document.getElementById('group-search-msg').style.display = 'none';

            const parts = ['sop', 'alt', 'ten', 'bas']; 
            parts.forEach(p => { 
                const pData = localStorage.getItem(`partLink_${p}`); 
                const inputEl = document.getElementById(`part-link-url-${p}`); 
                if (inputEl) { inputEl.value = pData ? JSON.parse(pData).url : ''; } 
            }); 
        } else { 
            titleInput.style.display = 'none'; 
            bookInput.style.display = 'none'; 
            extraInputs.style.display = 'none'; 
            sharedSearchArea.style.display = 'none'; 
            groupSearchArea.style.display = 'none';
        } 
    } 
    document.getElementById('part-link-url').value = data ? data.url : ''; 
    openModalWithHistory('part-link-modal'); // ✨ 수정됨
}

// --- 검색 및 데이터 적용 ---
async function searchGroupLinks() { 
    const searchInput = document.getElementById('group-search-input').value.trim(); 
    const msgEl = document.getElementById('group-search-msg'); 
    if (!searchInput) { msgEl.innerText = "검색어를 입력해주세요."; msgEl.style.display = 'block'; return; } 
    if (!currentGroupId) { msgEl.innerText = "로그인이 필요합니다."; msgEl.style.display = 'block'; return; } 
    msgEl.innerText = "검색 중..."; msgEl.style.display = 'block'; 
    searchResultsCache = {}; 
    const normalizedTerm = searchInput.replace(/\s+/g, '').toLowerCase(); 
    try { 
        const q = query(groupLinksCollection, where("groupId", "==", currentGroupId), where("searchTitle", "==", normalizedTerm), limit(50)); 
        const querySnapshot = await getDocs(q); 
        if (querySnapshot.empty) { 
            msgEl.innerText = "저장된 곡이 없습니다."; 
        } else { 
            const results = {}; 
            querySnapshot.forEach(doc => { 
                const data = doc.data(); 
                const bookKey = data.bookTitle || "책 제목 없음"; 
                if (!results[bookKey] || new Date(data.updatedAt) > new Date(results[bookKey].updatedAt)) { 
                    results[bookKey] = { ...data, id: doc.id }; 
                } 
            }); 
            let listHtml = `<div class="shared-list-container">`; 
            Object.keys(results).forEach(key => { 
                const data = results[key]; 
                searchResultsCache[key] = data; 
                const safeKey = key.replace(/'/g, "\\'"); 
                const bookDisplay = data.bookTitle ? `[${data.bookTitle}]` : `[책 제목 없음]`; 
                const dateDisplay = new Date(data.updatedAt).toLocaleDateString(); 
                listHtml += `
                    <div class="shared-item">
                        <div class="shared-info">
                            <span class="shared-song-title">${data.title}</span>
                            <span class="shared-book-title">${bookDisplay}</span>
                            <span class="shared-date">${dateDisplay}</span>
                        </div>
                        <div class="shared-btn-group">
                            <button onclick="applySharedData('${safeKey}')" class="btn-select-data">선택</button>
                        </div>
                    </div>`; 
            }); 
            listHtml += `</div>`; 
            msgEl.innerHTML = listHtml; 
        } 
    } catch (error) { console.error(error); msgEl.innerText = "오류가 발생했습니다."; } 
}

async function searchSharedLinks() { 
    const searchInput = document.getElementById('shared-search-input').value.trim(); 
    const msgEl = document.getElementById('shared-search-msg'); 
    if (!searchInput) { msgEl.innerText = "검색어를 입력해주세요."; msgEl.style.display = 'block'; return; } 
    msgEl.innerText = "검색 중..."; msgEl.style.display = 'block'; 
    searchResultsCache = {}; 
    const normalizedTerm = searchInput.replace(/\s+/g, '').toLowerCase(); 
    try { 
        const q = query(sharedLinksCollection, where("searchTitle", "==", normalizedTerm), limit(50)); 
        const querySnapshot = await getDocs(q); 
        if (querySnapshot.empty) { 
            msgEl.innerText = "아직 등록된 곡이 없습니다."; 
        } else { 
            const results = {}; 
            querySnapshot.forEach(doc => { 
                const data = doc.data(); 
                const bookKey = data.bookTitle || "책 제목 없음"; 
                if (!results[bookKey] || new Date(data.updatedAt) > new Date(results[bookKey].updatedAt)) { 
                    results[bookKey] = { ...data, id: doc.id }; 
                } 
            }); 
            let listHtml = `<div class="shared-list-container">`; 
            Object.keys(results).forEach(key => { 
                const data = results[key]; 
                searchResultsCache[key] = data; 
                const safeKey = key.replace(/'/g, "\\'"); 
                const bookDisplay = data.bookTitle ? `[${data.bookTitle}]` : `[책 제목 없음]`; 
                const dateDisplay = new Date(data.updatedAt).toLocaleDateString(); 
                const docId = data.id; 
                
                listHtml += `
                    <div class="shared-item">
                        <div class="shared-info">
                            <span class="shared-song-title">${data.title}</span>
                            <span class="shared-book-title">${bookDisplay}</span>
                            <span class="shared-date">${dateDisplay}</span>
                        </div>
                        <div class="shared-btn-group">
                            <button onclick="applySharedData('${safeKey}')" class="btn-select-data">선택</button>
                            <button onclick="reportSharedLink('${docId}')" class="btn-report-data">🚨 신고</button>
                        </div>
                    </div>`; 
            }); 
            listHtml += `</div>`; 
            msgEl.innerHTML = listHtml; 
        } 
    } catch (error) { console.error("Error searching shared links:", error); msgEl.innerText = "검색 중 오류가 발생했습니다."; } 
}

function applySharedData(key) { 
    const data = searchResultsCache[key]; 
    if (!data) return; 
    document.getElementById('part-link-title').value = data.title; 
    document.getElementById('part-link-book').value = data.bookTitle || ''; 
    document.getElementById('part-link-url').value = data.urls.all || ''; 
    const parts = ['sop', 'alt', 'ten', 'bas']; 
    parts.forEach(p => { 
        const el = document.getElementById(`part-link-url-${p}`); 
        if(el) el.value = data.urls[p] || ''; 
    }); 
    const groupMsg = document.getElementById('group-search-msg'); 
    const sharedMsg = document.getElementById('shared-search-msg'); 
    if(groupMsg.style.display !== 'none') groupMsg.innerHTML = `<div style="color:var(--primary-color); font-weight:bold; margin-top:10px;">✅ 데이터가 적용되었습니다.<br>아래 [저장] 버튼을 꼭 눌러주세요.</div>`; 
    if(sharedMsg.style.display !== 'none') sharedMsg.innerHTML = `<div style="color:var(--primary-color); font-weight:bold; margin-top:10px;">✅ 데이터가 적용되었습니다.<br>아래 [저장] 버튼을 꼭 눌러주세요.</div>`; 
}

async function reportSharedLink(docId) {
    const reportedList = JSON.parse(localStorage.getItem('choir_reported_links') || '[]');
    if (reportedList.includes(docId)) {
        alert("이미 신고한 콘텐츠입니다.");
        return;
    }

    if(!confirm("이 콘텐츠를 신고하시겠습니까?\n부적절한 콘텐츠나 잘못된 링크인 경우 신고해주세요.\n(누적 3회 시 자동 삭제됩니다)")) return;
    
    try {
        const docRef = doc(db, "shared_links", docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const currentReports = (data.reportCount || 0) + 1;
            if (currentReports >= 3) {
                await deleteDoc(docRef);
                alert("신고가 누적되어 해당 데이터가 삭제되었습니다.");
                document.getElementById('shared-search-msg').innerHTML = "삭제되었습니다. 다시 검색해주세요.";
            } else {
                await updateDoc(docRef, { reportCount: currentReports });
                alert("신고가 접수되었습니다. (현재 누적: " + currentReports + "회)");
                
                reportedList.push(docId);
                localStorage.setItem('choir_reported_links', JSON.stringify(reportedList));
            }
        } else { alert("이미 삭제된 데이터입니다."); }
    } catch (e) { console.error(e); alert("신고 처리 중 오류가 발생했습니다."); }
}

async function savePartLink() { 
    const mainUrl = document.getElementById('part-link-url').value.trim(); 
    let title = ''; 
    let bookTitle = ''; 
    
    if (currentPart === 'all') { 
        title = document.getElementById('part-link-title').value.trim(); 
        bookTitle = document.getElementById('part-link-book').value.trim(); 
        if (!title) { alert("제목을 입력해야 합니다."); return; } 
        if (!isValidYoutubeUrl(mainUrl)) { alert("합창 링크는 유튜브 주소(youtube.com 또는 youtu.be)만 가능합니다."); return; }

        const allData = { url: mainUrl, title: title, bookTitle: bookTitle }; 
        localStorage.setItem('partLink_all', JSON.stringify(allData)); 
        const sharedUrls = { all: mainUrl }; 
        const parts = ['sop', 'alt', 'ten', 'bas']; 
        
        let invalidPart = false;
        parts.forEach(p => { 
            const inputEl = document.getElementById(`part-link-url-${p}`); 
            if (inputEl) { 
                const url = inputEl.value.trim(); 
                if (url) { 
                    if (!isValidYoutubeUrl(url)) { invalidPart = true; }
                    localStorage.setItem(`partLink_${p}`, JSON.stringify({ url: url, title: title })); 
                    sharedUrls[p] = url; 
                } else { sharedUrls[p] = ''; } 
            } 
        }); 
        
        if (invalidPart) { alert("파트별 링크도 유튜브 주소만 가능합니다. (저장은 되었으나 수정이 필요합니다)"); }

        if (currentGroupId) { 
            const searchTitle = title.replace(/\s+/g, '').toLowerCase(); 
            try { 
                const q = query(groupLinksCollection, where("groupId", "==", currentGroupId), where("searchTitle", "==", searchTitle), where("bookTitle", "==", bookTitle));
                const querySnapshot = await getDocs(q);

                const dataToSave = { 
                    groupId: currentGroupId, 
                    title: title, 
                    searchTitle: searchTitle, 
                    bookTitle: bookTitle, 
                    urls: sharedUrls, 
                    updatedAt: new Date().toISOString() 
                };

                if (!querySnapshot.empty) {
                    const docId = querySnapshot.docs[0].id;
                    await updateDoc(doc(db, "group_links", docId), dataToSave);
                } else {
                    await addDoc(groupLinksCollection, dataToSave);
                }
            } catch (e) { console.log("Group save failed:", e); } 
        } 
        alert("저장되었습니다! (우리 교회 목록에 자동 추가됨)"); 
        loadPartLinks(); 
        closeModalWithHistory(); // ✨ 수정됨
        return; 
    } else { 
        const allLinkData = localStorage.getItem('partLink_all'); 
        if (allLinkData) { title = JSON.parse(allLinkData).title; } else { title = partNames[currentPart]; } 
    } 
    
    if (!mainUrl) { alert("주소를 입력해주세요."); return; } 
    if (!isValidYoutubeUrl(mainUrl)) { alert("유튜브 주소(youtube.com 또는 youtu.be)만 가능합니다."); return; }

    const data = { url: mainUrl, title: title }; 
    localStorage.setItem(`partLink_${currentPart}`, JSON.stringify(data)); 
    loadPartLinks(); 
    alert(`${partNames[currentPart]} 설정이 저장되었습니다!`); 
    closeModalWithHistory(); // ✨ 수정됨
}

async function sharePartLink() { 
    if (currentPart !== 'all') { alert("전체 설정 모드에서만 공유할 수 있습니다."); return; } 
    const title = document.getElementById('part-link-title').value.trim(); 
    const bookTitle = document.getElementById('part-link-book').value.trim(); 
    const urlAll = document.getElementById('part-link-url').value.trim(); 
    if (!title || !bookTitle || !urlAll) { alert("제목, 책 제목, 합창 링크는 필수입니다."); return; } 
    if (!isValidYoutubeUrl(urlAll)) { alert("합창 링크가 유튜브 주소가 아닙니다."); return; }

    const sharedUrls = { all: urlAll }; 
    let missing = false; 
    let invalid = false;

    ['sop', 'alt', 'ten', 'bas'].forEach(p => { 
        const val = document.getElementById(`part-link-url-${p}`).value.trim(); 
        if (!val) missing = true; 
        else if (!isValidYoutubeUrl(val)) invalid = true;
        sharedUrls[p] = val; 
    }); 
    
    if (missing) { alert("모든 파트의 링크를 채워야 공유할 수 있습니다."); return; } 
    if (invalid) { alert("모든 링크는 유튜브 주소여야 합니다."); return; }

    if (!confirm("이 데이터를 다른 교회와 공유하시겠습니까?\n(정확한 정보만 공유해주세요)")) return; 
    const searchTitle = title.replace(/\s+/g, '').toLowerCase(); 
    
    try { 
        const q = query(sharedLinksCollection, where("searchTitle", "==", searchTitle), where("bookTitle", "==", bookTitle));
        const querySnapshot = await getDocs(q);

        const dataToSave = { 
            title: title, 
            searchTitle: searchTitle, 
            bookTitle: bookTitle, 
            urls: sharedUrls, 
            updatedAt: new Date().toISOString() 
        };

        if (!querySnapshot.empty) {
            const docId = querySnapshot.docs[0].id;
            await updateDoc(doc(db, "shared_links", docId), dataToSave);
        } else {
            dataToSave.reportCount = 0;
            await addDoc(sharedLinksCollection, dataToSave);
        }

        alert("성공적으로 공유되었습니다! 감사합니다."); 
    } catch (e) { console.error(e); alert("공유 중 오류가 발생했습니다."); } 
}

function removePartLink() { 
    if (!currentLoginPw) { alert("로그인 후 이용 가능합니다."); return; }
    const inputPw = prompt("삭제하시려면 비밀번호를 입력해주세요.");
    if (inputPw === null) return; 
    if (inputPw !== currentLoginPw) { alert("비밀번호가 일치하지 않습니다."); return; }

    if (currentPart === 'all') {
        const partsToRemove = ['all', 'sop', 'alt', 'ten', 'bas'];
        partsToRemove.forEach(p => { localStorage.removeItem(`partLink_${p}`); });
        document.getElementById('part-link-url').value = '';
        document.getElementById('part-link-title').value = '';
        document.getElementById('part-link-book').value = ''; 
        ['sop', 'alt', 'ten', 'bas'].forEach(p => { const el = document.getElementById(`part-link-url-${p}`); if(el) el.value = ''; });
    } else {
        localStorage.removeItem(`partLink_${currentPart}`);
    }
    
    loadPartLinks();
    closeModalWithHistory(); // ✨ 수정됨
}

function performSearch(userInput) { const normalizedInput = userInput.replace(/[\s\(\)\[\]!.]/g, '').toLowerCase(); const matches = []; if (typeof window.CONCISE_BOOK_DATA === 'undefined') { console.error('concise_data.js 로드 실패'); return []; } for (const book of window.CONCISE_BOOK_DATA) { const prefix = book[0]; const titles = book[1]; for (let i = 0; i < titles.length; i++) { const title = titles[i]; const normalizedTitle = title.replace(/[\s\(\)\[\]!.]/g, '').toLowerCase(); if (normalizedTitle.includes(normalizedInput)) { matches.push({ title: title, url: generateUrl(prefix, i + 1), collectionName: formatBookName(prefix) }); } } } return matches; }
function generateUrl(collection, index) { return `https://joongangart.kr/${collection}/${index.toString().padStart(2, '0')}/pop1.html`; }
function formatBookName(prefix) { if (prefix.startsWith('joongang')) return `중앙성가 Vol.${prefix.replace('joongang', '')}`; if (prefix.startsWith('best')) return `중앙성가 Best${prefix.replace('best', '')}`; if (prefix.startsWith('vision')) return `비전성가 Vol.${prefix.replace('vision', '')}`; if (prefix.startsWith('Glory_SAB')) return `영광의 혼성 3부 ${prefix.replace('Glory_SAB', '')}집`; if (prefix.startsWith('Men_JS_Vol')) return `남성 중앙성가 Vol.${prefix.replace('Men_JS_Vol', '')}`; if (prefix.startsWith('glorymans')) return `남성 영광 찬양`; if (prefix.startsWith('sight')) return `하나님의 시선 Vol.${prefix.replace('sight', '')}집`; if (prefix.startsWith('NewandJoyfulPraises')) return `새롭고 기쁜 찬양 Vol.${prefix.replace('NewandJoyfulPraises', '')}집`; if (prefix.startsWith('ShinSangWooArrange')) { const vol = prefix.replace('ShinSangWooArrange', ''); return vol === '1SSA' ? `신상우 편곡집 Vol.1 (SSA)` : `신상우 편곡집 Vol.${vol}집`; } return prefix.replace(/([A-Z])/g, ' $1').trim().replace(/_/g, ' '); }
window.openLink = function(url) { window.open(url, '_blank'); return false; }
function showSelectionPopup(matches, isSetupMode) { 
    // 중복 곡 선택 팝업도 모달처럼 동작하므로 히스토리 추가 필요
    openModalWithHistory('selection-modal'); // ✨ 수정됨
    const optionsList = document.getElementById('modal-options-list'); optionsList.innerHTML = ''; matches.forEach(match => { const item = document.createElement('div'); item.className = 'modal-option-item'; item.innerHTML = `<strong>${match.title}</strong><span>[${match.collectionName}] 버전으로 ${isSetupMode ? '선택' : '연결'}</span>`; item.onclick = () => { if (isSetupMode) { selectAndSetLink(match); } else { openLink(match.url); closeModalWithHistory(); } }; optionsList.appendChild(item); }); 
}

// ✨ 누락되었던 메인 검색창 함수 추가
function searchAndRedirect(form) {
    const userInput = form.query.value.trim();
    if (!userInput) return false;
    const matches = performSearch(userInput);
    if (matches.length === 0) {
        alert("검색 결과가 없습니다.");
    } else if (matches.length === 1) {
        window.open(matches[0].url, '_blank');
    } else {
        showSelectionPopup(matches, false);
    }
    return false;
}

// -----------------------------------------------------------
// 4. 전역 스코프 등록
// -----------------------------------------------------------
window.boardLogin = boardLogin;
window.boardLogout = boardLogout;
window.showWriteForm = showWriteForm;
window.showBoardList = showBoardList;
window.savePost = savePost;
window.tryDeletePost = tryDeletePost;
window.tryEditPost = tryEditPost;
window.handleLinkClick = handleLinkClick;
window.searchAndSetLink = searchAndSetLink;
window.removeLink = removeLink;
window.closeLinkActionModal = closeModalWithHistory; // ✨
window.openPartLinkModal = openPartLinkModal; 
window.closePartLinkModal = closeModalWithHistory; // ✨
window.savePartLink = savePartLink; 
window.removePartLink = removePartLink; 
window.openCreateGroupModal = () => { openModalWithHistory('create-group-modal'); }; // ✨
window.closeCreateGroupModal = closeModalWithHistory; // ✨
window.createGroup = createGroup;
window.inviteMember = inviteMember; 
window.toggleIntegrated = toggleIntegrated; 
window.toggleManualLinks = toggleManualLinks; 
window.openDirectLink = openDirectLink; 
window.openShortcutLink = openShortcutLink;
window.openShortcutManager = () => { 
    refreshShortcutManager(); 
    openModalWithHistory('shortcut-manager-modal'); // ✨
};
window.closeShortcutManager = closeModalWithHistory; // ✨
window.configureShortcut = configureShortcut;
window.clearShortcut = clearShortcut;
window.searchSharedLinks = searchSharedLinks;
window.searchGroupLinks = searchGroupLinks;
window.applySharedData = applySharedData;
window.sharePartLink = sharePartLink;
window.removePartLink = removePartLink; 
window.reportSharedLink = reportSharedLink;
window.searchAndRedirect = searchAndRedirect;

// -----------------------------------------------------------
// 5. 초기화 리스너 등록
// -----------------------------------------------------------
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
        // toggleBoard(true); // 자동로그인 시 안 펼침
        boardLogin(); 
    } else {
        // toggleBoard(true); // 처음엔 닫힘
    }

    loadShortcutLinks();
    loadPartLinks(); 
});

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        closeModalWithHistory();
    }
});