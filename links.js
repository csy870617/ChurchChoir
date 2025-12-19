import { getDocs, addDoc, deleteDoc, updateDoc, doc, getDoc, query, where, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, sharedLinksCollection, groupLinksCollection } from "./config.js";
import { state, partNames } from "./state.js";
import { isValidYoutubeUrl, openModalWithHistory, closeModalWithHistory } from "./utils.js";
import { performSearch, showSelectionPopup } from "./search.js";

// --- 팝업 닫기 함수들 ---
export function closePartLinkModal() { document.getElementById('part-link-modal').style.display = 'none'; }
export function closeShortcutManager() { document.getElementById('shortcut-manager-modal').style.display = 'none'; }
export function closeLinkActionModal() { document.getElementById('link-action-modal').style.display = 'none'; }
export function closePlayModal() { document.getElementById('play-modal').style.display = 'none'; }
export function closePartManager() { document.getElementById('part-manager-modal').style.display = 'none'; }

// --- 찬양곡 슬롯 관리 (Manager) ---
export function openPartManager() {
    refreshPartManager();
    openModalWithHistory('part-manager-modal');
}

export function refreshPartManager() {
    for (let i = 1; i <= 3; i++) {
        const linkData = localStorage.getItem(`partLink_${i}_all`);
        const titleEl = document.getElementById(`part-manage-title-${i}`);
        if (linkData) {
            const data = JSON.parse(linkData);
            titleEl.innerText = data.title;
            titleEl.style.color = '#333';
        } else {
            titleEl.innerText = "설정안됨";
            titleEl.style.color = '#ccc';
        }
    }
}

export function configurePart(slot) {
    state.currentPartSlot = slot;
    openPartLinkModal('all'); 
}

export function clearPart(slot) {
    if(confirm(`링크 ${slot}번을 삭제하시겠습니까?`)) {
        ['all', 'sop', 'alt', 'ten', 'bas'].forEach(p => { localStorage.removeItem(`partLink_${slot}_${p}`); });
        refreshPartManager();
        loadPartLinks();
    }
}

// --- 듣기 팝업 ---
export function openPlayModal(slot) {
    if (slot) state.currentPartSlot = slot;
    else slot = state.currentPartSlot || 1;

    const linkData = localStorage.getItem(`partLink_${slot}_all`);
    
    if (!linkData) {
        if(confirm(`${slot}번에 등록된 곡이 없습니다. 곡을 등록하시겠습니까?`)) {
            configurePart(slot);
        }
        return;
    }

    const data = JSON.parse(linkData);
    document.getElementById('play-modal-title').innerText = data.title;

    ['all', 'sop', 'alt', 'ten', 'bas'].forEach(part => {
        const partData = localStorage.getItem(`partLink_${slot}_${part}`);
        const btn = document.getElementById(`modal-play-${part}`);
        
        if (partData && JSON.parse(partData).url) {
            btn.classList.remove('unlinked');
            btn.disabled = false;
        } else {
            btn.classList.add('unlinked');
        }
    });

    openModalWithHistory('play-modal');
}

// --- 메인 화면 버튼 업데이트 ---
export function loadPartLinks() {
    for (let i = 1; i <= 3; i++) {
        const linkData = localStorage.getItem(`partLink_${i}_all`);
        const btn = document.getElementById(`btn-part-${i}`);
        if(!btn) return;

        btn.style.color = '';
        btn.style.backgroundColor = '';
        
        if (linkData) {
            const data = JSON.parse(linkData);
            btn.innerText = data.title ? data.title : "제목 없음";
            btn.classList.remove('unlinked');
        } else {
            btn.innerText = `링크 ${i}`;
            btn.classList.add('unlinked');
        }
    }
}

// 팝업 내부 바로 듣기
export function openDirectLink(part) {
    const slot = state.currentPartSlot;
    const linkData = localStorage.getItem(`partLink_${slot}_${part}`);
    if (linkData) { const data = JSON.parse(linkData); if(data.url) window.open(data.url, '_blank'); else alert('등록된 링크가 없습니다.'); } 
    else { alert('등록된 링크가 없습니다.'); }
}

