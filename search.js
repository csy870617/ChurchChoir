import { saveLinkToStorage, loadShortcutLinks, refreshShortcutManager } from "./links.js";
import { state } from "./state.js";
import { openModalWithHistory, closeModalWithHistory } from "./utils.js";

export function performSearch(userInput) { 
    const normalizedInput = userInput.replace(/[\s\(\)\[\]!.]/g, '').toLowerCase(); 
    const matches = []; 
    if (typeof window.CONCISE_BOOK_DATA === 'undefined') { console.error('concise_data.js 로드 실패'); return []; } 
    for (const book of window.CONCISE_BOOK_DATA) { 
        const prefix = book[0]; const titles = book[1]; 
        for (let i = 0; i < titles.length; i++) { 
            const title = titles[i]; const normalizedTitle = title.replace(/[\s\(\)\[\]!.]/g, '').toLowerCase(); 
            if (normalizedTitle.includes(normalizedInput)) { matches.push({ title: title, url: generateUrl(prefix, i + 1), collectionName: formatBookName(prefix) }); } 
        } 
    } 
    return matches; 
}

function generateUrl(collection, index) { return `https://joongangart.kr/${collection}/${index.toString().padStart(2, '0')}/pop1.html`; }

function formatBookName(prefix) { 
    if (prefix.startsWith('joongang')) return `중앙성가 Vol.${prefix.replace('joongang', '')}`; 
    if (prefix.startsWith('best')) return `중앙성가 Best${prefix.replace('best', '')}`; 
    if (prefix.startsWith('vision')) return `비전성가 Vol.${prefix.replace('vision', '')}`; 
    if (prefix.startsWith('Glory_SAB')) return `영광의 혼성 3부 ${prefix.replace('Glory_SAB', '')}집`; 
    if (prefix.startsWith('Men_JS_Vol')) return `남성 중앙성가 Vol.${prefix.replace('Men_JS_Vol', '')}`; 
    if (prefix.startsWith('glorymans')) return `남성 영광 찬양`; 
    if (prefix.startsWith('sight')) return `하나님의 시선 Vol.${prefix.replace('sight', '')}집`; 
    if (prefix.startsWith('NewandJoyfulPraises')) return `새롭고 기쁜 찬양 Vol.${prefix.replace('NewandJoyfulPraises', '')}집`; 
    if (prefix.startsWith('ShinSangWooArrange')) { const vol = prefix.replace('ShinSangWooArrange', ''); return vol === '1SSA' ? `신상우 편곡집 Vol.1 (SSA)` : `신상우 편곡집 Vol.${vol}집`; } 
    return prefix.replace(/([A-Z])/g, ' $1').trim().replace(/_/g, ' '); 
}

export function searchAndRedirect(form) {
    const userInput = form.query.value.trim();
    if (!userInput) return false;
    const matches = performSearch(userInput);
    if (matches.length === 0) { alert("검색 결과가 없습니다."); } 
    else if (matches.length === 1) { window.open(matches[0].url, '_blank'); } 
    else { showSelectionPopup(matches, false); }
    return false;
}

export function showSelectionPopup(matches, isSetupMode) { 
    openModalWithHistory('selection-modal');
    const optionsList = document.getElementById('modal-options-list'); 
    optionsList.innerHTML = ''; 
    matches.forEach(match => { 
        const item = document.createElement('div'); 
        item.className = 'modal-option-item'; 
        item.innerHTML = `<strong>${match.title}</strong><span>[${match.collectionName}] 버전으로 ${isSetupMode ? '선택' : '연결'}</span>`; 
        item.onclick = () => { 
            if (isSetupMode) { selectAndSetLink(match); } 
            else { window.open(match.url, '_blank'); closeModalWithHistory(); } 
        }; 
        optionsList.appendChild(item); 
    }); 
}

function selectAndSetLink(match) { 
    saveLinkToStorage(state.currentLinkSlot, match); 
    alert(`'${match.title}' 곡이 즐겨찾기 ${state.currentLinkSlot}에 설정되었습니다.`); 
    closeModalWithHistory(); 
    closeModalWithHistory(); // 검색모달 + 설정모달 닫기
    refreshShortcutManager(); 
    loadShortcutLinks(); 
}

window.selectAndSetLink = selectAndSetLink; // Global for dynamic HTML