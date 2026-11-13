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
  fmt: () => fmt,
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
var PREF_EVENT = "dgp:pref-changed";
var PREF_AUTO_SUBMIT = "dgp.autoSubmit";
function readPref(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
    window.dispatchEvent(new Event(PREF_EVENT));
  } catch {
  }
}
function subscribePref(onChange) {
  const handler = () => onChange();
  window.addEventListener(PREF_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(PREF_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
var CSS = `
.dgp-root { font-size: 13px; color: var(--dsh-fg, inherit); }
.dgp-root ::selection { background: var(--dsh-accent, #4a9eff); color: #fff; }
.dgp-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px;
  border: 1px solid var(--dsh-border, rgba(128,128,128,.35)); background: var(--dsh-bg, transparent);
  cursor: pointer; font-size: 12px; line-height: 18px; max-width: 260px; white-space: nowrap; color: inherit;
  transition: border-color 120ms ease, transform 120ms ease-out; }
.dgp-chip:hover { border-color: var(--dsh-accent, #4a9eff); }
.dgp-chip:active { transform: scale(.97); }
.dgp-chip:focus-visible, .dgp-btn:focus-visible, .dgp-iconbtn:focus-visible {
  outline: 2px solid var(--dsh-accent, #4a9eff); outline-offset: 1px; }
.dgp-chip:focus:not(:focus-visible), .dgp-btn:focus:not(:focus-visible), .dgp-iconbtn:focus:not(:focus-visible) { outline: none; }
.dgp-chip-branch { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.dgp-chip-badge { opacity: .8; font-variant-numeric: tabular-nums; white-space: nowrap; flex-shrink: 0; }
.dgp-panel { position: fixed; z-index: 2200; width: min(384px, calc(100vw - 16px)); max-height: 70vh; overflow: auto;
  background: var(--dsh-popover-bg, var(--dsh-bg, #fff)); color: var(--dsh-fg, #1a1a1a); border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0,0,0,.18), 0 12px 32px -8px rgba(0,0,0,.35);
  padding: 10px 12px; scrollbar-width: thin; scrollbar-color: var(--dsh-border, rgba(128,128,128,.5)) transparent;
  transform-origin: bottom left; animation: dgp-pop 140ms cubic-bezier(.16,1,.3,1); }
.dgp-panel::-webkit-scrollbar { width: 8px; }
.dgp-panel::-webkit-scrollbar-thumb { background: var(--dsh-border, rgba(128,128,128,.5)); border-radius: 4px; }
.dgp-panel::-webkit-scrollbar-track { background: transparent; }
@keyframes dgp-pop { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .dgp-panel { animation: none; } }
.dgp-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.dgp-title { font-weight: 600; flex: 1; }
.dgp-iconbtn { border: none; background: transparent; cursor: pointer; padding: 6px; border-radius: 6px; opacity: .7;
  color: inherit; display: inline-flex; align-items: center; transition: background 120ms ease, transform 120ms ease-out; }
.dgp-iconbtn:hover { background: rgba(128,128,128,.15); opacity: 1; }
.dgp-iconbtn:active { transform: scale(.92); }
.dgp-sect { margin: 10px 0; }
.dgp-sect-title { font-size: 12px; font-weight: 500; opacity: .72; letter-spacing: .02em; margin-bottom: 6px; }
.dgp-btn { border: 1px solid var(--dsh-border, rgba(128,128,128,.35)); background: var(--dsh-bg, transparent);
  color: inherit; border-radius: 7px; padding: 5px 11px; cursor: pointer; font-size: 12px; line-height: 16px;
  transition: transform 120ms ease-out, border-color 120ms ease-out; }
.dgp-btn:hover:not(:disabled) { border-color: var(--dsh-accent, #4a9eff); }
.dgp-btn:active:not(:disabled) { transform: translateY(1px); }
.dgp-btn:disabled { opacity: .45; cursor: default; }
.dgp-btn-danger { color: #c0392b; border-color: rgba(192,57,43,.55); }
.dgp-btn-danger:hover:not(:disabled) { border-color: #c0392b; }
.dgp-btnrow { display: flex; flex-wrap: wrap; gap: 8px; }
.dgp-file { display: flex; gap: 8px; align-items: center; padding: 2px 0; font-family: var(--dsh-mono, monospace); font-size: 12px; }
.dgp-file a { overflow-wrap: anywhere; min-width: 0; }
.dgp-file-status { width: 20px; text-align: center; opacity: .85; }
.dgp-file-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.dgp-file-stat { opacity: .65; font-size: 12px; font-variant-numeric: tabular-nums; }
.dgp-row-line { padding: 2px 0; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgp-hash { font-family: var(--dsh-mono, monospace); opacity: .65; margin-right: 6px; }
.dgp-empty { opacity: .6; padding: 6px 0; font-size: 12px; }
.dgp-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; user-select: none; }
.dgp-toast { position: fixed; z-index: 2300; left: 50%; transform: translateX(-50%); bottom: 24px;
  max-width: min(90vw, 420px); text-align: center;
  background: var(--dsh-popover-bg, #222); color: var(--dsh-fg, #fff); border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,.2), 0 8px 24px -6px rgba(0,0,0,.35);
  padding: 7px 14px; font-size: 12px; animation: dgp-pop 140ms cubic-bezier(.16,1,.3,1); }
.dgp-account { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
.dgp-acct-login { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgp-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dgp-dot-connected { background: #2e9e5b; }
.dgp-dot-expired { background: #c77f2a; }
.dgp-dot-error { background: #c0392b; }
.dgp-input { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 6px 9px; border-radius: 7px;
  border: 1px solid var(--dsh-border, rgba(128,128,128,.4)); background: transparent; color: inherit; font-size: 12px; }
.dgp-input::placeholder { color: #595959; opacity: 1; }
.dgp-input:focus-visible { outline: 2px solid var(--dsh-accent, #4a9eff); outline-offset: -1px; }
.dgp-muted { opacity: .65; font-size: 12px; }
.dgp-card { margin-top: 8px; border: 1px solid var(--dsh-border, rgba(128,128,128,.4)); border-radius: 8px; padding: 8px; }
.dgp-code { font-size: 18px; font-family: var(--dsh-mono, monospace); letter-spacing: .06em; margin: 4px 0; user-select: all; }
.dgp-spacer { flex: 1; }
@media (prefers-reduced-motion: reduce) { .dgp-toast, .dgp-btn:active { animation: none; transform: none; } }
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
function fmt(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}
var nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));
function findComposer() {
  const visible = (el2) => {
    const r = el2.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.height >= 24;
  };
  const anchors = [
    "[data-composer-input]",
    "[data-composer-seat] textarea",
    '[data-composer-seat] [contenteditable="true"]',
    "textarea",
    '[contenteditable="true"]'
  ];
  const seen = [];
  for (const sel of anchors) {
    for (const el2 of Array.from(document.querySelectorAll(sel))) {
      const h = el2;
      if (!visible(h)) continue;
      if (seen.indexOf(h) === -1) seen.push(h);
    }
  }
  if (seen.length === 0) return null;
  const el = seen.reduce((a, b) => b.getBoundingClientRect().height > a.getBoundingClientRect().height ? b : a);
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea" || tag === "input") {
    const box = el;
    return {
      el,
      kind: tag,
      setText: async (v) => {
        const proto = Object.getPrototypeOf(box);
        const desc = Object.getOwnPropertyDescriptor(proto, "value") || Object.getOwnPropertyDescriptor(box, "value");
        if (desc && desc.set) desc.set.call(box, v);
        else box.value = v;
        box.dispatchEvent(new Event("input", { bubbles: true }));
        box.dispatchEvent(new Event("change", { bubbles: true }));
        return box.value === v;
      }
    };
  }
  return {
    el,
    kind: "contenteditable",
    setText: async (v) => {
      const inner = el.querySelector('[contenteditable="true"]') || el;
      const focusTarget = inner.isContentEditable ? inner : el;
      focusTarget.focus();
      const sel = window.getSelection();
      const selectAllInside = (node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      };
      const norm = (s) => s.replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
      const readBack = () => norm(focusTarget.textContent ?? "");
      let written = false;
      for (let attempt = 0; attempt < 3 && !written; attempt++) {
        selectAllInside(focusTarget);
        await nextTick();
        let cmdOk = false;
        try {
          cmdOk = document.execCommand("insertText", false, v);
        } catch {
          cmdOk = false;
        }
        written = cmdOk && readBack() === norm(v);
      }
      if (!written) {
        focusTarget.textContent = v;
        written = readBack() === norm(v);
      }
      try {
        focusTarget.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: v }));
      } catch {
        focusTarget.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return written;
    }
  };
}
function findSendButton(el) {
  let node = el;
  for (let depth = 0; depth < 6 && node; depth++) {
    const parent = node.parentElement;
    if (!parent) break;
    for (const child of Array.from(parent.children)) {
      if (child.contains(el)) continue;
      const buttons = Array.from(child.querySelectorAll("button"));
      const enabled = buttons.filter((b) => !b.disabled && b.getBoundingClientRect().width > 0);
      if (enabled.length > 0) return enabled[enabled.length - 1];
    }
    node = parent;
  }
  return null;
}
async function injectCommand(text, autoSubmit) {
  const composer = findComposer();
  if (!composer) return { ok: false, submitted: false, error: "\u672A\u627E\u5230\u8F93\u5165\u6846\uFF08composer \u4E0D\u53EF\u89C1\uFF09" };
  const written = await composer.setText(text);
  if (!written) return { ok: false, submitted: false, error: "\u5199\u5165\u8F93\u5165\u6846\u5931\u8D25\uFF08\u56DE\u8BFB\u6821\u9A8C\u4E0D\u901A\u8FC7\uFF09" };
  if (!autoSubmit) return { ok: true, submitted: false };
  const button = findSendButton(composer.el);
  if (button) {
    button.click();
    return { ok: true, submitted: true };
  }
  return { ok: true, submitted: false, error: "\u672A\u5B9A\u4F4D\u5230\u53D1\u9001\u6309\u94AE\uFF0C\u6307\u4EE4\u5DF2\u653E\u5165\u8F93\u5165\u6846" };
}

// src/client/index.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var inject = ["slots", "sessions", "locale"];
var BUILD = "dgp-v3.2";
var TOOL_PREAMBLE = "\u8BF7\u901A\u8FC7\u672C\u9879\u76EE\u7684 Git \u9762\u677F\u5DE5\u5177\u6267\u884C\uFF08\u8C03\u7528 git_write\uFF0C\u5FC5\u8981\u65F6\u63A5 git_confirm \u5B8C\u6210\u786E\u8BA4\uFF1B\u4E0D\u8981\u7528\u88F8 shell \u7ED5\u8FC7\u786E\u8BA4\uFF09\u3002";
var COMMANDS = [
  {
    id: "stage-all",
    labelKey: "cmdStageAll",
    build: (cwd) => `${TOOL_PREAMBLE}\u5728\u4ED3\u5E93 ${cwd} \u7528 git_write(action=add, args=["-A"]) \u6682\u5B58\u5168\u90E8\u6539\u52A8\uFF0C\u7136\u540E\u7528 git_repo_info \u590D\u6838\u5E76\u7B80\u8FF0\u7ED3\u679C\u3002`
  },
  {
    id: "commit",
    labelKey: "cmdCommit",
    build: (cwd, extra) => `${TOOL_PREAMBLE}\u5728\u4ED3\u5E93 ${cwd} \u5148 git_diff(mode=staged) \u770B\u5DF2\u6682\u5B58\u5185\u5BB9\uFF0C\u603B\u7ED3\u4E00\u6761\u89C4\u8303\u7684\u63D0\u4EA4\u4FE1\u606F${extra ? `\uFF08\u610F\u56FE\u8865\u5145\uFF1A${extra}\uFF09` : ""}\uFF0C\u518D git_write(action=commit, args=["-m", "<\u4FE1\u606F>"]) \u63D0\u4EA4\u3002\u82E5\u6682\u5B58\u533A\u4E3A\u7A7A\uFF0C\u5148\u63D0\u793A\u6211\u3002`
  },
  {
    id: "push",
    labelKey: "cmdPush",
    build: (cwd) => `${TOOL_PREAMBLE}\u5728\u4ED3\u5E93 ${cwd} \u5148 git_repo_info \u786E\u8BA4\u5206\u652F\u4E0E\u8FDC\u7AEF\uFF1B\u65E0\u4E0A\u6E38\u5219 git_write(action=push, args=["-u","origin","<\u5F53\u524D\u5206\u652F>"])\uFF0C\u5426\u5219 git_write(action=push, args=[])\u3002\u8BA4\u8BC1\u5931\u8D25\u65F6\u5982\u5B9E\u6C47\u62A5\uFF0C\u4E0D\u8981\u7D22\u8981\u6216\u56DE\u663E\u4EFB\u4F55\u4EE4\u724C\u3002`
  },
  {
    id: "pull",
    labelKey: "cmdPull",
    build: (cwd) => `${TOOL_PREAMBLE}\u5728\u4ED3\u5E93 ${cwd} \u6267\u884C git_write(action=pull, args=["--rebase"])\uFF08\u82E5\u660E\u663E\u6709\u5206\u53C9\u98CE\u9669\u6539\u7528\u9ED8\u8BA4 merge\uFF09\uFF1B\u51FA\u73B0\u51B2\u7A81\u7ACB\u523B\u505C\u4E0B\u5E76\u6C47\u62A5\u51B2\u7A81\u6587\u4EF6\u6E05\u5355\uFF0C\u4E0D\u8981\u81EA\u884C\u53D6\u820D\u3002`
  },
  {
    id: "fetch",
    labelKey: "cmdFetch",
    build: (cwd) => `${TOOL_PREAMBLE}\u5728\u4ED3\u5E93 ${cwd} \u6267\u884C git_write(action=fetch, args=["--prune"])\uFF0C\u7136\u540E\u6C47\u62A5\u5404\u5206\u652F\u9886\u5148/\u843D\u540E\u53D8\u5316\u3002`
  },
  {
    id: "branch-create",
    labelKey: "cmdBranchCreate",
    build: (cwd, extra) => `${TOOL_PREAMBLE}\u5728\u4ED3\u5E93 ${cwd} \u7528 git_write(action=branch, args=["${extra || "<\u65B0\u5206\u652F\u540D>"}"]) \u57FA\u4E8E\u5F53\u524D HEAD \u65B0\u5EFA\u5206\u652F\uFF0C\u518D git_write(action=checkout, args=["${extra || "<\u65B0\u5206\u652F\u540D>"}"]) \u5207\u8FC7\u53BB\u3002\u5206\u652F\u540D\u672A\u63D0\u4F9B\u65F6\u5148\u95EE\u6211\u3002`
  },
  {
    id: "branch-switch",
    labelKey: "cmdBranchSwitch",
    build: (cwd, extra) => `${TOOL_PREAMBLE}\u5728\u4ED3\u5E93 ${cwd} \u7528 git_write(action=checkout, args=["${extra || "<\u76EE\u6807\u5206\u652F>"}"]) \u5207\u6362\u5206\u652F\uFF1B\u5DE5\u4F5C\u533A\u4E0D\u5E72\u51C0\u5BFC\u81F4\u5931\u8D25\u65F6\u5148\u5411\u6211\u8BF4\u660E\uFF0C\u4E0D\u8981\u5F3A\u5236\u3002\u5206\u652F\u540D\u672A\u63D0\u4F9B\u65F6\u5148\u5217\u51FA git_branches \u8BA9\u6211\u9009\u3002`
  },
  {
    id: "discard",
    labelKey: "cmdDiscard",
    build: (cwd, extra) => `${TOOL_PREAMBLE}\u8FD9\u662F\u7834\u574F\u6027\u64CD\u4F5C\uFF1A\u5148\u5728\u56DE\u590D\u91CC\u5411\u7528\u6237\u590D\u8FF0\u5C06\u4E22\u5F03\u7684\u6587\u4EF6\uFF08${extra || "<\u672A\u8DDF\u8E2A/\u5DF2\u4FEE\u6539\u6587\u4EF6>"}\uFF09\uFF0C\u5F97\u5230\u786E\u8BA4\u540E git_write(action=restore, args=["--","<\u6587\u4EF6>"])\uFF1B\u672A\u8DDF\u8E2A\u6587\u4EF6\u7528 clean \u524D\u5FC5\u987B\u518D\u6B21\u5355\u72EC\u786E\u8BA4\u3002`
  },
  {
    id: "stash",
    labelKey: "cmdStash",
    build: (cwd) => `${TOOL_PREAMBLE}\u5728\u4ED3\u5E93 ${cwd} \u6267\u884C git_write(action=stash, args=[]) \u8D2E\u85CF\u5F53\u524D\u6539\u52A8\uFF0C\u5B8C\u6210\u540E\u6C47\u62A5\u8D2E\u85CF\u5185\u5BB9\u6458\u8981\u3002`
  },
  {
    id: "tag",
    labelKey: "cmdTag",
    build: (cwd, extra) => `${TOOL_PREAMBLE}\u5728\u4ED3\u5E93 ${cwd} \u7528 git_write(action=tag, args=["${extra || "<vX.Y.Z>"}"]) \u6253\u6807\u7B7E\uFF1B\u6807\u7B7E\u540D\u672A\u63D0\u4F9B\u65F6\u5148\u95EE\u6211\u3002\u63A8\u4E0D\u63A8\u9001\u8FDC\u7AEF\u7531\u6211\u51B3\u5B9A\uFF0C\u5148\u522B\u81EA\u52A8 push tag\u3002`
  },
  {
    id: "init",
    labelKey: "cmdInit",
    build: (cwd) => `${TOOL_PREAMBLE}\u8BE5\u76EE\u5F55\u8FD8\u4E0D\u662F\u4ED3\u5E93\uFF1A\u8BF7\u5728 ${cwd} \u6267\u884C git_write(action=init, args=["-b","main"]) \u521D\u59CB\u5316\u672C\u5730\u4ED3\u5E93\uFF0C\u5B8C\u6210\u540E\u6C47\u62A5\u3002\u8FDC\u7A0B\u5173\u8054\u7B49\u6211\u53E6\u884C\u6307\u793A\u3002`
  },
  {
    // npm 发布不走 git_write（该通道仅限 git 子命令），由 AI 经 shell 按内嵌 SOP 执行；无参数占位，点击即注入。
    // 通用性红线（v3.7 拍板）：模板面向任意 DSH 作者的任意机器，禁止内嵌任何个人路径/个人环境假设；
    // 前置不满足时 fail-closed 输出「需要用户手动补的配置清单」，AI 绝不代登录、绝不写凭据、绝不动全局配置。
    id: "npm-publish",
    labelKey: "cmdNpmPublish",
    build: (cwd) => `\u8BF7\u628A\u5F53\u524D\u9879\u76EE\uFF08${cwd}\uFF09\u53D1\u5E03\u5230 npm\u3002\u8FD9\u662F\u4E0D\u53EF\u9006\u5916\u90E8\u5199\u64CD\u4F5C\uFF0C\u4E25\u683C\u6309\u4EE5\u4E0B\u901A\u7528\u6D41\u7A0B\u6267\u884C\uFF0C\u4EFB\u4F55\u4E00\u6B65\u4E0D\u6EE1\u8DB3\u5C31\u505C\u4E0B\u6765\u5411\u6211\u6C47\u62A5\uFF1B\u7981\u6B62\u51ED exit 0 \u5224\u5B9A\u53D1\u5E03\u6210\u529F\u3002\u672C\u6D41\u7A0B\u4E0D\u5047\u8BBE\u6211\u7684\u673A\u5668\u4E0A\u6709\u4EFB\u4F55\u9884\u5148\u914D\u7F6E\uFF1A\u7F3A\u4EC0\u4E48\u5C31\u5982\u5B9E\u5217\u51FA\u9700\u8981\u6211\u624B\u52A8\u8865\u7684\u6B65\u9AA4\uFF0C\u4E0D\u8981\u66FF\u6211\u767B\u5F55\u3001\u4E0D\u8981\u66FF\u6211\u5199\u51ED\u636E\u3001\u4E0D\u8981\u4FEE\u6539\u4EFB\u4F55\u5168\u5C40\u914D\u7F6E\u30021) \u73AF\u5883\u9884\u68C0\uFF1Anpm \u662F\u5426\u53EF\u7528\u53CA\u7248\u672C\uFF1B\u6267\u884C npm whoami --registry=https://registry.npmjs.org \u786E\u8BA4\u5B98\u65B9\u6E90\u5DF2\u767B\u5F55\u2014\u2014\u672A\u767B\u5F55\u6216\u65E0\u51ED\u636E\u65F6\u7ACB\u5373\u505C\u6B62\uFF0C\u53EA\u8F93\u51FA\u300C\u9700\u8981\u6211\u624B\u52A8\u6267\u884C\u7684\u914D\u7F6E\u6B65\u9AA4\u300D\uFF08\u4F8B\u5982\u81EA\u884C npm login --registry=https://registry.npmjs.org\uFF0C\u6216\u628A\u5B98\u65B9\u6E90 authToken \u914D\u8FDB ~/.npmrc\uFF09\uFF0C\u4E0D\u5F97\u7D22\u8981\u3001\u4EE3\u586B\u6216\u5728\u8F93\u51FA\u4E2D\u56DE\u663E\u4EFB\u4F55 token\uFF1B2) \u5305\u4FE1\u606F\u6838\u5BF9\uFF1A\u8BFB\u53D6 package.json \u7684 name/version/files/publishConfig\uFF1Bname+version \u7EC4\u5408\u5728 npm \u4E0A\u6C38\u4E45\u5360\u7528\u4E0D\u53EF\u590D\u7528\uFF1B\u82E5\u4ED3\u5E93\u5B58\u5728\u591A\u5904\u7248\u672C\u58F0\u660E\uFF08lockfile\u3001\u6E90\u7801\u5E38\u91CF\uFF09\u987B\u9010\u5904\u6838\u5BF9\u4E00\u81F4\uFF0C\u4E0D\u4E00\u81F4\u5373\u505C\u6B62\u5E76\u5217\u51FA\u5DEE\u5F02\uFF1B3) \u5360\u7528\u9884\u68C0\uFF1A\u7528\u5E26 ?nocache= \u65F6\u95F4\u6233\u7684 https://registry.npmjs.org/<\u5305\u540D> \u76F4\u67E5\uFF08\u5B98\u65B9\u6E90\u4E3A\u6743\u5A01\uFF0C\u52FF\u7ECF\u955C\u50CF\uFF09\uFF0C404 \u6216\u8BE5\u7248\u672C\u4E0D\u5B58\u5728\u624D\u653E\u884C\uFF1B\u5DF2\u5360\u7528\u5219\u505C\u6B62\u5E76\u62A5\u544A\u73B0\u72B6\uFF1B4) \u4EA7\u7269\u9884\u68C0\uFF1Anpm pack --dry-run\uFF0C\u628A\u6587\u4EF6\u6E05\u5355\u4E0E\u4F53\u79EF\u9010\u9879\u8D34\u51FA\u6765\u4F9B\u6211\u8FC7\u76EE\uFF0C\u53D1\u73B0\u660E\u663E\u591A\u4F59\u6216\u7F3A\u5931\u6587\u4EF6\u5148\u62A5\u544A\uFF1B5) \u53D1\u5E03\uFF1A\u53EA\u6709\u6211\u660E\u786E\u786E\u8BA4\u540E\u624D\u6267\u884C npm publish --registry=https://registry.npmjs.org --access=public\uFF08scoped \u5305\u5FC5\u987B\u663E\u5F0F --access=public\uFF1B\u5373\u4F7F\u7CFB\u7EDF\u9ED8\u8BA4\u6E90\u53EF\u7528\u4E5F\u8981\u663E\u5F0F\u9489\u5B98\u65B9\u6E90\uFF1B\u4E0D\u5F97\u4E3A\u53D1\u5E03\u6539\u7528\u6237\u7684 .npmrc\uFF09\uFF1B6) \u7EC8\u9A8C\uFF1APUT \u8FD4\u56DE 202 \u53EA\u4EE3\u8868 staged\uFF0C\u7981\u6B62\u91CD\u53D1\uFF1B\u6539\u4E3A\u5E26 ?nocache= \u8F6E\u8BE2 packument \u76F4\u81F3\u8BE5\u7248\u672C\u51FA\u73B0\uFF0C\u628A\u7EC8\u9A8C\u8BC1\u636E\uFF08\u7248\u672C\u53F7\u3001dist-tags\u3001\u53D1\u5E03\u65F6\u95F4\u6233\uFF09\u8D34\u51FA\u6765\uFF1B7) \u5931\u8D25\u5206\u5C42\u5F52\u56E0\uFF08\u7F51\u7EDC\u2192\u8EAB\u4EFD\u2192\u914D\u7F6E\u2192\u5B9E\u73B0\uFF09\uFF0C\u9519\u8BEF\u7801\u4F1A\u4F2A\u88C5\uFF08\u5982 404 \u63A9\u76D6\u6743\u9650/\u90AE\u7BB1\u95EE\u9898\uFF09\uFF0C\u5F52\u56E0\u5750\u5B9E\u524D\u4E0D\u91CD\u8BD5\uFF1BE401/ENEEDAUTH \u4F18\u5148\u6838\u5BF9\u662F\u5426\u6F0F\u9489\u5B98\u65B9\u6E90\u6216\u51ED\u636E\u5931\u6548\u3002\u5B8C\u6210\u540E\u6C47\u62A5\u7EC8\u9A8C\u8BC1\u636E\u3002`
  }
];
var ZH = {
  entry: "Git",
  navLabel: "Git",
  panelTitle: "Git \u9762\u677F",
  refresh: "\u5237\u65B0",
  close: "\u5173\u95ED",
  notRepo: "\u5F53\u524D\u4F1A\u8BDD\u76EE\u5F55\u4E0D\u662F Git \u4ED3\u5E93",
  notRepoHint: "\u53EF\u8BA9 AI \u521D\u59CB\u5316\u4ED3\u5E93\uFF08\u4E0B\u65B9\u300C\u52A8\u4F5C\u300D\u533A\u6709\u5BF9\u5E94\u6309\u94AE\uFF09\u3002",
  changedFiles: "\u6539\u52A8\u6587\u4EF6",
  noChanges: "\u5DE5\u4F5C\u533A\u5E72\u51C0",
  recentCommits: "\u6700\u8FD1\u63D0\u4EA4",
  noCommits: "\u8FD8\u6CA1\u6709\u63D0\u4EA4",
  actions: "\u52A8\u4F5C\uFF08\u751F\u6210\u6307\u4EE4\u7ED9 AI \u6267\u884C\uFF09",
  inputHint: "\u53EF\u6539\u8BCD\u540E\u518D\u56DE\u8F66\uFF1B\u6307\u4EE4\u53EA\u662F\u53D1\u8D77\uFF0C\u5199\u64CD\u4F5C\u4ECD\u53D7\u786E\u8BA4\u7EA6\u675F\u3002",
  autoSubmit: "\u76F4\u63A5\u63D0\u4EA4\uFF08\u6CE8\u5165\u540E\u4EE3\u6309\u53D1\u9001\uFF09",
  // 折叠区：账号与授权
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
  injected: "\u6307\u4EE4\u5DF2\u653E\u5165\u8F93\u5165\u6846",
  injectedSubmitted: "\u6307\u4EE4\u5DF2\u63D0\u4EA4\u7ED9 AI",
  injectFailed: "\u6CE8\u5165\u5931\u8D25",
  detectFailed: "\u65E0\u6CD5\u68C0\u6D4B\u4ED3\u5E93\u72B6\u6001",
  retry: "\u91CD\u65B0\u68C0\u6D4B",
  allowWrite: "\u5141\u8BB8 Agent \u4FEE\u6539\u4ED3\u5E93",
  allowWriteHint: "\u603B\u5F00\u5173\uFF1A\u5173\u95ED\u65F6 git_write \u4E00\u5F8B\u62D2\u7EDD\u3002",
  requireConfirm: "\u5199\u64CD\u4F5C\u524D\u9700\u8981\u6211\u786E\u8BA4",
  requireConfirmHint: "\u5F00\u542F\u65F6 git_write \u8FD4\u56DE confirmToken\uFF0C\u4F60\u786E\u8BA4\u540E AI \u624D\u80FD\u8C03 git_confirm \u6267\u884C\u3002",
  cmdStageAll: "\u6682\u5B58\u5168\u90E8",
  cmdCommit: "\u63D0\u4EA4\u2026",
  cmdPush: "\u63A8\u9001",
  cmdPull: "\u62C9\u53D6",
  cmdFetch: "\u6293\u53D6",
  cmdBranchCreate: "\u65B0\u5EFA\u5206\u652F\u2026",
  cmdBranchSwitch: "\u5207\u6362\u5206\u652F\u2026",
  cmdDiscard: "\u4E22\u5F03\u6539\u52A8\u2026",
  cmdStash: "\u8D2E\u85CF",
  cmdTag: "\u6253\u6807\u7B7E\u2026",
  cmdInit: "\u521D\u59CB\u5316\u4ED3\u5E93",
  cmdNpmPublish: "\u53D1\u5E03 npm",
  askParam: "\u586B\u5165\u53C2\u6570",
  commitIntent: "\u63D0\u4EA4\u610F\u56FE\uFF08\u53EF\u7559\u7A7A\uFF09",
  branchName: "\u5206\u652F\u540D",
  discardFiles: "\u8981\u4E22\u5F03\u7684\u6587\u4EF6\uFF08\u7A7A\u683C\u5206\u9694\uFF09",
  tagName: "\u6807\u7B7E\u540D"
};
var EN = {
  entry: "Git",
  navLabel: "Git",
  panelTitle: "Git Panel",
  refresh: "Refresh",
  close: "Close",
  notRepo: "This session directory is not a Git repository",
  notRepoHint: "Let the AI init a repo (button below).",
  changedFiles: "Changed files",
  noChanges: "Working tree clean",
  recentCommits: "Recent commits",
  noCommits: "No commits yet",
  actions: "Actions (inject a command for the AI)",
  inputHint: "You can edit before pressing Enter; writes stay confirm-gated.",
  autoSubmit: "Auto submit (press send after injecting)",
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
  injected: "Command placed in the input box",
  injectedSubmitted: "Command sent to the AI",
  injectFailed: "Inject failed",
  detectFailed: "Cannot detect repository status",
  retry: "Check again",
  allowWrite: "Allow the agent to modify repositories",
  allowWriteHint: "Master switch: git_write refuses when off.",
  requireConfirm: "Ask me before every write",
  requireConfirmHint: "git_write returns a confirmToken you must approve via git_confirm.",
  cmdStageAll: "Stage all",
  cmdCommit: "Commit\u2026",
  cmdPush: "Push",
  cmdPull: "Pull",
  cmdFetch: "Fetch",
  cmdBranchCreate: "New branch\u2026",
  cmdBranchSwitch: "Switch branch\u2026",
  cmdDiscard: "Discard\u2026",
  cmdStash: "Stash",
  cmdTag: "Tag\u2026",
  cmdInit: "Init repo",
  cmdNpmPublish: "Publish to npm",
  askParam: "Fill parameter",
  commitIntent: "Commit intent (optional)",
  branchName: "Branch name",
  discardFiles: "Files to discard (space separated)",
  tagName: "Tag name"
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
  const [files, setFiles] = (0, import_react2.useState)([]);
  const [commits, setCommits] = (0, import_react2.useState)([]);
  const [accounts, setAccounts] = (0, import_react2.useState)([]);
  const [detectError, setDetectError] = (0, import_react2.useState)("");
  const [open, setOpen] = (0, import_react2.useState)(false);
  const [checking, setChecking] = (0, import_react2.useState)(false);
  const [toast, setToast] = (0, import_react2.useState)("");
  const [autoSubmit, setAutoSubmit] = (0, import_react2.useState)(() => readPref(PREF_AUTO_SUBMIT, "0") === "1");
  const [prompt, setPrompt] = (0, import_react2.useState)(null);
  const [promptValue, setPromptValue] = (0, import_react2.useState)("");
  const toastTimer = (0, import_react2.useRef)(null);
  const chipRef = (0, import_react2.useRef)(null);
  const panelRef = (0, import_react2.useRef)(null);
  const [anchor, setAnchor] = (0, import_react2.useState)({ left: 0, bottom: 0 });
  const cwd = useSessionCwd(sessions, sessionId);
  (0, import_react2.useEffect)(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (prompt) {
        setPrompt(null);
        e.stopPropagation();
      } else {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, prompt]);
  (0, import_react2.useEffect)(() => {
    const stop = subscribePref(() => setAutoSubmit(readPref(PREF_AUTO_SUBMIT, "0") === "1"));
    return stop;
  }, []);
  const showToast = (0, import_react2.useCallback)((text) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = window.setTimeout(() => setToast(""), 2400);
  }, []);
  const reload = (0, import_react2.useCallback)(async () => {
    if (!cwd) {
      setStatus(null);
      setFiles([]);
      setCommits([]);
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
          const [changes, log, state] = await Promise.all([
            api(`/repo/changes?cwd=${encodeURIComponent(cwd)}`).catch(() => null),
            api(`/repo/commits?cwd=${encodeURIComponent(cwd)}&limit=5`).catch(() => null),
            api("/state").catch(() => null)
          ]);
          setFiles(changes?.changes?.files ?? []);
          setCommits(log?.commits ?? []);
          if (state?.state?.accounts) setAccounts(state.state.accounts);
        } else {
          setFiles([]);
          setCommits([]);
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
  const runCommand = (0, import_react2.useCallback)(
    async (spec, extra) => {
      if (!cwd) return;
      const text = spec.build(cwd, extra);
      const result = await injectCommand(text, autoSubmit);
      if (result.ok) {
        showToast(result.submitted ? t("injectedSubmitted") : t("injected"));
        setOpen(false);
      } else {
        showToast(`${t("injectFailed")}\uFF1A${result.error ?? ""}`);
      }
    },
    [cwd, autoSubmit, t, showToast]
  );
  const onActionClick = (spec) => {
    if (["stage-all", "push", "pull", "fetch", "stash", "init", "npm-publish"].includes(spec.id)) {
      void runCommand(spec);
    } else {
      setPrompt(spec);
      setPromptValue("");
    }
  };
  const isRepo = status?.isRepo === true;
  const branchLabel = isRepo ? status.detached ? `HEAD @ ${status.head.slice(0, 7)}` : status.branch || "\u2014" : "Git";
  (0, import_react2.useEffect)(() => {
    if (prompt && panelRef.current) panelRef.current.scrollTop = panelRef.current.scrollHeight;
  }, [prompt]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dgp-root", ref: chipRef, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "button",
      {
        type: "button",
        className: "dgp-chip",
        title: isRepo ? branchLabel : detectError || t("entry"),
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
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-chip-branch", children: checking && !status ? "\u2026" : branchLabel }),
          isRepo && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dgp-chip-badge", children: [
            status.ahead > 0 ? `\u2191${status.ahead} ` : "",
            status.behind > 0 ? `\u2193${status.behind} ` : "",
            status.changed > 0 ? `${status.changed}*` : ""
          ] })
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
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-title", children: t("panelTitle") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("refresh"), "aria-label": t("refresh"), onClick: () => void reload(), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RefreshGlyph, {}) }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("close"), "aria-label": t("close"), onClick: () => setOpen(false), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CloseGlyph, {}) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dgp-toggle", title: t("autoSubmit"), style: { marginBottom: 8 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "input",
                {
                  type: "checkbox",
                  checked: autoSubmit,
                  onChange: (e) => {
                    setAutoSubmit(e.target.checked);
                    writePref(PREF_AUTO_SUBMIT, e.target.checked ? "1" : "0");
                  }
                }
              ),
              t("autoSubmit")
            ] }),
            detectError && !isRepo && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-sect", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-empty", children: [
              detectError,
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => void reload(), children: t("retry") })
            ] }) }),
            !isRepo && !detectError && cwd && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-sect", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-empty", children: t("notRepo") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-muted", children: t("notRepoHint") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-btnrow", style: { marginTop: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => onActionClick(COMMANDS.find((c) => c.id === "init")), children: t("cmdInit") }) })
            ] }),
            isRepo && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-sect", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-sect-title", children: [
                  t("changedFiles"),
                  " (",
                  files.length,
                  ")"
                ] }),
                files.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-empty", children: t("noChanges") }),
                files.slice(0, 12).map((file) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-file", title: file.path, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-file-status", children: file.staged ? file.worktree === "M" ? "MM" : "M" : file.untracked ? "?" : file.worktree }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-file-path", children: file.path.length > 48 ? "\u2026" + file.path.slice(-47) : file.path }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dgp-file-stat", children: [
                    file.added > 0 ? `+${file.added}` : "",
                    file.deleted > 0 ? ` -${file.deleted}` : ""
                  ] })
                ] }, file.path)),
                files.length > 12 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-muted", children: [
                  "\u2026",
                  files.length - 12
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-sect", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-sect-title", children: t("recentCommits") }),
                commits.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-empty", children: t("noCommits") }),
                commits.map((commit) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-row-line", title: `${commit.subject} (${commit.author}, ${commit.date})`, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-hash", children: commit.hash }),
                  commit.subject
                ] }, commit.hash))
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-sect", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-sect-title", children: t("actions") }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-btnrow", children: COMMANDS.filter((c) => c.id !== "init").map((command) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn" + (command.id === "discard" ? " dgp-btn-danger" : ""), onClick: () => onActionClick(command), children: t(command.labelKey) }, command.id)) }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-muted", style: { marginTop: 6 }, children: t("inputHint") })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GearSection, { t, accounts, onAccounts: setAccounts }),
            prompt && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-sect dgp-card", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-sect-title", children: [
                t(prompt.labelKey).replace("\u2026", ""),
                " \xB7 ",
                t("askParam")
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "input",
                {
                  className: "dgp-input",
                  autoFocus: true,
                  "aria-label": t(prompt.labelKey).replace("\u2026", ""),
                  placeholder: prompt.id === "commit" ? t("commitIntent") : prompt.id === "discard" ? t("discardFiles") : prompt.id === "tag" ? t("tagName") : t("branchName"),
                  value: promptValue,
                  onChange: (e) => setPromptValue(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === "Enter") {
                      const spec = prompt;
                      setPrompt(null);
                      void runCommand(spec, promptValue.trim() || void 0);
                    } else if (e.key === "Escape") {
                      setPrompt(null);
                    }
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-btnrow", style: { marginTop: 6 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => {
                  const spec = prompt;
                  setPrompt(null);
                  void runCommand(spec, promptValue.trim() || void 0);
                }, children: "OK" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dgp-btn", onClick: () => setPrompt(null), children: t("cancel") })
              ] })
            ] })
          ]
        }
      ),
      document.body
    ),
    toast && (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-toast", role: "status", children: toast }), document.body)
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
