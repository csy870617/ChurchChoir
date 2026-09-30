import { getDocs, addDoc, deleteDoc, updateDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { songsCollection } from "./config.js";
import { state } from "./state.js";
import { isValidChoirLink, isValidYoutubeUrl, isValidJoongangArtUrl, normalizeUrl, openModalWithHistory, closeModalWithHistory, bindPressActions, setCollapsibleState, addUrlToHistory, getUrlHistory, addTitleToHistory, getTitleHistory, attachAutocomplete } from "./utils.js";
import { performSearch } from "./search.js";

const PART_KEYS = ['sop', 'alt', 'ten', 'bas'];
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 현재 화면에 불러온 곡 목록 (재생/수정 모달을 열 때 재조회 없이 참조)
let currentSongs = [];
// 목록 요청 번호. 불러오기가 겹치면(연속 입장·저장 등) 마지막 요청 결과만 화면에 반영한다.
let songsRequestId = 0;

attachAutocomplete(document.getElementById('song-title'), getTitleHistory);
attachAutocomplete(document.getElementById('song-url-all'), getUrlHistory);
PART_KEYS.forEach(p => attachAutocomplete(document.getElementById(`song-url-${p}`), getUrlHistory));

export function closeSongModal() { closeModalWithHistory(); }
export function closePlayModal() { closeModalWithHistory(); }

// 'YYYY-MM-DD'를 로컬 자정 기준 시각(ms)으로 변환. 형식이 잘못됐으면 NaN
function parseSongDate(dateStr) {
    return new Date(dateStr + 'T00:00:00').getTime();
}

// 부를 날짜가 있는 곡은 오늘과 가까운 순서로, 날짜가 없는 곡은 최근 등록순으로 맨 아래에 배치
function sortSongsByClosestDate(songs) {
    const todayMs = new Date().setHours(0, 0, 0, 0);

    songs.sort((a, b) => {
        // 형식이 잘못된 날짜는 날짜 없음으로 취급 (NaN 비교로 정렬이 흔들리는 것 방지)
        const aHasDate = !!a.date && !isNaN(parseSongDate(a.date));
        const bHasDate = !!b.date && !isNaN(parseSongDate(b.date));

        if (aHasDate && bHasDate) {
            const diffA = Math.abs(parseSongDate(a.date) - todayMs);
            const diffB = Math.abs(parseSongDate(b.date) - todayMs);
            if (diffA !== diffB) return diffA - diffB;
        } else if (aHasDate !== bHasDate) {
            return aHasDate ? -1 : 1;
        }

        // createdAt이 없는 옛 데이터는 0(가장 오래됨)으로 간주해 NaN 비교로 인한 순서 불안정을 방지
        const aCreated = new Date(a.createdAt).getTime() || 0;
        const bCreated = new Date(b.createdAt).getTime() || 0;
        return bCreated - aCreated;
    });
}

// 찬양곡 목록 불러오기 (연습실 하나의 곡 수는 많지 않으므로 전체를 불러온 뒤 화면에서 정렬)
export async function loadSongs() {
    const listEl = document.getElementById('song-list');
    if (!state.currentGroupId) return;

    const requestId = ++songsRequestId;
    listEl.innerHTML = '<div class="empty-msg">불러오는 중...</div>';

    try {
        const q = query(songsCollection, where("groupId", "==", state.currentGroupId));
        const snap = await getDocs(q);
        if (requestId !== songsRequestId) return; // 더 최근 요청이 있으면 이 결과는 버림

        const songs = [];
        snap.forEach((docSnap) => {
            songs.push({ id: docSnap.id, ...docSnap.data() });
        });
        sortSongsByClosestDate(songs);
        currentSongs = songs;

        if (songs.length === 0) {
            listEl.innerHTML = '<div class="empty-msg">등록된 찬양곡이 없습니다.<br>위 [＋ 곡 추가]로 등록해보세요.</div>';
            return;
        }

        listEl.innerHTML = '';
        songs.forEach(song => listEl.appendChild(createSongItem(song)));
    } catch (e) {
        console.error(e);
        if (requestId !== songsRequestId) return;
        listEl.innerHTML = '<div class="empty-msg">불러오기 실패.<br>(관리자가 콘솔을 확인해주세요)</div>';
    }
}

// 'YYYY-MM-DD' -> '7/6(월)'
function formatDateBadge(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS[d.getDay()]})`;
}

// DOM API로 목록 항목 생성 (innerHTML XSS 방지)
function createSongItem(song) {
    const item = document.createElement('div');
    item.className = 'song-item';

    if (song.date && !isNaN(parseSongDate(song.date))) {
        const dateSpan = document.createElement('span');
        dateSpan.className = 'song-item-date';
        dateSpan.textContent = formatDateBadge(song.date);
        item.appendChild(dateSpan);
    }

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
        // 중앙아트 링크는 그 안에서 파트별로 다시 선택할 수 있으므로 재생 팝업 없이 바로 연결.
        // 단, 유튜브 파트 링크가 함께 저장돼 있으면 그 링크에도 접근할 수 있도록 재생 팝업을 띄운다.
        onTap: () => {
            const urlAll = song.urls ? song.urls.all : null;
            const hasPartLinks = !!(song.urls && PART_KEYS.some(p => song.urls[p]));
            if (isValidJoongangArtUrl(urlAll) && !hasPartLinks) {
                window.open(urlAll, '_blank', 'noopener');
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
        window.open(url, '_blank', 'noopener');
    } else {
        alert('등록된 링크가 없습니다.');
    }
}

// --- 찬양곡 등록/수정 모달 ---
export function openSongEditModal(songId) {
    state.currentSongId = songId || null;
    const song = songId ? currentSongs.find(s => s.id === songId) : null;

    document.getElementById('song-modal-title').textContent = song ? '찬양곡 수정' : '찬양곡 추가';
    document.getElementById('song-title').value = song ? song.title : '';
    document.getElementById('song-book').value = song ? (song.bookTitle || '') : '';
    document.getElementById('song-date').value = song ? (song.date || '') : '';
    document.getElementById('song-url-all').value = (song && song.urls) ? (song.urls.all || '') : '';

    PART_KEYS.forEach(p => {
        const el = document.getElementById(`song-url-${p}`);
        if (el) el.value = (song && song.urls) ? (song.urls[p] || '') : '';
    });

    document.getElementById('song-joongang-search-input').value = '';
    const msgEl = document.getElementById('song-joongang-search-msg');
    msgEl.innerHTML = '';
    msgEl.style.display = 'none';

    const titleSearchMsgEl = document.getElementById('song-title-search-msg');
    titleSearchMsgEl.innerHTML = '';
    titleSearchMsgEl.style.display = 'none';

    // 파트별 링크가 이미 있으면 펼쳐서 보여주고, 없으면 접어서 폼을 단순하게 유지
    const hasPartLinks = !!(song && song.urls && PART_KEYS.some(p => song.urls[p]));
    setCollapsibleState('song-part-inputs', document.getElementById('btn-toggle-parts'), hasPartLinks);

    const removeBtn = document.getElementById('btn-remove-song');
    if (removeBtn) removeBtn.style.display = song ? 'inline-block' : 'none';

    openModalWithHistory('song-modal');
}

// 저장 처리 중 버튼을 다시 눌러도 중복 저장되지 않도록 재진입 차단
let isSavingSong = false;

export async function saveSongLink() {
    if (isSavingSong) return;
    if (!state.currentGroupId) { alert("연습실에 입장한 후 이용해주세요."); return; }

    const title = document.getElementById('song-title').value.trim();
    const bookTitle = document.getElementById('song-book').value.trim();
    const date = document.getElementById('song-date').value || null;
    const urlAll = normalizeUrl(document.getElementById('song-url-all').value.trim());

    if (!title) { alert("제목을 입력해야 합니다."); return; }
    if (!date) { alert("날짜를 선택해 주세요."); return; }
    if (!isValidChoirLink(urlAll)) { alert("합창 링크는 유튜브 주소 또는 중앙아트 링크만 가능합니다."); return; }

    const urls = { all: urlAll };
    const partLabels = { sop: '소프라노', alt: '알토', ten: '테너', bas: '베이스' };
    for (const p of PART_KEYS) {
        const el = document.getElementById(`song-url-${p}`);
        const url = el ? normalizeUrl(el.value.trim()) : '';
        if (!url) continue;
        if (!isValidYoutubeUrl(url)) {
            alert(`${partLabels[p]} 링크는 유튜브 주소만 가능합니다.`);
            return;
        }
        urls[p] = url;
    }

    const songId = state.currentSongId;

    isSavingSong = true;
    try {
        if (songId) {
            await updateDoc(doc(songsCollection, songId), { title, bookTitle, date, urls });
        } else {
            await addDoc(songsCollection, {
                groupId: state.currentGroupId,
                title, bookTitle, date, urls,
                createdAt: new Date().toISOString()
            });
        }
    } catch (e) {
        console.error(e);
        alert("저장 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
        return;
    } finally {
        isSavingSong = false;
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

// --- 예전에 이 연습실에 등록했던 곡 검색 (곡 제목 입력란의 검색 버튼) ---
export async function searchMySongs() {
    const searchInput = document.getElementById('song-title').value.trim();
    const msgEl = document.getElementById('song-title-search-msg');

    if (!searchInput) {
        msgEl.textContent = "검색할 곡 제목을 입력해주세요.";
        msgEl.style.display = 'block';
        return;
    }
    if (!state.currentGroupId) {
        msgEl.textContent = "연습실에 입장한 후 이용해주세요.";
        msgEl.style.display = 'block';
        return;
    }

    msgEl.textContent = "검색 중...";
    msgEl.style.display = 'block';

    try {
        const q = query(songsCollection, where("groupId", "==", state.currentGroupId));
        const snap = await getDocs(q);

        const normalizedTerm = searchInput.replace(/\s+/g, '').toLowerCase();
        const matches = [];
        snap.forEach(docSnap => {
            const song = { id: docSnap.id, ...docSnap.data() };
            const normalizedTitle = (song.title || '').replace(/\s+/g, '').toLowerCase();
            if (normalizedTitle.includes(normalizedTerm)) matches.push(song);
        });

        if (matches.length === 0) {
            msgEl.textContent = `"${searchInput}"에 해당하는 예전 곡을 찾을 수 없습니다.`;
            return;
        }

        renderMySongResults(matches, msgEl);
    } catch (e) {
        console.error(e);
        msgEl.textContent = "검색 중 오류가 발생했습니다.";
    }
}

// DOM API로 검색 결과 렌더링 (innerHTML XSS 방지)
function renderMySongResults(matches, msgEl) {
    const container = document.createElement('div');
    container.className = 'search-result-list';

    matches.forEach(song => {
        const item = document.createElement('div');
        item.className = 'search-result-item';

        const info = document.createElement('div');
        info.className = 'search-result-info';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'search-result-title';
        titleSpan.textContent = song.title; // textContent로 XSS 차단

        const bookSpan = document.createElement('span');
        bookSpan.className = 'search-result-book';
        bookSpan.textContent = song.bookTitle || '책 제목 없음';

        info.appendChild(titleSpan);
        info.appendChild(bookSpan);

        const selectBtn = document.createElement('button');
        selectBtn.type = 'button';
        selectBtn.className = 'btn-select-data';
        selectBtn.textContent = '선택';
        selectBtn.addEventListener('click', () => applyMySongMatch(song));

        item.appendChild(info);
        item.appendChild(selectBtn);
        container.appendChild(item);
    });

    msgEl.innerHTML = '';
    msgEl.appendChild(container);
}

function applyMySongMatch(song) {
    document.getElementById('song-title').value = song.title;
    document.getElementById('song-book').value = song.bookTitle || '';
    document.getElementById('song-url-all').value = (song.urls && song.urls.all) || '';

    PART_KEYS.forEach(p => {
        const el = document.getElementById(`song-url-${p}`);
        if (el) el.value = (song.urls && song.urls[p]) || '';
    });

    const hasPartLinks = !!(song.urls && PART_KEYS.some(p => song.urls[p]));
    setCollapsibleState('song-part-inputs', document.getElementById('btn-toggle-parts'), hasPartLinks);

    const msgEl = document.getElementById('song-title-search-msg');
    msgEl.textContent = '✓ 예전 곡 정보가 적용되었습니다. 아래 [저장] 버튼을 눌러주세요.';
}
