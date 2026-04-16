import { getDocs, addDoc, deleteDoc, updateDoc, doc, getDoc, query, where, limit, orderBy, startAfter } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, boardCollection } from "./config.js";
import { state } from "./state.js";
import { convertUrlsToLinks } from "./utils.js";

const POSTS_PER_PAGE = 3;

const MAX_TITLE_LENGTH = 100;
const MAX_AUTHOR_LENGTH = 30;
const MAX_CONTENT_LENGTH = 2000;

// 게시글 불러오기 (isMore = true면 '더 보기' 클릭 상황)
export async function loadPosts(isMore = false) {
    const listEl = document.getElementById('post-items');
    const loadMoreBtn = document.getElementById('btn-load-more');

    if (!isMore) {
        listEl.innerHTML = '<div class="empty-msg">데이터를 불러오는 중입니다...</div>';
        state.lastVisible = null;
        loadMoreBtn.style.display = 'none';
    }

    try {
        let q;

        if (isMore && state.lastVisible) {
            q = query(
                boardCollection,
                where("groupId", "==", state.currentGroupId),
                orderBy("date", "desc"),
                startAfter(state.lastVisible),
                limit(POSTS_PER_PAGE)
            );
        } else {
            q = query(
                boardCollection,
                where("groupId", "==", state.currentGroupId),
                orderBy("date", "desc"),
                limit(POSTS_PER_PAGE)
            );
        }

        const querySnapshot = await getDocs(q);

        if (!isMore) listEl.innerHTML = '';

        if (querySnapshot.empty) {
            loadMoreBtn.style.display = 'none';
            if (!isMore) listEl.innerHTML = '<div class="empty-msg">등록된 공지사항이 없습니다.</div>';
            return;
        }

        state.lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

        if (querySnapshot.docs.length < POSTS_PER_PAGE) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'block';
        }

        querySnapshot.forEach((docSnap) => {
            const post = { id: docSnap.id, ...docSnap.data() };
            listEl.appendChild(createPostCard(post));
        });

    } catch (e) {
        console.error(e);
        if (e.code === 'failed-precondition') {
            console.log("Firestore 색인이 필요합니다. 콘솔의 링크를 확인하세요.");
        }
        if (!isMore) listEl.innerHTML = '<div class="empty-msg">데이터 로딩 실패.<br>(관리자가 콘솔을 확인해주세요)</div>';
    }
}

// DOM API로 게시글 카드 생성 (innerHTML XSS 방지)
function createPostCard(post) {
    const div = document.createElement('div');
    div.className = 'post-card';

    // 헤더
    const header = document.createElement('div');
    header.className = 'post-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'post-title-group';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'post-title';
    titleSpan.textContent = post.title; // textContent로 XSS 차단
    titleGroup.appendChild(titleSpan);

    const meta = document.createElement('div');
    meta.className = 'post-meta';
    const authorSpan = document.createElement('span');
    authorSpan.textContent = post.author; // textContent로 XSS 차단
    const dateSpan = document.createElement('span');
    dateSpan.style.fontSize = '0.9em';
    dateSpan.style.color = '#ccc';
    dateSpan.textContent = new Date(post.date).toLocaleDateString();
    meta.appendChild(authorSpan);
    meta.appendChild(dateSpan);

    header.appendChild(titleGroup);
    header.appendChild(meta);

    // 본문: URL만 링크로 변환, 나머지 텍스트는 이스케이프
    const body = document.createElement('div');
    body.className = 'post-body';
    body.innerHTML = convertUrlsToLinks(post.content);

    // 푸터: addEventListener로 onclick 대체 (XSS 차단)
    const footer = document.createElement('div');
    footer.className = 'post-footer';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-small btn-edit';
    editBtn.textContent = '수정';
    editBtn.addEventListener('click', () => tryEditPost(post.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-small btn-delete';
    deleteBtn.textContent = '삭제';
    deleteBtn.addEventListener('click', () => tryDeletePost(post.id));

    footer.appendChild(editBtn);
    footer.appendChild(deleteBtn);

    div.appendChild(header);
    div.appendChild(body);
    div.appendChild(footer);

    return div;
}

export function showWriteForm() {
    document.getElementById('edit-mode-id').value = '';
    document.getElementById('write-title').value = '';
    document.getElementById('write-content').value = '';
    document.getElementById('write-author').value = '';
    document.getElementById('board-list').style.display = 'none';
    document.getElementById('btn-show-write').style.display = 'none';
    document.getElementById('board-write').style.display = 'block';
}

export function showBoardList() {
    document.getElementById('board-write').style.display = 'none';
    document.getElementById('board-list').style.display = 'block';
    document.getElementById('btn-show-write').style.display = 'block';
    loadPosts(false);
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
        const postData = {
            groupId: state.currentGroupId,
            churchName: state.currentChurchName,
            title,
            content,
            author,
            date: new Date().toISOString()
        };

        if (id) {
            await updateDoc(doc(db, "choir_posts", id), postData);
            alert("수정되었습니다.");
        } else {
            await addDoc(boardCollection, postData);
            alert("등록되었습니다.");
        }
        showBoardList();
    } catch (e) { alert("저장 중 오류가 발생했습니다."); }
}

export async function tryDeletePost(id) {
    if (!confirm("정말 이 게시글을 삭제하시겠습니까?")) return;
    try {
        await deleteDoc(doc(db, "choir_posts", id));
        loadPosts(false);
    } catch (e) { console.error(e); alert("삭제 중 오류가 발생했습니다."); }
}

export async function tryEditPost(id) {
    try {
        const docRef = doc(db, "choir_posts", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const post = docSnap.data();
            document.getElementById('edit-mode-id').value = id;
            document.getElementById('write-title').value = post.title;
            document.getElementById('write-content').value = post.content;
            document.getElementById('write-author').value = post.author;
            document.getElementById('board-list').style.display = 'none';
            document.getElementById('btn-show-write').style.display = 'none';
            document.getElementById('board-write').style.display = 'block';
        }
    } catch (e) { console.error(e); }
}
