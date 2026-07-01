import { getDocs, addDoc, deleteDoc, updateDoc, doc, query, where, orderBy, limit, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, recurringLinksCollection, sharedLinksCollection, groupLinksCollection, groupsCollection } from "./config.js";
import { state } from "./state.js";
import { isValidYoutubeUrl, normalizeUrl, openModalWithHistory, closeModalWithHistory, hashPassword, bindPressActions } from "./utils.js";

const REPORT_THRESHOLD = 3;
const PART_KEYS = ['sop', 'alt', 'ten', 'bas'];

export function closeSongModal() { closeModalWithHistory(); }
export function closePlayModal() { closeModalWithHistory(); }

let recurringSongs = []; // [{id, order, title, bookTitle, urls: {all, sop, alt, ten, bas}}]

// --- 그룹 로그인 시 기존 즐겨찾기(3슬롯)·찬양곡 링크(3슬롯) 데이터를 새 리스트 구조로 1회 자동 이전 ---
async function migrateOldLinksIfNeeded(groupData) {
    if (!state.currentGroupId || groupData.linksMigrated) return;

    const oldShortcuts = groupData.shortcuts || {};
    const oldPartLinks = groupData.partLinks || {};

    if (Object.keys(oldShortcuts).length === 0 && Object.keys(oldPartLinks).length === 0) {
        try {
            await updateDoc(doc(groupsCollection, state.currentGroupId), { linksMigrated: true });
        } catch (e) { console.error("이전 플래그 저장 실패:", e); }
        return;
    }

    let order = Date.now();
    const migratedTitles = new Set();

    try {
        for (const slot of Object.keys(oldPartLinks)) {
            const slotData = oldPartLinks[slot];
            const allData = slotData ? slotData['all'] : null;
            if (!allData || !allData.url) continue;

            const urls = { all: allData.url };
            PART_KEYS.forEach(p => {
                if (slotData[p] && slotData[p].url) urls[p] = slotData[p].url;
            });

            await addDoc(recurringLinksCollection, {
                groupId: state.currentGroupId,
                order: order++,
                title: allData.title || '제목 없음',
                bookTitle: allData.bookTitle || '',
                urls
            });
            if (allData.title) migratedTitles.add(allData.title);
        }

        for (const slot of Object.keys(oldShortcuts)) {
            const data = oldShortcuts[slot];
            if (!data || !data.url) continue;
            if (data.title && migratedTitles.has(data.title)) continue; // 찬양곡 링크로 이미 이전된 곡은 중복 생성 방지

            await addDoc(recurringLinksCollection, {
                groupId: state.currentGroupId,
                order: order++,
                title: data.title || '제목 없음',
                bookTitle: '',
                urls: { all: data.url }
            });
        }

        await updateDoc(doc(groupsCollection, state.currentGroupId), { linksMigrated: true });
    } catch (e) {
        console.error("기존 링크 데이터 이전 실패:", e);
        // linksMigrated 플래그를 남기지 않아 다음 로그인 때 재시도됨
    }
}

export async function syncLinksFromDB(groupData) {
    await migrateOldLinksIfNeeded(groupData);
    await loadRecurringSongs();
}

// --- 매주 반복 찬양 목록 ---
export async function loadRecurringSongs() {
    const listEl = document.getElementById('recurring-list');
    if (!listEl || !state.currentGroupId) return;

    listEl.innerHTML = '<div class="empty-msg">불러오는 중...</div>';

    try {
        const q = query(recurringLinksCollection, where("groupId", "==", state.currentGroupId), orderBy("order", "asc"));
        const snap = await getDocs(q);
        recurringSongs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderRecurringSongs();
    } catch (e) {
        console.error(e);
        if (e.code === 'failed-precondition') {
            console.log("Firestore 색인이 필요합니다. 콘솔의 링크를 확인하세요.");
        }
        listEl.innerHTML = '<div class="empty-msg">불러오기 실패.<br>(관리자가 콘솔을 확인해주세요)</div>';
    }
}

