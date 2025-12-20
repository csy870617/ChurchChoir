export const state = {
    currentPostId: null,
    currentChurchName: null,
    currentGroupId: null,
    currentLinkSlot: null, 
    currentLoginPw: null, 
    currentPart: null,
    currentPartSlot: 1,
    searchResultsCache: {},
    lastVisible: null // ✨ 더 보기를 위해 마지막 글 위치 저장
};

export const partNames = { 'all': '전체', 'sop': '소프라노', 'alt': '알토', 'ten': '테너', 'bas': '베이스' };