// --- 파트 링크 모달 ---
export function openPartLinkModal(part) { 
    state.currentPart = part; 
    const slot = state.currentPartSlot;
    const linkData = localStorage.getItem(`partLink_${slot}_${part}`); const data = linkData ? JSON.parse(linkData) : null; 
    
    document.getElementById('part-modal-title').innerText = `${partNames[part]} 링크 설정 (슬롯 ${slot})`; 
    const titleInput = document.getElementById('part-link-title'); const bookInput = document.getElementById('part-link-book'); const extraInputs = document.getElementById('extra-part-inputs'); const sharedSearchArea = document.getElementById('shared-search-area'); const groupSearchArea = document.getElementById('group-search-area'); 
    
    if (extraInputs) { 
        if (part === 'all') { 
            titleInput.style.display = 'block'; titleInput.value = data ? data.title : ''; 
            const allData = localStorage.getItem(`partLink_${slot}_all`) ? JSON.parse(localStorage.getItem(`partLink_${slot}_all`)) : null; 
            bookInput.value = (allData && allData.bookTitle) ? allData.bookTitle : ''; bookInput.style.display = 'block'; extraInputs.style.display = 'block'; sharedSearchArea.style.display = 'block'; 
            if(state.currentGroupId) groupSearchArea.style.display = 'block'; else groupSearchArea.style.display = 'none';
            document.getElementById('shared-search-input').value = ''; document.getElementById('shared-search-msg').innerText = ''; document.getElementById('shared-search-msg').style.display = 'none'; document.getElementById('group-search-input').value = ''; document.getElementById('group-search-msg').style.display = 'none';
            ['sop', 'alt', 'ten', 'bas'].forEach(p => { const pData = localStorage.getItem(`partLink_${slot}_${p}`); const inputEl = document.getElementById(`part-link-url-${p}`); if (inputEl) { inputEl.value = pData ? JSON.parse(pData).url : ''; } }); 
        } else { titleInput.style.display = 'none'; bookInput.style.display = 'none'; extraInputs.style.display = 'none'; sharedSearchArea.style.display = 'none'; groupSearchArea.style.display = 'none'; } 
    } 
    document.getElementById('part-link-url').value = data ? data.url : ''; 
    openModalWithHistory('part-link-modal'); 
}

export async function savePartLink() { 
    const slot = state.currentPartSlot;
    const mainUrl = document.getElementById('part-link-url').value.trim(); let title = ''; let bookTitle = ''; 
    
    if (state.currentPart === 'all') { 
        title = document.getElementById('part-link-title').value.trim(); bookTitle = document.getElementById('part-link-book').value.trim(); 
        if (!title) { alert("제목을 입력해야 합니다."); return; } if (!isValidYoutubeUrl(mainUrl)) { alert("합창 링크는 유튜브 주소(youtube.com 또는 youtu.be)만 가능합니다."); return; }
        const allData = { url: mainUrl, title: title, bookTitle: bookTitle }; localStorage.setItem(`partLink_${slot}_all`, JSON.stringify(allData)); const sharedUrls = { all: mainUrl }; const parts = ['sop', 'alt', 'ten', 'bas']; let invalidPart = false; 
        parts.forEach(p => { const inputEl = document.getElementById(`part-link-url-${p}`); if (inputEl) { const url = inputEl.value.trim(); if (url) { if (!isValidYoutubeUrl(url)) { invalidPart = true; } localStorage.setItem(`partLink_${slot}_${p}`, JSON.stringify({ url: url, title: title })); sharedUrls[p] = url; } else { sharedUrls[p] = ''; } } }); 
        if (invalidPart) { alert("파트별 링크도 유튜브 주소만 가능합니다. (저장은 되었으나 수정이 필요합니다)"); }
        if (state.currentGroupId) { 
            const searchTitle = title.replace(/\s+/g, '').toLowerCase(); 
            try { 
                const q = query(groupLinksCollection, where("groupId", "==", state.currentGroupId), where("searchTitle", "==", searchTitle), where("bookTitle", "==", bookTitle)); const querySnapshot = await getDocs(q); 
                const dataToSave = { groupId: state.currentGroupId, title: title, searchTitle: searchTitle, bookTitle: bookTitle, urls: sharedUrls, updatedAt: new Date().toISOString() }; 
                if (!querySnapshot.empty) { const docId = querySnapshot.docs[0].id; await updateDoc(doc(db, "group_links", docId), dataToSave); } else { await addDoc(groupLinksCollection, dataToSave); } 
            } catch (e) { console.log("Group save failed:", e); } 
        } 
        alert("저장되었습니다! (우리 교회 목록에 자동 추가됨)"); loadPartLinks(); refreshPartManager(); closePartLinkModal(); return; 
    } else { 
        const allLinkData = localStorage.getItem(`partLink_${slot}_all`); if (allLinkData) { title = JSON.parse(allLinkData).title; } else { title = partNames[state.currentPart]; } 
    } 
    if (!mainUrl) { alert("주소를 입력해주세요."); return; } if (!isValidYoutubeUrl(mainUrl)) { alert("유튜브 주소(youtube.com 또는 youtu.be)만 가능합니다."); return; }
    const data = { url: mainUrl, title: title }; localStorage.setItem(`partLink_${slot}_${state.currentPart}`, JSON.stringify(data)); loadPartLinks(); refreshPartManager(); alert(`${partNames[state.currentPart]} 설정이 저장되었습니다!`); closePartLinkModal(); 
}

