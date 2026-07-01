import { getDocs, addDoc, deleteDoc, updateDoc, doc, getDoc, query, where, limit, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, sharedLinksCollection, groupLinksCollection, groupsCollection } from "./config.js";
import { state, partNames } from "./state.js";
import { isValidYoutubeUrl, normalizeUrl, openModalWithHistory, closeModalWithHistory, hashPassword } from "./utils.js";
import { performSearch, showSelectionPopup } from "./search.js";

const REPORT_THRESHOLD = 3;

export function closePartLinkModal() { closeModalWithHistory(); }
export function closeShortcutManager() { closeModalWithHistory(); }
export function closeLinkActionModal() { closeModalWithHistory(); }
export function closePlayModal() { closeModalWithHistory(); }
export function closePartManager() { closeModalWithHistory(); }

let dbShortcuts = {};
let dbPartLinks = {};

export function syncLinksFromDB(groupData) {
    dbShortcuts = groupData.shortcuts || {};
    dbPartLinks = groupData.partLinks || {};
    loadShortcutLinks();
    loadPartLinks();
}

// 순서 변경
export async function moveItem(type, currentSlot, direction) {
    if (!state.currentGroupId) {
        alert("로그인 정보가 없습니다. 다시 로그인해주세요.");
        return;
    }

    const offset = direction === 'up' ? -1 : 1;
    const targetSlot = currentSlot + offset;

    if (targetSlot < 1 || targetSlot > 3) return;

    try {
        const dbMap = (type === 'shortcut') ? dbShortcuts : dbPartLinks;

        // 스왑 결과를 미리 계산만 하고, DB 쓰기에 성공한 뒤에 로컬/화면에 반영
        // (DB 쓰기 실패 시 화면 순서와 DB가 어긋나던 문제 방지)
        const newCurrent = dbMap[targetSlot] || null;
        const newTarget = dbMap[currentSlot] || null;

        const groupRef = doc(groupsCollection, state.currentGroupId);
        const fieldPrefix = (type === 'shortcut') ? 'shortcuts' : 'partLinks';
        const updateData = {
            [`${fieldPrefix}.${currentSlot}`]: newCurrent,
            [`${fieldPrefix}.${targetSlot}`]: newTarget,
        };
        await updateDoc(groupRef, updateData);

        // DB 반영 성공 후에만 로컬 상태 갱신
        if (newCurrent === null) delete dbMap[currentSlot]; else dbMap[currentSlot] = newCurrent;
        if (newTarget === null) delete dbMap[targetSlot]; else dbMap[targetSlot] = newTarget;

        if (type === 'shortcut') {
            refreshShortcutManager();
            loadShortcutLinks();
        } else {
            refreshPartManager();
            loadPartLinks();
        }
    } catch (e) {
        console.error(e);
        alert("순서 변경 중 오류 발생: " + e.message);
    }
}

// --- 찬양곡 슬롯 관리 (Manager) ---
export function openPartManager() {
    refreshPartManager();
    openModalWithHistory('part-manager-modal');
}

