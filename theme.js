const THEME_KEY = 'choir_theme';

// 기본값은 라이트 모드. data-theme="dark"가 붙어 있을 때만 다크 모드로 취급한다.
export function toggleTheme() {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark';

    if (isDark) {
        root.removeAttribute('data-theme');
        try { localStorage.setItem(THEME_KEY, 'light'); } catch (e) {}
    } else {
        root.setAttribute('data-theme', 'dark');
        try { localStorage.setItem(THEME_KEY, 'dark'); } catch (e) {}
    }
}