export function removePartLink() { 
    if (!state.currentLoginPw) { alert("로그인 후 이용 가능합니다."); return; } 
    const inputPw = prompt("삭제하시려면 비밀번호를 입력해주세요."); if (inputPw === null) return; 
    if (inputPw !== state.currentLoginPw) { alert("비밀번호가 일치하지 않습니다."); return; } 
    const slot = state.currentPartSlot;
    if (state.currentPart === 'all') { ['all', 'sop', 'alt', 'ten', 'bas'].forEach(p => { localStorage.removeItem(`partLink_${slot}_${p}`); }); document.getElementById('part-link-url').value = ''; document.getElementById('part-link-title').value = ''; document.getElementById('part-link-book').value = ''; ['sop', 'alt', 'ten', 'bas'].forEach(p => { const el = document.getElementById(`part-link-url-${p}`); if(el) el.value = ''; }); } 
    else { localStorage.removeItem(`partLink_${slot}_${state.currentPart}`); } 
    loadPartLinks(); refreshPartManager(); closePartLinkModal(); 
}

// --- 즐겨찾기 관련 ---
export function loadShortcutLinks() { for (let i = 1; i <= 3; i++) { const linkData = localStorage.getItem(`storedLink${i}`); updateLinkButton(i, linkData ? JSON.parse(linkData) : null); } }
function updateLinkButton(slot, data) { const btn = document.getElementById(`btn-shortcut-${slot}`); if (btn) { btn.style.backgroundColor = ''; btn.style.color = ''; btn.style.borderColor = ''; if (data && data.url) { btn.innerText = data.title; btn.classList.remove('unlinked'); } else { btn.innerText = `즐겨찾기 ${slot}`; btn.classList.add('unlinked'); } } }
export function openShortcutLink(slot) { const linkData = localStorage.getItem(`storedLink${slot}`); if (linkData) { const data = JSON.parse(linkData); window.open(data.url, '_blank'); } else { alert("등록된 곡이 없습니다.\n[⚙️ 등록/수정] 버튼을 눌러 곡을 등록해주세요."); } }
export function openShortcutManager() { refreshShortcutManager(); openModalWithHistory('shortcut-manager-modal'); }
export function refreshShortcutManager() { for (let i = 1; i <= 3; i++) { const linkData = localStorage.getItem(`storedLink${i}`); const titleEl = document.getElementById(`manage-title-${i}`); if (linkData) { const data = JSON.parse(linkData); titleEl.innerText = data.title; titleEl.style.color = '#333'; } else { titleEl.innerText = "설정안됨"; titleEl.style.color = '#ccc'; } } }
export function configureShortcut(slot) { state.currentLinkSlot = slot; document.getElementById('action-search-input').value = ''; document.getElementById('action-search-message').style.display = 'none'; openModalWithHistory('link-action-modal'); }
export function clearShortcut(slot) { if(confirm(`즐겨찾기 ${slot}번을 삭제하시겠습니까?`)) { localStorage.removeItem(`storedLink${slot}`); refreshShortcutManager(); loadShortcutLinks(); } }
export function handleLinkClick(slot) {}
export function removeLink() { const inputPw = document.getElementById('action-link-pw').value.trim(); if (!state.currentLoginPw) { alert("로그인 후 이용 가능합니다."); return; } if (!inputPw || inputPw !== state.currentLoginPw) { alert("비밀번호가 일치하지 않습니다."); return; } if(confirm(`정말 즐겨찾기 ${state.currentLinkSlot}을(를) 해제하시겠습니까?`)) { localStorage.removeItem(`storedLink${state.currentLinkSlot}`); document.getElementById('action-link-pw').value = ''; updateLinkButton(state.currentLinkSlot, null); refreshShortcutManager(); closeLinkActionModal(); } }
export function searchAndSetLink(form) { const userInput = form.setupQuery.value.trim(); document.getElementById('action-search-message').style.display = 'none'; if (!userInput) return false; const matches = performSearch(userInput); if (matches.length === 1) { saveLinkToStorage(state.currentLinkSlot, matches[0]); alert(`'${matches[0].title}' 곡이 즐겨찾기 ${state.currentLinkSlot}에 설정되었습니다.`); closeLinkActionModal(); refreshShortcutManager(); loadShortcutLinks(); } else if (matches.length > 1) { showSelectionPopup(matches, true); } else { document.getElementById('action-search-message').innerText = `"${userInput}"에 해당하는 곡을 찾을 수 없습니다.`; document.getElementById('action-search-message').style.display = 'block'; } return false; }
export function saveLinkToStorage(slot, match) { const data = { title: match.title, url: match.url, collectionName: match.collectionName }; localStorage.setItem(`storedLink${slot}`, JSON.stringify(data)); }

