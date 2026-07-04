//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//The colors and font that make up the look. Pass a partial theme to init to
//recolor everything at once. Anything you leave out keeps the default below.
export interface TweakTagsTheme {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primaryHover: string;
  danger: string;
  font: string;
}

//Our default theme: a calm dark look with a vibrant azure accent.
export const DEFAULT_THEME: TweakTagsTheme = {
  bg: '#0e0f13',
  surface: '#14151a',
  surfaceRaised: '#1e2028',
  border: '#2b2d38',
  text: '#f3f4f6',
  muted: '#9aa0ac',
  primary: '#0a84ff',
  primaryHover: '#3d9bff',
  danger: '#e5484d',
  font: '14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

//Merges a partial theme onto the default.
export const mergeTheme = (theme?: Partial<TweakTagsTheme>): TweakTagsTheme => ({
  ...DEFAULT_THEME,
  ...theme,
});

//The css custom property name for each token.
const VAR_NAMES: Record<keyof TweakTagsTheme, string> = {
  bg: '--tt-bg',
  surface: '--tt-surface',
  surfaceRaised: '--tt-raised',
  border: '--tt-border',
  text: '--tt-text',
  muted: '--tt-muted',
  primary: '--tt-primary',
  primaryHover: '--tt-primary-hover',
  danger: '--tt-danger',
  font: '--tt-font',
};

//Marks an element as a TweakTags root and sets the theme variables on it, so
//everything inside resolves the right colors. Used on every top level element,
//including ones appended straight to the body like toasts.
export const applyScope = (node: HTMLElement, theme: TweakTagsTheme): void => {
  node.classList.add('tt-scope');

  for (const key of Object.keys(VAR_NAMES) as Array<keyof TweakTagsTheme>) {
    node.style.setProperty(VAR_NAMES[key], theme[key]);
  }
};

const STYLE_ID = 'tt-styles';

//The full stylesheet, written against the css variables so themes just work.
const CSS = `
.tt-scope {
  --tt-bg: #0e0f13;
  --tt-surface: #14151a;
  --tt-raised: #1e2028;
  --tt-border: #2b2d38;
  --tt-text: #f3f4f6;
  --tt-muted: #9aa0ac;
  --tt-primary: #0a84ff;
  --tt-primary-hover: #3d9bff;
  --tt-danger: #e5484d;
  --tt-font: 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --tt-top: 2147483647;
  --tt-shadow: 0 10px 34px rgba(0, 0, 0, 0.45);
  color: var(--tt-text);
  font: var(--tt-font);
  box-sizing: border-box;
}
.tt-scope *, .tt-scope *::before, .tt-scope *::after { box-sizing: border-box; }

.tt-btn {
  padding: 0.45rem 0.8rem;
  border-radius: 0.5rem;
  border: none;
  background: var(--tt-primary);
  color: #fff;
  cursor: pointer;
  font: var(--tt-font);
  font-weight: 600;
  line-height: 1.1;
}
.tt-btn:hover { background: var(--tt-primary-hover); }
.tt-btn:disabled { opacity: 0.55; cursor: default; }
.tt-btn.tt-subtle {
  background: var(--tt-raised);
  border: 1px solid var(--tt-border);
  color: var(--tt-text);
  font-weight: 500;
}
.tt-btn.tt-subtle:hover { background: var(--tt-surface); }
.tt-btn.tt-danger { background: var(--tt-danger); }
.tt-btn.tt-danger:hover { filter: brightness(1.1); }
.tt-btn.tt-icon { width: 2.1rem; padding: 0.45rem 0; text-align: center; }
.tt-btn.tt-block { width: 100%; }

.tt-input {
  padding: 0.5rem 0.6rem;
  border-radius: 0.5rem;
  border: 1px solid var(--tt-border);
  background: var(--tt-raised);
  color: var(--tt-text);
  font: var(--tt-font);
  width: 100%;
}
.tt-input:focus { outline: 2px solid var(--tt-primary); outline-offset: -1px; }
textarea.tt-input { resize: vertical; }

.tt-grip {
  width: 10px;
  height: 18px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  flex: none;
  background-image: radial-gradient(var(--tt-muted) 1.2px, transparent 1.3px);
  background-size: 5px 5px;
  background-position: center;
}
.tt-email {
  color: var(--tt-muted);
  padding: 0 0.35rem;
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tt-header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.tt-close {
  border: none;
  background: transparent;
  color: var(--tt-text);
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0 0.25rem;
}

.tt-bar {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: var(--tt-top);
  display: flex;
  flex-wrap: wrap;
  max-width: calc(100vw - 2rem);
  gap: 0.4rem;
  align-items: center;
  padding: 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid var(--tt-border);
  background: var(--tt-surface);
  box-shadow: var(--tt-shadow);
}
.tt-fab {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: var(--tt-top);
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 1px solid var(--tt-border);
  background: var(--tt-primary);
  color: #fff;
  cursor: pointer;
  font-size: 1.1rem;
  box-shadow: var(--tt-shadow);
}
.tt-menu {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: var(--tt-top);
  width: min(20rem, calc(100vw - 2rem));
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid var(--tt-border);
  background: var(--tt-surface);
  box-shadow: var(--tt-shadow);
}
.tt-login {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: var(--tt-top);
  width: min(32rem, calc(100vw - 2rem));
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid var(--tt-border);
  background: var(--tt-surface);
  box-shadow: var(--tt-shadow);
}
.tt-login-fields { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.tt-login-fields .tt-input { flex: 1 1 9rem; min-width: 8rem; width: auto; }

.tt-panel {
  position: fixed;
  right: 1rem;
  bottom: 4.75rem;
  z-index: var(--tt-top);
  width: min(21rem, calc(100vw - 2rem));
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--tt-border);
  background: var(--tt-surface);
  box-shadow: var(--tt-shadow);
}
.tt-error { color: #ff9a9a; }
.tt-hint { color: var(--tt-muted); font-size: 12px; }
.tt-divider { width: 100%; border: none; border-top: 1px solid var(--tt-border); margin: 0; }

.tt-list {
  margin: 0;
  padding: 0 0.4rem 0 0;
  list-style: none;
  max-height: 16rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.tt-list-item { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.tt-mono { font-family: monospace; }
.tt-pager { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.tt-pager span { color: var(--tt-muted); white-space: nowrap; }

.tt-toolbar {
  position: fixed;
  z-index: var(--tt-top);
  display: inline-flex;
  gap: 0.15rem;
  padding: 0.3rem;
  border-radius: 0.5rem;
  border: 1px solid var(--tt-border);
  background: var(--tt-surface);
  box-shadow: var(--tt-shadow);
}
.tt-toolbar button {
  min-width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 0.35rem;
  background: transparent;
  color: var(--tt-text);
  cursor: pointer;
  font: var(--tt-font);
}
.tt-toolbar button:hover { background: var(--tt-raised); }

.tt-toasts {
  position: fixed;
  right: 1rem;
  top: 1rem;
  z-index: var(--tt-top);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: min(22rem, calc(100vw - 2rem));
}
.tt-toast {
  padding: 0.6rem 0.8rem;
  border-radius: 0.5rem;
  border: 1px solid var(--tt-border);
  background: var(--tt-surface);
  box-shadow: var(--tt-shadow);
  border-left: 3px solid var(--tt-primary);
}
.tt-toast.tt-success { border-left-color: #3fb950; }
.tt-toast.tt-error { border-left-color: var(--tt-danger); }

.tt-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--tt-top);
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.tt-confirm {
  width: min(24rem, 100%);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid var(--tt-border);
  background: var(--tt-surface);
  box-shadow: var(--tt-shadow);
}
.tt-confirm-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

.tt-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--tt-top);
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
}
.tt-modal {
  width: 100%;
  max-width: 1800px;
  height: 100vh;
  background: #111;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 60px rgba(0, 0, 0, 0.5);
}
.tt-modal-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #2a2a2a;
}
.tt-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.tt-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid #222;
}
.tt-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--tt-muted); }

.tt-admin {
  min-height: 100vh;
  background: var(--tt-bg);
  display: flex;
  flex-direction: column;
}
.tt-admin-shell {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.tt-admin-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--tt-border);
}
.tt-tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.tt-card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid var(--tt-border);
  background: var(--tt-surface);
}
.tt-listrow {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding: 0.75rem;
  border-radius: 0.6rem;
  border: 1px solid var(--tt-border);
  background: var(--tt-raised);
}
.tt-badge {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.1rem 0.4rem;
  border-radius: 0.3rem;
  border: 1px solid var(--tt-border);
  color: var(--tt-muted);
}
.tt-login-page {
  min-height: 100vh;
  background: var(--tt-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}
.tt-login-card {
  width: min(24rem, 100%);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.75rem;
  border-radius: 0.9rem;
  border: 1px solid var(--tt-border);
  background: var(--tt-surface);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}
.tt-field { display: flex; flex-direction: column; gap: 0.35rem; }

.tt-center { display: flex; align-items: center; justify-content: center; }
.tt-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  border: 3px solid var(--tt-border);
  border-top-color: var(--tt-primary);
  animation: tt-spin 0.8s linear infinite;
}
@keyframes tt-spin { to { transform: rotate(360deg); } }

.tt-scroll { scrollbar-width: thin; scrollbar-color: var(--tt-primary) var(--tt-raised); }
.tt-scroll::-webkit-scrollbar { width: 10px; }
.tt-scroll::-webkit-scrollbar-track { background: var(--tt-raised); border-radius: 5px; }
.tt-scroll::-webkit-scrollbar-thumb { background: var(--tt-primary); border-radius: 5px; }
.tt-scroll::-webkit-scrollbar-thumb:hover { background: var(--tt-primary-hover); }
`;

//Injects the stylesheet once, plus any extra css the user passed to init.
export const injectStyles = (extraCss?: string): void => {
  if (typeof document === 'undefined') {
    return;
  }

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  if (extraCss) {
    style.textContent += `\n${extraCss}`;
  }
};
