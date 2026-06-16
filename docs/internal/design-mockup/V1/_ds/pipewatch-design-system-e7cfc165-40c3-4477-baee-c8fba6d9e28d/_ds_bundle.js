/* @ds-bundle: {"format":3,"namespace":"PipeWatchDesignSystem_e7cfc1","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"StatusBadge","sourcePath":"components/core/StatusBadge.jsx"},{"name":"RepoCard","sourcePath":"components/data/RepoCard.jsx"},{"name":"Sparkline","sourcePath":"components/data/Sparkline.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"RunPulse","sourcePath":"components/feedback/RunPulse.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"RadioGroup","sourcePath":"components/forms/RadioGroup.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"Dialog","sourcePath":"components/overlay/Dialog.jsx"},{"name":"Toast","sourcePath":"components/overlay/Toast.jsx"},{"name":"ToastStack","sourcePath":"components/overlay/ToastStack.jsx"},{"name":"Tooltip","sourcePath":"components/overlay/Tooltip.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"1d2848c2bb23","components/core/Badge.jsx":"ca31e8a43eb7","components/core/Button.jsx":"691ee91ace99","components/core/Card.jsx":"fd65d2b09ace","components/core/Input.jsx":"e4d09d09ed54","components/core/StatusBadge.jsx":"5f901c9b2920","components/data/RepoCard.jsx":"41f1daab57ba","components/data/Sparkline.jsx":"b3f5785828d3","components/feedback/EmptyState.jsx":"e57f0cac46b8","components/feedback/RunPulse.jsx":"c84e093adbd9","components/feedback/Skeleton.jsx":"485a0170bc1e","components/forms/Checkbox.jsx":"cd7271d6f3c1","components/forms/Radio.jsx":"ebcbe95d3604","components/forms/RadioGroup.jsx":"63d02031c20e","components/forms/Select.jsx":"d3e6a0e1017f","components/forms/Switch.jsx":"f569c42de915","components/navigation/Tabs.jsx":"afdeb3e47cd6","components/overlay/Dialog.jsx":"1debacaf07c6","components/overlay/Toast.jsx":"c0513db91a59","components/overlay/ToastStack.jsx":"712a2118de3b","components/overlay/Tooltip.jsx":"81fa6847dd27","ui_kits/app/App.jsx":"123cbe96a964"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.PipeWatchDesignSystem_e7cfc1 = window.PipeWatchDesignSystem_e7cfc1 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
const _CSS = `
.pw-avatar {
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-full); overflow: hidden; flex-shrink: 0;
  background: var(--bg-elevated); color: var(--text-secondary);
  font-family: var(--font-sans); font-weight: var(--weight-semibold);
  border: 1px solid var(--border-subtle);
  user-select: none;
}
.pw-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pw-avatar-2xs { width: 16px; height: 16px; font-size: 7px; }
.pw-avatar-xs  { width: 20px; height: 20px; font-size: 8px; }
.pw-avatar-sm  { width: 24px; height: 24px; font-size: 10px; }
.pw-avatar-md  { width: 32px; height: 32px; font-size: 12px; }
.pw-avatar-lg  { width: 40px; height: 40px; font-size: 15px; }
.pw-avatar-xl  { width: 56px; height: 56px; font-size: 20px; }
.pw-avatar-rounded { border-radius: var(--radius-lg); }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Avatar';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function toInitials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}
function Avatar({
  src,
  name,
  size = 'md',
  rounded = false,
  className = '',
  style
}) {
  const cls = ['pw-avatar', `pw-avatar-${size}`, rounded && 'pw-avatar-rounded', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("span", {
    className: cls,
    style: style,
    title: name,
    "aria-label": name
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name || 'Avatar'
  }) : toInitials(name));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const _CSS = `
.pw-badge {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 1px var(--space-1-5); border-radius: var(--radius-sm);
  font-family: var(--font-sans); font-size: var(--text-xs);
  font-weight: var(--weight-medium); line-height: 1.4;
  white-space: nowrap; flex-shrink: 0;
  border: 1px solid transparent;
}
.pw-badge-default {
  background: var(--bg-elevated); color: var(--text-secondary);
  border-color: var(--border-default);
}
.pw-badge-accent {
  background: oklch(70% 0.195 55 / 0.12); color: var(--pw-amber-500);
  border-color: oklch(70% 0.195 55 / 0.28);
}
.pw-badge-success {
  background: var(--status-success-subtle); color: var(--status-success);
}
.pw-badge-failure {
  background: var(--status-failure-subtle); color: var(--status-failure);
}
.pw-badge-outline {
  background: transparent; color: var(--text-secondary);
  border-color: var(--border-default);
}
.pw-badge-mono { font-family: var(--font-mono); letter-spacing: -0.02em; font-size: var(--text-2xs); }
.pw-badge-pill { border-radius: var(--radius-full); padding: 1px var(--space-2); }
.pw-badge-lg   { font-size: var(--text-sm); padding: 2px var(--space-2); }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Badge';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function Badge({
  variant = 'default',
  mono = false,
  pill = false,
  size,
  className = '',
  children,
  ...rest
}) {
  const cls = ['pw-badge', `pw-badge-${variant}`, mono && 'pw-badge-mono', pill && 'pw-badge-pill', size === 'lg' && 'pw-badge-lg', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// ─── CSS injection ──────────────────────────────────────────────────────────
const _CSS = `
.pw-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-2); font-family: var(--font-sans);
  font-weight: var(--weight-medium); letter-spacing: -0.01em; line-height: 1;
  border-radius: var(--radius-md); border: 1px solid transparent;
  cursor: pointer; white-space: nowrap; text-decoration: none; outline: none;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color            var(--duration-fast) var(--ease-out),
    border-color     var(--duration-fast) var(--ease-out),
    box-shadow       var(--duration-fast) var(--ease-out),
    transform        var(--duration-fast) var(--ease-out),
    opacity          var(--duration-fast) var(--ease-out);
}
.pw-btn:focus-visible {
  box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--focus-ring);
}
.pw-btn:active:not(:disabled) { transform: scale(0.97); }
.pw-btn:disabled { opacity: 0.42; cursor: not-allowed; pointer-events: none; }

.pw-btn-sm { height: 28px; padding: 0 var(--space-3); font-size: var(--text-xs); }
.pw-btn-md { height: 34px; padding: 0 var(--space-4); font-size: var(--text-base); }
.pw-btn-lg { height: 40px; padding: 0 var(--space-5); font-size: var(--text-md); }
.pw-btn-xl { height: 48px; padding: 0 var(--space-6); font-size: var(--text-lg); }

.pw-btn-primary { background: var(--interactive-accent); color: var(--interactive-fg); }
.pw-btn-primary:hover:not(:disabled) { background: var(--interactive-hover); }
.pw-btn-primary:active:not(:disabled) { background: var(--interactive-active); }

.pw-btn-secondary {
  background: var(--bg-elevated); color: var(--text-primary);
  border-color: var(--border-default);
}
.pw-btn-secondary:hover:not(:disabled) {
  background: var(--bg-overlay); border-color: var(--border-strong);
}

.pw-btn-ghost { background: transparent; color: var(--text-secondary); }
.pw-btn-ghost:hover:not(:disabled) {
  background: var(--bg-elevated); color: var(--text-primary);
}

.pw-btn-danger {
  background: transparent; color: var(--status-failure);
  border-color: var(--status-failure);
}
.pw-btn-danger:hover:not(:disabled) { background: var(--status-failure-subtle); }

.pw-btn-icon-only.pw-btn-sm { width: 28px; padding: 0; }
.pw-btn-icon-only.pw-btn-md { width: 34px; padding: 0; }
.pw-btn-icon-only.pw-btn-lg { width: 40px; padding: 0; }
.pw-btn-icon-only.pw-btn-xl { width: 48px; padding: 0; }

@keyframes pw-btn-spin { to { transform: rotate(360deg); } }
.pw-btn-spinner { animation: pw-btn-spin 0.7s linear infinite; flex-shrink: 0; }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Button';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function SpinnerIcon({
  sz = 14
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: sz,
    height: sz,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    className: "pw-btn-spinner"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12a9 9 0 1 1-4.216-7.632"
  }));
}
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  iconOnly = false,
  type = 'button',
  className = '',
  style,
  children,
  onClick,
  ...rest
}) {
  const cls = ['pw-btn', `pw-btn-${size}`, `pw-btn-${variant}`, iconOnly && 'pw-btn-icon-only', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: cls,
    disabled: disabled || loading,
    onClick: onClick,
    style: style
  }, rest), loading && /*#__PURE__*/React.createElement(SpinnerIcon, {
    sz: size === 'sm' ? 12 : size === 'lg' || size === 'xl' ? 18 : 14
  }), !loading && icon && iconPosition === 'left' && icon, children && /*#__PURE__*/React.createElement("span", null, children), !loading && icon && iconPosition === 'right' && icon);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
const _CSS = `
.pw-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.pw-card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
  gap: var(--space-3);
}
.pw-card-body  { padding: var(--space-5); }
.pw-card-flush { padding: 0; }
.pw-card-footer {
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}
.pw-card-sm .pw-card-header { padding: var(--space-3) var(--space-4); }
.pw-card-sm .pw-card-body   { padding: var(--space-4); }
.pw-card-sm .pw-card-footer { padding: var(--space-2) var(--space-4); }
.pw-card-title    { font-family: var(--font-sans); font-size: var(--text-md); font-weight: var(--weight-semibold); color: var(--text-primary); margin: 0; }
.pw-card-subtitle { font-family: var(--font-sans); font-size: var(--text-sm); color: var(--text-secondary); margin: var(--space-0-5) 0 0; }
.pw-card-interactive {
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow   var(--duration-fast) var(--ease-out);
}
.pw-card-interactive:hover {
  border-color: var(--border-strong); box-shadow: var(--shadow-sm);
}
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Card';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function Card({
  title,
  subtitle,
  actions,
  footer,
  size = 'md',
  interactive = false,
  flush = false,
  className = '',
  style,
  children,
  onClick
}) {
  const cls = ['pw-card', size === 'sm' && 'pw-card-sm', interactive && 'pw-card-interactive', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", {
    className: cls,
    style: style,
    onClick: onClick
  }, (title || actions) && /*#__PURE__*/React.createElement("div", {
    className: "pw-card-header"
  }, /*#__PURE__*/React.createElement("div", null, title && /*#__PURE__*/React.createElement("p", {
    className: "pw-card-title"
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    className: "pw-card-subtitle"
  }, subtitle)), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0
    }
  }, actions)), /*#__PURE__*/React.createElement("div", {
    className: flush ? 'pw-card-flush' : 'pw-card-body'
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    className: "pw-card-footer"
  }, footer));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const _CSS = `
.pw-input-wrap { display: flex; flex-direction: column; gap: var(--space-1); }

.pw-input-label {
  font-family: var(--font-sans); font-size: var(--text-xs);
  font-weight: var(--weight-medium); color: var(--text-secondary);
  letter-spacing: var(--tracking-wide); text-transform: uppercase;
}
.pw-input-field {
  height: 34px; padding: 0 var(--space-3);
  background: var(--bg-sunken); color: var(--text-primary);
  border: 1px solid var(--border-default); border-radius: var(--radius-md);
  font-family: var(--font-sans); font-size: var(--text-base);
  outline: none; width: 100%; box-sizing: border-box;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow   var(--duration-fast) var(--ease-out);
}
.pw-input-field::placeholder { color: var(--text-tertiary); }
.pw-input-field:hover:not(:disabled) { border-color: var(--border-strong); }
.pw-input-field:focus {
  border-color: var(--interactive-accent);
  box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px oklch(70% 0.195 55 / 0.30);
}
.pw-input-field:disabled { opacity: 0.45; cursor: not-allowed; }