// DOM API로 목록 렌더링 (innerHTML XSS 방지)
function renderRecurringSongs() {
    const listEl = document.getElementById('recurring-list');
    listEl.innerHTML = '';

    if (recurringSongs.length === 0) {
        listEl.innerHTML = '<div class="empty-msg">등록된 찬양이 없습니다.<br>아래 [＋ 곡 추가]로 등록해보세요.</div>';
        return;
    }

    recurringSongs.forEach(song => {
        const item = document.createElement('div');
        item.className = 'song-item';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'song-item-title';
        titleSpan.textContent = song.title; // textContent로 XSS 차단
        item.appendChild(titleSpan);

        if (song.bookTitle) {
            const bookSpan = document.createElement('span');
            bookSpan.className = 'song-item-book';
            bookSpan.textContent = song.bookTitle;
            item.appendChild(bookSpan);
        }

        bindPressActions(item, {
            onTap: () => openSongPlayModal(song.id),
            onLongPress: () => openSongEditModal(song.id)
        });

        listEl.appendChild(item);
    });
}

// --- 듣기 팝업 ---
export function openSongPlayModal(songId) {
    const song = recurringSongs.find(s => s.id === songId);
    if (!song) return;
    state.currentSongId = songId;

    document.getElementById('play-modal-title').innerText = song.title;

    ['all', ...PART_KEYS].forEach(part => {
        const url = song.urls ? song.urls[part] : null;
        const btn = document.getElementById(`modal-play-${part}`);
        if (!btn) return;
        if (url) {
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
    const song = recurringSongs.find(s => s.id === state.currentSongId);
    const url = song && song.urls ? song.urls[part] : null;

    if (url) {
        window.open(url, '_blank');
    } else {
        alert('등록된 링크가 없습니다.');
    }
}

// --- 찬양 등록/수정 모달 ---
export function openSongEditModal(songId) {
    state.currentSongId = songId || null;
    const idx = songId ? recurringSongs.findIndex(s => s.id === songId) : -1;
    const song = idx >= 0 ? recurringSongs[idx] : null;

    document.getElementById('part-modal-title').innerText = song ? '찬양 수정' : '새 찬양 추가';
    document.getElementById('part-link-title').value = song ? song.title : '';
    document.getElementById('part-link-book').value = song ? (song.bookTitle || '') : '';
    document.getElementById('part-link-url').value = (song && song.urls) ? (song.urls.all || '') : '';

    PART_KEYS.forEach(p => {
        const el = document.getElementById(`part-link-url-${p}`);
        if (el) el.value = (song && song.urls) ? (song.urls[p] || '') : '';
    });

    document.getElementById('shared-search-input').value = '';
    document.getElementById('shared-search-msg').innerText = '';
    document.getElementById('shared-search-msg').style.display = 'none';
    document.getElementById('group-search-input').value = '';
    document.getElementById('group-search-msg').style.display = 'none';

    const removeBtn = document.getElementById('btn-remove-song');
    if (removeBtn) removeBtn.style.display = song ? 'inline-block' : 'none';

    const moveGroup = document.getElementById('song-move-group');
    if (moveGroup) moveGroup.style.display = song ? 'flex' : 'none';
    const moveUpBtn = document.getElementById('btn-song-move-up');
    const moveDownBtn = document.getElementById('btn-song-move-down');
    if (moveUpBtn) moveUpBtn.disabled = !song || idx <= 0;
    if (moveDownBtn) moveDownBtn.disabled = !song || idx >= recurringSongs.length - 1;

    openModalWithHistory('part-link-modal');
}

export async function saveSongLink() {
    if (!state.currentGroupId) { alert("로그인 정보가 없습니다. 다시 로그인해주세요."); return; }

    const title = document.getElementById('part-link-title').value.trim();
    const bookTitle = document.getElementById('part-link-book').value.trim();
    const urlAll = normalizeUrl(document.getElementById('part-link-url').value.trim());

    if (!title) { alert("제목을 입력해야 합니다."); return; }
    if (!isValidYoutubeUrl(urlAll)) { alert("합창 링크는 유튜브 주소만 가능합니다."); return; }

    const urls = { all: urlAll };
    PART_KEYS.forEach(p => {
        const el = document.getElementById(`part-link-url-${p}`);
        const url = el ? normalizeUrl(el.value.trim()) : '';
        if (url) urls[p] = url;
    });

    const songId = state.currentSongId;

    try {
        if (songId) {
            await updateDoc(doc(recurringLinksCollection, songId), { title, bookTitle, urls });
        } else {
            await addDoc(recurringLinksCollection, {
                groupId: state.currentGroupId,
                order: Date.now(),
                title, bookTitle, urls
            });
        }
    } catch (e) {
        console.error(e);
        alert("저장 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
        return;
    }

    // 다른 곡 등록 시 검색에 활용되는 그룹 검색 데이터도 함께 갱신 (기존 기능 유지)
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
            title, searchTitle, bookTitle, urls,
            updatedAt: new Date().toISOString()
        };
        if (!querySnapshot.empty) {
            await updateDoc(doc(db, "group_links", querySnapshot.docs[0].id), dataToSave);
        } else {
            await addDoc(groupLinksCollection, dataToSave);
        }
    } catch (e) { console.log("Search save failed", e); }

    closeSongModal();
    await loadRecurringSongs();
}

export async function deleteSongLink() {
    if (!state.currentLoginPw) { alert("로그인 후 이용 가능합니다."); return; }
    if (!state.currentSongId) return;

    const inputPw = prompt("삭제하시려면 비밀번호를 입력해주세요.");
    if (inputPw === null) return;
    const hashedInput = await hashPassword(inputPw);
    if (hashedInput !== state.currentLoginPw) { alert("비밀번호가 일치하지 않습니다."); return; }

    try {
        await deleteDoc(doc(recurringLinksCollection, state.currentSongId));
    } catch (e) {
        console.error(e);
        alert("삭제 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
        return;
    }

    closeSongModal();
    await loadRecurringSongs();
}

// 순서 변경 (편집 모달 내 위/아래 버튼)
export async function moveSongLink(direction) {
    const songId = state.currentSongId;
    const idx = recurringSongs.findIndex(s => s.id === songId);
    if (idx === -1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= recurringSongs.length) return;

    const current = recurringSongs[idx];
    const target = recurringSongs[targetIdx];

    try {
        // 스왑 결과를 DB에 먼저 반영한 뒤 목록을 다시 불러와 화면과 DB가 어긋나지 않도록 함
        await updateDoc(doc(recurringLinksCollection, current.id), { order: target.order });
        await updateDoc(doc(recurringLinksCollection, target.id), { order: current.order });
    } catch (e) {
        console.error(e);
        alert("순서 변경 중 오류가 발생했습니다: " + e.message);
        return;
    }

    await loadRecurringSongs();
    openSongEditModal(songId);
}

// --- 검색 및 공유 (기존 기능 유지) ---
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
    PART_KEYS.forEach(p => {
        const el = document.getElementById(`part-link-url-${p}`);
        if (el) el.value = urls[p] || '';
    });

    const successHtml = `<div style="color:var(--primary-color); font-weight:bold; margin-top:10px;">✅ 데이터가 적용되었습니다.<br>아래 [저장] 버튼을 꼭 눌러주세요.</div>`;
    const groupMsg = document.getElementById('group-search-msg');
    const sharedMsg = document.getElementById('shared-search-msg');
    if (groupMsg.style.display !== 'none') groupMsg.innerHTML = successHtml;
    if (sharedMsg.style.display !== 'none') sharedMsg.innerHTML = successHtml;
}

export async function shareSongLink() {
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
    PART_KEYS.forEach(p => {
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