// --- 검색 및 공유 기능 ---
export async function searchGroupLinks() { 
    const searchInput = document.getElementById('group-search-input').value.trim(); const msgEl = document.getElementById('group-search-msg'); 
    if (!searchInput) { msgEl.innerText = "검색어를 입력해주세요."; msgEl.style.display = 'block'; return; } 
    if (!state.currentGroupId) { msgEl.innerText = "로그인이 필요합니다."; msgEl.style.display = 'block'; return; } 
    msgEl.innerText = "검색 중..."; msgEl.style.display = 'block'; state.searchResultsCache = {}; const normalizedTerm = searchInput.replace(/\s+/g, '').toLowerCase(); 
    try { 
        const q = query(groupLinksCollection, where("groupId", "==", state.currentGroupId), where("searchTitle", "==", normalizedTerm), limit(50)); const querySnapshot = await getDocs(q); 
        if (querySnapshot.empty) { msgEl.innerText = "저장된 곡이 없습니다."; } 
        else { renderSearchResults(querySnapshot, msgEl, false); } 
    } catch (error) { console.error(error); msgEl.innerText = "오류가 발생했습니다."; } 
}

export async function searchSharedLinks() { 
    const searchInput = document.getElementById('shared-search-input').value.trim(); const msgEl = document.getElementById('shared-search-msg'); 
    if (!searchInput) { msgEl.innerText = "검색어를 입력해주세요."; msgEl.style.display = 'block'; return; } 
    msgEl.innerText = "검색 중..."; msgEl.style.display = 'block'; state.searchResultsCache = {}; const normalizedTerm = searchInput.replace(/\s+/g, '').toLowerCase(); 
    try { 
        const q = query(sharedLinksCollection, where("searchTitle", "==", normalizedTerm), limit(50)); const querySnapshot = await getDocs(q); 
        if (querySnapshot.empty) { msgEl.innerText = "아직 등록된 곡이 없습니다."; } 
        else { renderSearchResults(querySnapshot, msgEl, true); } 
    } catch (error) { console.error("Error searching shared links:", error); msgEl.innerText = "검색 중 오류가 발생했습니다."; } 
}