.pw-input-error .pw-input-field { border-color: var(--status-failure); }
.pw-input-error .pw-input-field:focus {
  box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--status-failure-subtle);
}
.pw-input-mono .pw-input-field {
  font-family: var(--font-mono); font-size: var(--text-sm);
  letter-spacing: -0.02em;
}
.pw-input-lg .pw-input-field { height: 40px; font-size: var(--text-md); }

.pw-input-help      { font-family: var(--font-sans); font-size: var(--text-xs); color: var(--text-tertiary); }
.pw-input-error-msg { font-family: var(--font-sans); font-size: var(--text-xs); color: var(--status-failure); }

.pw-input-box { position: relative; }
.pw-input-prefix, .pw-input-suffix {
  position: absolute; top: 50%; transform: translateY(-50%);
  color: var(--text-tertiary); pointer-events: none;
  display: flex; align-items: center;
}
.pw-input-prefix { left: var(--space-3); }
.pw-input-suffix { right: var(--space-3); }
.pw-input-has-prefix .pw-input-field { padding-left: var(--space-8); }
.pw-input-has-suffix .pw-input-field { padding-right: var(--space-8); }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Input';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
let _uid = 0;
function Input({
  label,
  id,
  error,
  hint,
  mono = false,
  prefix,
  suffix,
  size,
  className = '',
  ...rest
}) {
  const fieldId = id || `pw-input-${++_uid}`;
  const hasError = Boolean(error);
  const wrapCls = ['pw-input-wrap', hasError && 'pw-input-error', mono && 'pw-input-mono', size === 'lg' && 'pw-input-lg', className].filter(Boolean).join(' ');
  const boxCls = ['pw-input-box', prefix && 'pw-input-has-prefix', suffix && 'pw-input-has-suffix'].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", {
    className: wrapCls
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    className: "pw-input-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: boxCls
  }, prefix && /*#__PURE__*/React.createElement("span", {
    className: "pw-input-prefix"
  }, prefix), /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    className: "pw-input-field"
  }, rest)), suffix && /*#__PURE__*/React.createElement("span", {
    className: "pw-input-suffix"
  }, suffix)), hasError && /*#__PURE__*/React.createElement("span", {
    className: "pw-input-error-msg"
  }, error), hint && !hasError && /*#__PURE__*/React.createElement("span", {
    className: "pw-input-help"
  }, hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusBadge.jsx
try { (() => {
const _CSS = `
.pw-status {
  display: inline-flex; align-items: center; gap: var(--space-1-5);
  padding: 3px var(--space-2); border-radius: var(--radius-sm);
  font-family: var(--font-sans); font-size: var(--text-xs);
  font-weight: var(--weight-medium); line-height: 1; white-space: nowrap;
  flex-shrink: 0;
}
.pw-status-lg {
  padding: var(--space-1) var(--space-2-5);
  font-size: var(--text-sm); border-radius: var(--radius-md);
}
.pw-status-dot {
  width: 6px; height: 6px; border-radius: var(--radius-full); flex-shrink: 0;
}
@keyframes pw-status-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
@keyframes pw-status-spin  { to { transform: rotate(360deg); } }
.pw-status-pulse { animation: pw-status-pulse 1.5s ease-in-out infinite; }
.pw-status-spin  { animation: pw-status-spin  0.9s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .pw-status-pulse, .pw-status-spin { animation: none; }
}
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'StatusBadge';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
const ICONS = {
  success: /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "6.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 8l2 2 4-4"
  })),
  failure: /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "6.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10.5 5.5l-5 5M5.5 5.5l5 5"
  })),
  running: /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    className: "pw-status-spin"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M14 8a6 6 0 1 1-2.2-4.6"
  })),
  cancelled: /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "6.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 8h6"
  })),
  skipped: /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "6.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 5.5l3 2.5-3 2.5V5.5zM10.5 5.5v5"
  })),
  queued: /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "6.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 5v3l2 2"
  }))
};
const STATUS = {
  success: {
    label: 'Succeeded',
    color: 'var(--status-success)',
    bg: 'var(--status-success-subtle)'
  },
  failure: {
    label: 'Failed',
    color: 'var(--status-failure)',
    bg: 'var(--status-failure-subtle)'
  },
  running: {
    label: 'Running',
    color: 'var(--status-running)',
    bg: 'var(--status-running-subtle)',
    pulse: true
  },
  cancelled: {
    label: 'Cancelled',
    color: 'var(--status-cancelled)',
    bg: 'var(--status-cancelled-subtle)'
  },
  skipped: {
    label: 'Skipped',
    color: 'var(--status-skipped)',
    bg: 'var(--status-skipped-subtle)'
  },
  queued: {
    label: 'Queued',
    color: 'var(--status-queued)',
    bg: 'var(--status-queued-subtle)'
  }
};
function StatusBadge({
  status = 'success',
  label,
  size = 'md',
  showDot = false,
  showIcon = true
}) {
  const cfg = STATUS[status] || STATUS.success;
  return /*#__PURE__*/React.createElement("span", {
    className: `pw-status${size === 'lg' ? ' pw-status-lg' : ''}`,
    style: {
      color: cfg.color,
      background: cfg.bg
    }
  }, showDot && /*#__PURE__*/React.createElement("span", {
    className: `pw-status-dot${cfg.pulse ? ' pw-status-pulse' : ''}`,
    style: {
      background: cfg.color
    }
  }), showIcon && ICONS[status], label ?? cfg.label);
}
Object.assign(__ds_scope, { StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/data/Sparkline.jsx
try { (() => {
function Sparkline({
  data = [],
  width = 80,
  height = 24,
  color,
  strokeWidth = 1.5,
  showArea = false,
  showDot = true
}) {
  if (!data || data.length < 2) {
    return /*#__PURE__*/React.createElement("svg", {
      width: width,
      height: height,
      viewBox: `0 0 ${width} ${height}`
    }, /*#__PURE__*/React.createElement("line", {
      x1: "0",
      y1: height / 2,
      x2: width,
      y2: height / 2,
      stroke: "var(--border-default)",
      strokeWidth: "1",
      strokeDasharray: "3 3"
    }));
  }
  const pad = strokeWidth + 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: pad + i / (data.length - 1) * (width - 2 * pad),
    y: height - pad - (v - min) / range * (height - 2 * pad)
  }));
  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const stroke = color || 'var(--pw-chart-1)';
  return /*#__PURE__*/React.createElement("svg", {
    width: width,
    height: height,
    viewBox: `0 0 ${width} ${height}`,
    style: {
      overflow: 'visible',
      display: 'block'
    }
  }, showArea && /*#__PURE__*/React.createElement("path", {
    d: `${lineD} L${last.x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height}Z`,
    fill: stroke,
    opacity: "0.08"
  }), /*#__PURE__*/React.createElement("path", {
    d: lineD,
    fill: "none",
    stroke: stroke,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), showDot && /*#__PURE__*/React.createElement("circle", {
    cx: last.x.toFixed(1),
    cy: last.y.toFixed(1),
    r: strokeWidth * 2,
    fill: stroke
  }));
}
Object.assign(__ds_scope, { Sparkline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Sparkline.jsx", error: String((e && e.message) || e) }); }

// components/data/RepoCard.jsx
try { (() => {
const _CSS = `
.pw-repo-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-3);
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow   var(--duration-fast) var(--ease-out);
}
.pw-repo-card:hover {
  border-color: var(--border-strong); box-shadow: var(--shadow-sm);
}
.pw-repo-card:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--focus-ring);
}
.pw-repo-card-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3);
}
.pw-repo-card-org  { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); }
.pw-repo-card-name { font-family: var(--font-mono); font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--text-primary); margin: 2px 0 0; }
.pw-repo-card-meta { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.pw-repo-card-branch {
  font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-secondary);
  background: var(--bg-elevated); padding: 2px var(--space-2); border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}
