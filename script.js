import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- [1] 인앱 브라우저 탈출 로직 ---
function escapeInAppBrowser() {
    const userAgent = navigator.userAgent.toLowerCase();
    const targetUrl = location.href;

    if (userAgent.match(/kakaotalk|naver|instagram|fban|fbav|line/i)) {
        if (userAgent.match(/android/i)) {
            location.href = 'intent://' + targetUrl.replace(/https?:\/\//i, '') + '#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end';
        } else if (userAgent.match(/iphone|ipad|ipod/i)) {
            // iOS는 안내만 가능
        }
    }
}
escapeInAppBrowser();


// --- [2] Firebase 설정 ---
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

let currentPostId = null;
let currentChurchName = null;
let currentGroupId = null;
let currentLinkSlot = null; 
let currentLoginPw = null; 
let currentPart = null; 
const partNames = { 'all': '합창', 'sop': '소프라노', 'alt': '알토', 'ten': '테너', 'bas': '베이스' };

// 전역 함수 노출
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
window.closeLinkActionModal = () => { document.getElementById('link-action-modal').style.display = 'none'; };

window.openPartLinkModal = openPartLinkModal; 
window.closePartLinkModal = () => { document.getElementById('part-link-modal').style.display = 'none'; };
window.savePartLink = savePartLink; 
window.removePartLink = removePartLink; 

window.openCreateGroupModal = () => { document.getElementById('create-group-modal').style.display = 'flex'; };
window.closeCreateGroupModal = () => { document.getElementById('create-group-modal').style.display = 'none'; };
window.createGroup = createGroup;
window.inviteMember = inviteMember; 
window.toggleBoard = toggleBoard; 

// -----------------------------------------------------------
// 3. 초기화 및 이벤트 리스너
// -----------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
    const remembered = localStorage.getItem('choir_remembered');
    if (remembered) {
        const { name, pw } = JSON.parse(remembered);
        document.getElementById('login-church').value = name;
        document.getElementById('login-pw').value = pw;
        document.getElementById('remember-me').checked = true;
        
        toggleBoard(true); 
        boardLogin();
    }
    loadShortcutLinks();
    loadPartLinks(); 
});

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        document.getElementById('selection-modal').style.display = 'none';
        document.getElementById('create-group-modal').style.display = 'none';
        document.getElementById('link-action-modal').style.display = 'none';
        document.getElementById('part-link-modal').style.display = 'none';
    }
});

function toggleBoard(forceOpen = false) {
    const wrapper = document.getElementById('board-content-wrapper');
    const titleText = document.getElementById('board-title-text');
    const btnWrite = document.getElementById('btn-show-write');
    const btnLogout = document.getElementById('btn-logout');
    
    if (forceOpen || wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        titleText.innerHTML = '📢 성가대 공지사항 <span style="font-size:0.8em; color:#888;">▲</span>';
        
        if (currentGroupId) {
            btnWrite.style.display = 'block';
            btnLogout.style.display = 'block';
        }
    } else {
        wrapper.style.display = 'none';
        titleText.innerHTML = '📢 성가대 공지사항 <span style="font-size:0.8em; color:#888;">▼</span>';
        
        btnWrite.style.display = 'none';
        btnLogout.style.display = 'none';
    }
}


// -----------------------------------------------------------
// ✨ 초대(공유) 기능 수정
// -----------------------------------------------------------
async function inviteMember() {
    const shareData = {
        // 제목은 앱 이름으로 간단히 설정
        title: '성가대 연습실', 
        // 실제 전달될 메시지 본문
        text: '[성가대 연습실] 찬양곡 미리듣기',
        // 요청하신 깔끔한 URL
        url: 'https://csy870617.github.io/faiths/'
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            // 사용자가 공유 창을 닫거나 취소한 경우 에러 무시
            if (err.name !== 'AbortError') {
                copyToClipboard(shareData.url);
            }
        }
    } else {
        // PC 등 공유 기능 미지원 시 클립보드 복사
        copyToClipboard(shareData.url);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("초대 링크가 복사되었습니다.\n카카오톡 등에 붙여넣기 하세요.");
    }).catch(err => {
        alert("링크 복사에 실패했습니다. 주소창의 링크를 직접 복사해주세요.");
    });
}