function renderSearchResults(querySnapshot, msgEl, isShared) { 
    const results = {}; 
    querySnapshot.forEach(doc => { const data = doc.data(); const bookKey = data.bookTitle || "책 제목 없음"; if (!results[bookKey] || new Date(data.updatedAt) > new Date(results[bookKey].updatedAt)) { results[bookKey] = { ...data, id: doc.id }; } }); 
    let listHtml = `<div class="shared-list-container">`; 
    Object.keys(results).forEach(key => { 
        const data = results[key]; state.searchResultsCache[key] = data; const safeKey = key.replace(/'/g, "\\'"); const bookDisplay = data.bookTitle ? `[${data.bookTitle}]` : `[책 제목 없음]`; const dateDisplay = new Date(data.updatedAt).toLocaleDateString(); const docId = data.id; 
        listHtml += `<div class="shared-item"><div class="shared-info"><span class="shared-song-title">${data.title}</span><span class="shared-book-title">${bookDisplay}</span><span class="shared-date">${dateDisplay}</span></div><div class="shared-btn-group"><button onclick="applySharedData('${safeKey}')" class="btn-select-data">선택</button>${isShared ? `<button onclick="reportSharedLink('${docId}')" class="btn-report-data">🚨 신고</button>` : ''}</div></div>`; 
    }); 
    listHtml += `</div>`; msgEl.innerHTML = listHtml; 
}

export function applySharedData(key) { 
    const data = state.searchResultsCache[key]; if (!data) return; 
    document.getElementById('part-link-title').value = data.title; document.getElementById('part-link-book').value = data.bookTitle || ''; document.getElementById('part-link-url').value = data.urls.all || ''; 
    ['sop', 'alt', 'ten', 'bas'].forEach(p => { const el = document.getElementById(`part-link-url-${p}`); if(el) el.value = data.urls[p] || ''; }); 
    const groupMsg = document.getElementById('group-search-msg'); const sharedMsg = document.getElementById('shared-search-msg'); 
    if(groupMsg.style.display !== 'none') groupMsg.innerHTML = `<div style="color:var(--primary-color); font-weight:bold; margin-top:10px;">✅ 데이터가 적용되었습니다.<br>아래 [저장] 버튼을 꼭 눌러주세요.</div>`; 
    if(sharedMsg.style.display !== 'none') sharedMsg.innerHTML = `<div style="color:var(--primary-color); font-weight:bold; margin-top:10px;">✅ 데이터가 적용되었습니다.<br>아래 [저장] 버튼을 꼭 눌러주세요.</div>`; 
}

export async function sharePartLink() { 
    if (state.currentPart !== 'all') { alert("전체 설정 모드에서만 공유할 수 있습니다."); return; } 
    const title = document.getElementById('part-link-title').value.trim(); const bookTitle = document.getElementById('part-link-book').value.trim(); const urlAll = document.getElementById('part-link-url').value.trim(); 
    if (!title || !bookTitle || !urlAll) { alert("제목, 책 제목, 합창 링크는 필수입니다."); return; } if (!isValidYoutubeUrl(urlAll)) { alert("합창 링크가 유튜브 주소가 아닙니다."); return; } 
    const sharedUrls = { all: urlAll }; let missing = false; let invalid = false; 
    ['sop', 'alt', 'ten', 'bas'].forEach(p => { const val = document.getElementById(`part-link-url-${p}`).value.trim(); if (!val) missing = true; else if (!isValidYoutubeUrl(val)) invalid = true; sharedUrls[p] = val; }); 
    if (missing) { alert("모든 파트의 링크를 채워야 공유할 수 있습니다."); return; } if (invalid) { alert("모든 링크는 유튜브 주소여야 합니다."); return; } 
    if (!confirm("이 데이터를 다른 교회와 공유하시겠습니까?\n(정확한 정보만 공유해주세요)")) return; 
    const searchTitle = title.replace(/\s+/g, '').toLowerCase(); 
    try { const q = query(sharedLinksCollection, where("searchTitle", "==", searchTitle), where("bookTitle", "==", bookTitle)); const querySnapshot = await getDocs(q); 
    const dataToSave = { title: title, searchTitle: searchTitle, bookTitle: bookTitle, urls: sharedUrls, updatedAt: new Date().toISOString() }; 
    if (!querySnapshot.empty) { const docId = querySnapshot.docs[0].id; await updateDoc(doc(db, "shared_links", docId), dataToSave); } else { dataToSave.reportCount = 0; await addDoc(sharedLinksCollection, dataToSave); } alert("성공적으로 공유되었습니다! 감사합니다."); } catch (e) { console.error(e); alert("공유 중 오류가 발생했습니다."); } 
}

export async function reportSharedLink(docId) {
    const reportedList = JSON.parse(localStorage.getItem('choir_reported_links') || '[]');
    if (reportedList.includes(docId)) { alert("이미 신고한 콘텐츠입니다."); return; }
    if(!confirm("이 콘텐츠를 신고하시겠습니까?\n부적절한 콘텐츠나 잘못된 링크인 경우 신고해주세요.\n(누적 3회 시 자동 삭제됩니다)")) return; 
    try { const docRef = doc(db, "shared_links", docId); const docSnap = await getDoc(docRef); if (docSnap.exists()) { const data = docSnap.data(); const currentReports = (data.reportCount || 0) + 1; if (currentReports >= 3) { await deleteDoc(docRef); alert("신고가 누적되어 해당 데이터가 삭제되었습니다."); document.getElementById('shared-search-msg').innerHTML = "삭제되었습니다. 다시 검색해주세요."; } else { await updateDoc(docRef, { reportCount: currentReports }); alert("신고가 접수되었습니다. (현재 누적: " + currentReports + "회)"); reportedList.push(docId); localStorage.setItem('choir_reported_links', JSON.stringify(reportedList)); } } else { alert("이미 삭제된 데이터입니다."); } } catch (e) { console.error(e); alert("신고 처리 중 오류가 발생했습니다."); }
}

// ✨ 오류 신고 메일 보내기
export function sendErrorReport() {
    const email = "csy0645009@gmail.com";
    const subject = "[성가대 연습실] 오류 신고";
    const body = "오류 내용을 적어주세요:\n\n";
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}