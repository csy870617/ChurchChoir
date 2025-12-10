// 0. 인앱 브라우저 탈출
(function() {
    const userAgent = navigator.userAgent.toLowerCase();
    const targetUrl = location.href;
    if (userAgent.match(/kakaotalk|line|instagram|facebook/i)) {
        if (userAgent.match(/android/i)) {
            location.href = 'intent://' + targetUrl.replace(/https?:\/\//i, '') + '#Intent;scheme=https;package=com.android.chrome;end';
        } else if (userAgent.match(/iphone|ipad|ipod/i)) {
            console.log('아이폰 인앱 브라우저 감지');
        }
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    
    // 로딩 화면 처리
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
        }, 1500); 
    }

    try { if (!Kakao.isInitialized()) Kakao.init('b5c055c0651a6fce6f463abd18a9bdc7'); } catch (e) { console.log('카카오 SDK 초기화 실패'); }

    function openExternalLink(url) {
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.match(/android/i) && userAgent.match(/kakaotalk|line|instagram|facebook|wv/i)) {
            const rawUrl = url.replace(/^https?:\/\//i, '');
            window.location.href = `intent://${rawUrl}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
        } else {
            window.open(url, '_blank');
        }
    }

    // ==========================================
    // 숨기기 모드 & 숨김 카드 관리
    // ==========================================
    const listContainer = document.getElementById('main-list');
    const hideModeBtn = document.getElementById('hide-mode-btn'); // 🙈 버튼
    let isHideMode = false;

    // 1. 초기화: 숨겨진 카드 적용
    const applyHiddenStatus = () => {
        const hiddenList = JSON.parse(localStorage.getItem('hiddenCards')) || [];
        const cards = document.querySelectorAll('.list-card');
        
        cards.forEach(card => {
            if (hiddenList.includes(card.id)) {
                card.classList.add('user-hidden');
            } else {
                card.classList.remove('user-hidden');
            }
        });
    };
    applyHiddenStatus();

    // 2. 숨기기 모드 토글 (팝업 제거됨)
    if (hideModeBtn) {
        hideModeBtn.addEventListener('click', () => {
            isHideMode = !isHideMode;
            document.body.classList.toggle('hide-mode', isHideMode);
            
            if (isHideMode) {
                hideModeBtn.innerHTML = '✅'; // 완료 아이콘
                hideModeBtn.classList.add('active');
                // alert 제거됨
            } else {
                hideModeBtn.innerHTML = '🙈'; // 숨기기 아이콘
                hideModeBtn.classList.remove('active');
            }
        });
    }

    // 3. 카드 클릭 처리
    listContainer.addEventListener('click', async (e) => {
        const card = e.target.closest('.list-card');
        if (!card) return;

        // [A] 숨기기 모드일 때: 숨김/해제 토글
        if (isHideMode) {
            let hiddenList = JSON.parse(localStorage.getItem('hiddenCards')) || [];
            
            if (hiddenList.includes(card.id)) {
                hiddenList = hiddenList.filter(id => id !== card.id);
                card.classList.remove('user-hidden');
            } else {
                hiddenList.push(card.id);
                card.classList.add('user-hidden');
            }
            localStorage.setItem('hiddenCards', JSON.stringify(hiddenList));
            return; // 링크 이동 방지
        }

        // [B] 일반 모드일 때: 링크 이동
        if (card.id === 'card-ccm') {
            openModal(document.getElementById('modal-overlay'));
        } else if (card.id === 'card-share') {
            const shareUrl = 'https://csy870617.github.io/faiths/';
            const shareTitle = 'FAITHS - 크리스천 성장 도구';
            const shareDesc = '더 멋진 크리스천으로 함께 성장해요';
            const shareImage = 'https://csy870617.github.io/faiths/thumbnail.png?v=' + new Date().getTime();

            if (window.Kakao && Kakao.isInitialized()) {
                try {
                    Kakao.Share.sendDefault({
                        objectType: 'feed',
                        content: { title: shareTitle, description: shareDesc, imageUrl: shareImage, link: { mobileWebUrl: shareUrl, webUrl: shareUrl }, imageWidth: 800, imageHeight: 400 },
                        buttons: [{ title: '바로가기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl }}],
                    });
                    return; 
                } catch (err) { console.log('카카오 공유 실패'); }
            }
            if (navigator.share) {
                try { await navigator.share({ url: shareUrl }); return; } catch (err) { console.log('공유 취소'); }
            }
            try { await navigator.clipboard.writeText(shareUrl); alert('주소가 복사되었습니다!'); } catch (err) { prompt('주소:', shareUrl); }
        } else {
            const link = card.getAttribute('data-link');
            if (link) openExternalLink(link);
        }
    });


    // (이하 배너, 모달 등 기존 로직 유지)
    const installBanner = document.getElementById('install-banner');
    const bannerInstallBtn = document.getElementById('banner-install-btn');
    const bannerCloseBtn = document.getElementById('banner-close-btn');
    const bannerNeverBtn = document.getElementById('banner-never-btn');
    let deferredPrompt;

    const showInstallBanner = () => {
        if (localStorage.getItem('installBannerHidden') === 'true') return;
        if (window.matchMedia('(display-mode: standalone)').matches) return;
        setTimeout(() => { if(installBanner) installBanner.classList.add('show'); }, 3000);
    };

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); deferredPrompt = e; showInstallBanner();
    });
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIos) showInstallBanner();

    if (bannerInstallBtn) {
        bannerInstallBtn.addEventListener('click', () => {
            installBanner.classList.remove('show');
            if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then((r) => { deferredPrompt = null; }); }
            else if (isIos) { setTimeout(() => openModal(document.getElementById('ios-modal')), 300); }
            else { alert("브라우저 메뉴에서 [앱 설치]를 선택하세요."); }
        });
    }
    if (bannerCloseBtn) bannerCloseBtn.addEventListener('click', () => installBanner.classList.remove('show'));
    if (bannerNeverBtn) bannerNeverBtn.addEventListener('click', () => { installBanner.classList.remove('show'); localStorage.setItem('installBannerHidden', 'true'); });

    // 모달 관리
    const modalOverlay = document.getElementById('modal-overlay');
    const iosModal = document.getElementById('ios-modal');
    const settingsModal = document.getElementById('settings-modal');
    const ccmBtn = document.getElementById('ccm-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const closeModalBtn = document.getElementById('close-modal');
    const closeIosModalBtn = document.getElementById('close-ios-modal');
    const closeSettingsBtn = document.getElementById('close-settings-modal');
    const moodBtns = document.querySelectorAll('.mood-btn');
    let currentModal = null; 

    const openModal = (modal) => { currentModal = modal; modal.style.display = 'flex'; setTimeout(() => { modal.classList.add('show'); }, 10); history.pushState({ modalOpen: true }, null, ""); };
    const closeModal = (modal) => { if (!modal) return; modal.classList.remove('show'); setTimeout(() => { modal.style.display = 'none'; }, 300); currentModal = null; };
    const closeWithBack = (modal) => { if (history.state && history.state.modalOpen) { history.back(); } else { closeModal(modal); } };
    window.addEventListener('popstate', () => { if (currentModal) closeModal(currentModal); });

    if (closeModalBtn) closeModalBtn.addEventListener('click', () => closeWithBack(modalOverlay));
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeWithBack(modalOverlay); });
    if (closeIosModalBtn) closeIosModalBtn.addEventListener('click', () => closeWithBack(iosModal));
    if (iosModal) iosModal.addEventListener('click', (e) => { if (e.target === iosModal) closeWithBack(iosModal); });
    if (settingsBtn) settingsBtn.addEventListener('click', () => openModal(settingsModal));
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => closeWithBack(settingsModal));
    if (settingsModal) settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) closeWithBack(settingsModal); });

    moodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-key');
            if (typeof CCM_LINKS !== 'undefined' && CCM_LINKS[key]) { openExternalLink(CCM_LINKS[key]); closeWithBack(modalOverlay); }
        });
    });

    const fontSizeSlider = document.getElementById('font-size-slider');
    if (fontSizeSlider) {
        const savedScale = localStorage.getItem('textScale');
        if (savedScale) { document.documentElement.style.setProperty('--text-scale', savedScale); fontSizeSlider.value = savedScale; }
        fontSizeSlider.addEventListener('input', (e) => { const scale = e.target.value; document.documentElement.style.setProperty('--text-scale', scale); localStorage.setItem('textScale', scale); });
    }

    const installAppBtn = document.getElementById('install-app-btn');
    if (installAppBtn) {
        installAppBtn.addEventListener('click', () => {
            if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then((r) => { deferredPrompt = null; }); }
            else { const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent); if (isIos) { closeWithBack(settingsModal); setTimeout(() => openModal(iosModal), 350); } else { alert("이미 설치되어 있거나 브라우저 메뉴에서 설치 가능합니다."); } }
        });
    }

    // 탭 필터링 (숨겨진 카드 고려)
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const filterValue = tab.getAttribute('data-filter');
            const cards = document.querySelectorAll('.list-card');
            cards.forEach(card => {
                const cardCategory = card.getAttribute('data-category');
                if (filterValue === 'all' || filterValue === cardCategory) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

});