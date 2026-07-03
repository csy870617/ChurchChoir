import { getDocs, addDoc, deleteDoc, updateDoc, doc, query, where, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { songsCollection } from "./config.js";
import { state } from "./state.js";
import { isValidChoirLink, isValidJoongangArtUrl, normalizeUrl, openModalWithHistory, closeModalWithHistory, bindPressActions, setCollapsibleState, addUrlToHistory, getUrlHistory, addTitleToHistory, getTitleHistory } from "./utils.js";
import { performSearch } from "./search.js";

const SONGS_PER_PAGE = 10;
const PART_KEYS = ['sop', 'alt', 'ten', 'bas'];

// 현재 화면에 불러온 곡 목록 (재생/수정 모달을 열 때 재조회 없이 참조)
let currentSongs = [];

export function closeSongModal() { closeModalWithHistory(); }
export function closePlayModal() { closeModalWithHistory(); }

// 찬양곡 목록 불러오기 (isMore = true면 '더 보기' 클릭 상황)
export async function loadSongs(isMore = false) {
    const listEl = document.getElementById('song-list');
    const loadMoreBtn = document.getElementById('btn-load-more-songs');
    if (!state.currentGroupId) return;

    if (!isMore) {
        listEl.innerHTML = '<div class="empty-msg">불러오는 중...</div>';
        state.lastVisibleSong = null;
        loadMoreBtn.style.display = 'none';
        currentSongs = [];
    }

    try {
        let q;
        if (isMore && state.lastVisibleSong) {
            q = query(
                songsCollection,
                where("groupId", "==", state.currentGroupId),
                orderBy("createdAt", "desc"),
                startAfter(state.lastVisibleSong),
                limit(SONGS_PER_PAGE)
            );
        } else {
            q = query(
                songsCollection,
                where("groupId", "==", state.currentGroupId),
                orderBy("createdAt", "desc"),
                limit(SONGS_PER_PAGE)
            );
        }

        const snap = await getDocs(q);
        if (!isMore) listEl.innerHTML = '';

        if (snap.empty) {
            loadMoreBtn.style.display = 'none';
            if (!isMore) listEl.innerHTML = '<div class="empty-msg">등록된 찬양곡이 없습니다.<br>위 [＋ 곡 추가]로 등록해보세요.</div>';
            return;
        }

        state.lastVisibleSong = snap.docs[snap.docs.length - 1];
        loadMoreBtn.style.display = snap.docs.length < SONGS_PER_PAGE ? 'none' : 'block';

        snap.forEach((docSnap) => {
            const song = { id: docSnap.id, ...docSnap.data() };
            currentSongs.push(song);
            listEl.appendChild(createSongItem(song));
        });
    } catch (e) {
        console.error(e);
        if (e.code === 'failed-precondition') {
            console.log("Firestore 색인이 필요합니다. 콘솔의 링크를 확인하세요.");
        }
        if (!isMore) listEl.innerHTML = '<div class="empty-msg">불러오기 실패.<br>(관리자가 콘솔을 확인해주세요)</div>';
    }
}

export function loadMoreSongs() { loadSongs(true); }

// DOM API로 목록 항목 생성 (innerHTML XSS 방지)
function createSongItem(song) {
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
        // 중앙아트 링크는 그 안에서 파트별로 다시 선택할 수 있으므로, 재생 팝업 없이 바로 연결
        onTap: () => {
            const urlAll = song.urls ? song.urls.all : null;
            if (isValidJoongangArtUrl(urlAll)) {
                window.open(urlAll, '_blank');
            } else {
                openSongPlayModal(song.id);
            }
        },
        onLongPress: () => openSongEditModal(song.id)
    });

    return item;
}

// --- 듣기 팝업 ---
export function openSongPlayModal(songId) {
    const song = currentSongs.find(s => s.id === songId);
    if (!song) return;
    state.currentSongId = songId;

    document.getElementById('play-modal-title').textContent = song.title;

    ['all', ...PART_KEYS].forEach(part => {
        const url = song.urls ? song.urls[part] : null;
        const btn = document.getElementById(`modal-play-${part}`);
        if (!btn) return;
        btn.disabled = !url;
        btn.classList.toggle('unlinked', !url);
    });

    openModalWithHistory('play-modal');
}

export function openDirectLink(part) {
    const song = currentSongs.find(s => s.id === state.currentSongId);
    const url = song && song.urls ? song.urls[part] : null;

    if (url) {
        window.open(url, '_blank');
    } else {
        alert('등록된 링크가 없습니다.');
    }
}

// 이전에 입력했던 값을 datalist에 채워 넣어, 입력 필드에서 바로 불러올 수 있게 함
function renderHistoryDatalist(datalistId, values) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;
    datalist.innerHTML = '';
    values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        datalist.appendChild(option);
    });
}