.pw-repo-card-time  { font-family: var(--font-sans); font-size: var(--text-xs); color: var(--text-tertiary); }
.pw-repo-card-foot  { display: flex; align-items: center; justify-content: space-between; }
.pw-repo-card-dur   { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-tertiary); }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'RepoCard';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function RepoCard({
  name,
  org,
  branch,
  status = 'success',
  lastRunTime,
  duration,
  trend = [],
  onClick
}) {
  const trendColor = status === 'failure' ? 'var(--status-failure)' : 'var(--status-success)';
  return /*#__PURE__*/React.createElement("div", {
    className: "pw-repo-card",
    onClick: onClick,
    role: "button",
    tabIndex: 0,
    onKeyDown: e => e.key === 'Enter' && onClick?.()
  }, /*#__PURE__*/React.createElement("div", {
    className: "pw-repo-card-head"
  }, /*#__PURE__*/React.createElement("div", null, org && /*#__PURE__*/React.createElement("div", {
    className: "pw-repo-card-org"
  }, org, "/"), /*#__PURE__*/React.createElement("div", {
    className: "pw-repo-card-name"
  }, name)), /*#__PURE__*/React.createElement(__ds_scope.StatusBadge, {
    status: status
  })), /*#__PURE__*/React.createElement("div", {
    className: "pw-repo-card-meta"
  }, branch && /*#__PURE__*/React.createElement("span", {
    className: "pw-repo-card-branch"
  }, branch), lastRunTime && /*#__PURE__*/React.createElement("span", {
    className: "pw-repo-card-time"
  }, lastRunTime)), /*#__PURE__*/React.createElement("div", {
    className: "pw-repo-card-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pw-repo-card-dur"
  }, duration || '—'), trend.length > 1 && /*#__PURE__*/React.createElement(__ds_scope.Sparkline, {
    data: trend,
    width: 80,
    height: 20,
    color: trendColor,
    strokeWidth: 1.5,
    showArea: true
  })));
}
Object.assign(__ds_scope, { RepoCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/RepoCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
const _CSS = `
.pw-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center;
  padding: var(--space-16) var(--space-8);
  gap: var(--space-2);
}
.pw-empty-icon {
  color: var(--text-tertiary);
  margin-bottom: var(--space-2);
  opacity: 0.7;
}
.pw-empty-title {
  font-family: var(--font-sans); font-size: var(--text-md);
  font-weight: var(--weight-medium); color: var(--text-secondary);
  margin: 0; line-height: var(--leading-tight);
}
.pw-empty-desc {
  font-family: var(--font-sans); font-size: var(--text-sm);
  color: var(--text-tertiary); margin: 0;
  max-width: 340px; line-height: var(--leading-normal);
}
.pw-empty-actions {
  display: flex; gap: var(--space-2); margin-top: var(--space-3);
  flex-wrap: wrap; justify-content: center;
}
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'EmptyState';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function EmptyState({
  icon,
  title,
  description,
  actions,
  className = ''
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `pw-empty ${className}`
  }, icon && /*#__PURE__*/React.createElement("div", {
    className: "pw-empty-icon"
  }, icon), title && /*#__PURE__*/React.createElement("p", {
    className: "pw-empty-title"
  }, title), description && /*#__PURE__*/React.createElement("p", {
    className: "pw-empty-desc"
  }, description), actions && /*#__PURE__*/React.createElement("div", {
    className: "pw-empty-actions"
  }, actions));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/RunPulse.jsx
try { (() => {
const _CSS = `
.pw-pulse-wrap {
  display: inline-flex; align-items: center; gap: var(--space-2);
}
.pw-pulse-dot {
  border-radius: var(--radius-full); flex-shrink: 0;
  animation: pw-pulse-beat 1.5s ease-in-out infinite;
}
@keyframes pw-pulse-beat { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
.pw-pulse-ring {
  position: relative;
}
.pw-pulse-ring::before {
  content: ''; position: absolute;
  inset: -3px; border-radius: var(--radius-full);
  background: var(--status-running-subtle);
  animation: pw-pulse-ring-expand 1.5s ease-out infinite;
}
@keyframes pw-pulse-ring-expand {
  0%   { transform: scale(1);   opacity: 0.8; }
  100% { transform: scale(2.4); opacity: 0;   }
}
.pw-pulse-label {
  font-family: var(--font-sans); font-size: var(--text-xs);
  font-weight: var(--weight-medium); color: var(--status-running);
}
@media (prefers-reduced-motion: reduce) {
  .pw-pulse-dot, .pw-pulse-ring::before { animation: none; }
}
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'RunPulse';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function RunPulse({
  size = 8,
  label,
  ring = false,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "pw-pulse-wrap",
    style: style
  }, /*#__PURE__*/React.createElement("span", {
    className: `pw-pulse-dot${ring ? ' pw-pulse-ring' : ''}`,
    style: {
      width: size,
      height: size,
      background: 'var(--status-running)'
    }
  }), label && /*#__PURE__*/React.createElement("span", {
    className: "pw-pulse-label"
  }, label));
}
Object.assign(__ds_scope, { RunPulse });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/RunPulse.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
const _CSS = `
.pw-skeleton {
  background: linear-gradient(90deg,
    var(--bg-elevated) 25%,
    var(--bg-overlay)  50%,
    var(--bg-elevated) 75%
  );
  background-size: 200% 100%;
  animation: pw-shimmer 1.6s ease-in-out infinite;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
@keyframes pw-shimmer {
  0%   { background-position:  200% 0; }
  100% { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .pw-skeleton { animation: none; background: var(--bg-elevated); }
}
.pw-skeleton-circle { border-radius: var(--radius-full); }
.pw-skeleton-rounded { border-radius: var(--radius-lg); }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Skeleton';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function Skeleton({
  variant = 'line',
  width,
  height,
  className = '',
  style
}) {
  const cls = ['pw-skeleton', variant === 'circle' && 'pw-skeleton-circle', variant === 'rounded' && 'pw-skeleton-rounded', className].filter(Boolean).join(' ');
  const defaultH = variant === 'circle' ? 32 : variant === 'line' ? 12 : 80;
  const defaultW = variant === 'circle' ? 32 : '100%';
  return /*#__PURE__*/React.createElement("div", {
    className: cls,
    "aria-hidden": "true",
    style: {
      width: width ?? defaultW,
      height: height ?? defaultH,
      ...style
    }
  });
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
const _CSS = `
.pw-cb-wrap {
  display: inline-flex; align-items: flex-start; gap: 9px;
  cursor: pointer; user-select: none;
}
.pw-cb-wrap.pw-cb-disabled { opacity: 0.42; cursor: not-allowed; }
.pw-cb-box {
  position: relative; flex-shrink: 0; width: 16px; height: 16px; margin-top: 1px;
  border: 1.5px solid var(--border-strong); border-radius: var(--radius-sm);
  background: var(--bg-sunken);
  transition: border-color 100ms, background-color 100ms, box-shadow 100ms;
  display: flex; align-items: center; justify-content: center;
}
input[type="checkbox"].pw-cb-input {
  position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: inherit; inset: 0;
}
.pw-cb-wrap:hover:not(.pw-cb-disabled) .pw-cb-box { border-color: var(--interactive-accent); }
.pw-cb-wrap:focus-within .pw-cb-box { box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--focus-ring); }
.pw-cb-box.pw-cb-on  { background: var(--interactive-accent); border-color: var(--interactive-accent); }
.pw-cb-box.pw-cb-ind { background: var(--interactive-accent); border-color: var(--interactive-accent); }
.pw-cb-mark { color: var(--interactive-fg); flex-shrink: 0; }
.pw-cb-labels { display: flex; flex-direction: column; gap: 2px; }
.pw-cb-label { font-family: var(--font-sans); font-size: var(--text-base); color: var(--text-primary); line-height: 1.4; }
.pw-cb-hint  { font-family: var(--font-sans); font-size: var(--text-xs); color: var(--text-tertiary); }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Checkbox';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function Checkbox({
  label,
  checked = false,
  onChange,
  disabled = false,
  indeterminate = false,
  hint,
  id
}) {
  const inputId = id || (label ? `pw-cb-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const boxCls = ['pw-cb-box', checked && 'pw-cb-on', indeterminate && 'pw-cb-ind'].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("label", {
    className: `pw-cb-wrap${disabled ? ' pw-cb-disabled' : ''}`,
    htmlFor: inputId
  }, /*#__PURE__*/React.createElement("div", {
    className: boxCls
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    id: inputId,
    className: "pw-cb-input",
    checked: checked,
    onChange: e => onChange?.(e.target.checked),
    disabled: disabled
  }), checked && !indeterminate && /*#__PURE__*/React.createElement("svg", {
    className: "pw-cb-mark",
    width: "10",
    height: "10",
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "2 6 5 9 10 3"
  })), indeterminate && /*#__PURE__*/React.createElement("svg", {
    className: "pw-cb-mark",
    width: "10",
    height: "10",
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "2.5",
    y1: "6",
    x2: "9.5",
    y2: "6"
  }))), (label || hint) && /*#__PURE__*/React.createElement("div", {
    className: "pw-cb-labels"
  }, label && /*#__PURE__*/React.createElement("span", {
    className: "pw-cb-label"
  }, label), hint && /*#__PURE__*/React.createElement("span", {
    className: "pw-cb-hint"
  }, hint)));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
const _CSS = `
.pw-radio-wrap {
  display: inline-flex; align-items: flex-start; gap: 9px;
  cursor: pointer; user-select: none;
}
.pw-radio-wrap.pw-radio-disabled { opacity: 0.42; cursor: not-allowed; }
.pw-radio-circle {
  position: relative; flex-shrink: 0; width: 16px; height: 16px; margin-top: 1px;
  border: 1.5px solid var(--border-strong); border-radius: 9999px;
  background: var(--bg-sunken);
  transition: border-color 100ms, box-shadow 100ms;
  display: flex; align-items: center; justify-content: center;
}
input[type="radio"].pw-radio-input {
  position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: inherit; inset: 0;
}
.pw-radio-wrap:hover:not(.pw-radio-disabled) .pw-radio-circle { border-color: var(--interactive-accent); }
.pw-radio-wrap:focus-within .pw-radio-circle { box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--focus-ring); }
.pw-radio-circle.pw-radio-on { border-width: 5px; border-color: var(--interactive-accent); }
.pw-radio-label { font-family: var(--font-sans); font-size: var(--text-base); color: var(--text-primary); line-height: 1.4; }
.pw-radio-hint  { font-family: var(--font-sans); font-size: var(--text-xs); color: var(--text-tertiary); margin-top: 2px; }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Radio';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function Radio({
  label,
  checked = false,
  onChange,
  disabled = false,
  name,
  value,
  hint,
  id
}) {
  const inputId = id || (value ? `pw-radio-${name}-${value}` : undefined);
  return /*#__PURE__*/React.createElement("label", {
    className: `pw-radio-wrap${disabled ? ' pw-radio-disabled' : ''}`,
    htmlFor: inputId
  }, /*#__PURE__*/React.createElement("div", {
    className: `pw-radio-circle${checked ? ' pw-radio-on' : ''}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    id: inputId,
    className: "pw-radio-input",
    checked: checked,
    onChange: e => e.target.checked && onChange?.(value),
    disabled: disabled,
    name: name,
    value: value
  })), (label || hint) && /*#__PURE__*/React.createElement("div", null, label && /*#__PURE__*/React.createElement("div", {
    className: "pw-radio-label"
  }, label), hint && /*#__PURE__*/React.createElement("div", {
    className: "pw-radio-hint"
  }, hint)));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/RadioGroup.jsx
try { (() => {
const _CSS = `
.pw-rg-wrap { display: flex; flex-direction: column; gap: 4px; }
.pw-rg-label { font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--text-secondary); margin-bottom: 6px; }
.pw-rg-list  { display: flex; flex-direction: column; gap: 10px; }
.pw-rg-list.pw-rg-inline { flex-direction: row; flex-wrap: wrap; gap: 16px; }
.pw-rg-hint  { font-family: var(--font-sans); font-size: var(--text-xs); color: var(--text-tertiary); margin-top: 4px; }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'RadioGroup';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function RadioGroup({
  label,
  options = [],
  value,
  onChange,
  name = 'rg',
  disabled = false,
  inline = false,
  hint
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "pw-rg-wrap"
  }, label && /*#__PURE__*/React.createElement("div", {
    className: "pw-rg-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: `pw-rg-list${inline ? ' pw-rg-inline' : ''}`,
    role: "radiogroup"
  }, options.map(opt => {
    const v = typeof opt === 'string' ? opt : opt.value;
    const l = typeof opt === 'string' ? opt : opt.label;
    const h = typeof opt === 'object' ? opt.hint : undefined;
    return /*#__PURE__*/React.createElement(__ds_scope.Radio, {
      key: v,
      name: name,
      value: v,
      label: l,
      hint: h,
      checked: value === v,
      onChange: onChange,
      disabled: disabled || typeof opt === 'object' && opt.disabled
    });
  })), hint && /*#__PURE__*/React.createElement("div", {
    className: "pw-rg-hint"
  }, hint));
}
Object.assign(__ds_scope, { RadioGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/RadioGroup.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
const _CSS = `
.pw-sel-wrap { display: flex; flex-direction: column; gap: 5px; }
.pw-sel-label { font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--text-secondary); }
.pw-sel-rel { position: relative; }
select.pw-sel {
  width: 100%; padding: 0 var(--space-8) 0 var(--space-3);
  background: var(--bg-sunken); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); font-family: var(--font-sans);
  color: var(--text-primary); outline: none; cursor: pointer;
  appearance: none; -webkit-appearance: none;
  transition: border-color 100ms, box-shadow 100ms;
}
select.pw-sel-sm { height: 28px; font-size: var(--text-xs); }
select.pw-sel-md { height: 34px; font-size: var(--text-base); }
select.pw-sel-lg { height: 40px; font-size: var(--text-md); }
select.pw-sel:hover:not(:disabled) { border-color: var(--border-strong); }
select.pw-sel:focus {
  border-color: var(--focus-ring);
  box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--focus-ring);
}
select.pw-sel:disabled { opacity: 0.42; cursor: not-allowed; }
select.pw-sel.pw-sel-err { border-color: var(--status-failure); }
select.pw-sel.pw-sel-mono { font-family: var(--font-mono); font-size: var(--text-xs); }
select.pw-sel option { background: var(--bg-overlay); color: var(--text-primary); }
.pw-sel-chevron { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-tertiary); }
.pw-sel-hint   { font-family: var(--font-sans); font-size: var(--text-xs); color: var(--text-tertiary); }
.pw-sel-errmsg { font-family: var(--font-sans); font-size: var(--text-xs); color: var(--status-failure); }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Select';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
const Chevron = () => /*#__PURE__*/React.createElement("svg", {
  width: "12",
  height: "12",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("polyline", {
  points: "6 9 12 15 18 9"
}));
function Select({
  label,
  options = [],
  value,
  onChange,
  placeholder,
  size = 'md',
  error,
  hint,
  disabled = false,
  mono = false,
  id,
  className = '',
  style
}) {
  const inputId = id || (label ? `pw-sel-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return /*#__PURE__*/React.createElement("div", {
    className: `pw-sel-wrap ${className}`,
    style: style
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    className: "pw-sel-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "pw-sel-rel"
  }, /*#__PURE__*/React.createElement("select", {
    id: inputId,
    className: ['pw-sel', `pw-sel-${size}`, mono && 'pw-sel-mono', error && 'pw-sel-err'].filter(Boolean).join(' '),
    value: value ?? '',
    onChange: e => onChange?.(e.target.value),
    disabled: disabled
  }, placeholder && /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder), options.map(opt => {
    const v = typeof opt === 'string' ? opt : opt.value;
    const l = typeof opt === 'string' ? opt : opt.label;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v,
      disabled: opt.disabled
    }, l);
  })), /*#__PURE__*/React.createElement("span", {
    className: "pw-sel-chevron"
  }, /*#__PURE__*/React.createElement(Chevron, null))), error && /*#__PURE__*/React.createElement("span", {
    className: "pw-sel-errmsg"
  }, error), hint && !error && /*#__PURE__*/React.createElement("span", {
    className: "pw-sel-hint"
  }, hint));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
