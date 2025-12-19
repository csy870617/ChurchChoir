import { getDocs, addDoc, deleteDoc, updateDoc, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, boardCollection } from "./config.js";
import { state } from "./state.js";
import { convertUrlsToLinks } from "./utils.js";

export async function loadPosts() {
    const listEl = document.getElementById('post-items');
    listEl.innerHTML = '<div class="empty-msg">데이터를 불러오는 중입니다...</div>';
    
    try {
        const q = query(boardCollection, where("groupId", "==", state.currentGroupId));
        const querySnapshot = await getDocs(q);
        let posts = [];
        
        querySnapshot.forEach((docSnap) => { 
            const data = docSnap.data();
            posts.push({ id: docSnap.id, ...data }); 
        });

        posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        listEl.innerHTML = '';
        if (posts.length === 0) { listEl.innerHTML = '<div class="empty-msg">등록된 공지사항이 없습니다.</div>'; return; }
        
        posts.forEach(post => {
            const div = document.createElement('div');
            div.className = 'post-card';
            div.innerHTML = `
                <div class="post-header"><div class="post-title-group"><span class="post-title">${post.title}</span></div><div class="post-meta"><span>작성자: ${post.author}</span><span>${new Date(post.date).toLocaleDateString()}</span></div></div>
                <div class="post-body">${convertUrlsToLinks(post.content)}</div> 
                <div class="post-footer"><button onclick="tryEditPost('${post.id}')" class="btn-small btn-edit">수정</button><button onclick="tryDeletePost('${post.id}')" class="btn-small btn-delete">삭제</button></div>`;
            listEl.appendChild(div);
        });
    } catch (e) { listEl.innerHTML = '<div class="empty-msg">데이터 로딩 실패.</div>'; }
}

export function showWriteForm() {
    document.getElementById('edit-mode-id').value = '';
    document.getElementById('write-title').value = '';
    document.getElementById('write-content').value = '';
    document.getElementById('write-author').value = '';
    // 비밀번호 초기화 삭제
    document.getElementById('board-list').style.display = 'none';
    document.getElementById('btn-show-write').style.display = 'none';
    document.getElementById('board-write').style.display = 'block';
}

export function showBoardList() {
    document.getElementById('board-write').style.display = 'none';
    document.getElementById('board-list').style.display = 'block';
    document.getElementById('btn-show-write').style.display = 'block';
    loadPosts(); 
}

// ✨ 저장 (비밀번호 없이)
export async function savePost() {
    const id = document.getElementById('edit-mode-id').value;
    const title = document.getElementById('write-title').value.trim();
    const content = document.getElementById('write-content').value.trim();
    const author = document.getElementById('write-author').value.trim();
    
    // 비밀번호 체크 로직 삭제
    if (!title || !content || !author) { alert("제목, 작성자, 내용을 모두 입력해주세요."); return; }
    
    try {
        // 비밀번호(pw) 필드 제거됨
        const postData = { groupId: state.currentGroupId, churchName: state.currentChurchName, title: title, content: content, author: author, date: new Date().toISOString() };
        
        if (id) { await updateDoc(doc(db, "choir_posts", id), postData); alert("수정되었습니다."); } 
        else { await addDoc(boardCollection, postData); alert("등록되었습니다."); }
        showBoardList();
    } catch (e) { alert("저장 중 오류가 발생했습니다."); }
}

// ✨ 삭제 (비밀번호 확인 없이, 확인창만 띄움)
export async function tryDeletePost(id) {
    if (!confirm("정말 이 게시글을 삭제하시겠습니까?")) return; 
    
    try {
        const docRef = doc(db, "choir_posts", id);
        await deleteDoc(docRef);
        // alert("삭제되었습니다."); // 사용자 경험상 굳이 안 띄워도 리스트가 갱신되면 됨
        loadPosts(); 
    } catch (e) { console.error(e); alert("삭제 중 오류가 발생했습니다."); }
}

// ✨ 수정 (비밀번호 확인 없이 바로 폼 열기)
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
            // 비밀번호 불러오기 삭제
            
            document.getElementById('board-list').style.display = 'none';
            document.getElementById('btn-show-write').style.display = 'none'; // 글쓰기 버튼 숨김
            document.getElementById('board-write').style.display = 'block';
        }
    } catch (e) { console.error(e); }
}