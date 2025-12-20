import { getDocs, addDoc, deleteDoc, updateDoc, doc, getDoc, query, where, limit, orderBy, startAfter } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, boardCollection } from "./config.js";
import { state } from "./state.js";
import { convertUrlsToLinks } from "./utils.js";

// ✨ 게시글 불러오기 (isMore = true면 '더 보기' 클릭 상황)
export async function loadPosts(isMore = false) {
    const listEl = document.getElementById('post-items');
    const loadMoreBtn = document.getElementById('btn-load-more');
    
    // 처음 로딩이면 목록 초기화
    if (!isMore) {
        listEl.innerHTML = '<div class="empty-msg">데이터를 불러오는 중입니다...</div>';
        state.lastVisible = null; // 커서 초기화
        loadMoreBtn.style.display = 'none'; // 버튼 일단 숨김
    }

    try {
        let q;
        const perPage = 3; // 한 번에 불러올 개수

        if (isMore && state.lastVisible) {
            // 더 보기: 마지막 글(lastVisible) 다음부터 3개 가져오기
            q = query(
                boardCollection, 
                where("groupId", "==", state.currentGroupId),
                orderBy("date", "desc"), 
                startAfter(state.lastVisible),
                limit(perPage)
            );
        } else {
            // 처음 로딩: 최신순 3개 가져오기
            q = query(
                boardCollection, 
                where("groupId", "==", state.currentGroupId),
                orderBy("date", "desc"), 
                limit(perPage)
            );
        }

        const querySnapshot = await getDocs(q);
        
        // 처음 로딩 시 기존 '로딩중' 메시지 삭제
        if (!isMore) listEl.innerHTML = '';

        if (querySnapshot.empty) {
            loadMoreBtn.style.display = 'none'; // 더 가져올 게 없으면 버튼 숨김
            if (!isMore) listEl.innerHTML = '<div class="empty-msg">등록된 공지사항이 없습니다.</div>';
            return;
        }

        // 마지막 문서 저장 (다음 '더 보기'를 위해)
        state.lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

        // 3개 미만으로 가져왔으면 더 이상 데이터가 없는 것이므로 버튼 숨김
        if (querySnapshot.docs.length < perPage) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'block';
        }

        querySnapshot.forEach((docSnap) => { 
            const post = { id: docSnap.id, ...docSnap.data() };
            const div = document.createElement('div');
            div.className = 'post-card';
            div.innerHTML = `
                <div class="post-header">
                    <div class="post-title-group"><span class="post-title">${post.title}</span></div>
                    <div class="post-meta">
                        <span>${post.author}</span>
                        <span style="font-size:0.9em; color:#ccc;">${new Date(post.date).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="post-body">${convertUrlsToLinks(post.content)}</div> 
                <div class="post-footer">
                    <button onclick="tryEditPost('${post.id}')" class="btn-small btn-edit">수정</button>
                    <button onclick="tryDeletePost('${post.id}')" class="btn-small btn-delete">삭제</button>
                </div>`;
            listEl.appendChild(div);
        });

    } catch (e) { 
        console.error(e);
        if (e.code === 'failed-precondition') {
            console.log("Firestore 색인이 필요합니다. 콘솔의 링크를 확인하세요.");
        }
        if (!isMore) listEl.innerHTML = '<div class="empty-msg">데이터 로딩 실패.<br>(관리자가 콘솔을 확인해주세요)</div>'; 
    }
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
    loadPosts(false); // 처음부터 다시 로드
}

export async function savePost() {
    const id = document.getElementById('edit-mode-id').value;
    const title = document.getElementById('write-title').value.trim();
    const content = document.getElementById('write-content').value.trim();
    const author = document.getElementById('write-author').value.trim();
    
    if (!title || !content || !author) { alert("제목, 작성자, 내용을 모두 입력해주세요."); return; }
    
    try {
        const postData = { groupId: state.currentGroupId, churchName: state.currentChurchName, title: title, content: content, author: author, date: new Date().toISOString() };
        
        if (id) { await updateDoc(doc(db, "choir_posts", id), postData); alert("수정되었습니다."); } 
        else { await addDoc(boardCollection, postData); alert("등록되었습니다."); }
        showBoardList();
    } catch (e) { alert("저장 중 오류가 발생했습니다."); }
}

export async function tryDeletePost(id) {
    if (!confirm("정말 이 게시글을 삭제하시겠습니까?")) return; 
    try {
        const docRef = doc(db, "choir_posts", id);
        await deleteDoc(docRef);
        loadPosts(false); // 삭제 후 새로고침
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