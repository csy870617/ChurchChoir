import { getDocs, addDoc, deleteDoc, updateDoc, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { boardCollection } from "./config.js";
import { state } from "./state.js";
import { convertUrlsToLinks, bindPressActions } from "./utils.js";

const POSTS_PER_PAGE = 5;

const MAX_TITLE_LENGTH = 100;
const MAX_AUTHOR_LENGTH = 30;
const MAX_CONTENT_LENGTH = 2000;

// 현재 연습실의 공지사항 전체 (최신순 정렬). 페이지 넘김은 이 배열을 잘라서 화면에 보여준다.
let currentPosts = [];
let currentPage = 1;

// 공지사항 불러오기 (연습실 하나의 공지 수는 많지 않으므로 전체를 불러온 뒤 화면에서 정렬·페이지 처리)
export async function loadPosts(keepPage = false) {
    const listEl = document.getElementById('post-items');
    const pagination = document.getElementById('board-pagination');
    if (!state.currentGroupId) return;

    listEl.innerHTML = '<div class="empty-msg">불러오는 중...</div>';
    pagination.style.display = 'none';
    currentPosts = [];

    try {
        const q = query(boardCollection, where("groupId", "==", state.currentGroupId));
        const snap = await getDocs(q);

        if (snap.empty) {
            listEl.innerHTML = '<div class="empty-msg">등록된 공지사항이 없습니다.</div>';
            return;
        }

        snap.forEach((docSnap) => {
            currentPosts.push({ id: docSnap.id, ...docSnap.data() });
        });
        // 최신 작성일이 위로 오도록 정렬
        currentPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalPages = Math.max(1, Math.ceil(currentPosts.length / POSTS_PER_PAGE));
        if (!keepPage || currentPage > totalPages) currentPage = 1;
        renderPostPage();
    } catch (e) {
        console.error(e);
        listEl.innerHTML = '<div class="empty-msg">데이터 로딩 실패.<br>(관리자가 콘솔을 확인해주세요)</div>';
    }
}

// 현재 페이지에 해당하는 공지 목록과 페이지 이동 컨트롤을 그린다
function renderPostPage() {
    const listEl = document.getElementById('post-items');
    const pagination = document.getElementById('board-pagination');
    const indicator = document.getElementById('page-indicator');
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');

    const totalPages = Math.max(1, Math.ceil(currentPosts.length / POSTS_PER_PAGE));
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * POSTS_PER_PAGE;
    const pagePosts = currentPosts.slice(start, start + POSTS_PER_PAGE);

    listEl.innerHTML = '';
    pagePosts.forEach(post => listEl.appendChild(createPostCard(post)));

    // 공지가 한 페이지 안에 다 들어가면 페이지 넘김 버튼을 숨긴다
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    pagination.style.display = 'flex';
    indicator.textContent = `${currentPage} / ${totalPages}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
}

export function goToPrevPostPage() {
    if (currentPage > 1) { currentPage--; renderPostPage(); }
}

export function goToNextPostPage() {
    const totalPages = Math.max(1, Math.ceil(currentPosts.length / POSTS_PER_PAGE));
    if (currentPage < totalPages) { currentPage++; renderPostPage(); }
}

// DOM API로 게시글 카드 생성 (innerHTML XSS 차단). 버튼 없이 내용만 깔끔하게 보여주고,
// 길게 누르거나 우클릭하면 수정 화면(삭제 포함)이 열린다.
function createPostCard(post) {
    const div = document.createElement('div');
    div.className = 'post-card';

    const header = document.createElement('div');
    header.className = 'post-header';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'post-title';
    titleSpan.textContent = post.title; // textContent로 XSS 차단

    const meta = document.createElement('div');
    meta.className = 'post-meta';
    const authorSpan = document.createElement('span');
    authorSpan.textContent = post.author; // textContent로 XSS 차단
    const dateSpan = document.createElement('span');
    dateSpan.className = 'post-date';
    dateSpan.textContent = new Date(post.date).toLocaleDateString();
    meta.appendChild(authorSpan);
    meta.appendChild(dateSpan);

    header.appendChild(titleSpan);
    header.appendChild(meta);

    // 본문: URL만 링크로 변환, 나머지 텍스트는 이스케이프
    const body = document.createElement('div');
    body.className = 'post-body';
    body.innerHTML = convertUrlsToLinks(post.content);

    div.appendChild(header);
    div.appendChild(body);

    bindPressActions(div, {
        onTap: () => {},
        onLongPress: () => tryEditPost(post.id)
    });

    return div;
}

export function showWriteForm() {
    document.getElementById('edit-mode-id').value = '';
    document.getElementById('write-title').value = '';
    document.getElementById('write-content').value = '';
    document.getElementById('write-author').value = '';
    document.getElementById('btn-delete-post').style.display = 'none';
    document.getElementById('board-list').style.display = 'none';
    document.getElementById('btn-show-write').style.display = 'none';
    document.getElementById('board-write').style.display = 'block';
}

export function showBoardList() {
    document.getElementById('board-write').style.display = 'none';
    document.getElementById('board-list').style.display = 'block';
    document.getElementById('btn-show-write').style.display = 'inline-flex';
    loadPosts(true); // 수정·삭제 후 보던 페이지를 유지
}

export async function savePost() {
    const id = document.getElementById('edit-mode-id').value;
    const title = document.getElementById('write-title').value.trim();
    const content = document.getElementById('write-content').value.trim();
    const author = document.getElementById('write-author').value.trim();

    if (!title || !content || !author) { alert("제목, 작성자, 내용을 모두 입력해주세요."); return; }
    if (title.length > MAX_TITLE_LENGTH) { alert(`제목은 ${MAX_TITLE_LENGTH}자 이하로 입력해주세요.`); return; }
    if (author.length > MAX_AUTHOR_LENGTH) { alert(`작성자는 ${MAX_AUTHOR_LENGTH}자 이하로 입력해주세요.`); return; }
    if (content.length > MAX_CONTENT_LENGTH) { alert(`내용은 ${MAX_CONTENT_LENGTH}자 이하로 입력해주세요.`); return; }

    try {
        if (id) {
            // 수정 시에는 작성일(date)·groupId를 덮어쓰지 않고 내용만 갱신
            await updateDoc(doc(boardCollection, id), { title, content, author });
        } else {
            await addDoc(boardCollection, {
                groupId: state.currentGroupId,
                title,
                content,
                author,
                date: new Date().toISOString()
            });
            currentPage = 1; // 새 공지는 맨 앞(첫 페이지)에 오므로 첫 페이지로 이동
        }
        showBoardList();
    } catch (e) { console.error(e); alert("저장 중 오류가 발생했습니다."); }
}

export async function tryEditPost(id) {
    try {
        const docRef = doc(boardCollection, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const post = docSnap.data();
            document.getElementById('edit-mode-id').value = id;
            document.getElementById('write-title').value = post.title;
            document.getElementById('write-content').value = post.content;
            document.getElementById('write-author').value = post.author;
            document.getElementById('btn-delete-post').style.display = 'inline-flex';
            document.getElementById('board-list').style.display = 'none';
            document.getElementById('btn-show-write').style.display = 'none';
            document.getElementById('board-write').style.display = 'block';
        }
    } catch (e) { console.error(e); }
}

export async function deletePostFromForm() {
    const id = document.getElementById('edit-mode-id').value;
    if (!id) return;
    if (!confirm("정말 이 게시글을 삭제하시겠습니까?")) return;
    try {
        await deleteDoc(doc(boardCollection, id));
        showBoardList();
    } catch (e) { console.error(e); alert("삭제 중 오류가 발생했습니다."); }
}