const _CSS = `
.pw-sw-wrap {
  display: inline-flex; align-items: center; gap: 10px;
  cursor: pointer; user-select: none;
}
.pw-sw-wrap.pw-sw-disabled { opacity: 0.42; cursor: not-allowed; }
.pw-sw-track {
  position: relative; flex-shrink: 0; border-radius: 9999px;
  background: var(--bg-overlay); border: 1px solid var(--border-default);
  transition: background 150ms, border-color 150ms;
}
.pw-sw-sm .pw-sw-track { width: 28px; height: 16px; }
.pw-sw-md .pw-sw-track { width: 36px; height: 20px; }
.pw-sw-lg .pw-sw-track { width: 44px; height: 24px; }
.pw-sw-track.pw-sw-on { background: var(--interactive-accent); border-color: var(--interactive-accent); }
.pw-sw-thumb {
  position: absolute; top: 50%; border-radius: 9999px;
  background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.25);
  transform: translateY(-50%) translateX(0);
  transition: transform 150ms cubic-bezier(0,0,0.2,1);
}
.pw-sw-sm .pw-sw-thumb { width: 10px; height: 10px; left: 2px; }
.pw-sw-md .pw-sw-thumb { width: 14px; height: 14px; left: 2px; }
.pw-sw-lg .pw-sw-thumb { width: 18px; height: 18px; left: 2px; }
.pw-sw-sm .pw-sw-track.pw-sw-on .pw-sw-thumb { transform: translateY(-50%) translateX(12px); }
.pw-sw-md .pw-sw-track.pw-sw-on .pw-sw-thumb { transform: translateY(-50%) translateX(16px); }
.pw-sw-lg .pw-sw-track.pw-sw-on .pw-sw-thumb { transform: translateY(-50%) translateX(20px); }
input.pw-sw-input { position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none; }
.pw-sw-wrap:focus-within .pw-sw-track { box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--focus-ring); }
.pw-sw-labels { display: flex; flex-direction: column; gap: 1px; }
.pw-sw-label { font-family: var(--font-sans); font-size: var(--text-base); color: var(--text-primary); line-height: 1.4; }
.pw-sw-hint  { font-family: var(--font-sans); font-size: var(--text-xs); color: var(--text-tertiary); }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Switch';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function Switch({
  label,
  checked = false,
  onChange,
  disabled = false,
  size = 'md',
  hint,
  id
}) {
  const inputId = id || (label ? `pw-sw-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return /*#__PURE__*/React.createElement("label", {
    className: `pw-sw-wrap pw-sw-${size}${disabled ? ' pw-sw-disabled' : ''}`,
    htmlFor: inputId
  }, /*#__PURE__*/React.createElement("div", {
    className: `pw-sw-track${checked ? ' pw-sw-on' : ''}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    id: inputId,
    className: "pw-sw-input",
    checked: checked,
    onChange: e => onChange?.(e.target.checked),
    disabled: disabled,
    role: "switch",
    "aria-checked": checked
  }), /*#__PURE__*/React.createElement("div", {
    className: "pw-sw-thumb"
  })), (label || hint) && /*#__PURE__*/React.createElement("div", {
    className: "pw-sw-labels"
  }, label && /*#__PURE__*/React.createElement("span", {
    className: "pw-sw-label"
  }, label), hint && /*#__PURE__*/React.createElement("span", {
    className: "pw-sw-hint"
  }, hint)));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
const {
  useState
} = React;
const _CSS = `
.pw-tabs { display: flex; flex-direction: column; }
.pw-tabs-list {
  display: flex; border-bottom: 1px solid var(--border-default);
  overflow-x: auto; scrollbar-width: none;
}
.pw-tabs-list::-webkit-scrollbar { display: none; }
.pw-tab-btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: 0 var(--space-4); height: 40px;
  font-family: var(--font-sans); font-size: var(--text-base);
  font-weight: var(--weight-medium); color: var(--text-tertiary);
  background: transparent; border: none; cursor: pointer;
  outline: none; white-space: nowrap; position: relative;
  transition: color var(--duration-fast) var(--ease-out);
}
.pw-tab-btn::after {
  content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px;
  background: var(--interactive-accent);
  transform: scaleX(0); transition: transform var(--duration-fast) var(--ease-out);
  border-radius: var(--radius-full) var(--radius-full) 0 0;
}
.pw-tab-btn:hover:not(:disabled) { color: var(--text-secondary); }
.pw-tab-btn:focus-visible {
  box-shadow: inset 0 0 0 2px var(--focus-ring);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}
.pw-tab-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pw-tab-btn[aria-selected="true"] { color: var(--text-primary); }
.pw-tab-btn[aria-selected="true"]::after { transform: scaleX(1); }
.pw-tab-count {
  font-family: var(--font-mono); font-size: var(--text-2xs);
  background: var(--bg-elevated); color: var(--text-tertiary);
  padding: 1px 5px; border-radius: var(--radius-sm); min-width: 18px;
  text-align: center; line-height: 1.6;
}
.pw-tab-btn[aria-selected="true"] .pw-tab-count {
  background: var(--status-running-subtle); color: var(--interactive-accent);
}
.pw-tabs-panel { padding-top: var(--space-4); }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Tabs';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function Tabs({
  tabs,
  defaultTab,
  onChange,
  children
}) {
  const [active, setActive] = useState(defaultTab ?? tabs?.[0]?.id);
  function select(id) {
    setActive(id);
    onChange?.(id);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "pw-tabs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pw-tabs-list",
    role: "tablist"
  }, tabs?.map(tab => /*#__PURE__*/React.createElement("button", {
    key: tab.id,
    role: "tab",
    className: "pw-tab-btn",
    "aria-selected": active === tab.id,
    disabled: tab.disabled,
    onClick: () => select(tab.id)
  }, tab.icon && tab.icon, tab.label, tab.count !== undefined && /*#__PURE__*/React.createElement("span", {
    className: "pw-tab-count"
  }, tab.count)))), /*#__PURE__*/React.createElement("div", {
    className: "pw-tabs-panel",
    role: "tabpanel"
  }, typeof children === 'function' ? children(active) : children));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/overlay/Dialog.jsx
try { (() => {
const {
  useEffect,
  useRef
} = React;
const _CSS = `
.pw-dlg-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
  animation: pw-dlg-fade 180ms cubic-bezier(0,0,0.2,1);
}
@keyframes pw-dlg-fade { from { opacity:0; } to { opacity:1; } }
@keyframes pw-dlg-slide { from { opacity:0; transform:translateY(10px) scale(0.97); } to { opacity:1; transform:none; } }
.pw-dlg-box {
  background: var(--bg-surface); border: 1px solid var(--border-default);
  border-radius: 12px; box-shadow: 0 24px 80px rgba(0,0,0,0.45);
  display: flex; flex-direction: column; max-height: 88vh; outline: none;
  animation: pw-dlg-slide 200ms cubic-bezier(0,0,0.2,1);
}
.pw-dlg-sm { width: min(400px,100%); }
.pw-dlg-md { width: min(560px,100%); }
.pw-dlg-lg { width: min(720px,100%); }
.pw-dlg-header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 20px 24px 16px; border-bottom: 1px solid var(--border-subtle); flex-shrink: 0;
}
.pw-dlg-title { font-family: var(--font-sans); font-size: var(--text-md); font-weight: var(--weight-semibold); color: var(--text-primary); margin: 0; line-height: 1.3; }
.pw-dlg-desc  { font-family: var(--font-sans); font-size: var(--text-sm); color: var(--text-tertiary); margin: 4px 0 0; line-height: 1.5; }
.pw-dlg-close {
  flex-shrink: 0; width: 28px; height: 28px; border-radius: 6px; border: none;
  background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: var(--text-tertiary);
  transition: background 100ms, color 100ms;
}
.pw-dlg-close:hover { background: var(--bg-elevated); color: var(--text-primary); }
.pw-dlg-close:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--focus-ring); }
.pw-dlg-body { padding: 20px 24px; overflow-y: auto; flex: 1; font-family: var(--font-sans); font-size: var(--text-base); color: var(--text-secondary); line-height: 1.55; }
.pw-dlg-footer { padding: 16px 24px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0; }
@media (prefers-reduced-motion: reduce) {
  .pw-dlg-overlay { animation: none; }
  .pw-dlg-box { animation: none; }
}
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Dialog';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
const XIcon = () => /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round"
}, /*#__PURE__*/React.createElement("line", {
  x1: "18",
  y1: "6",
  x2: "6",
  y2: "18"
}), /*#__PURE__*/React.createElement("line", {
  x1: "6",
  y1: "6",
  x2: "18",
  y2: "18"
}));
function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md'
}) {
  const boxRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    boxRef.current?.focus();
    const onKey = e => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    className: "pw-dlg-overlay",
    onClick: e => {
      if (e.target === e.currentTarget) onClose?.();
    },
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "pw-dlg-title"
  }, /*#__PURE__*/React.createElement("div", {
    ref: boxRef,
    className: `pw-dlg-box pw-dlg-${size}`,
    tabIndex: -1
  }, /*#__PURE__*/React.createElement("div", {
    className: "pw-dlg-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    id: "pw-dlg-title",
    className: "pw-dlg-title"
  }, title), description && /*#__PURE__*/React.createElement("p", {
    className: "pw-dlg-desc"
  }, description)), onClose && /*#__PURE__*/React.createElement("button", {
    className: "pw-dlg-close",
    onClick: onClose,
    "aria-label": "Close dialog"
  }, /*#__PURE__*/React.createElement(XIcon, null))), /*#__PURE__*/React.createElement("div", {
    className: "pw-dlg-body"
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    className: "pw-dlg-footer"
  }, footer))), document.body);
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/overlay/Toast.jsx
try { (() => {
const {
  useEffect
} = React;
const _CSS = `
.pw-toast {
  display: flex; align-items: flex-start; gap: 10px;
  min-width: 280px; max-width: 420px;
  padding: 12px 14px;
  background: var(--bg-overlay); border: 1px solid var(--border-default);
  border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.35);
  font-family: var(--font-sans);
  animation: pw-toast-in 200ms cubic-bezier(0,0,0.2,1);
}
@keyframes pw-toast-in { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:none; } }
.pw-toast-success { border-left: 3px solid var(--status-success); }
.pw-toast-error   { border-left: 3px solid var(--status-failure); }
.pw-toast-warning { border-left: 3px solid var(--pw-amber-500); }
.pw-toast-info    { border-left: 3px solid var(--status-queued); }
.pw-toast-icon { flex-shrink: 0; margin-top: 1px; }
.pw-toast-body { flex: 1; min-width: 0; }
.pw-toast-title { font-size: var(--text-base); font-weight: var(--weight-medium); color: var(--text-primary); line-height: 1.3; }
.pw-toast-desc  { font-size: var(--text-sm); color: var(--text-secondary); margin-top: 2px; line-height: 1.45; }
.pw-toast-close {
  flex-shrink: 0; width: 20px; height: 20px; margin-top: 1px;
  border: none; background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-tertiary); border-radius: 4px;
  transition: background 100ms, color 100ms;
}
.pw-toast-close:hover { background: var(--bg-elevated); color: var(--text-primary); }
.pw-toast-stack {
  position: fixed; bottom: 24px; right: 24px; z-index: 1100;
  display: flex; flex-direction: column; gap: 8px;
  align-items: flex-end; pointer-events: none;
}
.pw-toast-stack .pw-toast { pointer-events: auto; }
@media (prefers-reduced-motion: reduce) { .pw-toast { animation: none; } }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Toast';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
const ICONS = {
  success: /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "var(--status-success)",
    strokeWidth: "1.75",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "6.5"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "5,8 7,10 11,6"
  })),
  error: /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "var(--status-failure)",
    strokeWidth: "1.75",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "6.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "5",
    x2: "8",
    y2: "8.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "11",
    r: ".6",
    fill: "var(--status-failure)"
  })),
  warning: /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "var(--pw-amber-500)",
    strokeWidth: "1.75",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8 2.5L14 13.5H2L8 2.5z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "7",
    x2: "8",
    y2: "9.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "11.5",
    r: ".6",
    fill: "var(--pw-amber-500)"
  })),
  info: /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "var(--status-queued)",
    strokeWidth: "1.75",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "6.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "7.5",
    x2: "8",
    y2: "11"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "5.5",
    r: ".6",
    fill: "var(--status-queued)"
  }))
};
const XSmall = () => /*#__PURE__*/React.createElement("svg", {
  width: "10",
  height: "10",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  strokeLinecap: "round"
}, /*#__PURE__*/React.createElement("line", {
  x1: "18",
  y1: "6",
  x2: "6",
  y2: "18"
}), /*#__PURE__*/React.createElement("line", {
  x1: "6",
  y1: "6",
  x2: "18",
  y2: "18"
}));
function Toast({
  title,
  description,
  variant = 'default',
  onDismiss,
  duration = 5000
}) {
  useEffect(() => {
    if (!duration || !onDismiss) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);
  return /*#__PURE__*/React.createElement("div", {
    className: `pw-toast${variant !== 'default' ? ` pw-toast-${variant}` : ''}`,
    role: "status",
    "aria-live": "polite"
  }, variant !== 'default' && ICONS[variant] && /*#__PURE__*/React.createElement("span", {
    className: "pw-toast-icon"
  }, ICONS[variant]), /*#__PURE__*/React.createElement("div", {
    className: "pw-toast-body"
  }, title && /*#__PURE__*/React.createElement("div", {
    className: "pw-toast-title"
  }, title), description && /*#__PURE__*/React.createElement("div", {
    className: "pw-toast-desc"
  }, description)), onDismiss && /*#__PURE__*/React.createElement("button", {
    className: "pw-toast-close",
    onClick: onDismiss,
    "aria-label": "Dismiss notification"
  }, /*#__PURE__*/React.createElement(XSmall, null)));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/Toast.jsx", error: String((e && e.message) || e) }); }

// components/overlay/ToastStack.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ToastStack({
  toasts = [],
  dismiss
}) {
  if (!toasts.length) return null;
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    className: "pw-toast-stack",
    "aria-label": "Notifications"
  }, toasts.map(t => /*#__PURE__*/React.createElement(__ds_scope.Toast, _extends({
    key: t.id
  }, t, {
    onDismiss: () => dismiss?.(t.id)
  })))), document.body);
}
Object.assign(__ds_scope, { ToastStack });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/ToastStack.jsx", error: String((e && e.message) || e) }); }