// -----------------------------------------------------------
// 4. 그룹 및 로그인 로직
// -----------------------------------------------------------

async function createGroup() {
    const name = document.getElementById('new-church-name').value.trim();
    const pw = document.getElementById('new-church-pw').value.trim();

    if (!name || !pw) { alert("이름과 비밀번호를 모두 입력해주세요."); return; }

    try {
        const q = query(groupsCollection, where("churchName", "==", name), where("password", "==", pw));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            alert("이미 동일한 이름과 비밀번호를 사용하는 그룹이 존재합니다.\n비밀번호를 다르게 설정하거나 다른 이름을 사용해주세요.");
            return;
        }

        await addDoc(groupsCollection, {
            churchName: name,
            password: pw,
            createdAt: new Date().toISOString()
        });

        alert(`'${name}' 그룹이 생성되었습니다! 로그인해주세요.`);
        closeCreateGroupModal();
        document.getElementById('login-church').value = name;
        document.getElementById('login-pw').value = ''; 
    } catch (e) {
        console.error("Error creating group: ", e);
        alert("그룹 생성 중 오류가 발생했습니다.");
    }
}

async function boardLogin() {
    const inputName = document.getElementById('login-church').value.trim();
    const inputPw = document.getElementById('login-pw').value.trim();
    const rememberMe = document.getElementById('remember-me').checked;

    if (!inputName || !inputPw) { 
        if (!rememberMe) alert("정보를 입력해주세요."); 
        return; 
    }

    try {
        const q = query(groupsCollection, where("churchName", "==", inputName), where("password", "==", inputPw));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("교회 이름 또는 비밀번호가 올바르지 않습니다.");
            return;
        }

        const groupDoc = querySnapshot.docs[0];
        currentGroupId = groupDoc.id; 
        currentChurchName = groupDoc.data().churchName;
        currentLoginPw = inputPw; 
        
        if (rememberMe) {
            localStorage.setItem('choir_remembered', JSON.stringify({ name: inputName, pw: inputPw }));
        } else {
            localStorage.removeItem('choir_remembered');
        }

        document.getElementById('board-title-text').innerHTML = '📢 성가대 공지사항 <span style="font-size:0.8em; color:#888;">▲</span>'; 
        
        document.getElementById('board-login').style.display = 'none';
        document.getElementById('board-list').style.display = 'block';
        
        document.getElementById('btn-show-write').style.display = 'block';
        document.getElementById('btn-logout').style.display = 'block';
        
        loadPosts(); 

    } catch (e) {
        console.error("Login error: ", e);
        alert("로그인 중 오류가 발생했습니다.");
    }
}

function boardLogout() {
    currentGroupId = null;
    currentChurchName = null;
    currentLoginPw = null; 

    document.getElementById('board-list').style.display = 'none';
    document.getElementById('board-write').style.display = 'none';
    
    document.getElementById('btn-show-write').style.display = 'none';
    document.getElementById('btn-logout').style.display = 'none';
    
    document.getElementById('board-login').style.display = 'block';
}

