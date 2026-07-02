import { getDocs, addDoc, deleteDoc, updateDoc, doc, query, where, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { weeklyLinksCollection } from "./config.js";
import { state } from "./state.js";
import { normalizeUrl, openModalWithHistory, closeModalWithHistory, bindPressActions } from "./utils.js";
import { performSearch } from "./search.js";

const WEEKLY_PER_PAGE = 5;

export function closeWeeklyModal() { closeModalWithHistory(); }

// 이번주 새 찬양 불러오기 (isMore = true면 '더 보기' 클릭 상황)
export async function loadWeeklySongs(isMore = false) {
    const listEl = document.getElementById('weekly-list');
    const loadMoreBtn = document.getElementById('btn-load-more-weekly');
    if (!listEl || !state.currentGroupId) return;

    if (!isMore) {
        listEl.innerHTML = '<div class="empty-msg">불러오는 중...</div>';
        state.lastVisibleWeekly = null;
        loadMoreBtn.style.display = 'none';
    }

    try {
        let q;
        if (isMore && state.lastVisibleWeekly) {
            q = query(
                weeklyLinksCollection,
                where("groupId", "==", state.currentGroupId),
                orderBy("date", "desc"),
                startAfter(state.lastVisibleWeekly),
                limit(WEEKLY_PER_PAGE)
            );
        } else {
            q = query(
                weeklyLinksCollection,
                where("groupId", "==", state.currentGroupId),
                orderBy("date", "desc"),
                limit(WEEKLY_PER_PAGE)
            );
        }

        const querySnapshot = await getDocs(q);

        if (!isMore) listEl.innerHTML = '';

        if (querySnapshot.empty) {
            loadMoreBtn.style.display = 'none';
            if (!isMore) listEl.innerHTML = '<div class="empty-msg">등록된 찬양이 없습니다.</div>';
            return;
        }

        state.lastVisibleWeekly = querySnapshot.docs[querySnapshot.docs.length - 1];
        loadMoreBtn.style.display = (querySnapshot.docs.length < WEEKLY_PER_PAGE) ? 'none' : 'block';

        querySnapshot.forEach(docSnap => {
            const song = { id: docSnap.id, ...docSnap.data() };
            listEl.appendChild(createWeeklyItem(song));
        });
    } catch (e) {
        console.error(e);
        if (e.code === 'failed-precondition') {
            console.log("Firestore 색인이 필요합니다. 콘솔의 링크를 확인하세요.");
        }
        if (!isMore) listEl.innerHTML = '<div class="empty-msg">데이터 로딩 실패.<br>(관리자가 콘솔을 확인해주세요)</div>';
    }
}

// DOM API로 항목 생성 (innerHTML XSS 방지)
function createWeeklyItem(song) {
    const item = document.createElement('div');
    item.className = 'weekly-item';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'weekly-item-date';
    dateSpan.textContent = formatDate(song.date);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'weekly-item-title';
    titleSpan.textContent = song.title; // textContent로 XSS 차단
    if (song.url) titleSpan.classList.add('has-link');

    item.appendChild(dateSpan);
    item.appendChild(titleSpan);

    bindPressActions(item, {
        onTap: () => {
            if (song.url) window.open(song.url, '_blank');
            else alert('아직 등록된 링크가 없습니다.\n길게 누르거나 마우스 오른쪽 버튼을 클릭하면 링크를 추가할 수 있어요.');
        },
        onLongPress: () => openWeeklyEditModal(song)
    });

    return item;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function resetWeeklySearchArea() {
    document.getElementById('weekly-joongang-search-input').value = '';
    document.getElementById('weekly-joongang-search-msg').innerText = '';
    document.getElementById('weekly-joongang-search-msg').style.display = 'none';
}

export function openWeeklyAddModal() {
    state.currentSongId = null;
    document.getElementById('weekly-modal-title').innerText = '새 찬양 추가';
    document.getElementById('weekly-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('weekly-title').value = '';
    document.getElementById('weekly-url').value = '';
    document.getElementById('btn-remove-weekly').style.display = 'none';
    resetWeeklySearchArea();
    openModalWithHistory('weekly-modal');
}

function openWeeklyEditModal(song) {
    state.currentSongId = song.id;
    document.getElementById('weekly-modal-title').innerText = '찬양 수정';
    document.getElementById('weekly-date').value = song.date || '';
    document.getElementById('weekly-title').value = song.title || '';
    document.getElementById('weekly-url').value = song.url || '';
    document.getElementById('btn-remove-weekly').style.display = 'inline-block';
    resetWeeklySearchArea();
    openModalWithHistory('weekly-modal');
}

// --- 중앙아트 카탈로그에서 곡 찾아 링크 채우기 ---
export function searchJoongangArtWeekly() {
    const searchInput = document.getElementById('weekly-joongang-search-input').value.trim();
    const msgEl = document.getElementById('weekly-joongang-search-msg');

    if (!searchInput) {
        msgEl.innerText = "검색어를 입력해주세요.";
        msgEl.style.display = 'block';
        return;
    }

    const matches = performSearch(searchInput);
    msgEl.style.display = 'block';

    if (matches.length === 0) {
        msgEl.innerText = `"${searchInput}"에 해당하는 곡을 중앙아트에서 찾을 수 없습니다.\n유튜브 링크를 직접 입력해주세요.`;
        return;
    }

    renderJoongangResultsWeekly(matches, msgEl);
}

// DOM API로 검색 결과 렌더링 (innerHTML XSS 방지)
function renderJoongangResultsWeekly(matches, msgEl) {
    const container = document.createElement('div');
    container.className = 'shared-list-container';

    matches.forEach(match => {
        const item = document.createElement('div');
        item.className = 'shared-item';

        const info = document.createElement('div');
        info.className = 'shared-info';

        const songTitle = document.createElement('span');
        songTitle.className = 'shared-song-title';
        songTitle.textContent = match.title; // textContent로 XSS 차단

        const bookTitle = document.createElement('span');
        bookTitle.className = 'shared-book-title';
        bookTitle.textContent = `[${match.collectionName}]`;

        info.appendChild(songTitle);
        info.appendChild(bookTitle);

        const btnGroup = document.createElement('div');
        btnGroup.className = 'shared-btn-group';

        const selectBtn = document.createElement('button');
        selectBtn.className = 'btn-select-data';
        selectBtn.textContent = '선택';
        selectBtn.addEventListener('click', () => applyJoongangMatchWeekly(match));
        btnGroup.appendChild(selectBtn);

        item.appendChild(info);
        item.appendChild(btnGroup);
        container.appendChild(item);
    });

    msgEl.innerHTML = '';
    msgEl.appendChild(container);
}

function applyJoongangMatchWeekly(match) {
    document.getElementById('weekly-title').value = match.title;
    document.getElementById('weekly-url').value = match.url;

    const msgEl = document.getElementById('weekly-joongang-search-msg');
    msgEl.innerHTML = `<div style="color:var(--primary-color); font-weight:bold; margin-top:10px;">✅ 중앙아트 링크가 적용되었습니다.<br>아래 [저장] 버튼을 꼭 눌러주세요.</div>`;
}

export async function saveWeeklySong() {
    if (!state.currentGroupId) { alert("로그인 정보가 없습니다. 다시 로그인해주세요."); return; }

    const date = document.getElementById('weekly-date').value;
    const title = document.getElementById('weekly-title').value.trim();
    const urlInput = document.getElementById('weekly-url').value.trim();
    const url = urlInput ? normalizeUrl(urlInput) : '';

    if (!date) { alert("날짜를 선택해주세요."); return; }
    if (!title) { alert("곡 제목을 입력해주세요."); return; }

    const songId = state.currentSongId;

    try {
        if (songId) {
            await updateDoc(doc(weeklyLinksCollection, songId), { date, title, url });
        } else {
            await addDoc(weeklyLinksCollection, { groupId: state.currentGroupId, date, title, url });
        }
    } catch (e) {
        console.error(e);
        alert("저장 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
        return;
    }

    closeWeeklyModal();
    loadWeeklySongs(false);
}

export async function deleteWeeklySong() {
    if (!state.currentSongId) return;
    if (!confirm("정말 이 찬양을 삭제하시겠습니까?")) return;

    try {
        await deleteDoc(doc(weeklyLinksCollection, state.currentSongId));
    } catch (e) {
        console.error(e);
        alert("삭제 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
        return;
    }

    closeWeeklyModal();
    loadWeeklySongs(false);
}