// components/overlay/Tooltip.jsx
try { (() => {
const {
  useState,
  useRef,
  useCallback
} = React;
const _CSS = `
.pw-tip-wrap { position: relative; display: inline-flex; align-items: center; }
.pw-tip-box {
  position: absolute; z-index: 900; pointer-events: none; white-space: nowrap;
  background: var(--bg-overlay); color: var(--text-primary);
  border: 1px solid var(--border-default); border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  padding: 5px 10px;
  font-family: var(--font-sans); font-size: var(--text-xs); line-height: 1.4;
  animation: pw-tip-in 100ms cubic-bezier(0,0,0.2,1);
}
.pw-tip-mono { font-family: var(--font-mono); }
@keyframes pw-tip-in { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:none; } }
.pw-tip-top    { bottom: calc(100% + 7px); left: 50%; transform: translateX(-50%); }
.pw-tip-bottom { top:    calc(100% + 7px); left: 50%; transform: translateX(-50%); }
.pw-tip-left   { right: calc(100% + 7px); top: 50%; transform: translateY(-50%); }
.pw-tip-right  { left:  calc(100% + 7px); top: 50%; transform: translateY(-50%); }
@media (prefers-reduced-motion: reduce) { .pw-tip-box { animation: none; } }
`;
let _injected = false;
if (typeof document !== 'undefined' && !_injected) {
  const s = document.createElement('style');
  s.dataset.pw = 'Tooltip';
  s.textContent = _CSS;
  document.head.appendChild(s);
  _injected = true;
}
function Tooltip({
  content,
  children,
  position = 'top',
  delay = 300,
  mono = false,
  disabled = false
}) {
  const [visible, setVisible] = useState(false);
  const timer = useRef(null);
  const show = useCallback(() => {
    if (disabled || !content) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(true), delay);
  }, [disabled, content, delay]);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setVisible(false);
  }, []);
  return /*#__PURE__*/React.createElement("span", {
    className: "pw-tip-wrap",
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide
  }, children, visible && /*#__PURE__*/React.createElement("span", {
    className: ['pw-tip-box', `pw-tip-${position}`, mono && 'pw-tip-mono'].filter(Boolean).join(' '),
    role: "tooltip"
  }, content));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/Tooltip.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/App.jsx
try { (() => {
// PipeWatch App — UI Kit v2
// Dashboard · Runs · Run Detail · Repositories · Insights · Settings

const {
  useState,
  useEffect
} = React;

// ─── Data ─────────────────────────────────────────────────────────────────────
const REPOS = [{
  id: 1,
  name: 'api-gateway',
  org: 'acme',
  branch: 'main',
  status: 'success',
  lastRun: '3 min ago',
  duration: '2m 14s',
  sha: 'a4f92c1',
  message: 'fix: handle timeout in auth middleware',
  trend: [85, 90, 88, 95, 92, 100, 98]
}, {
  id: 2,
  name: 'web-dashboard',
  org: 'acme',
  branch: 'main',
  status: 'failure',
  lastRun: '12 min ago',
  duration: '1m 38s',
  sha: '7b3e0d4',
  message: 'feat: add sparkline to repo cards',
  trend: [95, 90, 85, 80, 75, 88, 70]
}, {
  id: 3,
  name: 'agent-runner',
  org: 'acme',
  branch: 'dev',
  status: 'running',
  lastRun: 'just now',
  duration: '0m 48s',
  sha: '2c8a15f',
  message: 'refactor: parallelise stage execution',
  trend: [100, 100, 95, 100, 100, 95, 100]
}, {
  id: 4,
  name: 'infra-terraform',
  org: 'acme',
  branch: 'main',
  status: 'queued',
  lastRun: '1 min ago',
  duration: '—',
  sha: 'f1d7a32',
  message: 'chore: upgrade node 20 → 22',
  trend: [90, 88, 92, 90, 95, 100, 88]
}, {
  id: 5,
  name: 'docs-site',
  org: 'acme',
  branch: 'main',
  status: 'cancelled',
  lastRun: '2 hours ago',
  duration: '0m 12s',
  sha: 'd9e4b76',
  message: 'docs: update getting started guide',
  trend: [100, 100, 100, 95, 100, 100, 100]
}, {
  id: 6,
  name: 'billing-service',
  org: 'acme',
  branch: 'main',
  status: 'skipped',
  lastRun: '5 hours ago',
  duration: '—',
  sha: '3a2f891',
  message: 'ci: skip billing on fork PRs',
  trend: [88, 92, 90, 88, 85, 90, 92]
}];
const RUNS = [{
  id: 'run-2847',
  repo: 'web-dashboard',
  branch: 'main',
  sha: '7b3e0d4',
  message: 'feat: add sparkline to repo cards',
  status: 'failure',
  duration: '1m 38s',
  ago: '12 min ago',
  trigger: 'push'
}, {
  id: 'run-2846',
  repo: 'agent-runner',
  branch: 'dev',
  sha: '2c8a15f',
  message: 'refactor: parallelise stage execution',
  status: 'running',
  duration: '0m 48s',
  ago: 'just now',
  trigger: 'push'
}, {
  id: 'run-2845',
  repo: 'api-gateway',
  branch: 'main',
  sha: 'a4f92c1',
  message: 'fix: handle timeout in auth middleware',
  status: 'success',
  duration: '2m 14s',
  ago: '3 min ago',
  trigger: 'push'
}, {
  id: 'run-2844',
  repo: 'infra-terraform',
  branch: 'main',
  sha: 'f1d7a32',
  message: 'chore: upgrade node 20 → 22',
  status: 'queued',
  duration: '—',
  ago: '1 min ago',
  trigger: 'push'
}, {
  id: 'run-2843',
  repo: 'api-gateway',
  branch: 'main',
  sha: 'c7e3a89',
  message: 'fix: rate limit config off by one',
  status: 'success',
  duration: '2m 02s',
  ago: '1 hour ago',
  trigger: 'push'
}, {
  id: 'run-2842',
  repo: 'web-dashboard',
  branch: 'feat/insights',
  sha: '6d1b247',
  message: 'feat: insights page initial impl',
  status: 'success',
  duration: '1m 55s',
  ago: '2 hours ago',
  trigger: 'push'
}, {
  id: 'run-2841',
  repo: 'docs-site',
  branch: 'main',
  sha: 'd9e4b76',
  message: 'docs: update getting started guide',
  status: 'cancelled',
  duration: '0m 12s',
  ago: '2 hours ago',
  trigger: 'push'
}, {
  id: 'run-2840',
  repo: 'billing-service',
  branch: 'main',
  sha: '3a2f891',
  message: 'ci: skip billing on fork PRs',
  status: 'skipped',
  duration: '—',
  ago: '5 hours ago',
  trigger: 'push'
}];
const DAILY_DATA = [{
  date: 'Jun 3',
  success: 8,
  failure: 1
}, {
  date: 'Jun 4',
  success: 12,
  failure: 0
}, {
  date: 'Jun 5',
  success: 10,
  failure: 2
}, {
  date: 'Jun 6',
  success: 14,
  failure: 1
}, {
  date: 'Jun 7',
  success: 9,
  failure: 3
}, {
  date: 'Jun 8',
  success: 6,
  failure: 0
}, {
  date: 'Jun 9',
  success: 4,
  failure: 0
}, {
  date: 'Jun 10',
  success: 11,
  failure: 2
}, {
  date: 'Jun 11',
  success: 13,
  failure: 1
}, {
  date: 'Jun 12',
  success: 15,
  failure: 0
}, {
  date: 'Jun 13',
  success: 9,
  failure: 4
}, {
  date: 'Jun 14',
  success: 16,
  failure: 1
}, {
  date: 'Jun 15',
  success: 12,
  failure: 2
}, {
  date: 'Jun 16',
  success: 8,
  failure: 1
}];

// ─── Status config ────────────────────────────────────────────────────────────
const SCFG = {
  success: {
    label: 'Succeeded',
    c: 'var(--status-success)',
    bg: 'var(--status-success-subtle)'
  },
  failure: {
    label: 'Failed',
    c: 'var(--status-failure)',
    bg: 'var(--status-failure-subtle)'
  },
  running: {
    label: 'Running',
    c: 'var(--status-running)',
    bg: 'var(--status-running-subtle)'
  },
  cancelled: {
    label: 'Cancelled',
    c: 'var(--status-cancelled)',
    bg: 'var(--status-cancelled-subtle)'
  },
  skipped: {
    label: 'Skipped',
    c: 'var(--status-skipped)',
    bg: 'var(--status-skipped-subtle)'
  },
  queued: {
    label: 'Queued',
    c: 'var(--status-queued)',
    bg: 'var(--status-queued-subtle)'
  }
};
const SICONS = {
  success: /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "6.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 8l2 2 4-4"
  })),
  failure: /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "6.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10.5 5.5l-5 5M5.5 5.5l5 5"
  })),
  running: /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    style: {
      animation: 'pw-spin .9s linear infinite'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M14 8a6 6 0 1 1-2.2-4.6"
  })),
  cancelled: /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "6.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 8h6"
  })),
  skipped: /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "6.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 5.5l3 2.5-3 2.5V5.5zM10.5 5.5v5"
  })),
  queued: /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "8",
    r: "6.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 5v3l2 2"
  }))
};
function SBadge({
  status,
  lg
}) {
  const c = SCFG[status] || SCFG.success;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: lg ? '4px 10px' : '3px 8px',
      borderRadius: '4px',
      color: c.c,
      background: c.bg,
      fontFamily: 'var(--font-sans)',
      fontSize: lg ? '12px' : '11px',
      fontWeight: 500,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, SICONS[status], c.label);
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Spk({
  data = [],
  w = 72,
  h = 20,
  color = 'var(--pw-chart-1)'
}) {
  if (data.length < 2) return null;
  const pad = 2,
    mx = Math.max(...data),
    mn = Math.min(...data),
    rng = mx - mn || 1;
  const pts = data.map((v, i) => ({
    x: pad + i / (data.length - 1) * (w - 2 * pad),
    y: h - pad - (v - mn) / rng * (h - 2 * pad)
  }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    viewBox: `0 0 ${w} ${h}`,
    style: {
      display: 'block',
      overflow: 'visible'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: d,
    fill: "none",
    stroke: color,
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: last.x.toFixed(1),
    cy: last.y.toFixed(1),
    r: "2.5",
    fill: color
  }));
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV_ICONS = {
  dashboard: /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "7",
    height: "7",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "3",
    width: "7",
    height: "7",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "14",
    width: "7",
    height: "7",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "14",
    width: "7",
    height: "7",
    rx: "1"
  })),
  runs: /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
  })),
  repositories: /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "3",
    x2: "6",
    y2: "15"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "6",
    r: "3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "18",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M18 9a9 9 0 0 1-9 9"
  })),
  insights: /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 20V10M12 20V4M6 20v-6"
  })),
  settings: /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
  }))
};
const NAV = [{
  id: 'dashboard',
  label: 'Dashboard'
}, {
  id: 'runs',
  label: 'Runs'
}, {
  id: 'repositories',
  label: 'Repositories'
}, {
  id: 'insights',
  label: 'Insights'
}, {
  id: 'settings',
  label: 'Settings'
}];

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  view,
  setView,
  theme,
  setTheme
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 220,
      flexShrink: 0,
      height: '100vh',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-default)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--pw-amber-500)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 32 32",
    fill: "none"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "16",
    cy: "16",
    r: "13.5",
    stroke: "currentColor",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5.5 16L9.5 16L11.5 10.5L13.5 21.5L15.5 10.5L17.5 21.5L19.5 16L26.5 16",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '14px',
      fontWeight: 600,
      color: 'var(--text-primary)',
      letterSpacing: '-0.025em'
    }
  }, "Pipe", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--pw-amber-500)'
    }
  }, "Watch")), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: '10px',
      fontFamily: 'var(--font-mono)',
      color: 'var(--pw-amber-500)',
      background: 'oklch(70% 0.195 55 / 0.12)',
      padding: '1px 6px',
      borderRadius: '3px'
    }
  }, "Cloud")), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      padding: '8px',
      overflowY: 'auto'
    }
  }, NAV.map(item => /*#__PURE__*/React.createElement(NavBtn, {
    key: item.id,
    item: item,
    active: view === item.id,
    onClick: () => setView(item.id)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setTheme(t => t === 'dark' ? 'light' : 'dark'),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 8px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      background: 'var(--bg-elevated)',
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      color: 'var(--text-tertiary)',
      width: '100%'
    }
  }, theme === 'dark' ? /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
  })) : /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  })), theme === 'dark' ? 'Light mode' : 'Dark mode'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 6px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 26,
      height: 26,
      borderRadius: '9999px',
      background: 'var(--pw-amber-800)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      fontWeight: 600,
      color: 'var(--pw-amber-300)',
      flexShrink: 0,
      fontFamily: 'var(--font-sans)'
    }
  }, "AC"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '12px',
      fontWeight: 500,
      color: 'var(--text-primary)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, "Alice Chen"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      color: 'var(--text-tertiary)'
    }
  }, "acme-org")))));
}
function NavBtn({
  item,
  active,
  onClick
}) {
  const [hov, setHov] = useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '9px',
      width: '100%',
      padding: '0 10px',
      height: '33px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: '13px',
      fontWeight: active ? 500 : 400,
      background: active ? 'oklch(70% 0.195 55 / 0.12)' : hov ? 'var(--bg-elevated)' : 'transparent',
      color: active ? 'var(--pw-amber-400)' : hov ? 'var(--text-primary)' : 'var(--text-secondary)',
      textAlign: 'left',
      transition: 'background 80ms, color 80ms'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: active ? 'var(--pw-amber-400)' : 'var(--text-tertiary)',
      flexShrink: 0
    }
  }, NAV_ICONS[item.id]), item.label);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({
  setView,
  setSelectedRun
}) {
  const ok = RUNS.filter(r => r.status === 'success').length;
  const rate = Math.round(ok / RUNS.length * 100);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 32px',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '22px'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: '17px',
      fontWeight: 600,
      color: 'var(--text-primary)',
      letterSpacing: '-0.02em'
    }
  }, "Dashboard"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement(PBtn, null, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "4",
    y1: "6",
    x2: "20",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "4",
    y1: "12",
    x2: "14",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "4",
    y1: "18",
    x2: "10",
    y2: "18"
  })), "Filter"), /*#__PURE__*/React.createElement(PBtn, {
    primary: true
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M5 12h14"
  })), "Add repo"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: '12px',
      marginBottom: '26px'
    }
  }, [{
    label: 'Repositories',
    val: '6',
    sub: '1 failing'
  }, {
    label: 'Runs today',
    val: String(RUNS.length),
    sub: 'last 24 hours'
  }, {
    label: 'Success rate',
    val: `${rate}%`,
    sub: '7-day average'
  }, {
    label: 'Avg duration',
    val: '1m 54s',
    sub: 'across all repos'
  }].map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10px',
      color: 'var(--text-tertiary)',
      marginBottom: '6px',
      letterSpacing: '0.07em',
      textTransform: 'uppercase'
    }
  }, s.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '22px',
      fontWeight: 700,
      color: 'var(--text-primary)',
      letterSpacing: '-0.03em',
      lineHeight: 1,
      fontFeatureSettings: '"tnum"'
    }
  }, s.val), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      marginTop: '4px'
    }
  }, s.sub)))), /*#__PURE__*/React.createElement(SectionHead, {
    title: "Repositories",
    action: "View all",
    onAction: () => setView('repositories')
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: '10px',
      marginBottom: '26px'
    }
  }, REPOS.map(r => /*#__PURE__*/React.createElement(RepoCard, {
    key: r.id,
    repo: r,
    onClick: () => setView('runs')
  }))), /*#__PURE__*/React.createElement(SectionHead, {
    title: "Recent runs",
    action: "View all",
    onAction: () => setView('runs')
  }), /*#__PURE__*/React.createElement(RunsTable, {
    runs: RUNS.slice(0, 5),
    onSelect: run => {
      setSelectedRun(run);
      setView('run-detail');
    }
  }));
}
function RepoCard({
  repo,
  onClick
}) {
  const [hov, setHov] = useState(false);
  const tc = repo.status === 'failure' ? 'var(--status-failure)' : repo.status === 'running' ? 'var(--status-running)' : 'var(--status-success)';
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      background: 'var(--bg-surface)',
      border: `1px solid ${hov ? 'var(--border-strong)' : 'var(--border-default)'}`,
      borderRadius: '8px',
      padding: '14px 16px',
      cursor: 'pointer',
      transition: 'border-color 100ms, box-shadow 100ms',
      boxShadow: hov ? 'var(--shadow-sm)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      color: 'var(--text-tertiary)'
    }
  }, repo.org, "/"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      fontWeight: 500,
      color: 'var(--text-primary)',
      marginTop: '2px'
    }
  }, repo.name)), /*#__PURE__*/React.createElement(SBadge, {
    status: repo.status
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: '10px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      color: 'var(--text-secondary)',
      background: 'var(--bg-elevated)',
      padding: '1px 6px',
      borderRadius: '3px',
      border: '1px solid var(--border-subtle)'
    }
  }, repo.branch), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '11px',
      color: 'var(--text-tertiary)'
    }
  }, repo.lastRun)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      fontFeatureSettings: '"tnum"'
    }
  }, repo.duration), /*#__PURE__*/React.createElement(Spk, {
    data: repo.trend,
    color: tc
  })));
}