export function refreshPartManager() {
    for (let i = 1; i <= 3; i++) {
        const slotData = dbPartLinks[i];
        const linkData = slotData ? slotData['all'] : null;
        const titleEl = document.getElementById(`part-manage-title-${i}`);

        if (linkData && linkData.title) {
            titleEl.innerText = linkData.title;
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

export async function clearPart(slot) {
    if (confirm(`링크 ${slot}번을 삭제하시겠습니까?`)) {
        delete dbPartLinks[slot];
        if (state.currentGroupId) {
            try {
                const groupRef = doc(groupsCollection, state.currentGroupId);
                await updateDoc(groupRef, { [`partLinks.${slot}`]: null });
            } catch (e) {
                console.error(e);
                alert("삭제 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
            }
        }
        refreshPartManager();
        loadPartLinks();
    }
}

// --- 듣기 팝업 ---
export function openPlayModal(slot) {
    if (slot) state.currentPartSlot = slot;
    else slot = state.currentPartSlot || 1;

    const slotData = dbPartLinks[slot];
    const linkData = slotData ? slotData['all'] : null;

    if (!linkData) {
        configurePart(slot);
        return;
    }

    document.getElementById('play-modal-title').innerText = linkData.title;

    ['all', 'sop', 'alt', 'ten', 'bas'].forEach(part => {
        const partData = slotData[part];
        const btn = document.getElementById(`modal-play-${part}`);

        if (partData && partData.url) {
            btn.classList.remove('unlinked');
            btn.disabled = false;
        } else {
            btn.classList.add('unlinked');
            btn.disabled = true;
        }
    });

    openModalWithHistory('play-modal');
}

// 팝업 내부 바로 듣기
export function openDirectLink(part) {
    const slot = state.currentPartSlot;
    const slotData = dbPartLinks[slot];
    const partData = slotData ? slotData[part] : null;

    if (partData && partData.url) {
        window.open(partData.url, '_blank');
    } else {
        alert('등록된 링크가 없습니다.');
    }
}

// --- 파트 링크 모달 ---
export function openPartLinkModal(part) {
    state.currentPart = part;
    const slot = state.currentPartSlot;

    const slotData = dbPartLinks[slot];
    const partData = slotData ? slotData[part] : null;
    const allData = slotData ? slotData['all'] : null;

    document.getElementById('part-modal-title').innerText = `${partNames[part]} 링크 설정 (슬롯 ${slot})`;

    const titleInput = document.getElementById('part-link-title');
    const bookInput = document.getElementById('part-link-book');
    const extraInputs = document.getElementById('extra-part-inputs');
    const sharedSearchArea = document.getElementById('shared-search-area');
    const groupSearchArea = document.getElementById('group-search-area');

    if (extraInputs) {
        if (part === 'all') {
            titleInput.style.display = 'block';
            titleInput.value = (allData && allData.title) ? allData.title : '';
            bookInput.value = (allData && allData.bookTitle) ? allData.bookTitle : '';
            bookInput.style.display = 'block';
            extraInputs.style.display = 'block';
            sharedSearchArea.style.display = 'block';
            groupSearchArea.style.display = state.currentGroupId ? 'block' : 'none';

            document.getElementById('shared-search-input').value = '';
            document.getElementById('shared-search-msg').innerText = '';
            document.getElementById('shared-search-msg').style.display = 'none';
            document.getElementById('group-search-input').value = '';
            document.getElementById('group-search-msg').style.display = 'none';

            ['sop', 'alt', 'ten', 'bas'].forEach(p => {
                const pData = slotData ? slotData[p] : null;
                const inputEl = document.getElementById(`part-link-url-${p}`);
                if (inputEl) { inputEl.value = (pData && pData.url) ? pData.url : ''; }
            });
        } else {
            titleInput.style.display = 'none';
            bookInput.style.display = 'none';
            extraInputs.style.display = 'none';
            sharedSearchArea.style.display = 'none';
            groupSearchArea.style.display = 'none';
        }
    }

    document.getElementById('part-link-url').value = (partData && partData.url) ? partData.url : '';
    openModalWithHistory('part-link-modal');
}

export async function savePartLink() {
    const slot = state.currentPartSlot;
    // 프로토콜이 없으면 https:// 를 붙여 저장 (없으면 window.open이 상대경로로 열려 404 발생)
    const mainUrl = normalizeUrl(document.getElementById('part-link-url').value.trim());

    if (state.currentPart === 'all') {
        const title = document.getElementById('part-link-title').value.trim();
        const bookTitle = document.getElementById('part-link-book').value.trim();
        if (!title) { alert("제목을 입력해야 합니다."); return; }
        if (!isValidYoutubeUrl(mainUrl)) { alert("합창 링크는 유튜브 주소만 가능합니다."); return; }

        const allData = { url: mainUrl, title, bookTitle };
        const sharedUrls = { all: mainUrl };
        const parts = ['sop', 'alt', 'ten', 'bas'];

        if (!dbPartLinks[slot]) dbPartLinks[slot] = {};
        dbPartLinks[slot]['all'] = allData;

        parts.forEach(p => {
            const inputEl = document.getElementById(`part-link-url-${p}`);
            if (inputEl) {
                const url = normalizeUrl(inputEl.value.trim());
                if (url) {
                    dbPartLinks[slot][p] = { url, title };
                    sharedUrls[p] = url;
                }
            }
        });

        if (state.currentGroupId) {
            try {
                const groupRef = doc(groupsCollection, state.currentGroupId);
                await updateDoc(groupRef, { [`partLinks.${slot}`]: dbPartLinks[slot] });
            } catch (e) {
                console.error(e);
                alert("저장 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
                return;
            }

            try {
                const searchTitle = title.replace(/\s+/g, '').toLowerCase();
                const q = query(
                    groupLinksCollection,
                    where("groupId", "==", state.currentGroupId),
                    where("searchTitle", "==", searchTitle),
                    where("bookTitle", "==", bookTitle)
                );
                const querySnapshot = await getDocs(q);
                const dataToSave = {
                    groupId: state.currentGroupId,
                    title,
                    searchTitle,
                    bookTitle,
                    urls: sharedUrls,
                    updatedAt: new Date().toISOString()
                };
                if (!querySnapshot.empty) {
                    await updateDoc(doc(db, "group_links", querySnapshot.docs[0].id), dataToSave);
                } else {
                    await addDoc(groupLinksCollection, dataToSave);
                }
            } catch (e) { console.log("Search save failed", e); }
        }

        loadPartLinks();
        refreshPartManager();
        closePartLinkModal();
        return;
    }

    // 개별 파트 저장
    if (!isValidYoutubeUrl(mainUrl)) { alert("유튜브 주소만 가능합니다."); return; }
    if (!dbPartLinks[slot]) dbPartLinks[slot] = {};
    const currentTitle = dbPartLinks[slot]['all'] ? dbPartLinks[slot]['all'].title : partNames[state.currentPart];
    dbPartLinks[slot][state.currentPart] = { url: mainUrl, title: currentTitle };

    if (state.currentGroupId) {
        try {
            const groupRef = doc(groupsCollection, state.currentGroupId);
            await updateDoc(groupRef, { [`partLinks.${slot}.${state.currentPart}`]: dbPartLinks[slot][state.currentPart] });
        } catch (e) {
            console.error(e);
            alert("저장 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
            return;
        }
    }

    loadPartLinks();
    refreshPartManager();
    closePartLinkModal();
}

export async function removePartLink() {
    if (!state.currentLoginPw) { alert("로그인 후 이용 가능합니다."); return; }
    const inputPw = prompt("삭제하시려면 비밀번호를 입력해주세요.");
    if (inputPw === null) return;
    const hashedInput = await hashPassword(inputPw);
    if (hashedInput !== state.currentLoginPw) { alert("비밀번호가 일치하지 않습니다."); return; }

    const slot = state.currentPartSlot;
    try {
        if (state.currentPart === 'all') {
            delete dbPartLinks[slot];
            if (state.currentGroupId) {
                const groupRef = doc(groupsCollection, state.currentGroupId);
                await updateDoc(groupRef, { [`partLinks.${slot}`]: null });
            }
            document.getElementById('part-link-url').value = '';
            document.getElementById('part-link-title').value = '';
            document.getElementById('part-link-book').value = '';
            ['sop', 'alt', 'ten', 'bas'].forEach(p => {
                const el = document.getElementById(`part-link-url-${p}`);
                if (el) el.value = '';
            });
        } else {
            if (dbPartLinks[slot]) delete dbPartLinks[slot][state.currentPart];
            if (state.currentGroupId) {
                const groupRef = doc(groupsCollection, state.currentGroupId);
                await updateDoc(groupRef, { [`partLinks.${slot}.${state.currentPart}`]: null });
            }
        }
    } catch (e) {
        console.error(e);
        alert("삭제 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
    }
    loadPartLinks();
    refreshPartManager();
    closePartLinkModal();
}

// --- 메인 화면 버튼 업데이트 ---
export function loadPartLinks() {
    for (let i = 1; i <= 3; i++) {
        const slotData = dbPartLinks[i];
        const linkData = slotData ? slotData['all'] : null;
        const btn = document.getElementById(`btn-part-${i}`);
        if (!btn) continue;

        btn.style.color = '';
        btn.style.backgroundColor = '';

        if (linkData && linkData.title) {
            btn.innerText = linkData.title;
            btn.classList.remove('unlinked');
        } else {
            btn.innerText = `링크 ${i}`;
            btn.classList.add('unlinked');
        }
    }
}

// --- 즐겨찾기 관련 ---
export function loadShortcutLinks() {
    for (let i = 1; i <= 3; i++) {
        updateLinkButton(i, dbShortcuts[i]);
    }
}

function updateLinkButton(slot, data) {
    const btn = document.getElementById(`btn-shortcut-${slot}`);
    if (!btn) return;
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

export function openShortcutLink(slot) {
    const data = dbShortcuts[slot];
    if (data && data.url) { window.open(data.url, '_blank'); }
    else { configureShortcut(slot); }
}

export function openShortcutManager() {
    refreshShortcutManager();
    openModalWithHistory('shortcut-manager-modal');
}

export function refreshShortcutManager() {
    for (let i = 1; i <= 3; i++) {
        const data = dbShortcuts[i];
        const titleEl = document.getElementById(`manage-title-${i}`);
        if (data) {
            titleEl.innerText = data.title;
            titleEl.style.color = '#333';
        } else {
            titleEl.innerText = "설정안됨";
            titleEl.style.color = '#ccc';
        }
    }
}

export function configureShortcut(slot) {
    state.currentLinkSlot = slot;
    document.getElementById('action-search-input').value = '';
    document.getElementById('action-search-message').style.display = 'none';
    openModalWithHistory('link-action-modal');
}

export async function saveLinkToStorage(slot, match) {
    const data = { title: match.title, url: match.url, collectionName: match.collectionName };
    dbShortcuts[slot] = data;
    if (state.currentGroupId) {
        try {
            const groupRef = doc(groupsCollection, state.currentGroupId);
            await updateDoc(groupRef, { [`shortcuts.${slot}`]: data });
        } catch (e) {
            console.error(e);
            alert("즐겨찾기 저장 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
        }
    }
    refreshShortcutManager();
    loadShortcutLinks();
    closeLinkActionModal();
}

export async function removeLink() {
    if (!state.currentLoginPw) { alert("로그인 후 이용 가능합니다."); return; }
    if (confirm(`정말 즐겨찾기 ${state.currentLinkSlot}을(를) 해제하시겠습니까?`)) {
        delete dbShortcuts[state.currentLinkSlot];
        if (state.currentGroupId) {
            try {
                const groupRef = doc(groupsCollection, state.currentGroupId);
                await updateDoc(groupRef, { [`shortcuts.${state.currentLinkSlot}`]: null });
            } catch (e) {
                console.error(e);
                alert("해제 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
            }
        }
        updateLinkButton(state.currentLinkSlot, null);
        refreshShortcutManager();
        closeLinkActionModal();
    }
}

export function searchAndSetLink(form) {
    const userInput = form.setupQuery.value.trim();
    document.getElementById('action-search-message').style.display = 'none';
    if (!userInput) return false;
    const matches = performSearch(userInput);
    if (matches.length === 1) {
        saveLinkToStorage(state.currentLinkSlot, matches[0]);
    } else if (matches.length > 1) {
        showSelectionPopup(matches, true);
    } else {
        document.getElementById('action-search-message').innerText = `"${userInput}"에 해당하는 곡을 찾을 수 없습니다.`;
        document.getElementById('action-search-message').style.display = 'block';
    }
    return false;
}

export async function clearShortcut(slot) {
    if (confirm(`즐겨찾기 ${slot}번을 삭제하시겠습니까?`)) {
        delete dbShortcuts[slot];
        if (state.currentGroupId) {
            try {
                const groupRef = doc(groupsCollection, state.currentGroupId);
                await updateDoc(groupRef, { [`shortcuts.${slot}`]: null });
            } catch (e) {
                console.error(e);
                alert("삭제 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
            }
        }
        refreshShortcutManager();
        loadShortcutLinks();
    }
}

// --- 검색 및 공유 ---
export async function searchGroupLinks() {
    const searchInput = document.getElementById('group-search-input').value.trim();
    const msgEl = document.getElementById('group-search-msg');

    if (!searchInput) {
        msgEl.innerText = "검색어를 입력해주세요.";
        msgEl.style.display = 'block';
        return;
    }
    if (!state.currentGroupId) {
        msgEl.innerText = "로그인이 필요합니다.";
        msgEl.style.display = 'block';
        return;
    }

    msgEl.innerText = "검색 중...";
    msgEl.style.display = 'block';
    state.searchResultsCache = {};
    const normalizedTerm = searchInput.replace(/\s+/g, '').toLowerCase();

    try {
        const q = query(
            groupLinksCollection,
            where("groupId", "==", state.currentGroupId),
            where("searchTitle", "==", normalizedTerm),
            limit(50)
        );
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            msgEl.innerText = "저장된 곡이 없습니다.";
        } else {
            renderSearchResults(querySnapshot, msgEl, false);
        }
    } catch (error) {
        console.error(error);
        msgEl.innerText = "오류가 발생했습니다.";
    }
}

export async function searchSharedLinks() {
    const searchInput = document.getElementById('shared-search-input').value.trim();
    const msgEl = document.getElementById('shared-search-msg');

    if (!searchInput) {
        msgEl.innerText = "검색어를 입력해주세요.";
        msgEl.style.display = 'block';
        return;
    }

    msgEl.innerText = "검색 중...";
    msgEl.style.display = 'block';
    state.searchResultsCache = {};
    const normalizedTerm = searchInput.replace(/\s+/g, '').toLowerCase();

    try {
        const q = query(
            sharedLinksCollection,
            where("searchTitle", "==", normalizedTerm),
            limit(50)
        );
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            msgEl.innerText = "아직 등록된 곡이 없습니다.";
        } else {
            renderSearchResults(querySnapshot, msgEl, true);
        }
    } catch (error) {
        console.error("Error searching shared links:", error);
        msgEl.innerText = "검색 중 오류가 발생했습니다.";
    }
}

// DOM API로 검색 결과 렌더링 (innerHTML XSS 방지)
function renderSearchResults(querySnapshot, msgEl, isShared) {
    const results = {};
    querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const bookKey = data.bookTitle || "책 제목 없음";
        if (!results[bookKey] || new Date(data.updatedAt) > new Date(results[bookKey].updatedAt)) {
            results[bookKey] = { ...data, id: docSnap.id };
        }
    });

    const container = document.createElement('div');
    container.className = 'shared-list-container';

    Object.keys(results).forEach(key => {
        const data = results[key];
        state.searchResultsCache[key] = data;

        const item = document.createElement('div');
        item.className = 'shared-item';

        const info = document.createElement('div');
        info.className = 'shared-info';

        const songTitle = document.createElement('span');
        songTitle.className = 'shared-song-title';
        songTitle.textContent = data.title; // textContent로 XSS 차단

        const bookTitle = document.createElement('span');
        bookTitle.className = 'shared-book-title';
        bookTitle.textContent = data.bookTitle ? `[${data.bookTitle}]` : '[책 제목 없음]';

        const dateSpan = document.createElement('span');
        dateSpan.className = 'shared-date';
        dateSpan.textContent = new Date(data.updatedAt).toLocaleDateString();

        info.appendChild(songTitle);
        info.appendChild(bookTitle);
        info.appendChild(dateSpan);

        const btnGroup = document.createElement('div');
        btnGroup.className = 'shared-btn-group';

        const selectBtn = document.createElement('button');
        selectBtn.className = 'btn-select-data';
        selectBtn.textContent = '선택';
        selectBtn.addEventListener('click', () => applySharedData(key));
        btnGroup.appendChild(selectBtn);

        if (isShared) {
            const reportBtn = document.createElement('button');
            reportBtn.className = 'btn-report-data';
            reportBtn.textContent = '🚨 신고';
            reportBtn.addEventListener('click', () => reportSharedLink(data.id));
            btnGroup.appendChild(reportBtn);
        }

        item.appendChild(info);
        item.appendChild(btnGroup);
        container.appendChild(item);
    });

    msgEl.innerHTML = '';
    msgEl.appendChild(container);
}

export function applySharedData(key) {
    const data = state.searchResultsCache[key];
    if (!data) return;

    const urls = data.urls || {}; // urls 필드가 없는 데이터로 인한 TypeError 방지
    document.getElementById('part-link-title').value = data.title || '';
    document.getElementById('part-link-book').value = data.bookTitle || '';
    document.getElementById('part-link-url').value = urls.all || '';
    ['sop', 'alt', 'ten', 'bas'].forEach(p => {
        const el = document.getElementById(`part-link-url-${p}`);
        if (el) el.value = urls[p] || '';
    });

    const successHtml = `<div style="color:var(--primary-color); font-weight:bold; margin-top:10px;">✅ 데이터가 적용되었습니다.<br>아래 [저장] 버튼을 꼭 눌러주세요.</div>`;
    const groupMsg = document.getElementById('group-search-msg');
    const sharedMsg = document.getElementById('shared-search-msg');
    if (groupMsg.style.display !== 'none') groupMsg.innerHTML = successHtml;
    if (sharedMsg.style.display !== 'none') sharedMsg.innerHTML = successHtml;
}

export async function sharePartLink() {
    if (state.currentPart !== 'all') {
        alert("전체 설정 모드에서만 공유할 수 있습니다.");
        return;
    }

    const title = document.getElementById('part-link-title').value.trim();
    const bookTitle = document.getElementById('part-link-book').value.trim();
    const urlAll = normalizeUrl(document.getElementById('part-link-url').value.trim());

    if (!title || !bookTitle || !urlAll) {
        alert("제목, 책 제목, 합창 링크는 필수입니다.");
        return;
    }
    if (!isValidYoutubeUrl(urlAll)) {
        alert("합창 링크가 유튜브 주소가 아닙니다.");
        return;
    }

    const sharedUrls = { all: urlAll };
    let missing = false;
    let invalid = false;
    ['sop', 'alt', 'ten', 'bas'].forEach(p => {
        const val = normalizeUrl(document.getElementById(`part-link-url-${p}`).value.trim());
        if (!val) missing = true;
        else if (!isValidYoutubeUrl(val)) invalid = true;
        sharedUrls[p] = val;
    });

    if (missing) { alert("모든 파트의 링크를 채워야 공유할 수 있습니다."); return; }
    if (invalid) { alert("모든 링크는 유튜브 주소여야 합니다."); return; }
    if (!confirm("이 데이터를 다른 교회와 공유하시겠습니까?\n(정확한 정보만 공유해주세요)")) return;

    const searchTitle = title.replace(/\s+/g, '').toLowerCase();
    try {
        const q = query(
            sharedLinksCollection,
            where("searchTitle", "==", searchTitle),
            where("bookTitle", "==", bookTitle)
        );
        const querySnapshot = await getDocs(q);
        const dataToSave = { title, searchTitle, bookTitle, urls: sharedUrls, updatedAt: new Date().toISOString() };

        if (!querySnapshot.empty) {
            await updateDoc(doc(db, "shared_links", querySnapshot.docs[0].id), dataToSave);
        } else {
            dataToSave.reportCount = 0;
            await addDoc(sharedLinksCollection, dataToSave);
        }
        alert("성공적으로 공유되었습니다! 감사합니다.");
    } catch (e) {
        console.error(e);
        alert("공유 중 오류가 발생했습니다.");
    }
}

export async function reportSharedLink(docId) {
    const reportedList = JSON.parse(localStorage.getItem('choir_reported_links') || '[]');
    if (reportedList.includes(docId)) {
        alert("이미 신고한 콘텐츠입니다.");
        return;
    }
    if (!confirm(`이 콘텐츠를 신고하시겠습니까?\n부적절한 콘텐츠나 잘못된 링크인 경우 신고해주세요.\n(누적 ${REPORT_THRESHOLD}회 시 자동 삭제됩니다)`)) return;

    try {
        const docRef = doc(db, "shared_links", docId);

        // 동시 신고 시 카운트가 덮어써져 임계치 도달이 늦어지던 문제 방지: 트랜잭션으로 원자적 처리
        const result = await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(docRef);
            if (!docSnap.exists()) return { status: 'gone' };

            const currentReports = (docSnap.data().reportCount || 0) + 1;
            if (currentReports >= REPORT_THRESHOLD) {
                transaction.delete(docRef);
                return { status: 'deleted' };
            }
            transaction.update(docRef, { reportCount: currentReports });
            return { status: 'reported', count: currentReports };
        });

        if (result.status === 'gone') {
            alert("이미 삭제된 데이터입니다.");
        } else if (result.status === 'deleted') {
            alert("신고가 누적되어 해당 데이터가 삭제되었습니다.");
            document.getElementById('shared-search-msg').innerHTML = "삭제되었습니다. 다시 검색해주세요.";
        } else {
            alert(`신고가 접수되었습니다. (현재 누적: ${result.count}회)`);
            reportedList.push(docId);
            localStorage.setItem('choir_reported_links', JSON.stringify(reportedList));
        }
    } catch (e) {
        console.error(e);
        alert("신고 처리 중 오류가 발생했습니다.");
    }
}

// --- 오류 신고 메일 ---
export function sendErrorReport() {
    const email = "csy0645009@gmail.com";
    const subject = "[성가대 연습실] 오류 신고";
    const body = "오류 내용을 적어주세요:\n\n";
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

window.moveItem = moveItem;
