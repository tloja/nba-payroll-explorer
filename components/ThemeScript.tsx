// Inline, synchronous, no-flash theme bootstrap. Must run before the browser
// paints anything else in <body> — that's why this is a literal <script> tag
// placed as the very first child (app/layout.tsx), not a useEffect (which
// only runs after React hydrates, well after first paint). If a visitor has
// never toggled the theme, this intentionally does nothing: globals.css's
// `@media (prefers-color-scheme: dark)` block already renders the right
// theme for an unset preference with zero JS, so there's nothing to
// bootstrap in that case — only an explicit stored override needs restoring
// before paint.
const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export function ThemeScript() {
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />;
}