// ─── Runs Table ───────────────────────────────────────────────────────────────
function RunsTable({
  runs,
  onSelect
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: '1px solid var(--border-default)',
      background: 'var(--bg-elevated)'
    }
  }, ['Status', 'Repository · Branch', 'Commit', 'Duration', 'Time'].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      padding: '9px 14px',
      textAlign: 'left',
      fontSize: '10px',
      fontWeight: 500,
      color: 'var(--text-tertiary)',
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, runs.map((r, i) => /*#__PURE__*/React.createElement(RunRow, {
    key: r.id,
    run: r,
    last: i === runs.length - 1,
    onSelect: onSelect
  })))));
}
function RunRow({
  run,
  last,
  onSelect
}) {
  const [hov, setHov] = useState(false);
  return /*#__PURE__*/React.createElement("tr", {
    onClick: () => onSelect(run),
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
      background: hov ? 'var(--bg-elevated)' : 'transparent',
      cursor: 'pointer',
      transition: 'background 80ms'
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(SBadge, {
    status: run.status
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: 'var(--text-primary)',
      fontWeight: 500
    }
  }, run.repo), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      color: 'var(--text-tertiary)',
      marginTop: '2px'
    }
  }, run.branch)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--text-secondary)',
      background: 'var(--bg-elevated)',
      padding: '2px 6px',
      borderRadius: '4px',
      border: '1px solid var(--border-subtle)'
    }
  }, run.sha), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '12px',
      color: 'var(--text-secondary)',
      maxWidth: 220,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, run.message))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: 'var(--text-secondary)',
      whiteSpace: 'nowrap',
      fontFeatureSettings: '"tnum"'
    }
  }, run.duration), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      fontSize: '12px',
      color: 'var(--text-tertiary)',
      whiteSpace: 'nowrap'
    }
  }, run.ago));
}

// ─── Runs View ────────────────────────────────────────────────────────────────
function RunsView({
  setSelectedRun,
  setView
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 32px',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '22px'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: '17px',
      fontWeight: 600,
      color: 'var(--text-primary)',
      letterSpacing: '-0.02em'
    }
  }, "Runs"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "Search by SHA, repo, or message\u2026",
    style: {
      height: 32,
      padding: '0 10px 0 30px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: '6px',
      outline: 'none',
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      color: 'var(--text-primary)',
      width: 260
    }
  }), /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-tertiary)",
    strokeWidth: "2",
    strokeLinecap: "round",
    style: {
      position: 'absolute',
      left: 9,
      top: 10
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.35-4.35"
  })))), /*#__PURE__*/React.createElement(RunsTable, {
    runs: RUNS,
    onSelect: run => {
      setSelectedRun(run);
      setView('run-detail');
    }
  }));
}

