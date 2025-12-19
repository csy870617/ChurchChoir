export const state = {
    currentPostId: null,
    currentChurchName: null,
    currentGroupId: null,
    currentLinkSlot: null, 
    currentLoginPw: null, 
    currentPart: null,
    currentPartSlot: 1, // ✨ 찬양곡 슬롯 번호 추가
    searchResultsCache: {}
};

export const partNames = { 'all': '전체', 'sop': '소프라노', 'alt': '알토', 'ten': '테너', 'bas': '베이스' };