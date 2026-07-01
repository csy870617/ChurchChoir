export const state = {
    currentPostId: null,
    currentChurchName: null,
    currentGroupId: null,
    currentLoginPw: null,
    currentSongId: null, // 재생/수정 모달이 대상으로 하는 찬양(recurring 또는 weekly) 문서 id
    searchResultsCache: {},
    lastVisible: null, // ✨ 공지사항 더 보기를 위해 마지막 글 위치 저장
    lastVisibleWeekly: null // ✨ 새 찬양 더 보기를 위해 마지막 글 위치 저장
};