// ─── Repositories View ────────────────────────────────────────────────────────
function RepositoriesView({
  setView
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const FILTERS = [{
    id: 'all',
    label: 'All',
    count: REPOS.length
  }, {
    id: 'passing',
    label: 'Passing',
    count: REPOS.filter(r => r.status === 'success').length
  }, {
    id: 'failing',
    label: 'Failing',
    count: REPOS.filter(r => r.status === 'failure').length
  }, {
    id: 'running',
    label: 'Running',
    count: REPOS.filter(r => r.status === 'running').length
  }];
  const filtered = REPOS.filter(r => {
    const q = search.toLowerCase();
    const matchQ = !q || r.name.includes(q) || r.org.includes(q) || r.branch.includes(q);
    const matchF = filter === 'all' || filter === 'passing' && r.status === 'success' || filter === 'failing' && r.status === 'failure' || filter === 'running' && r.status === 'running';
    return matchQ && matchF;
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 32px',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '18px'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: '17px',
      fontWeight: 600,
      color: 'var(--text-primary)',
      letterSpacing: '-0.02em'
    }
  }, "Repositories"), /*#__PURE__*/React.createElement(PBtn, {
    primary: true
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M5 12h14"
  })), "Add repository")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '14px',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '2px',
      padding: '3px',
      background: 'var(--bg-elevated)',
      borderRadius: '8px'
    }
  }, FILTERS.map(f => /*#__PURE__*/React.createElement("button", {
    key: f.id,
    onClick: () => setFilter(f.id),
    style: {
      padding: '4px 12px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      fontWeight: filter === f.id ? 500 : 400,
      background: filter === f.id ? 'var(--bg-surface)' : 'transparent',
      color: filter === f.id ? 'var(--text-primary)' : 'var(--text-secondary)',
      transition: 'background 80ms,color 80ms',
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, f.label, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      color: filter === f.id ? 'var(--text-secondary)' : 'var(--text-tertiary)',
      background: filter === f.id ? 'var(--bg-elevated)' : 'transparent',
      padding: '0 4px',
      borderRadius: '3px'
    }
  }, f.count)))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Search repositories\u2026",
    style: {
      height: 32,
      padding: '0 10px 0 30px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: '6px',
      outline: 'none',
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      color: 'var(--text-primary)',
      width: 220
    }
  }), /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-tertiary)",
    strokeWidth: "2",
    strokeLinecap: "round",
    style: {
      position: 'absolute',
      left: 9,
      top: 10
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.35-4.35"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: '1px solid var(--border-default)',
      background: 'var(--bg-elevated)'
    }
  }, ['Repository', 'Status', 'Branch', 'Last commit', 'Duration', 'Updated'].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      padding: '9px 14px',
      textAlign: 'left',
      fontSize: '10px',
      fontWeight: 500,
      color: 'var(--text-tertiary)',
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map((r, i) => /*#__PURE__*/React.createElement(RepoRow, {
    key: r.id,
    repo: r,
    last: i === filtered.length - 1,
    onClick: () => setView('runs')
  })))), !filtered.length && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '40px',
      textAlign: 'center',
      fontSize: '13px',
      color: 'var(--text-tertiary)'
    }
  }, "No repositories match your filter.")));
}
function RepoRow({
  repo,
  last,
  onClick
}) {
  const [hov, setHov] = useState(false);
  return /*#__PURE__*/React.createElement("tr", {
    onClick: onClick,
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
      background: hov ? 'var(--bg-elevated)' : 'transparent',
      cursor: 'pointer',
      transition: 'background 80ms'
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      color: 'var(--text-tertiary)'
    }
  }, repo.org, "/"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      fontWeight: 500,
      color: 'var(--text-primary)',
      marginTop: '2px'
    }
  }, repo.name)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px'
    }
  }, /*#__PURE__*/React.createElement(SBadge, {
    status: repo.status
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--text-secondary)',
      background: 'var(--bg-elevated)',
      padding: '2px 7px',
      borderRadius: '3px',
      border: '1px solid var(--border-subtle)'
    }
  }, repo.branch)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      maxWidth: 240
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--text-secondary)',
      background: 'var(--bg-elevated)',
      padding: '1px 6px',
      borderRadius: '3px',
      display: 'inline-block',
      marginBottom: '3px'
    }
  }, repo.sha), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: 200
    }
  }, repo.message)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: 'var(--text-secondary)',
      fontFeatureSettings: '"tnum"'
    }
  }, repo.duration), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      fontSize: '12px',
      color: 'var(--text-tertiary)'
    }
  }, repo.lastRun));
}

// ─── Run Detail ───────────────────────────────────────────────────────────────
const BASE_STAGES = [{
  name: 'Checkout',
  ok: true,
  dur: '3s'
}, {
  name: 'Setup Node',
  ok: true,
  dur: '21s'
}, {
  name: 'Install deps',
  ok: true,
  dur: '44s'
}, {
  name: 'Build',
  ok: null,
  dur: null
}, {
  name: 'Test',
  ok: null,
  dur: null
}];
function getStages(run) {
  if (run.status === 'failure') return [...BASE_STAGES.slice(0, 3), {
    name: 'Build',
    status: 'failure',
    dur: '32s'
  }];
  if (run.status === 'running') return [...BASE_STAGES.slice(0, 2), {
    name: 'Install deps',
    status: 'running',
    dur: '—'
  }, {
    name: 'Build',
    status: 'queued',
    dur: '—'
  }, {
    name: 'Test',
    status: 'queued',
    dur: '—'
  }];
  if (run.status === 'cancelled') return [BASE_STAGES[0], {
    name: 'Setup Node',
    status: 'cancelled',
    dur: '8s'
  }];
  return BASE_STAGES.map((s, i) => ({
    ...s,
    status: s.ok ? 'success' : run.status === 'success' ? 'success' : run.status,
    dur: s.dur || (i === 3 ? '1m 02s' : i === 4 ? '38s' : '—')
  }));
}
function RunDetail({
  run,
  setView
}) {
  if (!run) return null;
  const stages = getStages(run);
  const LOG = {
    failure: ['$ npm run build', '> web-dashboard@1.4.0 build', '> next build --mode production', '\u001b[31mTypeError: src/components/RepoCard.tsx:42\u001b[0m — Type \'string | undefined\' is not assignable to type \'number\'.', 'Build failed with exit code 1'],
    running: ['$ npm install', '> Resolving packages (342)…', '> Downloading tarball react@18.3.1…', '> Installing…'],
    success: ['$ npm test', '✓ auth.middleware.spec.ts (14 tests passed)', '✓ rate-limit.spec.ts (8 tests passed)', '✓ timeout.spec.ts (6 tests passed)', 'All 28 tests passed in 36.8s'],
    default: ['Run ' + run.id + ' — ' + run.status]
  };
  const logLines = LOG[run.status] || LOG.default;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 32px',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('runs'),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: '18px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      color: 'var(--text-tertiary)',
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M19 12H5M12 5l-7 7 7 7"
  })), "Back to runs"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
      padding: '18px 22px',
      marginBottom: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '8px'
    }
  }, /*#__PURE__*/React.createElement(SBadge, {
    status: run.status,
    lg: true
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--text-tertiary)'
    }
  }, run.id), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      background: 'var(--bg-elevated)',
      padding: '1px 7px',
      borderRadius: '4px'
    }
  }, run.trigger)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '14px',
      fontWeight: 500,
      color: 'var(--text-primary)',
      marginBottom: '8px'
    }
  }, run.message), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '14px',
      fontSize: '12px',
      color: 'var(--text-tertiary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-secondary)',
      fontWeight: 500
    }
  }, run.repo), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)'
    }
  }, run.branch), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      background: 'var(--bg-elevated)',
      padding: '1px 6px',
      borderRadius: '3px'
    }
  }, run.sha), /*#__PURE__*/React.createElement("span", null, run.ago))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '20px',
      fontWeight: 700,
      color: 'var(--text-primary)',
      fontFeatureSettings: '"tnum"'
    }
  }, run.duration), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      marginTop: '2px'
    }
  }, "total duration")))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
      overflow: 'hidden',
      marginBottom: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 16px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-elevated)',
      fontSize: '10px',
      fontWeight: 500,
      color: 'var(--text-tertiary)',
      letterSpacing: '0.07em',
      textTransform: 'uppercase'
    }
  }, "Stages"), stages.map((stage, i) => /*#__PURE__*/React.createElement("div", {
    key: stage.name,
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: '11px 16px',
      borderBottom: i < stages.length - 1 ? '1px solid var(--border-subtle)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(SBadge, {
    status: stage.status || 'queued'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      marginLeft: '14px',
      fontSize: '13px',
      color: 'var(--text-primary)'
    }
  }, stage.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      fontFeatureSettings: '"tnum"'
    }
  }, stage.dur || '—')))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-code)',
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
      padding: '16px',
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      lineHeight: '1.75',
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10px',
      color: 'var(--text-tertiary)',
      marginBottom: '10px',
      letterSpacing: '0.07em',
      textTransform: 'uppercase'
    }
  }, "Log output"), logLines.map((line, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      color: line.startsWith('✓') ? 'var(--status-success)' : line.includes('Error') || line.includes('error') || line.includes('failed') ? 'var(--status-failure)' : line.startsWith('$') || line.startsWith('>') ? 'var(--text-primary)' : 'var(--text-secondary)'
    }
  }, line))));
}