// --- 찬양곡 등록/수정 모달 ---
export function openSongEditModal(songId) {
    state.currentSongId = songId || null;
    const song = songId ? currentSongs.find(s => s.id === songId) : null;

    renderHistoryDatalist('youtube-url-history', getUrlHistory());
    renderHistoryDatalist('song-title-history', getTitleHistory());

    document.getElementById('song-modal-title').textContent = song ? '찬양곡 수정' : '새 찬양곡 추가';
    document.getElementById('song-title').value = song ? song.title : '';
    document.getElementById('song-book').value = song ? (song.bookTitle || '') : '';
    document.getElementById('song-url-all').value = (song && song.urls) ? (song.urls.all || '') : '';

    PART_KEYS.forEach(p => {
        const el = document.getElementById(`song-url-${p}`);
        if (el) el.value = (song && song.urls) ? (song.urls[p] || '') : '';
    });

    document.getElementById('song-joongang-search-input').value = '';
    const msgEl = document.getElementById('song-joongang-search-msg');
    msgEl.innerHTML = '';
    msgEl.style.display = 'none';

    // 파트별 링크가 이미 있으면 펼쳐서 보여주고, 없으면 접어서 폼을 단순하게 유지
    const hasPartLinks = !!(song && song.urls && PART_KEYS.some(p => song.urls[p]));
    setCollapsibleState('song-part-inputs', document.getElementById('btn-toggle-parts'), hasPartLinks);

    const removeBtn = document.getElementById('btn-remove-song');
    if (removeBtn) removeBtn.style.display = song ? 'inline-block' : 'none';

    openModalWithHistory('song-modal');
}

export async function saveSongLink() {
    if (!state.currentGroupId) { alert("연습실에 입장한 후 이용해주세요."); return; }

    const title = document.getElementById('song-title').value.trim();
    const bookTitle = document.getElementById('song-book').value.trim();
    const urlAll = normalizeUrl(document.getElementById('song-url-all').value.trim());

    if (!title) { alert("제목을 입력해야 합니다."); return; }
    if (!isValidChoirLink(urlAll)) { alert("합창 링크는 유튜브 주소 또는 중앙아트 링크만 가능합니다."); return; }

    const urls = { all: urlAll };
    PART_KEYS.forEach(p => {
        const el = document.getElementById(`song-url-${p}`);
        const url = el ? normalizeUrl(el.value.trim()) : '';
        if (url) urls[p] = url;
    });

    const songId = state.currentSongId;

    try {
        if (songId) {
            await updateDoc(doc(songsCollection, songId), { title, bookTitle, urls });
        } else {
            await addDoc(songsCollection, {
                groupId: state.currentGroupId,
                title, bookTitle, urls,
                createdAt: new Date().toISOString()
            });
        }
    } catch (e) {
        console.error(e);
        alert("저장 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
        return;
    }

    Object.values(urls).forEach(addUrlToHistory);
    addTitleToHistory(title);

    closeSongModal();
    await loadSongs();
}

export async function deleteSongLink() {
    if (!state.currentSongId) return;
    if (!confirm("정말 이 찬양곡을 삭제하시겠습니까?")) return;

    try {
        await deleteDoc(doc(songsCollection, state.currentSongId));
    } catch (e) {
        console.error(e);
        alert("삭제 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
        return;
    }

    closeSongModal();
    await loadSongs();
}

// --- 중앙아트 카탈로그에서 곡 찾아 합창 링크 채우기 ---
export function searchJoongangArt() {
    const searchInput = document.getElementById('song-joongang-search-input').value.trim();
    const msgEl = document.getElementById('song-joongang-search-msg');

    if (!searchInput) {
        msgEl.textContent = "검색어를 입력해주세요.";
        msgEl.style.display = 'block';
        return;
    }

    const matches = performSearch(searchInput);
    msgEl.style.display = 'block';

    if (matches.length === 0) {
        msgEl.textContent = `"${searchInput}"에 해당하는 곡을 중앙아트에서 찾을 수 없습니다. 유튜브 링크를 직접 입력해주세요.`;
        return;
    }

    renderJoongangResults(matches, msgEl);
}

// DOM API로 검색 결과 렌더링 (innerHTML XSS 방지)
function renderJoongangResults(matches, msgEl) {
    const container = document.createElement('div');
    container.className = 'search-result-list';

    matches.forEach(match => {
        const item = document.createElement('div');
        item.className = 'search-result-item';

        const info = document.createElement('div');
        info.className = 'search-result-info';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'search-result-title';
        titleSpan.textContent = match.title; // textContent로 XSS 차단

        const bookSpan = document.createElement('span');
        bookSpan.className = 'search-result-book';
        bookSpan.textContent = match.collectionName;

        info.appendChild(titleSpan);
        info.appendChild(bookSpan);

        const selectBtn = document.createElement('button');
        selectBtn.type = 'button';
        selectBtn.className = 'btn-select-data';
        selectBtn.textContent = '선택';
        selectBtn.addEventListener('click', () => applyJoongangMatch(match));

        item.appendChild(info);
        item.appendChild(selectBtn);
        container.appendChild(item);
    });

    msgEl.innerHTML = '';
    msgEl.appendChild(container);
}

function applyJoongangMatch(match) {
    document.getElementById('song-title').value = match.title;
    document.getElementById('song-book').value = match.collectionName;
    document.getElementById('song-url-all').value = match.url;

    const msgEl = document.getElementById('song-joongang-search-msg');
    msgEl.textContent = '✓ 중앙아트 링크가 적용되었습니다. 아래 [저장] 버튼을 눌러주세요.';
}
