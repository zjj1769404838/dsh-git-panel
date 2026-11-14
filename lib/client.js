window.__ModuleLoader__.load({ id: "@zjjlivingfree/dsh-git-panel", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react2 = require("react");
var import_react_dom = require("react-dom");

// src/client/shared.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var NS = "dsh-git-panel";
var ROUTE = "/dsh-git-panel";
function routeUrl(path) {
  const base = document.baseURI || location.href;
  return new URL(ROUTE + path, base).toString();
}
async function api(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2e4);
  try {
    const response = await fetch(routeUrl(path), {
      method: body === void 0 ? "GET" : "POST",
      headers: body === void 0 ? void 0 : { "content-type": "application/json" },
      body: body === void 0 ? void 0 : JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let json = null;
    try {
      json = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!json) throw new Error(`\u63A5\u53E3\u8FD4\u56DE\u975E JSON\uFF08HTTP ${response.status}\uFF09`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}
var CSS = `
/* \u8BBE\u8BA1\u4EE4\u724C\uFF08ui-ux-pro-max / Dark Mode OLED\uFF09\uFF1A\u5F00\u53D1\u8005\u5DE5\u5177\u6DF1\u8272\u76AE\u80A4\u3002
   \u53D8\u91CF\u540C\u65F6\u6302\u5728 root / panel\uFF1Apanel \u662F portal\uFF0C\u8131\u79BB .dgp-root \u7EE7\u627F\uFF0C\u5FC5\u987B\u81EA\u5E26\u4E00\u4EFD\u3002 */
.dgp-root, .dgp-panel {
  --dgp-bg: #0f172a;
  --dgp-bg-soft: #1b2336;
  --dgp-bg-hover: #272f42;
  --dgp-fg: #f1f5f9;
  --dgp-fg-muted: #94a3b8;
  --dgp-border: #233047;
  --dgp-border-strong: #3b4a63;
  --dgp-accent: #22c55e;
  --dgp-accent-fg: #06210f;
  --dgp-danger: #ef4444;
  --dgp-warn: #f59e0b;
  --dgp-info: #38bdf8;
  --dgp-shadow: 0 1px 2px rgba(0,0,0,.45), 0 16px 44px -12px rgba(0,0,0,.72);
  --dgp-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --dgp-sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}
@media (prefers-color-scheme: light) {
  .dgp-root, .dgp-panel {
    --dgp-bg: #ffffff;
    --dgp-bg-soft: #f4f7fb;
    --dgp-bg-hover: #e8eef6;
    --dgp-fg: #0f172a;
    --dgp-fg-muted: #64748b;
    --dgp-border: #e6ecf3;
    --dgp-border-strong: #cbd5e1;
    --dgp-accent: #16a34a;
    --dgp-accent-fg: #ffffff;
    --dgp-shadow: 0 1px 2px rgba(15,23,42,.10), 0 16px 44px -12px rgba(15,23,42,.28);
  }
}
.dgp-root, .dgp-panel { font: 13px/1.5 var(--dgp-sans); color: var(--dgp-fg); }
.dgp-root ::selection, .dgp-panel ::selection { background: var(--dgp-accent); color: var(--dgp-accent-fg); }

/* chip\uFF1A\u8F93\u5165\u6846\u65C1\u5165\u53E3\uFF0C\u6052\u663E Git \u6587\u672C + \u5206\u652F\uFF08v3.15 \u53BB\u6389\u72B6\u6001\u6570\u5B57\u5FBD\u6807\uFF09 */
.dgp-chip { display: inline-flex; align-items: center; gap: 7px; padding: 4px 11px; border-radius: 8px;
  border: 1px solid var(--dgp-border-strong); background: var(--dgp-bg-soft); color: var(--dgp-fg);
  cursor: pointer; font-size: 12px; line-height: 18px; max-width: 280px; white-space: nowrap;
  transition: border-color 150ms ease, background 150ms ease, transform 120ms ease-out; }
.dgp-chip:hover { border-color: var(--dgp-accent); background: var(--dgp-bg-hover); }
.dgp-chip:active { transform: scale(.97); }
.dgp-chip svg { color: var(--dgp-accent); flex: none; }
.dgp-chip-label { font-weight: 600; letter-spacing: .04em; flex: none; }
.dgp-chip-sep { color: var(--dgp-fg-muted); flex: none; font-family: var(--dgp-mono); }
.dgp-chip-branch { overflow: hidden; text-overflow: ellipsis; min-width: 0; font-family: var(--dgp-mono); }

/* \u7126\u70B9\u53EF\u89C1 */
.dgp-chip:focus-visible, .dgp-btn:focus-visible, .dgp-iconbtn:focus-visible, .dgp-input:focus-visible {
  outline: 2px solid var(--dgp-accent); outline-offset: 2px; }
.dgp-chip:focus:not(:focus-visible), .dgp-btn:focus:not(:focus-visible), .dgp-iconbtn:focus:not(:focus-visible) { outline: none; }
.dgp-input:focus-visible { outline-offset: -1px; }

/* \u9762\u677F */
.dgp-panel { position: fixed; z-index: 2200; width: min(400px, calc(100vw - 16px)); max-height: 72vh; overflow: auto;
  background: var(--dgp-bg); color: var(--dgp-fg); border: 1px solid var(--dgp-border); border-radius: 14px;
  box-shadow: var(--dgp-shadow); padding: 0; scrollbar-width: thin; scrollbar-color: var(--dgp-border-strong) transparent;
  transform-origin: bottom left; animation: dgp-pop 160ms cubic-bezier(.16,1,.3,1); }
.dgp-panel::-webkit-scrollbar { width: 8px; }
.dgp-panel::-webkit-scrollbar-thumb { background: var(--dgp-border-strong); border-radius: 4px; }
.dgp-panel::-webkit-scrollbar-track { background: transparent; }
@keyframes dgp-pop { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }

/* \u5934\u90E8 / \u72B6\u6001\u680F */
.dgp-head { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-bottom: 1px solid var(--dgp-border); }
.dgp-head svg { color: var(--dgp-accent); flex: none; }
.dgp-title { font-weight: 600; font-size: 13px; letter-spacing: .01em; }
.dgp-iconbtn { border: none; background: transparent; cursor: pointer; padding: 5px; border-radius: 6px;
  color: var(--dgp-fg-muted); display: inline-flex; align-items: center;
  transition: background 150ms ease, color 150ms ease, transform 120ms ease-out; }
.dgp-iconbtn:hover { background: var(--dgp-bg-hover); color: var(--dgp-fg); }
.dgp-iconbtn:active { transform: scale(.92); }
.dgp-statusbar { display: flex; align-items: center; gap: 8px; padding: 9px 14px;
  border-bottom: 1px solid var(--dgp-border); background: var(--dgp-bg-soft); }
.dgp-status-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dgp-status-dot[data-state='clean'] { background: var(--dgp-accent); }
.dgp-status-dot[data-state='dirty'] { background: var(--dgp-warn); }
.dgp-status-branch { font: 600 12px var(--dgp-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

/* \u5206\u533A */
.dgp-sect { margin: 0; padding: 11px 14px; border-bottom: 1px solid var(--dgp-border); }
.dgp-sect-title { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
  color: var(--dgp-fg-muted); margin-bottom: 8px; }
.dgp-muted { color: var(--dgp-fg-muted); font-size: 12px; }
.dgp-empty { color: var(--dgp-fg-muted); padding: 6px 0; font-size: 12px; }
.dgp-spacer { flex: 1; }

/* \u6309\u94AE\uFF08v3.15 \u5220\u9664\u5F3A\u8C03/\u5206\u7EC4\u6309\u94AE\uFF1A\u52A8\u4F5C\u6309\u94AE\u5DF2\u4E0B\u7EBF\uFF09 */
.dgp-btn { border: 1px solid var(--dgp-border-strong); background: var(--dgp-bg-soft); color: var(--dgp-fg);
  border-radius: 7px; padding: 5px 11px; cursor: pointer; font-size: 12px; line-height: 16px;
  transition: transform 120ms ease-out, background 150ms ease, border-color 150ms ease, color 150ms ease, filter 150ms ease; }
/* \u5B9E\u5FC3\u5F3A\u8C03\u6309\u94AE\u4E0D\u5957\u7528\u901A\u7528 hover \u80CC\u666F\uFF1A\u5426\u5219\u6D45\u8272\u4E3B\u9898\u4E0B\u4F1A\u53D8\u6210\u300C\u767D\u5B57 + \u6D45\u7070\u5E95\u300D\u770B\u4E0D\u6E05\uFF08v3.12 \u4FEE\u590D\uFF09\u3002 */
.dgp-btn:hover:not(:disabled):not(.dgp-btn-accent) { border-color: var(--dgp-accent); background: var(--dgp-bg-hover); }
.dgp-btn:active:not(:disabled) { transform: translateY(1px); }
.dgp-btn:disabled { opacity: .4; cursor: default; }
.dgp-btn-danger { color: var(--dgp-danger); border-color: rgba(239,68,68,.5); }
.dgp-btn-danger:hover:not(:disabled) { border-color: var(--dgp-danger); }
.dgp-btnrow { display: flex; flex-wrap: wrap; gap: 6px; }

/* \u6587\u4EF6\u5217\u8868 */
.dgp-file { display: flex; gap: 8px; align-items: center; padding: 3px 0; font: 12px/1.5 var(--dgp-mono); }
.dgp-file a { overflow-wrap: anywhere; min-width: 0; color: var(--dgp-info); }
.dgp-file-status { width: 20px; text-align: center; color: var(--dgp-accent); font-weight: 600; }
.dgp-file-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

/* \u8868\u5355 / \u5361\u7247 / \u8D26\u53F7 */
.dgp-toggle { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; cursor: pointer;
  user-select: none; color: var(--dgp-fg-muted); }
.dgp-toggle input[type='checkbox'] { accent-color: var(--dgp-accent); width: 14px; height: 14px; cursor: pointer; }
.dgp-input { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 7px 10px; border-radius: 7px;
  border: 1px solid var(--dgp-border-strong); background: var(--dgp-bg); color: var(--dgp-fg); font-size: 12px; }
.dgp-input::placeholder { color: var(--dgp-fg-muted); opacity: 1; }
.dgp-card { margin-top: 8px; border: 1px solid var(--dgp-border); border-radius: 9px; padding: 10px; background: var(--dgp-bg-soft); }
.dgp-code { font-size: 18px; font-family: var(--dgp-mono); letter-spacing: .08em; margin: 4px 0; user-select: all; }
.dgp-account { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--dgp-border); }
.dgp-account:last-child { border-bottom: none; }
.dgp-acct-login { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--dgp-mono); }
.dgp-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dgp-dot-connected { background: var(--dgp-accent); }
.dgp-dot-expired { background: var(--dgp-warn); }
.dgp-dot-error { background: var(--dgp-danger); }

@media (prefers-reduced-motion: reduce) {
  .dgp-panel { animation: none; }
  .dgp-btn:active, .dgp-chip:active, .dgp-iconbtn:active { transform: none; }
}
`;
function useStyles() {
  (0, import_react.useEffect)(() => {
    if (document.getElementById("dgp-style")) return;
    const style = document.createElement("style");
    style.id = "dgp-style";
    style.textContent = CSS;
    document.head.appendChild(style);
  }, []);
}
function Dot({ state }) {
  const label = state === "expired" ? "expired" : state === "error" ? "error" : "connected";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `dgp-dot dgp-dot-${state || "connected"}`, role: "img", "aria-label": label });
}

// src/client/index.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var inject = ["slots", "sessions", "locale"];
var BUILD = "dgp-v3.16";
var ZH = {
  entry: "Git",
  navLabel: "Git",
  panelTitle: "Git \u9762\u677F",
  refresh: "\u5237\u65B0",
  close: "\u5173\u95ED",
  notRepo: "\u5F53\u524D\u4F1A\u8BDD\u76EE\u5F55\u4E0D\u662F Git \u4ED3\u5E93",
  notRepoHint: "\u6253\u5F00\u6216\u5207\u6362\u5230\u4E00\u4E2A Git \u4ED3\u5E93\u76EE\u5F55\u540E\u518D\u67E5\u770B\u3002",
  retry: "\u91CD\u65B0\u68C0\u6D4B",
  detectFailed: "\u65E0\u6CD5\u68C0\u6D4B\u4ED3\u5E93\u72B6\u6001",
  gear: "\u8D26\u53F7\u4E0E\u6388\u6743",
  account: "GitHub \u8D26\u53F7",
  noAccount: "\u672A\u8FDE\u63A5\u8D26\u53F7\uFF08\u4E0D\u5F71\u54CD\u672C\u5730 git \u64CD\u4F5C\uFF09",
  acctConnected: "\u5DF2\u8FDE\u63A5",
  acctExpired: "\u5DF2\u5931\u6548",
  acctError: "\u51ED\u636E\u5F02\u5E38",
  connectAccount: "\u8FDE\u63A5\u8D26\u53F7",
  methodPat: "PAT \u4EE4\u724C",
  methodOauth: "OAuth \u8BBE\u5907\u7801",
  tokenLabel: "\u8BBF\u95EE\u4EE4\u724C",
  tokenPlaceholder: "\u7C98\u8D34 PAT\uFF08\u4FDD\u5B58\u540E\u4E0D\u518D\u56DE\u663E\uFF09",
  labelLabel: "\u5907\u6CE8\u540D\uFF08\u53EF\u9009\uFF09",
  clientIdLabel: "OAuth App Client ID",
  clientIdHint: "\u672C\u63D2\u4EF6\u4E0D\u5185\u7F6E\u4EFB\u4F55\u5E94\u7528\u51ED\u636E\uFF1A\u9700\u4F60\u81EA\u5EFA GitHub OAuth App \u5E76\u586B\u5165 Client ID\u3002",
  userCode: "\u6D4F\u89C8\u5668\u6253\u5F00\u4E0B\u9762\u7684\u5730\u5740\u5E76\u8F93\u5165\u4EE3\u7801\u5B8C\u6210\u6388\u6743",
  waiting: "\u7B49\u5F85\u6388\u6743\u2026",
  connect: "\u8FDE\u63A5",
  cancel: "\u53D6\u6D88",
  disconnect: "\u65AD\u5F00",
  recheck: "\u6821\u9A8C",
  injectFailed: "\u6CE8\u5165\u5931\u8D25",
  allowWrite: "\u5141\u8BB8 Agent \u4FEE\u6539\u4ED3\u5E93",
  requireConfirm: "\u5199\u64CD\u4F5C\u524D\u9700\u8981\u6211\u786E\u8BA4",
  npmAccount: "npm \u53D1\u5E03\u8D26\u53F7",
  npmNoAccount: "\u672A\u914D\u7F6E npm \u51ED\u636E\u3002",
  npmConnect: "\u8FDE\u63A5 npm",
  npmAdd: "\u6DFB\u52A0\u51ED\u636E",
  npmSwitch: "\u5207\u6362",
  npmActive: "\u5F53\u524D",
  npmError: "\u51ED\u636E\u6821\u9A8C\u5931\u8D25",
  npmTokenLabel: "npm token",
  npmTokenHint: "\u5728 npmjs.com \u2192 Access Tokens \u751F\u6210\uFF1B\u9A8C\u8BC1\u901A\u8FC7\u540E\u5199\u5165 ~/.npmrc\uFF08\u7B49\u540C npm login\uFF09\uFF0C\u4FDD\u5B58\u540E\u4E0D\u518D\u56DE\u663E\u3002",
  npmTokenPlaceholder: "\u7C98\u8D34 npm token\uFF08npm_ \u6216\u65E7\u5F0F\u957F hex \u5747\u53EF\uFF09"
};
var EN = {
  entry: "Git",
  navLabel: "Git",
  panelTitle: "Git Panel",
  refresh: "Refresh",
  close: "Close",
  notRepo: "This session directory is not a Git repository",
  notRepoHint: "Open or switch to a Git repository directory to inspect it.",
  retry: "Check again",
  detectFailed: "Cannot detect repository status",
  gear: "Accounts & Access",
  account: "GitHub account",
  noAccount: "No account connected (local git still works)",
  acctConnected: "Connected",
  acctExpired: "Expired",
  acctError: "Credential error",
  connectAccount: "Connect account",
  methodPat: "PAT token",
  methodOauth: "OAuth device flow",
  tokenLabel: "Access token",
  tokenPlaceholder: "Paste PAT (never shown again after save)",
  labelLabel: "Label (optional)",
  clientIdLabel: "OAuth App Client ID",
  clientIdHint: "No third-party app credential is bundled: create your own GitHub OAuth App and paste its Client ID.",
  userCode: "Open the URL below in a browser and enter the code",
  waiting: "Waiting for authorization\u2026",
  connect: "Connect",
  cancel: "Cancel",
  disconnect: "Disconnect",
  recheck: "Recheck",
  injectFailed: "Injection failed",
  allowWrite: "Allow the agent to modify repositories",
  requireConfirm: "Ask me before every write",
  npmAccount: "npm publishing accounts",
  npmNoAccount: "No npm credential configured.",
  npmConnect: "Connect npm",
  npmAdd: "Add credential",
  npmSwitch: "Switch",
  npmActive: "Active",
  npmError: "Credential check failed",
  npmTokenLabel: "npm token",
  npmTokenHint: "Create one at npmjs.com \u2192 Access Tokens; after verification it is written to ~/.npmrc (same as npm login) and never shown again.",
  npmTokenPlaceholder: "Paste npm token (npm_ or legacy long hex)"
};
function useSessionCwd(sessions, sessionId) {
  const subscribe = (0, import_react2.useMemo)(
    () => (listener) => {
      try {
        const list = sessions?.list;
        return typeof list?.subscribe === "function" ? list.subscribe(listener) : () => {
        };
      } catch {
        return () => {
        };
      }
    },
    [sessions]
  );
  const get = (0, import_react2.useCallback)(() => {
    try {
      if (!sessionId || !sessions) return "";
      const value = sessions.list?.getSnapshot?.()?.byId?.[sessionId]?.cwd;
      return typeof value === "string" ? value : "";
    } catch {
      return "";
    }
  }, [sessionId, sessions]);
  return (0, import_react2.useSyncExternalStore)(subscribe, get, () => "");
}
function GearSection({ t, accounts, onAccounts }) {
  const [flags, setFlags] = (0, import_react2.useState)(null);
  const [connectOpen, setConnectOpen] = (0, import_react2.useState)(false);
  const [method, setMethod] = (0, import_react2.useState)("pat");
  const [token, setToken] = (0, import_react2.useState)("");
  const [label, setLabel] = (0, import_react2.useState)("");
  const [clientId, setClientId] = (0, import_react2.useState)("");
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [oauthFlow, setOauthFlow] = (0, import_react2.useState)(null);
  const [error, setError] = (0, import_react2.useState)("");
  const pollRef = (0, import_react2.useRef)(null);
  (0, import_react2.useEffect)(() => {
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    };
  }, []);
  const ensureLoaded = (0, import_react2.useCallback)(async () => {
    if (flags !== null) return;
    try {
      const data = await api("/state");
      if (data.ok && data.state) {
        setFlags({ allowWrite: data.state.settings.allowWrite, requireConfirm: data.state.settings.requireConfirm });
        onAccounts(data.state.accounts);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [flags, onAccounts]);
  const applySettings = async (patch) => {
    try {
      const data = await api("/settings", patch);
      if (data.ok && data.state) {
        onAccounts(data.state.accounts);
        if (data.state.settings) setFlags({ allowWrite: data.state.settings.allowWrite, requireConfirm: data.state.settings.requireConfirm });
        return data.state;
      }
      setError(data.error ?? t("detectFailed"));
    } catch (err) {
      setError(err.message);
    }
    return null;
  };
  const toggleFlag = async (key, value) => {
    await applySettings({ [key]: value });
  };
  const connectPat = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api("/pat/connect", { token, label });
      if (data.ok && data.state) {
        onAccounts(data.state.accounts);
        setConnectOpen(false);
        setToken("");
      } else {
        setError(data.error ?? t("injectFailed"));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const startOauth = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api("/oauth/start", { clientId });
      if (!data.ok || !data.pollKey || !data.flow) {
        setError(data.error ?? t("detectFailed"));
        return;
      }
      setOauthFlow({ userCode: data.flow.userCode, verificationUri: data.flow.verificationUri });
      const pollKey = data.pollKey;
      pollRef.current = window.setInterval(async () => {
        try {
          const res = await api("/oauth/poll", { pollKey });
          if (res.status === "authorized" && res.state) {
            if (pollRef.current !== null) window.clearInterval(pollRef.current);
            onAccounts(res.state.accounts);
            setConnectOpen(false);
            setOauthFlow(null);
          } else if (res.status === "denied" || res.status === "expired" || res.status === "error") {
            if (pollRef.current !== null) window.clearInterval(pollRef.current);
            setError(res.error ?? t("injectFailed"));
            setOauthFlow(null);
          }
        } catch {
        }
      }, 4e3);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const accountAction = async (action, id) => {
    try {
      const data = await api(`/accounts/${action}`, { id });
      if (data.state) onAccounts(data.state.accounts);
    } catch (err) {
      setError(err.message);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-sect", onPointerEnter: () => void ensureLoaded(), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "details",
    {
      onToggle: (e) => {
        if (e.target.open) void ensureLoaded();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("summary", { className: "dgp-sect-title", style: { cursor: "pointer" }, children: t("gear") }),
        error && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-empty", role: "alert", children: [
          error,
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-iconbtn", "aria-label": t("close"), onClick: () => setError(""), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CloseGlyph, {}) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-sect-title", style: { marginTop: 6 }, children: t("account") }),
        accounts.map((account) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-account", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Dot, { state: account.status }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-acct-login", title: account.login, children: account.login }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dgp-muted", children: [
            account.kind === "oauth" ? "OAuth" : "PAT",
            " \xB7 ",
            t(account.status === "expired" ? "acctExpired" : account.status === "error" ? "acctError" : "acctConnected")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-spacer" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => void accountAction("recheck", account.id), children: t("recheck") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => void accountAction("remove", account.id), children: t("disconnect") })
        ] }, account.id)),
        accounts.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-empty", children: t("noAccount") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", style: { marginTop: 6 }, onClick: () => setConnectOpen(!connectOpen), children: t("connectAccount") }),
        connectOpen && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-btnrow", style: { marginBottom: 8 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => setMethod("pat"), style: method === "pat" ? { borderColor: "var(--dsh-accent, #4a9eff)" } : void 0, children: t("methodPat") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => setMethod("oauth"), style: method === "oauth" ? { borderColor: "var(--dsh-accent, #4a9eff)" } : void 0, children: t("methodOauth") })
          ] }),
          method === "pat" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-sect-title", children: t("tokenLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { className: "dgp-input", type: "password", autoComplete: "off", "aria-label": t("tokenLabel"), placeholder: t("tokenPlaceholder"), value: token, onChange: (e) => setToken(e.target.value) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-sect-title", style: { marginTop: 6 }, children: t("labelLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { className: "dgp-input", "aria-label": t("labelLabel"), value: label, onChange: (e) => setLabel(e.target.value) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-btnrow", style: { marginTop: 8 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", disabled: busy || token.trim().length === 0, onClick: () => void connectPat(), children: t("connect") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => setConnectOpen(false), children: t("cancel") })
            ] })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-sect-title", children: t("clientIdLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-muted", children: t("clientIdHint") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { className: "dgp-input", "aria-label": t("clientIdLabel"), value: clientId, onChange: (e) => setClientId(e.target.value) }),
            oauthFlow ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginTop: 8 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-muted", children: t("userCode") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-file", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("a", { href: oauthFlow.verificationUri, target: "_blank", rel: "noreferrer", children: oauthFlow.verificationUri }) }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-code", children: oauthFlow.userCode }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-muted", children: t("waiting") })
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-btnrow", style: { marginTop: 8 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", disabled: busy || clientId.trim().length === 0, onClick: () => void startOauth(), children: t("connect") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => setConnectOpen(false), children: t("cancel") })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(NpmCard, { t }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginTop: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dgp-toggle", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: flags?.allowWrite === true, disabled: flags === null, onChange: (e) => void toggleFlag("allowWrite", e.target.checked) }),
            t("allowWrite")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dgp-toggle", style: { marginTop: 4 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: flags?.requireConfirm !== false, disabled: flags === null, onChange: (e) => void toggleFlag("requireConfirm", e.target.checked) }),
            t("requireConfirm")
          ] })
        ] })
      ]
    }
  ) });
}
function NpmCard({ t }) {
  const [view, setView] = (0, import_react2.useState)(null);
  const [token, setToken] = (0, import_react2.useState)("");
  const [open, setOpen] = (0, import_react2.useState)(false);
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)("");
  const load = (0, import_react2.useCallback)(async () => {
    try {
      const data = await api("/npm/status", {});
      if (data.ok && data.npm) setView(data.npm);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  (0, import_react2.useEffect)(() => {
    void load();
  }, [load]);
  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api("/npm/connect", { token });
      if (data.ok) {
        setOpen(false);
        setToken("");
        await load();
      } else {
        setError(data.error ?? t("injectFailed"));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const switchTo = async (id) => {
    setBusy(true);
    setError("");
    try {
      const data = await api("/npm/switch", { id });
      if (!data.ok) setError(data.error ?? t("injectFailed"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id) => {
    setBusy(true);
    setError("");
    try {
      const data = await api("/npm/remove", { id });
      if (!data.ok) setError(data.error ?? t("injectFailed"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const rows = view?.accounts ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-sect", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-sect-title", children: t("npmAccount") }),
    error && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-empty", role: "alert", children: error }),
    rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-account", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Dot, { state: row.active ? row.state === "error" ? "error" : "connected" : "connected" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-acct-login", title: row.login, children: row.login }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-muted", children: row.active ? t("npmActive") : row.state === "error" && row.error ? row.error : row.masked }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-spacer" }),
      !row.active && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", disabled: busy, onClick: () => void switchTo(row.id), children: t("npmSwitch") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn dgp-btn-danger", disabled: busy, onClick: () => void remove(row.id), children: t("disconnect") })
    ] }, row.id)),
    rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-empty", children: t("npmNoAccount") }),
    rows.length > 0 && view?.activeState === "error" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-muted", children: [
      t("npmError"),
      ": ",
      view.activeError
    ] }),
    !open && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", style: { marginTop: 6 }, onClick: () => setOpen(true), children: rows.length === 0 ? t("npmConnect") : t("npmAdd") }),
    open && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-sect-title", children: t("npmTokenLabel") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-muted", children: t("npmTokenHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { className: "dgp-input", type: "password", autoComplete: "off", "aria-label": t("npmTokenLabel"), placeholder: t("npmTokenPlaceholder"), value: token, onChange: (e) => setToken(e.target.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-btnrow", style: { marginTop: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", disabled: busy || token.trim().length === 0, onClick: () => void connect(), children: t("connect") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => setOpen(false), children: t("cancel") })
      ] })
    ] })
  ] });
}
function RefreshGlyph() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M13.5 1.5v3h-3" })
  ] });
}
function CloseGlyph() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M4 4l8 8M12 4l-8 8" }) });
}
function BranchChip({ t, sessionId, sessions }) {
  useStyles();
  const [status, setStatus] = (0, import_react2.useState)(null);
  const [accounts, setAccounts] = (0, import_react2.useState)([]);
  const [detectError, setDetectError] = (0, import_react2.useState)("");
  const [open, setOpen] = (0, import_react2.useState)(false);
  const [checking, setChecking] = (0, import_react2.useState)(false);
  const chipRef = (0, import_react2.useRef)(null);
  const panelRef = (0, import_react2.useRef)(null);
  const [anchor, setAnchor] = (0, import_react2.useState)({ left: 0, bottom: 0 });
  const cwd = useSessionCwd(sessions, sessionId);
  (0, import_react2.useEffect)(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);
  const reload = (0, import_react2.useCallback)(async () => {
    if (!cwd) {
      setStatus(null);
      setDetectError("");
      return;
    }
    setChecking(true);
    try {
      const data = await api(
        `/repo/status?cwd=${encodeURIComponent(cwd)}`
      );
      if (data.ok && data.status) {
        setStatus(data.status);
        setDetectError("");
        if (data.status.isRepo) {
          const state = await api("/state").catch(() => null);
          if (state?.state?.accounts) setAccounts(state.state.accounts);
        }
      } else {
        setStatus(null);
        setDetectError(data.error || t("detectFailed"));
      }
    } catch (error) {
      setStatus(null);
      setDetectError(error.message || t("detectFailed"));
    } finally {
      setChecking(false);
    }
  }, [cwd, t]);
  (0, import_react2.useEffect)(() => {
    setStatus(null);
    setDetectError("");
    if (!cwd) return;
    let alive = true;
    const load = () => {
      if (alive && document.visibilityState !== "hidden") void reload();
    };
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [cwd, reload]);
  const toggle = () => {
    const next = !open;
    if (next && chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect();
      setAnchor({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 392)), bottom: window.innerHeight - rect.top + 6 });
    }
    setOpen(next);
    if (next) {
      void reload();
      requestAnimationFrame(() => panelRef.current?.focus());
    } else {
      chipRef.current?.focus();
    }
  };
  const isRepo = status?.isRepo === true;
  const branchLabel = isRepo ? status.detached ? `HEAD @ ${status.head.slice(0, 7)}` : status.branch || "\u2014" : "\u2014";
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dgp-root", ref: chipRef, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "button",
      {
        type: "button",
        className: "dgp-chip",
        title: isRepo ? `Git \xB7 ${branchLabel}` : detectError || t("entry"),
        onClick: toggle,
        "aria-expanded": open,
        "aria-controls": open ? "dgp-panel" : void 0,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", "aria-hidden": "true", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "5", cy: "4", r: "2" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "5", cy: "12", r: "2" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "11", cy: "7", r: "2" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5 6v4M7 7h2M11 9v1a3 3 0 0 1-3 3H7" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-chip-label", children: "Git" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-chip-sep", "aria-hidden": "true", children: "\xB7" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-chip-branch", children: checking && !status ? "\u2026" : branchLabel })
        ]
      }
    ),
    open && (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "div",
        {
          ref: panelRef,
          id: "dgp-panel",
          tabIndex: -1,
          role: "dialog",
          "aria-label": t("panelTitle"),
          className: "dgp-panel",
          style: { left: anchor.left, bottom: anchor.bottom },
          onMouseLeave: () => {
            const active = document.activeElement;
            if (active && panelRef.current?.contains(active)) return;
            setOpen(false);
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", "aria-hidden": "true", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "5", cy: "4", r: "2" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "5", cy: "12", r: "2" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "11", cy: "7", r: "2" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5 6v4M7 7h2M11 9v1a3 3 0 0 1-3 3H7" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-title", children: t("panelTitle") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-spacer" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("refresh"), "aria-label": t("refresh"), onClick: () => void reload(), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RefreshGlyph, {}) }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("close"), "aria-label": t("close"), onClick: () => setOpen(false), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CloseGlyph, {}) })
            ] }),
            detectError && !isRepo && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-sect", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-empty", children: [
              detectError,
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => void reload(), children: t("retry") })
            ] }) }),
            !isRepo && !detectError && cwd && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-sect", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-empty", children: t("notRepo") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-muted", children: t("notRepoHint") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GearSection, { t, accounts, onAccounts: setAccounts })
          ]
        }
      ),
      document.body
    )
  ] });
}
function apply(ctx) {
  let t = (key) => ZH[key] ?? EN[key] ?? key;
  try {
    ctx.locale?.register?.(NS, { zh: ZH, en: EN });
    const bound = ctx.locale?.bind?.(NS);
    if (typeof bound === "function") {
      t = (key) => {
        const value = bound(key);
        return typeof value === "string" && value.length > 0 && value !== key ? value : ZH[key] ?? key;
      };
    }
  } catch (error) {
    ctx.logger?.warn?.(`[${NS}] locale \u6CE8\u518C\u5931\u8D25\uFF1A${String(error)}`);
  }
  const sessions = ctx.sessions;
  try {
    ctx.slots?.inject?.("conversation.input.left", () => {
      try {
        return ctx.slots?.register?.(
          {
            name: "conversation.input.left",
            id: "dsh-git-panel-branch",
            order: 30,
            locale: NS,
            inject: (sessionId) => ({ t, sessionId, sessions })
          },
          BranchChip
        );
      } catch (error) {
        ctx.logger?.error?.(`[${NS}] \u5165\u53E3\u6CE8\u518C\u5931\u8D25\uFF1A${String(error)}`);
        return void 0;
      }
    });
    ctx.logger?.info?.(`[${NS}] \u5206\u652F chip \u5DF2\u6CE8\u518C\uFF08${BUILD}\uFF09`);
  } catch (error) {
    ctx.logger?.error?.(`[${NS}] conversation.input.left \u6CE8\u5165\u5931\u8D25\uFF1A${String(error)}`);
  }
}
return module.exports; } });