// ─── Insights View ────────────────────────────────────────────────────────────
function RunsChart({
  data
}) {
  const W = 560,
    H = 180,
    PL = 30,
    PR = 10,
    PT = 14,
    PB = 32;
  const iW = W - PL - PR,
    iH = H - PT - PB;
  const maxVal = Math.max(...data.map(d => d.success + d.failure));
  const bw = iW / data.length,
    pad = 3,
    bInner = bw - pad * 2;
  const gridPcts = [0, 0.25, 0.5, 0.75, 1];
  const ratePts = data.map((d, i) => ({
    x: PL + (i + 0.5) * bw,
    y: PT + iH * (1 - d.success / (d.success + d.failure || 1))
  }));
  const ratePath = ratePts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return /*#__PURE__*/React.createElement("svg", {
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    style: {
      display: 'block',
      overflow: 'visible'
    }
  }, gridPcts.map(pct => {
    const y = PT + iH * (1 - pct);
    return /*#__PURE__*/React.createElement("line", {
      key: pct,
      x1: PL,
      y1: y,
      x2: PL + iW,
      y2: y,
      stroke: "var(--border-subtle)",
      strokeWidth: "1",
      strokeDasharray: pct === 0 ? '0' : '4 3'
    });
  }), data.map((d, i) => {
    const x = PL + i * bw + pad;
    const sH = d.success / maxVal * iH,
      fH = d.failure / maxVal * iH;
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("rect", {
      x: x,
      y: PT + iH - sH,
      width: bInner,
      height: sH,
      fill: "var(--status-success)",
      opacity: "0.55",
      rx: "2"
    }), d.failure > 0 && /*#__PURE__*/React.createElement("rect", {
      x: x,
      y: PT + iH - sH - fH,
      width: bInner,
      height: fH,
      fill: "var(--status-failure)",
      opacity: "0.75",
      rx: "2"
    }));
  }), data.map((d, i) => i % 2 === 0 && /*#__PURE__*/React.createElement("text", {
    key: i,
    x: PL + (i + 0.5) * bw,
    y: H - 6,
    textAnchor: "middle",
    fontSize: "9",
    fill: "var(--text-tertiary)",
    fontFamily: "var(--font-sans)"
  }, d.date.replace('Jun ', ''))), /*#__PURE__*/React.createElement("path", {
    d: ratePath,
    fill: "none",
    stroke: "var(--pw-amber-500)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: ratePts[ratePts.length - 1].x,
    cy: ratePts[ratePts.length - 1].y,
    r: "3",
    fill: "var(--pw-amber-500)"
  }));
}
function InsightsView() {
  const totalRuns = DAILY_DATA.reduce((a, d) => a + d.success + d.failure, 0);
  const totalFails = DAILY_DATA.reduce((a, d) => a + d.failure, 0);
  const succRate = Math.round((1 - totalFails / totalRuns) * 100);
  const REPO_STATS = REPOS.map(r => {
    const runs = Math.floor(Math.random() * 12) + 6,
      fails = r.status === 'failure' ? 3 : Math.floor(Math.random() * 2);
    return {
      ...r,
      runs14d: runs,
      fails14d: fails,
      rate: Math.round((runs - fails) / runs * 100)
    };
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 32px',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '22px'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: '17px',
      fontWeight: 600,
      color: 'var(--text-primary)',
      letterSpacing: '-0.02em'
    }
  }, "Insights"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      padding: '3px 10px',
      borderRadius: '4px'
    }
  }, "Last 14 days")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: '12px',
      marginBottom: '24px'
    }
  }, [{
    label: 'Total runs',
    val: String(totalRuns),
    sub: '14-day window'
  }, {
    label: 'Success rate',
    val: `${succRate}%`,
    sub: `${totalFails} failures`
  }, {
    label: 'Avg duration',
    val: '1m 54s',
    sub: 'across all repos'
  }, {
    label: 'Most failures',
    val: 'web-dashboard',
    sub: '6 failures',
    mono: true
  }].map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10px',
      color: 'var(--text-tertiary)',
      marginBottom: '6px',
      letterSpacing: '0.07em',
      textTransform: 'uppercase'
    }
  }, s.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '20px',
      fontWeight: 700,
      color: 'var(--text-primary)',
      letterSpacing: '-0.03em',
      lineHeight: 1,
      fontFeatureSettings: '"tnum"',
      fontFamily: s.mono ? 'var(--font-mono)' : 'inherit'
    }
  }, s.val), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      marginTop: '4px'
    }
  }, s.sub)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
      padding: '18px 20px',
      marginBottom: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '13px',
      fontWeight: 500,
      color: 'var(--text-primary)'
    }
  }, "Runs per day"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '14px',
      fontSize: '11px',
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 2,
      background: 'var(--status-success)',
      opacity: .55,
      display: 'inline-block'
    }
  }), "Success"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 2,
      background: 'var(--status-failure)',
      opacity: .75,
      display: 'inline-block'
    }
  }), "Failure"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 20,
      height: 2,
      background: 'var(--pw-amber-500)',
      display: 'inline-block',
      borderRadius: 1
    }
  }), "Success rate"))), /*#__PURE__*/React.createElement(RunsChart, {
    data: DAILY_DATA
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-elevated)',
      fontSize: '10px',
      fontWeight: 500,
      color: 'var(--text-tertiary)',
      letterSpacing: '0.07em',
      textTransform: 'uppercase'
    }
  }, "Repository breakdown"), /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, ['Repository', 'Status', 'Runs (14d)', 'Failures', 'Success rate', 'Avg duration'].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      padding: '8px 14px',
      textAlign: 'left',
      fontSize: '10px',
      fontWeight: 500,
      color: 'var(--text-tertiary)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, REPO_STATS.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: r.id,
    style: {
      borderBottom: i < REPO_STATS.length - 1 ? '1px solid var(--border-subtle)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: 'var(--text-primary)',
      fontWeight: 500
    }
  }, r.org, "/", r.name), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px'
    }
  }, /*#__PURE__*/React.createElement(SBadge, {
    status: r.status
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: 'var(--text-secondary)',
      fontFeatureSettings: '"tnum"'
    }
  }, r.runs14d), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: r.fails14d > 0 ? 'var(--status-failure)' : 'var(--status-success)',
      fontFeatureSettings: '"tnum"'
    }
  }, r.fails14d), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 72,
      height: 4,
      borderRadius: 2,
      background: 'var(--bg-elevated)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${r.rate}%`,
      height: '100%',
      background: r.rate >= 90 ? 'var(--status-success)' : r.rate >= 70 ? 'var(--pw-amber-500)' : 'var(--status-failure)',
      borderRadius: 2
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--text-secondary)',
      fontFeatureSettings: '"tnum"'
    }
  }, r.rate, "%"))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: 'var(--text-secondary)',
      fontFeatureSettings: '"tnum"'
    }
  }, r.duration)))))));
}

// ─── Settings View ────────────────────────────────────────────────────────────
function InlineSw({
  checked,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: () => onChange(!checked),
    style: {
      width: 34,
      height: 19,
      borderRadius: 9999,
      background: checked ? 'var(--interactive-accent)' : 'var(--bg-overlay)',
      border: `1px solid ${checked ? 'var(--interactive-accent)' : 'var(--border-default)'}`,
      cursor: 'pointer',
      position: 'relative',
      flexShrink: 0,
      transition: 'background 150ms,border-color 150ms'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      width: 13,
      height: 13,
      borderRadius: 9999,
      background: 'white',
      top: '50%',
      left: 2,
      transform: `translateY(-50%) translateX(${checked ? 14 : 0}px)`,
      boxShadow: '0 1px 3px rgba(0,0,0,.25)',
      transition: 'transform 150ms cubic-bezier(0,0,0.2,1)'
    }
  }));
}
function SettingsView() {
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySlack, setNotifySlack] = useState(false);
  const [notifyPR, setNotifyPR] = useState(true);
  const [notifySuccess, setNotifySuccess] = useState(false);
  const [retention, setRetention] = useState('90');
  const [saved, setSaved] = useState(false);
  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const Row = ({
    label,
    hint,
    ctrl
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '13px 0',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '13px',
      fontWeight: 500,
      color: 'var(--text-primary)'
    }
  }, label), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      marginTop: '2px'
    }
  }, hint)), ctrl);
  const Section = ({
    title,
    sub,
    children
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
      padding: '16px 20px',
      marginBottom: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '12px',
      paddingBottom: '10px',
      borderBottom: '1px solid var(--border-default)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '13px',
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, title), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      marginTop: '2px'
    }
  }, sub)), children);
  const selStyle = {
    height: 30,
    padding: '0 28px 0 10px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: '6px',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    fontSize: '12px',
    color: 'var(--text-primary)',
    appearance: 'none',
    cursor: 'pointer'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 32px',
      fontFamily: 'var(--font-sans)',
      maxWidth: 680
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: '17px',
      fontWeight: 600,
      color: 'var(--text-primary)',
      letterSpacing: '-0.02em'
    }
  }, "Settings"), /*#__PURE__*/React.createElement("button", {
    onClick: save,
    style: {
      height: 32,
      padding: '0 16px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      fontWeight: 500,
      background: saved ? 'var(--status-success)' : 'var(--interactive-accent)',
      color: 'white',
      transition: 'background 200ms'
    }
  }, saved ? '✓ Saved' : 'Save changes')), /*#__PURE__*/React.createElement(Section, {
    title: "Notifications",
    sub: "Configure when and how you receive alerts."
  }, /*#__PURE__*/React.createElement(Row, {
    label: "Email on failure",
    hint: "Send an email when any pipeline fails.",
    ctrl: /*#__PURE__*/React.createElement(InlineSw, {
      checked: notifyEmail,
      onChange: setNotifyEmail
    })
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Slack integration",
    hint: "Post alerts to your Slack workspace.",
    ctrl: /*#__PURE__*/React.createElement(InlineSw, {
      checked: notifySlack,
      onChange: setNotifySlack
    })
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Notify on pull requests",
    hint: "Include PR runs in all notifications.",
    ctrl: /*#__PURE__*/React.createElement(InlineSw, {
      checked: notifyPR,
      onChange: setNotifyPR
    })
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Notify on success",
    hint: "Also send for successful runs.",
    ctrl: /*#__PURE__*/React.createElement(InlineSw, {
      checked: notifySuccess,
      onChange: setNotifySuccess
    })
  })), /*#__PURE__*/React.createElement(Section, {
    title: "General",
    sub: "Default behaviour for repositories and runs."
  }, /*#__PURE__*/React.createElement(Row, {
    label: "Default branch",
    hint: "Monitored if no other branch is specified.",
    ctrl: /*#__PURE__*/React.createElement("select", {
      style: selStyle
    }, /*#__PURE__*/React.createElement("option", null, "main"), /*#__PURE__*/React.createElement("option", null, "master"), /*#__PURE__*/React.createElement("option", null, "dev"))
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Run log retention",
    hint: "How long to keep run logs and artefacts.",
    ctrl: /*#__PURE__*/React.createElement("select", {
      value: retention,
      onChange: e => setRetention(e.target.value),
      style: selStyle
    }, /*#__PURE__*/React.createElement("option", {
      value: "30"
    }, "30 days"), /*#__PURE__*/React.createElement("option", {
      value: "90"
    }, "90 days"), /*#__PURE__*/React.createElement("option", {
      value: "180"
    }, "180 days"), /*#__PURE__*/React.createElement("option", {
      value: "365"
    }, "1 year"))
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Edition",
    hint: "Your current PipeWatch plan.",
    ctrl: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: 'var(--pw-amber-500)',
        background: 'oklch(70% 0.195 55 / 0.12)',
        padding: '3px 10px',
        borderRadius: '4px'
      }
    }, "Cloud")
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-surface)',
      border: '1px solid oklch(58% 0.205 23 / 0.25)',
      borderRadius: '8px',
      padding: '16px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '12px',
      paddingBottom: '10px',
      borderBottom: '1px solid oklch(58% 0.205 23 / 0.15)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '13px',
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, "Danger zone"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      marginTop: '2px'
    }
  }, "Irreversible actions \u2014 proceed with care.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '13px',
      fontWeight: 500,
      color: 'var(--text-primary)'
    }
  }, "Delete organisation"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      marginTop: '2px'
    }
  }, "Permanently remove this org and all its data.")), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 32,
      padding: '0 14px',
      borderRadius: '6px',
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      fontWeight: 500,
      cursor: 'pointer',
      background: 'transparent',
      border: '1px solid var(--status-failure)',
      color: 'var(--status-failure)',
      transition: 'background 100ms'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'oklch(58% 0.205 23 / 0.1)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, "Delete organisation"))));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function PBtn({
  children,
  onClick,
  primary
}) {
  const [hov, setHov] = useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      height: 32,
      padding: '0 12px',
      borderRadius: '6px',
      border: primary ? 'none' : '1px solid var(--border-default)',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      fontWeight: primary ? 500 : 400,
      background: primary ? 'var(--interactive-accent)' : hov ? 'var(--bg-overlay)' : 'var(--bg-elevated)',
      color: primary ? 'var(--interactive-fg)' : hov ? 'var(--text-primary)' : 'var(--text-secondary)',
      transition: 'background 80ms, color 80ms'
    }
  }, children);
}
function SectionHead({
  title,
  action,
  onAction
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '10px'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: '12px',
      fontWeight: 600,
      color: 'var(--text-primary)',
      letterSpacing: '-0.01em'
    }
  }, title), action && /*#__PURE__*/React.createElement("button", {
    onClick: onAction,
    style: {
      fontSize: '12px',
      color: 'var(--text-accent)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      padding: 0
    }
  }, action, " \u2192"));
}

// ─── App root ─────────────────────────────────────────────────────────────────
function App() {
  const saved = localStorage.getItem('pw-view') || 'dashboard';
  const [view, setView] = useState(saved);
  const [selectedRun, setSelectedRun] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('pw-theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pw-theme', theme);
  }, [theme]);
  const nav = v => {
    setView(v);
    localStorage.setItem('pw-view', v);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--bg-base)'
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    view: view,
    setView: nav,
    theme: theme,
    setTheme: setTheme
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      minHeight: '100vh'
    }
  }, view === 'dashboard' && /*#__PURE__*/React.createElement(Dashboard, {
    setView: nav,
    setSelectedRun: setSelectedRun
  }), view === 'runs' && /*#__PURE__*/React.createElement(RunsView, {
    setSelectedRun: setSelectedRun,
    setView: nav
  }), view === 'run-detail' && /*#__PURE__*/React.createElement(RunDetail, {
    run: selectedRun,
    setView: nav
  }), view === 'repositories' && /*#__PURE__*/React.createElement(RepositoriesView, {
    setView: nav
  }), view === 'insights' && /*#__PURE__*/React.createElement(InsightsView, null), view === 'settings' && /*#__PURE__*/React.createElement(SettingsView, null)));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/App.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.RepoCard = __ds_scope.RepoCard;

__ds_ns.Sparkline = __ds_scope.Sparkline;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.RunPulse = __ds_scope.RunPulse;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.RadioGroup = __ds_scope.RadioGroup;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.ToastStack = __ds_scope.ToastStack;

__ds_ns.Tooltip = __ds_scope.Tooltip;

})();