function convertUrlsToLinks(text) {
    if (!text) return '';
    const urlRegex = /(\b(https?:\/\/[^\s]+|www\.[^\s]+))/g;
    
    return text.replace(urlRegex, function(url) {
        let fullUrl = url;
        if (!url.match(/^https?:\/\//i)) {
            fullUrl = 'http://' + url;
        }
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
        querySnapshot.forEach((doc) => {
            posts.push({ id: doc.id, ...doc.data() });
        });

        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        listEl.innerHTML = '';
        if (posts.length === 0) {
            listEl.innerHTML = '<div class="empty-msg">등록된 공지사항이 없습니다.</div>';
            return;
        }

        posts.forEach(post => {
            const dateStr = new Date(post.date).toLocaleDateString();
            const authorStr = `작성자: ${post.author}`;
            
            const linkedContent = convertUrlsToLinks(post.content);

            const div = document.createElement('div');
            div.className = 'post-card';
            div.innerHTML = `
                <div class="post-header">
                    <div class="post-title-group">
                        <span class="post-title">${post.title}</span>
                    </div>
                    <div class="post-meta">
                        <span>${authorStr}</span>
                        <span>${dateStr}</span>
                    </div>
                </div>
                <div class="post-body">${linkedContent}</div> 
                <div class="post-footer">
                    <span style="font-size:0.8em; color:#666;">관리:</span>
                    <input type="password" id="pw-${post.id}" class="post-input-pw" placeholder="비밀번호">
                    <button onclick="tryEditPost('${post.id}')" class="btn-small btn-edit">수정</button>
                    <button onclick="tryDeletePost('${post.id}')" class="btn-small btn-delete">삭제</button>
                </div>
            `;
            listEl.appendChild(div);
        });

    } catch (e) {
        console.error("Error loading posts: ", e);
        listEl.innerHTML = '<div class="empty-msg">데이터 로딩 실패.</div>';
    }
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

    if (!title || !content || !author || !pw) {
        alert("모든 내용을 입력해주세요.");
        return;
    }

    try {
        const postData = {
            groupId: currentGroupId, 
            churchName: currentChurchName,
            title: title,
            content: content,
            author: author,
            pw: pw,
            date: new Date().toISOString()
        };

        if (id) {
            const postRef = doc(db, "choir_posts", id);
            await updateDoc(postRef, postData);
            alert("수정되었습니다.");
        } else {
            await addDoc(boardCollection, postData);
            alert("등록되었습니다.");
        }
        showBoardList();
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("저장 중 오류가 발생했습니다.");
    }
}

async function tryDeletePost(id) {
    const inputPw = document.getElementById(`pw-${id}`).value.trim();
    if (!inputPw) { alert("비밀번호를 입력하세요."); return; }

    try {
        const docRef = doc(db, "choir_posts", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            if(docSnap.data().pw === inputPw) {
                if(confirm("정말 삭제하시겠습니까?")) {
                    await deleteDoc(docRef);
                    alert("삭제되었습니다.");
                    loadPosts(); 
                }
            } else {
                alert("비밀번호가 일치하지 않습니다.");
            }
        }
    } catch (e) {
        console.error("Error deleting post: ", e);
    }
}

async function tryEditPost(id) {
    const inputPw = document.getElementById(`pw-${id}`).value.trim();
    if (!inputPw) { alert("비밀번호를 입력하세요."); return; }

    try {
        const docRef = doc(db, "choir_posts", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const post = docSnap.data();
            if (post.pw === inputPw) {
                document.getElementById('edit-mode-id').value = id;
                document.getElementById('write-title').value = post.title;
                document.getElementById('write-content').value = post.content;
                document.getElementById('write-author').value = post.author;
                document.getElementById('write-pw').value = post.pw;

                document.getElementById('board-list').style.display = 'none';
                document.getElementById('board-write').style.display = 'block';
            } else {
                alert("비밀번호가 일치하지 않습니다.");
            }
        }
    } catch (e) {
        console.error("Error editing post: ", e);
    }
}

// -----------------------------------------------------------
// 2. 단축 링크 로직 (연습곡 1, 2)
// -----------------------------------------------------------

function loadShortcutLinks() {
    for (let i = 1; i <= 2; i++) {
        const linkData = localStorage.getItem(`storedLink${i}`);
        updateLinkButton(i, linkData ? JSON.parse(linkData) : null);
    }
}

function updateLinkButton(slot, data) {
    const btn = document.getElementById(`btn-link-${slot}`);
    
    if (data && data.url) {
        btn.innerText = data.title;
        btn.classList.remove('unlinked');
        btn.style.backgroundColor = 'var(--primary-green)'; 
    } else {
        // 문구 수정: 연습곡 등록 X
        btn.innerText = `연습곡 등록 ${slot}`; 
        btn.classList.add('unlinked');
        btn.style.backgroundColor = '';
    }
}

function handleLinkClick(slot) {
     openLinkActionModal(slot);
}

function openLinkActionModal(slot) {
    currentLinkSlot = slot;
    const linkData = localStorage.getItem(`storedLink${slot}`);
    const data = linkData ? JSON.parse(linkData) : null;
    
    document.getElementById('action-modal-title').innerText = `연습곡 ${slot}`;

    document.getElementById('action-search-input').value = '';
    document.getElementById('action-search-message').style.display = 'none';
    document.getElementById('action-link-pw').value = '';

    const statusContent = document.getElementById('current-link-status-content');
    
    if (data && data.title) {
        statusContent.innerHTML = `
            <strong onclick="window.open('${data.url}', '_blank')">${data.title}</strong>
        `;
        statusContent.classList.remove('unlinked');
    } else {
        statusContent.innerHTML = `
            <strong class="unlinked" style="cursor:default;">설정되지 않음</strong>
        `;
        statusContent.classList.add('unlinked');
    }
    
    document.getElementById('link-action-modal').style.display = 'flex';
}

function removeLink() {
    const inputPw = document.getElementById('action-link-pw').value.trim();
    
    if (!currentLoginPw) {
        alert("로그인 후 이용 가능합니다.");
        return;
    }
    
    if (!inputPw || inputPw !== currentLoginPw) {
        alert("비밀번호가 일치하지 않습니다.");
        document.getElementById('action-link-pw').value = '';
        return;
    }

    if(confirm(`정말 연습곡 ${currentLinkSlot}을(를) 제거하시겠습니까?`)) {
        localStorage.removeItem(`storedLink${currentLinkSlot}`);
        document.getElementById('action-link-pw').value = '';
        updateLinkButton(currentLinkSlot, null);
        alert(`연습곡 ${currentLinkSlot}이 제거되었습니다.`);
        closeLinkActionModal();
    }
}

function searchAndSetLink(form) {
    const userInput = form.setupQuery.value.trim();
    document.getElementById('action-search-message').style.display = 'none';

    if (!userInput) return false;

    const matches = performSearch(userInput);

    if (matches.length === 1) {
        saveLinkToStorage(currentLinkSlot, matches[0]);
        alert(`'${matches[0].title}' 곡이 연습곡 ${currentLinkSlot}에 설정되었습니다.`);
        closeLinkActionModal();
        loadShortcutLinks();
    } else if (matches.length > 1) {
        showSelectionPopup(matches, true); 
    } else {
        document.getElementById('action-search-message').innerText = 
            `"${userInput}"에 해당하는 곡을 찾을 수 없습니다.`;
        document.getElementById('action-search-message').style.display = 'block';
    }
    return false;
}

window.selectAndSetLink = function(match) {
    saveLinkToStorage(currentLinkSlot, match);
    alert(`'${match.title}' 곡이 연습곡 ${currentLinkSlot}에 설정되었습니다.`);
    
    document.getElementById('selection-modal').style.display = 'none';
    closeLinkActionModal();
    loadShortcutLinks();
}

function saveLinkToStorage(slot, match) {
    const data = {
        title: match.title,
        url: match.url,
        collectionName: match.collectionName
    };
    localStorage.setItem(`storedLink${slot}`, JSON.stringify(data));
}

// -----------------------------------------------------------
// 4. 파트별 링크 로직 (직접 입력)
// -----------------------------------------------------------

function loadPartLinks() {
    ['all', 'sop', 'alt', 'ten', 'bas'].forEach(part => {
        const linkData = localStorage.getItem(`partLink_${part}`);
        updatePartButton(part, linkData ? JSON.parse(linkData) : null);
    });
}

function updatePartButton(part, data) {
    const btn = document.getElementById(`btn-part-${part}`);
    if (!btn) return;

    const partName = partNames[part];
    
    btn.innerText = partName; 

    if (data && data.url) {
        btn.classList.remove('unlinked');
    } else {
        btn.classList.add('unlinked');
    }
}

function openPartLinkModal(part) {
    currentPart = part;
    const linkData = localStorage.getItem(`partLink_${part}`);
    const data = linkData ? JSON.parse(linkData) : null;
    const partName = partNames[part];

    document.getElementById('part-modal-title').innerText = `${partName} 파트 링크 설정`;
    
    const titleInput = document.getElementById('part-link-title');
    if (part === 'all') {
        titleInput.style.display = 'block';
        titleInput.value = data ? data.title : '';
    } else {
        titleInput.style.display = 'none';
    }
    
    document.getElementById('part-link-url').value = data ? data.url : '';
    document.getElementById('part-link-pw').value = '';

    const statusContent = document.getElementById('current-part-link-content');
    
    let displayTitle = '설정되지 않음';
    let displayUrl = '';
    let isLinked = false;

    if (data && data.title) {
        displayTitle = `${data.title} (${partName})`;
        displayUrl = data.url;
        isLinked = true;
    } else {
        const allLinkData = localStorage.getItem('partLink_all');
        const allData = allLinkData ? JSON.parse(allLinkData) : null;
        if (allData && allData.title) {
            displayTitle = `${allData.title} (${partName})`;
        }
    }

    if (isLinked || (displayTitle !== '설정되지 않음')) {
        if (displayUrl) {
            statusContent.innerHTML = `
                <strong onclick="window.open('${displayUrl}', '_blank')">${displayTitle}</strong>
            `;
        } else {
            statusContent.innerHTML = `
                <strong style="cursor: default; background-color: #f1f3f5; border-color: #dee2e6; color: #495057; box-shadow: none;">${displayTitle}</strong>
            `;
        }
    } else {
        statusContent.innerHTML = `<strong class="unlinked" style="color: var(--danger-red); cursor: default; background: transparent; border: none; box-shadow: none;">${displayTitle}</strong>`;
    }

    document.getElementById('part-link-modal').style.display = 'flex';
}

function savePartLink() {
    const url = document.getElementById('part-link-url').value.trim();
    let title = '';

    if (currentPart === 'all') {
        title = document.getElementById('part-link-title').value.trim();
        if (!title) {
            alert("합창 파트는 제목을 입력해야 합니다.");
            return;
        }
    } else {
        const allLinkData = localStorage.getItem('partLink_all');
        if (allLinkData) {
            title = JSON.parse(allLinkData).title;
        } else {
            title = partNames[currentPart];
        }
    }

    if (!url && currentPart !== 'all') {
        alert("주소를 입력해주세요.");
        return;
    }
    
    if (url && !url.match(/^https?:\/\//i) && !url.match(/^www\./i)) {
            if(!confirm("입력된 주소가 http:// 또는 https:// 로 시작하지 않습니다. 주소가 정확한지 확인해 주세요.")) return;
    }

    const data = { url: url, title: title };
    localStorage.setItem(`partLink_${currentPart}`, JSON.stringify(data));
    
    if (currentPart === 'all') {
        loadPartLinks(); 
    } else {
        updatePartButton(currentPart, data);
    }
    
    alert(`${partNames[currentPart]} 파트 설정이 저장되었습니다!`);
    closePartLinkModal();
}

function removePartLink() {
    const inputPw = document.getElementById('part-link-pw').value.trim();
    
    if (!currentLoginPw) {
        alert("로그인 후 이용 가능합니다.");
        return;
    }
    
    if (!inputPw || inputPw !== currentLoginPw) {
        alert("비밀번호가 일치하지 않습니다.");
        document.getElementById('part-link-pw').value = '';
        return;
    }

    if(confirm(`정말 ${partNames[currentPart]} 파트 링크를 제거하시겠습니까?`)) {
        localStorage.removeItem(`partLink_${currentPart}`);
        document.getElementById('part-link-pw').value = '';
        
        if (currentPart === 'all') {
            loadPartLinks(); 
        } else {
            updatePartButton(currentPart, null);
        }
        
        alert(`${partNames[currentPart]} 파트 링크가 제거되었습니다.`);
        closePartLinkModal();
    }
}

// -----------------------------------------------------------
// 5. 찬양곡 검색 및 리다이렉션 로직
// -----------------------------------------------------------

window.searchAndRedirect = function(form) {
    const userInput = form.query.value.trim();
    if (!userInput) return false;

    const matches = performSearch(userInput);
    
    if (matches.length === 1) {
        return openLink(matches[0].url);
    } else if (matches.length > 1) {
        showSelectionPopup(matches, false); 
        return false;
    } else {
        // 문구 수정 반영
        alert(`❌ "${userInput}"에 해당하는 곡을 목록에서 찾을 수 없습니다.\n\n검색되지 않는 곡은 홈화면에 있는 버튼을 통해 직접 링크를 입력하시기 바랍니다`);
        return false;
    }
}

function performSearch(userInput) {
    const normalizedInput = userInput.replace(/[\s\(\)\[\]!.]/g, '').toLowerCase();
    const matches = [];
    
    if (typeof window.CONCISE_BOOK_DATA === 'undefined') {
            console.error('오류: 데이터 파일 (concise_data.js)을 찾을 수 없습니다.');
            return [];
    }

    for (const book of window.CONCISE_BOOK_DATA) {
        const prefix = book[0];
        const titles = book[1]; 
        
        for (let i = 0; i < titles.length; i++) {
            const title = titles[i];
            const normalizedTitle = title.replace(/[\s\(\)\[\]!.]/g, '').toLowerCase();
            if (normalizedTitle.includes(normalizedInput)) {
                matches.push({
                    title: title,
                    url: generateUrl(prefix, i + 1),
                    collectionName: formatBookName(prefix) 
                });
            }
        }
    }
    return matches;
}

function generateUrl(collection, index) {
    const formattedIndex = index.toString().padStart(2, '0');
    return `https://joongangart.kr/${collection}/${formattedIndex}/pop1.html`;
}

function formatBookName(prefix) {
    if (prefix.startsWith('joongang')) {
        const vol = prefix.replace('joongang', '');
        return `중앙성가 Vol.${vol}`;
    } else if (prefix.startsWith('best')) {
        const vol = prefix.replace('best', '');
        return `중앙성가 Best${vol}`;
    } else if (prefix.startsWith('vision')) {
        const vol = prefix.replace('vision', '');
        return `비전성가 Vol.${vol}`;
    } else if (prefix.startsWith('Glory_SAB')) {
        const vol = prefix.replace('Glory_SAB', '');
        return `영광의 혼성 3부 ${vol}집`;
    } else if (prefix.startsWith('Men_JS_Vol')) {
        const vol = prefix.replace('Men_JS_Vol', '');
        return `남성 중앙성가 Vol.${vol}`;
    } else if (prefix.startsWith('glorymans')) {
        return `남성 영광 찬양`;
    } else if (prefix.startsWith('sight')) {
        const vol = prefix.replace('sight', '');
        return `하나님의 시선 Vol.${vol}집`;
    } else if (prefix.startsWith('NewandJoyfulPraises')) {
        const vol = prefix.replace('NewandJoyfulPraises', '');
        return `새롭고 기쁜 찬양 Vol.${vol}집`;
    } else if (prefix.startsWith('ShinSangWooArrange')) {
        const vol = prefix.replace('ShinSangWooArrange', '');
        if (vol.match(/^\d+$/)) {
            return `신상우 편곡집 Vol.${vol}집`;
        } else if (vol === '1SSA') {
                return `신상우 편곡집 Vol.1 (SSA)`;
        }
    }
    
    let formattedName = prefix.replace(/([A-Z])/g, ' $1').trim();
    formattedName = formattedName.replace(/_/g, ' ');
    return formattedName;
}

window.openLink = function(url) {
    window.open(url, '_blank');
    return false;
}

function showSelectionPopup(matches, isSetupMode) {
    const modal = document.getElementById('selection-modal');
    const optionsList = document.getElementById('modal-options-list');
    optionsList.innerHTML = ''; 
    
    matches.forEach(match => {
        const item = document.createElement('div');
        item.className = 'modal-option-item';
        item.innerHTML = `
            <strong>${match.title}</strong>
            <span>[${match.collectionName}] 버전으로 ${isSetupMode ? '선택' : '연결'}</span>
        `;
        item.onclick = () => {
            if (isSetupMode) {
                selectAndSetLink(match);
            } else {
                openLink(match.url);
                modal.style.display = 'none';
            }
        };
        optionsList.appendChild(item);
    });

    modal.style.display = 'flex'; 
    
    modal.onclick = (e) => {
        if (e.target.id === 'selection-modal') {
            modal.style.display = 'none';
        }
    };
}