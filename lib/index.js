var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/node/store.ts
import { existsSync, mkdirSync as mkdirSync2, readFileSync as readFileSync2, renameSync, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname2 } from "node:path";
import { randomBytes as randomBytes2 } from "node:crypto";

// src/node/paths.ts
import { homedir } from "node:os";
import { join } from "node:path";
function dshHome() {
  const fromEnv = process.env.DSH_HOME;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) return fromEnv;
  return join(homedir(), ".dsh");
}
function pluginDir() {
  return join(dshHome(), "git-panel");
}
function stateFile() {
  return join(pluginDir(), "state.json");
}
function keyFile() {
  return join(pluginDir(), "key.bin");
}

// src/node/vault.ts
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
var KEY_BYTES = 32;
var IV_BYTES = 12;
var TAG_BYTES = 16;
var PREFIX = "v1.";
function loadOrCreateKey() {
  const file = keyFile();
  try {
    const raw = readFileSync(file);
    if (raw.length === KEY_BYTES) return raw;
  } catch {
  }
  mkdirSync(dirname(file), { recursive: true });
  const key = randomBytes(KEY_BYTES);
  writeFileSync(file, key, { mode: 384 });
  try {
    chmodSync(file, 384);
  } catch {
  }
  return key;
}
function seal(plain) {
  if (typeof plain !== "string" || plain.length === 0) throw new Error("empty secret");
  const key = loadOrCreateKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, body]).toString("base64");
}
function open(sealed) {
  if (typeof sealed !== "string" || !sealed.startsWith(PREFIX)) throw new Error("unsupported secret format");
  const raw = Buffer.from(sealed.slice(PREFIX.length), "base64");
  if (raw.length < IV_BYTES + TAG_BYTES) throw new Error("corrupted secret");
  const key = loadOrCreateKey();
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = raw.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}
var REDACT_RULES = [
  // 常见令牌形态：ghp_/gho_/ghu_/ghs_/ghr_/github_pat_、glpat-、Bearer、Basic
  [/\b(gh[pousr]_[A-Za-z0-9]{16,})/g, "***"],
  [/\b(github_pat_[A-Za-z0-9_]{20,})/g, "***"],
  [/\b(glpat-[A-Za-z0-9_-]{16,})/g, "***"],
  [/(Authorization\s*:\s*)(Bearer|Basic|token)\s+[^\s'"]+/gi, "$1$2 ***"],
  [/(https?:\/\/)([^/\s:@]+):([^/\s@]+)@/g, "$1$2:***@"],
  [/([?&](?:access_token|token|private_token|client_secret)=)[^&\s]+/gi, "$1***"]
];
function redact(input) {
  let text = typeof input === "string" ? input : input instanceof Error ? input.message : String(input ?? "");
  for (const [pattern, replacement] of REDACT_RULES) text = text.replace(pattern, replacement);
  return text;
}

// src/node/store.ts
var DEFAULT_SETTINGS = {
  allowedRepos: [],
  allowedRoots: [],
  allowWrite: false,
  requireConfirm: true,
  defaultAccountId: ""
};
function normalizeRoot(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw.length === 0) return null;
  return raw.replace(/[\\/]+$/, "");
}
function normalizeRoots(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const item of input) {
    const root = normalizeRoot(item);
    if (root && !out.includes(root)) out.push(root);
  }
  return out;
}
function emptyState() {
  return { version: 1, accounts: [], settings: { ...DEFAULT_SETTINGS } };
}
function normalizeRepo(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw.length === 0) return null;
  if (raw === "*") return "*";
  const cleaned = raw.replace(/^git@[^:]+:/, "").replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+\//i, "").replace(/\.git$/, "").replace(/^\/+|\/+$/g, "");
  const parts = cleaned.split("/").filter((segment) => segment.length > 0);
  if (parts.length < 2) return null;
  if (!parts.every((segment) => /^[\w.-]+$/.test(segment))) return null;
  return parts.join("/");
}
function normalizeRepos(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const item of input) {
    const repo = normalizeRepo(item);
    if (repo && !out.includes(repo)) out.push(repo);
  }
  return out;
}
function normalizePermission(value) {
  return value === "full" || value === "read" ? value : "none";
}
function normalizeRepoPermissions(input, accountIds) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const valid = new Set(accountIds);
  const out = {};
  for (const [accountId, table] of Object.entries(input)) {
    if (!valid.has(accountId)) continue;
    if (!table || typeof table !== "object" || Array.isArray(table)) continue;
    const inner = {};
    for (const [repo, perm] of Object.entries(table)) {
      const key = normalizeRepo(repo);
      if (!key || key === "*") continue;
      inner[key] = normalizePermission(perm);
    }
    out[accountId] = inner;
  }
  return out;
}
var PanelStore = class {
  constructor(file = stateFile()) {
    this.file = file;
    this.load();
  }
  file;
  state = emptyState();
  load() {
    try {
      if (!existsSync(this.file)) {
        this.state = emptyState();
        return;
      }
      const raw = JSON.parse(readFileSync2(this.file, "utf8"));
      const accounts = Array.isArray(raw.accounts) ? raw.accounts : [];
      this.state = {
        version: 1,
        accounts: accounts.filter((item) => item && typeof item.id === "string" && typeof item.secret === "string").map((item) => ({
          id: item.id,
          provider: typeof item.provider === "string" ? item.provider : "github",
          kind: item.kind === "oauth" ? "oauth" : "pat",
          login: typeof item.login === "string" ? item.login : "",
          displayName: typeof item.displayName === "string" ? item.displayName : "",
          avatarUrl: typeof item.avatarUrl === "string" ? item.avatarUrl : "",
          host: typeof item.host === "string" ? item.host : "",
          apiBase: typeof item.apiBase === "string" ? item.apiBase : "",
          scopes: Array.isArray(item.scopes) ? item.scopes.filter((s) => typeof s === "string") : [],
          secret: item.secret,
          createdAt: Number(item.createdAt) || Date.now(),
          lastCheckedAt: Number(item.lastCheckedAt) || 0,
          status: item.status === "expired" || item.status === "error" ? item.status : "connected",
          lastError: typeof item.lastError === "string" ? item.lastError : ""
        })),
        settings: {
          allowedRepos: normalizeRepos(raw.settings?.allowedRepos),
          allowedRoots: normalizeRoots(raw.settings?.allowedRoots),
          allowWrite: raw.settings?.allowWrite === true,
          requireConfirm: raw.settings?.requireConfirm !== false,
          defaultAccountId: typeof raw.settings?.defaultAccountId === "string" ? raw.settings.defaultAccountId : "",
          repoPermissions: normalizeRepoPermissions(
            raw.settings?.repoPermissions,
            accounts.filter((item) => item && typeof item.id === "string").map((item) => item.id)
          )
        }
      };
    } catch (error) {
      try {
        renameSync(this.file, `${this.file}.broken`);
      } catch {
      }
      this.state = emptyState();
      console.warn("[dsh-git-panel] state.json \u8BFB\u53D6\u5931\u8D25\uFF0C\u5DF2\u91CD\u7F6E\uFF1A" + redact(error));
    }
  }
  persist() {
    mkdirSync2(dirname2(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync2(tmp, JSON.stringify(this.state, null, 2), { mode: 384 });
    renameSync(tmp, this.file);
  }
  snapshot() {
    return {
      version: this.state.version,
      accounts: this.state.accounts.map((item) => ({ ...item, secret: "" })),
      settings: {
        ...this.state.settings,
        allowedRepos: [...this.state.settings.allowedRepos],
        allowedRoots: [...this.state.settings.allowedRoots],
        repoPermissions: this.state.settings.repoPermissions ? Object.fromEntries(
          Object.entries(this.state.settings.repoPermissions).map(([id, table]) => [
            id,
            { ...table }
          ])
        ) : void 0
      }
    };
  }
  accounts() {
    return this.state.accounts;
  }
  settings() {
    return this.state.settings;
  }
  getAccount(id) {
    return this.state.accounts.find((item) => item.id === id);
  }
  /** 取默认账号：显式默认 → 唯一账号 → 第一个。 */
  activeAccount(preferred) {
    const wanted = preferred ?? this.state.settings.defaultAccountId;
    if (wanted) {
      const hit = this.getAccount(wanted);
      if (hit) return hit;
    }
    if (this.state.accounts.length === 1) return this.state.accounts[0];
    return this.state.accounts[0];
  }
  addAccount(input) {
    const record = {
      id: randomBytes2(8).toString("hex"),
      provider: input.provider,
      kind: input.kind,
      login: input.login,
      displayName: input.displayName ?? input.login,
      avatarUrl: input.avatarUrl ?? "",
      host: input.host,
      apiBase: input.apiBase ?? "",
      scopes: [...input.scopes],
      secret: seal(input.token),
      createdAt: Date.now(),
      lastCheckedAt: Date.now(),
      status: "connected",
      lastError: ""
    };
    const replaced = this.state.accounts.filter(
      (item) => item.provider === record.provider && item.login === record.login
    );
    const replacedDefault = replaced.some((item) => item.id === this.state.settings.defaultAccountId);
    this.state.accounts = this.state.accounts.filter((item) => !replaced.includes(item));
    this.state.accounts.unshift(record);
    if (!this.state.settings.defaultAccountId || replacedDefault) {
      this.state.settings.defaultAccountId = record.id;
    }
    const table = { ...this.state.settings.repoPermissions ?? {} };
    for (const item of replaced) delete table[item.id];
    table[record.id] = {};
    this.state.settings.repoPermissions = table;
    this.persist();
    return record;
  }
  removeAccount(id) {
    const before = this.state.accounts.length;
    this.state.accounts = this.state.accounts.filter((item) => item.id !== id);
    if (this.state.settings.defaultAccountId === id) {
      this.state.settings.defaultAccountId = this.state.accounts[0]?.id ?? "";
    }
    if (this.state.settings.repoPermissions) {
      const table = { ...this.state.settings.repoPermissions };
      delete table[id];
      this.state.settings.repoPermissions = table;
    }
    if (this.state.accounts.length === before) return false;
    this.persist();
    return true;
  }
  /** 读取明文令牌（仅内存使用，调用方不得写入日志或返回值）。 */
  revealSecret(id) {
    const record = this.getAccount(id);
    if (!record) return null;
    try {
      return open(record.secret);
    } catch {
      return null;
    }
  }
  markAccount(id, patch) {
    const record = this.getAccount(id);
    if (!record) return;
    Object.assign(record, patch, { lastCheckedAt: patch.lastCheckedAt ?? Date.now() });
    this.persist();
  }
  updateSettings(patch) {
    const next = { ...this.state.settings, ...patch };
    if ("allowedRepos" in patch) next.allowedRepos = normalizeRepos(patch.allowedRepos);
    if ("allowedRoots" in patch) next.allowedRoots = normalizeRoots(patch.allowedRoots);
    if ("allowWrite" in patch) next.allowWrite = patch.allowWrite === true;
    if ("requireConfirm" in patch) next.requireConfirm = patch.requireConfirm !== false;
    if (typeof next.defaultAccountId !== "string") next.defaultAccountId = "";
    if ("repoPermissions" in patch) {
      next.repoPermissions = normalizeRepoPermissions(
        patch.repoPermissions,
        this.state.accounts.map((item) => item.id)
      );
    }
    this.state.settings = next;
    this.persist();
    return {
      ...next,
      allowedRepos: [...next.allowedRepos],
      allowedRoots: [...next.allowedRoots],
      repoPermissions: next.repoPermissions ? Object.fromEntries(
        Object.entries(next.repoPermissions).map(([id, table]) => [id, { ...table }])
      ) : void 0
    };
  }
  /**
   * 某账号对某仓库的权限。
   * - 该账号已有 per-repo 权限表 → 表内未列出的仓库默认 'full'；
   * - 老账号（没有表）→ 沿用全局 allowedRepos 兼容语义。
   */
  repoPermission(accountId, repo) {
    const normalized = normalizeRepo(repo);
    if (!normalized || normalized === "*") return "none";
    const table = this.state.settings.repoPermissions?.[accountId];
    if (table) {
      const hit = table[normalized];
      return hit ?? "full";
    }
    const list = this.state.settings.allowedRepos;
    if (list.includes("*")) return "full";
    return list.includes(normalized) ? "full" : "none";
  }
  /** 设置某账号对某仓库的权限（写入并落盘）。 */
  setRepoPermission(accountId, repo, perm) {
    const normalized = normalizeRepo(repo);
    if (!normalized || normalized === "*") return "none";
    const table = { ...this.state.settings.repoPermissions ?? {} };
    const inner = { ...table[accountId] ?? {} };
    inner[normalized] = normalizePermission(perm);
    table[accountId] = inner;
    this.state.settings.repoPermissions = table;
    this.persist();
    return inner[normalized];
  }
  /** 某账号是否至少可读该仓库。 */
  isRepoAllowedFor(accountId, repo) {
    return this.repoPermission(accountId, repo) !== "none";
  }
  /** 某账号是否可写该仓库（fail-closed 判定用）。 */
  isRepoWritableFor(accountId, repo) {
    return this.repoPermission(accountId, repo) === "full";
  }
  /** 远端仓库是否在授权范围内。空列表=未授权；`*`=全部。 */
  isRepoAllowed(repo) {
    const normalized = normalizeRepo(repo);
    if (!normalized) return false;
    const list = this.state.settings.allowedRepos;
    if (list.includes("*")) return true;
    return list.includes(normalized);
  }
  /** 本地目录是否在授权根目录内（按路径段比较，避免 `/repo-evil` 命中 `/repo`）。`*` 表示全部目录。 */
  isRootAllowed(dir) {
    const target = normalizeRoot(dir);
    if (!target) return false;
    if (this.state.settings.allowedRoots.includes("*")) return true;
    const norm = (value) => value.replace(/\\/g, "/").toLowerCase();
    const targetNorm = norm(target);
    return this.state.settings.allowedRoots.some((root) => {
      const rootNorm = norm(normalizeRoot(root) ?? "");
      if (!rootNorm) return false;
      return targetNorm === rootNorm || targetNorm.startsWith(rootNorm + "/");
    });
  }
  reset() {
    this.state = emptyState();
    this.persist();
  }
};

// src/node/handler.ts
import { randomBytes as randomBytes3 } from "node:crypto";

// src/node/git.ts
import { execFile } from "node:child_process";
import { closeSync, existsSync as existsSync2, openSync, readSync, statSync } from "node:fs";
import { isAbsolute, join as join2, resolve } from "node:path";
var TIMEOUT_MS = 3e4;
var MAX_OUTPUT = 4e5;
var READ_ONLY = /* @__PURE__ */ new Set([
  "status",
  "log",
  "diff",
  "show",
  "branch",
  "remote",
  "rev-parse",
  "rev-list",
  "ls-files",
  "tag",
  "describe",
  "blame",
  "for-each-ref"
]);
var WRITE = /* @__PURE__ */ new Set(["init", "add", "commit", "checkout", "switch", "restore", "reset", "stash", "merge", "rebase", "push", "pull", "fetch", "cherry-pick", "revert", "tag", "branch", "clean"]);
function isKnownCommand(sub) {
  return READ_ONLY.has(sub) || WRITE.has(sub);
}
function clip(text) {
  if (text.length <= MAX_OUTPUT) return text;
  return text.slice(0, MAX_OUTPUT) + `
\u2026\uFF08\u8F93\u51FA\u5DF2\u622A\u65AD\uFF0C\u5171 ${text.length} \u5B57\u7B26\uFF09`;
}
function describeFailure(sub, code, stderr, stdout) {
  const detail = (stderr || stdout || "").trim();
  const short = detail.split("\n").slice(0, 12).join("\n");
  if (code === 128 && /not a git repository/i.test(detail)) return "\u76EE\u6807\u76EE\u5F55\u4E0D\u662F Git \u4ED3\u5E93\uFF08\u7F3A\u5C11 .git\uFF09";
  if (/does not have any commits yet/i.test(detail)) return "\u4ED3\u5E93\u8FD8\u6CA1\u6709\u4EFB\u4F55\u63D0\u4EA4";
  if (/pathspec .* did not match/i.test(detail)) return `\u8DEF\u5F84\u4E0D\u5B58\u5728\u6216\u6CA1\u6709\u5339\u914D\u7684\u6587\u4EF6\uFF1A${short}`;
  if (/could not resolve host|unable to access|Authentication failed|Permission denied \(publickey\)/i.test(detail)) {
    return `\u65E0\u6CD5\u8BBF\u95EE\u8FDC\u7AEF\uFF08\u7F51\u7EDC\u6216\u51ED\u636E\u95EE\u9898\uFF09\uFF1A${short}`;
  }
  if (/would be overwritten by (checkout|merge)/i.test(detail)) return `\u672C\u5730\u6709\u672A\u63D0\u4EA4\u6539\u52A8\uFF0C\u5207\u6362/\u5408\u5E76\u88AB\u62D2\u7EDD\uFF1A${short}`;
  return `git ${sub} \u5931\u8D25\uFF08\u9000\u51FA\u7801 ${code}\uFF09\uFF1A${short || "\u65E0\u8F93\u51FA"}`;
}
function ensureRepo(cwd) {
  if (typeof cwd !== "string" || cwd.trim().length === 0) return { ok: false, error: "\u7F3A\u5C11\u5DE5\u4F5C\u76EE\u5F55\u53C2\u6570" };
  if (!isAbsolute(cwd)) return { ok: false, error: `\u5DE5\u4F5C\u76EE\u5F55\u5FC5\u987B\u662F\u7EDD\u5BF9\u8DEF\u5F84\uFF1A${cwd}` };
  const dir = resolve(cwd);
  if (!existsSync2(dir)) return { ok: false, error: `\u76EE\u5F55\u4E0D\u5B58\u5728\uFF1A${dir}` };
  try {
    if (!statSync(dir).isDirectory()) return { ok: false, error: `\u4E0D\u662F\u76EE\u5F55\uFF1A${dir}` };
  } catch (error) {
    return { ok: false, error: `\u65E0\u6CD5\u8BBF\u95EE\u76EE\u5F55\uFF1A${redact(error)}` };
  }
  if (!existsSync2(join2(dir, ".git"))) return { ok: false, error: `${dir} \u4E0D\u662F Git \u4ED3\u5E93\uFF08\u672A\u627E\u5230 .git\uFF09` };
  return { ok: true, root: dir };
}
async function readRepoStatus(cwd) {
  const empty = {
    isRepo: false,
    root: "",
    branch: "",
    detached: false,
    head: "",
    ahead: 0,
    behind: 0,
    changed: 0,
    error: "",
    reason: "invalid"
  };
  const repo = ensureRepo(cwd);
  if (!repo.ok) {
    const message = repo.error ?? "\u4E0D\u662F Git \u4ED3\u5E93";
    const notInitialized = /未找到 \.git/.test(message);
    return { ...empty, error: message, reason: notInitialized ? "no-repo" : "invalid" };
  }
  const root = repo.root;
  const branchRes = await runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const headRes = await runGit(root, ["rev-parse", "--short", "HEAD"]);
  const head = headRes.ok ? headRes.stdout.trim() : "";
  if (!branchRes.ok) {
    return { ...empty, isRepo: true, root, head, error: branchRes.error, reason: "repo" };
  }
  const rawBranch = branchRes.stdout.trim();
  const detached = rawBranch === "HEAD";
  let ahead = 0;
  let behind = 0;
  const counts = await runGit(root, ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"]);
  if (counts.ok) {
    const parts = counts.stdout.trim().split(/\s+/);
    behind = Number.parseInt(parts[0] ?? "0", 10) || 0;
    ahead = Number.parseInt(parts[1] ?? "0", 10) || 0;
  }
  let changed = 0;
  const status = await runGit(root, ["status", "--porcelain"]);
  if (status.ok) {
    changed = status.stdout.split("\n").filter((line) => line.trim().length > 0).length;
  }
  return {
    isRepo: true,
    root,
    branch: detached ? "" : rawBranch,
    detached,
    head,
    ahead,
    behind,
    changed,
    error: "",
    reason: "repo"
  };
}
var MAX_CHANGE_FILES = 500;
var MAX_UNTRACKED_LINES = 2e3;
function decodeGitPath(raw) {
  if (raw.length < 2 || !raw.startsWith('"') || !raw.endsWith('"')) return raw;
  const body = raw.slice(1, -1);
  const bytes = [];
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch !== "\\") {
      for (const byte of Buffer.from(ch, "utf8")) bytes.push(byte);
      i += 1;
      continue;
    }
    i += 1;
    const next = body[i] ?? "";
    if (next >= "0" && next <= "7") {
      const oct = body.slice(i, i + 3);
      if (/^[0-7]{3}$/.test(oct)) {
        bytes.push(Number.parseInt(oct, 8));
        i += 3;
        continue;
      }
    }
    switch (next) {
      case "n":
        bytes.push(10);
        i += 1;
        break;
      case "t":
        bytes.push(9);
        i += 1;
        break;
      case "r":
        bytes.push(13);
        i += 1;
        break;
      case "a":
        bytes.push(7);
        i += 1;
        break;
      case "b":
        bytes.push(8);
        i += 1;
        break;
      case "f":
        bytes.push(12);
        i += 1;
        break;
      case "v":
        bytes.push(11);
        i += 1;
        break;
      case '"':
        bytes.push(34);
        i += 1;
        break;
      case "\\":
        bytes.push(92);
        i += 1;
        break;
      default:
        bytes.push(92);
        break;
    }
  }
  return Buffer.from(bytes).toString("utf8");
}
function findQuoteEnd(text) {
  let i = 1;
  while (i < text.length) {
    if (text[i] === "\\") {
      i += 2;
      continue;
    }
    if (text[i] === '"') return i;
    i += 1;
  }
  return -1;
}
function splitStatusPath(rest) {
  if (rest.startsWith('"')) {
    const end = findQuoteEnd(rest);
    if (end > 0) {
      const first = rest.slice(0, end + 1);
      const remainder = rest.slice(end + 1);
      if (remainder.startsWith(" -> ")) return decodeGitPath(remainder.slice(4));
      return decodeGitPath(first);
    }
  }
  const arrow = rest.indexOf(" -> ");
  if (arrow >= 0) return decodeGitPath(rest.slice(arrow + 4));
  return decodeGitPath(rest);
}
function normalizeNumstatPath(raw) {
  let text = decodeGitPath(raw);
  const arrow = text.lastIndexOf(" => ");
  if (arrow >= 0) {
    text = text.slice(arrow + 4);
  } else if (text.includes("{") && text.includes("=>")) {
    const start = text.lastIndexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) text = text.slice(start + 1, end);
  }
  return text.trim();
}
function countFileLines(absPath, cap = MAX_UNTRACKED_LINES) {
  let fd = null;
  try {
    const info = statSync(absPath);
    if (!info.isFile()) return 0;
    fd = openSync(absPath, "r");
    const buffer = Buffer.alloc(64 * 1024);
    let count = 0;
    let lastByte = -1;
    for (; ; ) {
      const read = readSync(fd, buffer, 0, buffer.length, null);
      if (read <= 0) break;
      for (let i = 0; i < read; i += 1) {
        if (buffer[i] === 10) count += 1;
        lastByte = buffer[i];
      }
      if (count >= cap) break;
    }
    if (lastByte !== -1 && lastByte !== 10) count += 1;
    return Math.min(count, cap);
  } catch {
    return 0;
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
      }
    }
  }
}
async function readRepoChanges(cwd) {
  const empty = { isRepo: false, root: "", branch: "", dirty: false, files: [] };
  const repo = ensureRepo(cwd);
  if (!repo.ok) return empty;
  const root = repo.root;
  const top = await runGit(root, ["rev-parse", "--show-toplevel"]);
  const repoRoot = top.ok && top.stdout.trim().length > 0 ? top.stdout.trim() : root;
  const branchRes = await runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const rawBranch = branchRes.ok ? branchRes.stdout.trim() : "";
  const branch = rawBranch && rawBranch !== "HEAD" ? rawBranch : "";
  const files = /* @__PURE__ */ new Map();
  const status = await runGit(root, ["status", "--porcelain", "--untracked-files=all"]);
  if (status.ok) {
    for (const line of status.stdout.split("\n")) {
      if (line.trim().length === 0) continue;
      if (line.length < 4) continue;
      const code = line.slice(0, 2);
      const path = splitStatusPath(line.slice(3));
      if (path.length === 0) continue;
      let index = "";
      let worktree = "";
      let staged = false;
      if (code === "??") {
        index = "";
        worktree = "?";
        staged = false;
      } else {
        index = code[0] === " " ? "" : code[0];
        worktree = code[1] === " " ? "" : code[1];
        staged = index.length > 0;
      }
      files.set(path, { path, index, worktree, added: 0, deleted: 0, staged });
    }
  }
  const numstat = await runGit(root, ["diff", "--numstat", "HEAD"]);
  const diffRes = numstat.ok ? numstat : await runGit(root, ["diff", "--numstat", "--cached"]);
  if (diffRes.ok) {
    for (const line of diffRes.stdout.split("\n")) {
      if (line.trim().length === 0) continue;
      const parts = line.split("	");
      if (parts.length < 3) continue;
      const added = Number.parseInt(parts[0], 10);
      const deleted = Number.parseInt(parts[1], 10);
      const path = normalizeNumstatPath(parts.slice(2).join("	"));
      if (path.length === 0) continue;
      const target = files.get(path);
      if (!target) continue;
      target.added = Number.isFinite(added) && added > 0 ? added : 0;
      target.deleted = Number.isFinite(deleted) && deleted > 0 ? deleted : 0;
    }
  }
  for (const file of files.values()) {
    if (file.worktree !== "?" || file.added > 0) continue;
    file.added = countFileLines(join2(repoRoot, file.path));
  }
  const list = Array.from(files.values()).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const limited = list.slice(0, MAX_CHANGE_FILES);
  return {
    isRepo: true,
    root: repoRoot,
    branch,
    dirty: limited.length > 0,
    files: limited
  };
}
async function initRepo(cwd, branch = "main") {
  const fail2 = (error, root = "") => ({ ok: false, root, branch: "", created: false, error });
  if (typeof cwd !== "string" || cwd.trim().length === 0) return fail2("\u7F3A\u5C11\u5DE5\u4F5C\u76EE\u5F55\u53C2\u6570");
  if (!isAbsolute(cwd)) return fail2(`\u5DE5\u4F5C\u76EE\u5F55\u5FC5\u987B\u662F\u7EDD\u5BF9\u8DEF\u5F84\uFF1A${cwd}`);
  const dir = resolve(cwd);
  if (!existsSync2(dir)) return fail2(`\u76EE\u5F55\u4E0D\u5B58\u5728\uFF1A${dir}`);
  try {
    if (!statSync(dir).isDirectory()) return fail2(`\u4E0D\u662F\u76EE\u5F55\uFF1A${dir}`);
  } catch (error) {
    return fail2(`\u65E0\u6CD5\u8BBF\u95EE\u76EE\u5F55\uFF1A${redact(error)}`);
  }
  if (existsSync2(join2(dir, ".git"))) {
    const status2 = await readRepoStatus(dir);
    return { ok: true, root: dir, branch: status2.branch || status2.head, created: false, error: "" };
  }
  const initial = typeof branch === "string" && /^[\w./-]{1,80}$/.test(branch) ? branch : "main";
  const result = await runGit(dir, ["init", "-b", initial]);
  if (!result.ok) return fail2(result.error, dir);
  const status = await readRepoStatus(dir);
  return { ok: true, root: dir, branch: status.branch || initial, created: true, error: "" };
}
function runGit(cwd, args) {
  const safeArgs = args.filter((item) => typeof item === "string" && item.length > 0);
  const sub = safeArgs[0] ?? "";
  const dangerous = safeArgs.some((item) => /^--(upload-pack|exec|receive-pack|template|separate-git-dir|open-files-in-pager|pager)=/i.test(item));
  const command = `git ${safeArgs.join(" ")}`;
  if (dangerous) {
    return Promise.resolve({
      ok: false,
      code: 1,
      stdout: "",
      stderr: "",
      error: "\u53C2\u6570\u5305\u542B\u4E0D\u5141\u8BB8\u7684 git \u9009\u9879\uFF08\u53EF\u6267\u884C\u5916\u90E8\u7A0B\u5E8F\u7C7B\uFF09",
      command
    });
  }
  if (!isKnownCommand(sub)) {
    return Promise.resolve({
      ok: false,
      code: 1,
      stdout: "",
      stderr: "",
      error: `\u4E0D\u652F\u6301\u7684 git \u5B50\u547D\u4EE4\uFF1A${sub || "(\u7A7A)"}`,
      command
    });
  }
  return new Promise((resolvePromise) => {
    execFile(
      "git",
      safeArgs,
      {
        cwd,
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT * 4,
        windowsHide: true,
        env: {
          ...process.env,
          // 禁止 git 弹交互提示/编辑器，否则会卡死进程。
          GIT_TERMINAL_PROMPT: "0",
          GIT_ASKPASS: "",
          GIT_PAGER: "cat",
          GIT_EDITOR: "true"
        }
      },
      (error, stdoutRaw, stderrRaw) => {
        const stdout = clip(String(stdoutRaw ?? ""));
        const stderr = clip(String(stderrRaw ?? ""));
        if (!error) {
          resolvePromise({ ok: true, code: 0, stdout, stderr, error: "", command });
          return;
        }
        const code = typeof error.code === "number" ? error.code : 1;
        const killed = error.killed === true;
        const message = killed ? `git ${sub} \u8D85\u65F6\uFF08${TIMEOUT_MS / 1e3}s\uFF09\u88AB\u7EC8\u6B62` : describeFailure(sub, code, stderr, stdout);
        resolvePromise({
          ok: false,
          code,
          stdout,
          stderr,
          error: redact(message),
          command
        });
      }
    );
  });
}

// src/node/graph.ts
var FIELD_SEP = "";
var EMPTY = {
  isRepo: false,
  root: "",
  branch: "",
  head: "",
  detached: false,
  reason: "invalid",
  error: "",
  truncated: false,
  laneCount: 0,
  rows: []
};
var GRAPH_MIN = 5;
var GRAPH_MAX = 100;
var GRAPH_DEFAULT = 30;
function parseRefs(raw) {
  const refs = [];
  for (const piece of raw.split(",")) {
    const text = piece.trim();
    if (text.length === 0) continue;
    if (text.startsWith("HEAD -> ")) {
      refs.push({ name: text.slice("HEAD -> ".length).trim(), kind: "head" });
      continue;
    }
    if (text === "HEAD") {
      refs.push({ name: "HEAD", kind: "head" });
      continue;
    }
    if (text.startsWith("tag: ")) {
      refs.push({ name: text.slice("tag: ".length).trim(), kind: "tag" });
      continue;
    }
    if (/^(origin|upstream|fork)\//.test(text) || text.includes("/")) {
      refs.push({ name: text, kind: "remote" });
      continue;
    }
    refs.push({ name: text, kind: "local" });
  }
  return refs;
}
function parseLog(stdout) {
  const commits = [];
  for (const line of stdout.split("\n")) {
    if (line.trim().length === 0) continue;
    const parts = line.split(FIELD_SEP);
    if (parts.length < 7) continue;
    const [hash, short, parents, author, date, decoration, ...rest] = parts;
    commits.push({
      hash: (hash ?? "").trim(),
      short: (short ?? "").trim(),
      parents: (parents ?? "").trim().length > 0 ? parents.trim().split(/\s+/) : [],
      author: (author ?? "").trim(),
      date: (date ?? "").trim(),
      // 标题里若混入 \x1f 会被切碎，这里拼回去，保证不丢内容。
      subject: rest.join(FIELD_SEP).trim(),
      refs: parseRefs((decoration ?? "").trim())
    });
  }
  return commits;
}
function layoutGraph(commits) {
  const lanes = [];
  const rows = [];
  const firstFree = () => {
    const index = lanes.indexOf(null);
    if (index !== -1) return index;
    lanes.push(null);
    return lanes.length - 1;
  };
  commits.forEach((commit, row) => {
    let lane = lanes.indexOf(commit.hash);
    if (lane === -1) {
      lane = firstFree();
      lanes[lane] = commit.hash;
    }
    const before = lanes.slice();
    const segments = [];
    lanes[lane] = null;
    commit.parents.forEach((parent, index) => {
      const existing = lanes.indexOf(parent);
      if (existing !== -1) {
        if (existing !== lane) segments.push({ from: lane, to: existing });
        return;
      }
      const target = index === 0 ? lane : firstFree();
      lanes[target] = parent;
      segments.push({ from: lane, to: target });
    });
    const through = [];
    const width = Math.max(before.length, lanes.length);
    for (let i = 0; i < width; i += 1) {
      if (i === lane) continue;
      if (before[i] && lanes[i]) through.push(i);
    }
    rows.push({ ...commit, row, lane, segments, through });
  });
  let laneCount = 0;
  for (let i = 0; i < lanes.length; i += 1) if (lanes[i]) laneCount = i + 1;
  for (const row of rows) {
    laneCount = Math.max(laneCount, row.lane + 1);
    for (const seg of row.segments) laneCount = Math.max(laneCount, seg.from + 1, seg.to + 1);
    for (const lane of row.through) laneCount = Math.max(laneCount, lane + 1);
  }
  return { rows, laneCount };
}
function clampLimit(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return GRAPH_DEFAULT;
  return Math.min(GRAPH_MAX, Math.max(GRAPH_MIN, parsed));
}
async function readRepoGraph(cwd, limitInput) {
  const limit = clampLimit(limitInput);
  const repo = ensureRepo(cwd);
  if (!repo.ok) {
    const message = repo.error ?? "\u4E0D\u662F Git \u4ED3\u5E93";
    const notInitialized = /未找到 \.git/.test(message);
    return { ...EMPTY, error: message, reason: notInitialized ? "no-repo" : "invalid" };
  }
  const root = repo.root;
  const branchRes = await runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const headRes = await runGit(root, ["rev-parse", "--short", "HEAD"]);
  const head = headRes.ok ? headRes.stdout.trim() : "";
  const rawBranch = branchRes.ok ? branchRes.stdout.trim() : "";
  const detached = rawBranch === "HEAD";
  const log = await runGit(root, [
    "log",
    // 只看当前分支历史：Git 工作台聚焦当前项目演进线（2026-10-29 用户要求）。
    "--date-order",
    `-n${limit + 1}`,
    "--date=short",
    `--pretty=format:%H${FIELD_SEP}%h${FIELD_SEP}%P${FIELD_SEP}%an${FIELD_SEP}%ad${FIELD_SEP}%D${FIELD_SEP}%s`
  ]);
  if (!log.ok) {
    const empty = /does not have any commits|unknown revision/i.test(`${log.stderr} ${log.error}`);
    return {
      ...EMPTY,
      isRepo: true,
      root,
      branch: detached ? "" : rawBranch,
      head,
      detached,
      reason: "repo",
      error: empty ? "" : log.error
    };
  }
  const parsed = parseLog(log.stdout);
  const truncated = parsed.length > limit;
  const visible = truncated ? parsed.slice(0, limit) : parsed;
  const { rows, laneCount } = layoutGraph(visible);
  return {
    isRepo: true,
    root,
    branch: detached ? "" : rawBranch,
    head,
    detached,
    reason: "repo",
    error: "",
    truncated,
    laneCount,
    rows
  };
}

// src/node/git-ops.ts
var CLIP_LOG = 400;
function validBranchName(name2) {
  if (typeof name2 !== "string") return false;
  const trimmed = name2.trim();
  if (trimmed.length === 0 || trimmed.length > 120) return false;
  if (trimmed.startsWith("-") || trimmed.startsWith("/") || trimmed.endsWith("/")) return false;
  if (trimmed.endsWith(".lock") || trimmed.includes("..") || trimmed.includes("@{")) return false;
  if (/[\s~^:?*[\\\u0000-\u001f\u007f]/.test(trimmed)) return false;
  if (/^(HEAD|FETCH_HEAD|ORIG_HEAD|MERGE_HEAD|CHERRY_PICK_HEAD|rebase|refs\/)/i.test(trimmed)) return false;
  return true;
}
function clipLog(text) {
  if (text.length <= CLIP_LOG) return text;
  return text.slice(0, CLIP_LOG) + `\u2026\uFF08\u8F93\u51FA\u5DF2\u622A\u65AD\uFF0C\u5171 ${text.length} \u5B57\u7B26\uFF09`;
}
function firstLine(text) {
  return text.split("\n").find((line) => line.trim().length > 0)?.trim() ?? "";
}
async function readBranches(cwd) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", current: "", branches: [], error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const root = repo.root;
  const currentRes = await runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const current = currentRes.ok ? currentRes.stdout.trim() : "";
  const local = await runGit(root, [
    "for-each-ref",
    "--format=%(refname:short)%09%(objectname:short)%09%(upstream:short)%09%(upstream:track)",
    "refs/heads"
  ]);
  const remote = await runGit(root, [
    "for-each-ref",
    "--format=%(refname:short)%09%(objectname:short)",
    "refs/remotes"
  ]);
  if (!local.ok || !remote.ok) {
    return { ok: false, root, current, branches: [], error: local.error || remote.error };
  }
  const branches = [];
  for (const line of local.stdout.split("\n")) {
    if (line.trim().length === 0) continue;
    const [name2, head, upstream, track] = line.split("	");
    let ahead = 0;
    let behind = 0;
    if (track) {
      const ah = /\[ahead (\d+)[^\]]*\]/.exec(track);
      const bh = /\[behind (\d+)[^\]]*\]/.exec(track);
      if (ah) ahead = Number.parseInt(ah[1], 10) || 0;
      if (bh) behind = Number.parseInt(bh[1], 10) || 0;
    }
    branches.push({
      name: name2,
      head: head ?? "",
      upstream: upstream ?? "",
      ahead,
      behind,
      current: current === name2,
      kind: "local",
      tip: ""
    });
  }
  const localNames = new Set(branches.map((branch) => branch.name));
  for (const line of remote.stdout.split("\n")) {
    if (line.trim().length === 0) continue;
    const [name2, head] = line.split("	");
    if (!name2 || name2.endsWith("/HEAD")) continue;
    const slash = name2.indexOf("/");
    const shortName = slash > 0 ? name2.slice(slash + 1) : name2;
    if (!localNames.has(shortName)) continue;
    branches.push({ name: name2, head: head ?? "", upstream: "", ahead: 0, behind: 0, current: false, kind: "remote", tip: head ?? "" });
  }
  return { ok: true, root, current, branches, error: "" };
}
async function createBranch(cwd, name2, startPoint, checkout) {
  if (!validBranchName(name2)) return { ok: false, root: "", error: `\u5206\u652F\u540D\u4E0D\u5408\u6CD5\uFF1A${name2}`, output: "" };
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", output: "" };
  const root = repo.root;
  const args = checkout ? ["checkout", "-b", name2] : ["branch", name2];
  if (startPoint.trim().length > 0) args.push(startPoint.trim());
  const result = await runGit(root, args);
  if (!result.ok) return { ok: false, root, error: result.error, output: clipLog(result.stdout) };
  return { ok: true, root, error: "", output: firstLine(result.stdout) };
}
async function checkoutBranch(cwd, name2) {
  if (!validBranchName(name2)) return { ok: false, root: "", error: `\u5206\u652F\u540D\u4E0D\u5408\u6CD5\uFF1A${name2}`, output: "" };
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", output: "" };
  const result = await runGit(repo.root, ["checkout", name2]);
  if (!result.ok) return { ok: false, root: repo.root, error: result.error, output: clipLog(result.stdout) };
  return { ok: true, root: repo.root, error: "", output: firstLine(result.stdout) };
}
async function deleteBranch(cwd, name2, force) {
  if (!validBranchName(name2)) return { ok: false, root: "", error: `\u5206\u652F\u540D\u4E0D\u5408\u6CD5\uFF1A${name2}`, output: "" };
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", output: "" };
  const result = await runGit(repo.root, ["branch", force ? "-D" : "-d", name2]);
  if (!result.ok) return { ok: false, root: repo.root, error: result.error, output: clipLog(result.stdout) };
  return { ok: true, root: repo.root, error: "", output: firstLine(result.stdout) };
}
async function renameBranch(cwd, name2, newName) {
  if (!validBranchName(newName)) return { ok: false, root: "", error: `\u65B0\u5206\u652F\u540D\u4E0D\u5408\u6CD5\uFF1A${newName}`, output: "" };
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", output: "" };
  const result = await runGit(repo.root, ["branch", "-m", name2, newName]);
  if (!result.ok) return { ok: false, root: repo.root, error: result.error, output: clipLog(result.stdout) };
  return { ok: true, root: repo.root, error: "", output: firstLine(result.stdout) };
}
async function stagePaths(cwd, paths) {
  const clean = (Array.isArray(paths) ? paths : []).map((item) => String(item).trim()).filter((item) => item.length > 0);
  if (clean.length === 0) return { ok: false, root: "", error: "\u8BF7\u9009\u62E9\u8981\u6682\u5B58\u7684\u6587\u4EF6" };
  for (const item of clean) {
    if (/^(-|[A-Za-z]:[\\/]|\/|\.\.)/.test(item) || item.includes("..")) {
      return { ok: false, root: "", error: `\u8DEF\u5F84\u4E0D\u5408\u6CD5\uFF1A${item}\uFF08\u5FC5\u987B\u662F\u4ED3\u5E93\u5185\u7684\u76F8\u5BF9\u8DEF\u5F84\uFF09` };
    }
  }
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const result = await runGit(repo.root, ["add", "--", ...clean]);
  if (!result.ok) return { ok: false, root: repo.root, error: result.error };
  return { ok: true, root: repo.root, error: "" };
}
async function unstagePaths(cwd, paths) {
  const clean = (Array.isArray(paths) ? paths : []).map((item) => String(item).trim()).filter((item) => item.length > 0);
  if (clean.length === 0) return { ok: false, root: "", error: "\u8BF7\u9009\u62E9\u8981\u53D6\u6D88\u6682\u5B58\u7684\u6587\u4EF6" };
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const result = await runGit(repo.root, ["restore", "--staged", "--", ...clean]);
  if (!result.ok) return { ok: false, root: repo.root, error: result.error };
  return { ok: true, root: repo.root, error: "" };
}
async function discardPaths(cwd, paths) {
  const clean = (Array.isArray(paths) ? paths : []).map((item) => String(item).trim()).filter((item) => item.length > 0);
  if (clean.length === 0) return { ok: false, root: "", error: "\u8BF7\u9009\u62E9\u8981\u4E22\u5F03\u6539\u52A8\u7684\u6587\u4EF6" };
  for (const item of clean) {
    if (/^(-|[A-Za-z]:[\\/]|\/|\.\.)/.test(item) || item.includes("..")) {
      return { ok: false, root: "", error: `\u8DEF\u5F84\u4E0D\u5408\u6CD5\uFF1A${item}\uFF08\u5FC5\u987B\u662F\u4ED3\u5E93\u5185\u7684\u76F8\u5BF9\u8DEF\u5F84\uFF09` };
    }
  }
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const root = repo.root;
  const tracked = await runGit(root, ["restore", "--worktree", "--", ...clean]);
  const untracked = [];
  for (const item of clean) {
    const check = await runGit(root, ["ls-files", "--", item]);
    if (check.ok && check.stdout.trim().length === 0) untracked.push(item);
  }
  if (untracked.length > 0) {
    const cleaned = await runGit(root, ["clean", "-f", "--", ...untracked]);
    if (!cleaned.ok && !tracked.ok) return { ok: false, root, error: tracked.error || cleaned.error };
  }
  if (!tracked.ok) return { ok: false, root, error: tracked.error };
  return { ok: true, root, error: "" };
}
async function commitStaged(cwd, message, amend) {
  const text = typeof message === "string" ? message.trim() : "";
  if (text.length === 0 && !amend) return { ok: false, root: "", hash: "", error: "\u63D0\u4EA4\u4FE1\u606F\u4E0D\u80FD\u4E3A\u7A7A", output: "" };
  if (text.length > 4e3) return { ok: false, root: "", hash: "", error: "\u63D0\u4EA4\u4FE1\u606F\u8FC7\u957F\uFF08\u4E0A\u9650 4000 \u5B57\u7B26\uFF09", output: "" };
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", hash: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", output: "" };
  const root = repo.root;
  const staged = await runGit(root, ["diff", "--cached", "--quiet"]);
  if (staged.ok && !amend) {
    return { ok: false, root, hash: "", error: "\u6682\u5B58\u533A\u662F\u7A7A\u7684\uFF1A\u8BF7\u5148\u5728\u5DE6\u4FA7\u53D8\u66F4\u5217\u8868\u52FE\u9009\u6587\u4EF6\u5E76\u6682\u5B58", output: "" };
  }
  if (staged.ok && amend) {
    return { ok: false, root, hash: "", error: "\u6682\u5B58\u533A\u662F\u7A7A\u7684\uFF1AAmend \u9700\u8981\u81F3\u5C11\u4E00\u4E2A\u6682\u5B58\u7684\u6539\u52A8", output: "" };
  }
  const args = ["commit", "-m", text.length > 0 ? text : "--no-edit", "--no-verify"];
  if (amend) args.push("--amend");
  const result = await runGit(root, args);
  if (!result.ok) {
    if (/nothing to commit/.test(result.stderr || result.stdout)) {
      return { ok: false, root, hash: "", error: "\u6682\u5B58\u533A\u662F\u7A7A\u7684\uFF1A\u8BF7\u5148\u6682\u5B58\u6587\u4EF6\u518D\u63D0\u4EA4", output: clipLog(result.stdout) };
    }
    return { ok: false, root, hash: "", error: result.error, output: clipLog(result.stdout) };
  }
  const hashRes = await runGit(root, ["rev-parse", "--short", "HEAD"]);
  return { ok: true, root, hash: hashRes.ok ? hashRes.stdout.trim() : "", error: "", output: firstLine(result.stdout) };
}
var MAX_COMMITS = 200;
async function readCommits(cwd, limit, offset, ref, search) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", commits: [], error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", truncated: false };
  const root = repo.root;
  const cap = Math.min(Math.max(Number.isFinite(limit) ? limit : 30, 1), MAX_COMMITS);
  const skip = Math.min(Math.max(Number.isFinite(offset) ? offset : 0, 0), 1e5);
  const revision = String(ref ?? "").trim();
  if (revision.length > 0 && (revision.startsWith("-") || /\s/.test(revision))) {
    return { ok: false, root, commits: [], error: `\u5206\u652F/\u63D0\u4EA4\u53F7\u4E0D\u5408\u6CD5\uFF1A${revision}`, truncated: false };
  }
  const keyword = String(search ?? "").trim();
  if (keyword.length > 200) {
    return { ok: false, root, commits: [], error: "\u68C0\u7D22\u5173\u952E\u8BCD\u8FC7\u957F\uFF08\u4E0A\u9650 200 \u5B57\u7B26\uFF09", truncated: false };
  }
  const args = ["log"];
  if (revision.length > 0) args.push(revision);
  args.push(
    `-n${cap}`,
    `--skip=${skip}`,
    "--date=iso-local",
    "--pretty=format:%H%x09%h%x09%an%x09%ae%x09%ad%x09%P%x09%D%x09%s"
  );
  if (keyword.length > 0) args.push("--regexp-ignore-case", "--fixed-strings", `--grep=${keyword}`);
  const result = await runGit(root, args);
  if (!result.ok) {
    if (/does not have any commits yet|bad revision|unknown revision|ambiguous argument/i.test(result.stderr)) {
      if (revision.length > 0) {
        return { ok: false, root, commits: [], error: `\u65E0\u6CD5\u89E3\u6790\u5206\u652F\u6216\u63D0\u4EA4\uFF1A${revision}`, truncated: false };
      }
      return { ok: true, root, commits: [], error: "", truncated: false };
    }
    return { ok: false, root, commits: [], error: result.error, truncated: false };
  }
  const commits = [];
  for (const line of result.stdout.split("\n")) {
    if (line.trim().length === 0) continue;
    const [hash, shortHash, author, email, date, parents, refs, ...rest] = line.split("	");
    commits.push({
      hash,
      shortHash,
      author,
      email,
      date,
      subject: rest.join("	"),
      refs: refs ?? "",
      parents: (parents ?? "").split(" ").filter((item) => item.length > 0)
    });
  }
  return { ok: true, root, commits, error: "", truncated: commits.length >= cap };
}
var MAX_DETAIL_DIFF = 6e4;
async function readCommitDetail(cwd, rev) {
  const revision = String(rev ?? "").trim();
  if (revision.length === 0 || /^-/.test(revision)) {
    return { ok: false, root: "", error: `\u63D0\u4EA4\u53F7\u4E0D\u5408\u6CD5\uFF1A${revision}`, commit: null, files: [], diff: "", diffTruncated: false };
  }
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", commit: null, files: [], diff: "", diffTruncated: false };
  const root = repo.root;
  const meta = await runGit(root, ["show", "--no-color", "-s", "--date=iso-local", "--format=%H%x09%h%x09%an%x09%ae%x09%ad%x09%P%x09%D%x09%B%x09EOFMETA", revision]);
  if (!meta.ok) return { ok: false, root, error: meta.error, commit: null, files: [], diff: "", diffTruncated: false };
  const lines = meta.stdout.split("\n");
  const metaLine = lines[0] ?? "";
  const [hash, shortHash, author, email, date, parents, refs] = metaLine.split("	");
  const eof = lines.findIndex((line) => line.trim() === "EOFMETA");
  const message = eof > 0 ? lines.slice(0, eof).slice(1).join("\n").replace(/\n$/, "") : lines[1] ?? "";
  const commit = {
    hash,
    shortHash,
    author,
    email,
    date,
    parents: (parents ?? "").split(" ").filter((item) => item.length > 0),
    refs: refs ?? "",
    subject: message.split("\n")[0] ?? "",
    message
  };
  const numstat = await runGit(root, ["show", "--no-color", "--numstat", "--format=", revision]);
  const files = [];
  if (numstat.ok) {
    for (const line of numstat.stdout.split("\n")) {
      if (line.trim().length === 0) continue;
      const parts = line.split("	");
      if (parts.length < 3) continue;
      files.push({
        added: /^-+$/.test(parts[0]) ? 0 : Number.parseInt(parts[0], 10) || 0,
        deleted: /^-+$/.test(parts[1]) ? 0 : Number.parseInt(parts[1], 10) || 0,
        status: parts[0] === "-" ? "rename" : "changed",
        path: parts.slice(2).join("	")
      });
    }
  }
  const diff = await runGit(root, ["show", "--no-color", "--format=", revision]);
  const raw = diff.ok ? diff.stdout : "";
  const diffTruncated = raw.length > MAX_DETAIL_DIFF;
  return { ok: true, root, error: "", commit, files, diff: diffTruncated ? raw.slice(0, MAX_DETAIL_DIFF) : raw, diffTruncated };
}
var MAX_DIFF = 8e4;
async function readDiff(cwd, mode, path, rev) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", diff: "", truncated: false, totalLines: 0 };
  const root = repo.root;
  let args;
  if (mode === "staged") args = ["diff", "--no-color", "--cached"];
  else if (mode === "commit") {
    const revision = String(rev ?? "").trim();
    if (!revision || /^-/.test(revision)) return { ok: false, root, error: `\u63D0\u4EA4\u53F7\u4E0D\u5408\u6CD5\uFF1A${rev}`, diff: "", truncated: false, totalLines: 0 };
    args = ["diff", "--no-color", `${revision}^`, revision];
  } else args = ["diff", "--no-color"];
  const clean = String(path ?? "").trim();
  if (clean) {
    if (/^(-|[A-Za-z]:[\\/]|\/|\.\.)/.test(clean) || clean.includes("..")) {
      return { ok: false, root, error: `\u8DEF\u5F84\u4E0D\u5408\u6CD5\uFF1A${clean}`, diff: "", truncated: false, totalLines: 0 };
    }
    args.push("--", clean);
  }
  const result = await runGit(root, args);
  if (!result.ok) return { ok: false, root, error: result.error, diff: "", truncated: false, totalLines: 0 };
  const lines = result.stdout.split("\n");
  const truncated = result.stdout.length > MAX_DIFF;
  return { ok: true, root, error: "", diff: truncated ? result.stdout.slice(0, MAX_DIFF) : result.stdout, truncated, totalLines: lines.length };
}
async function stageAll(cwd) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const result = await runGit(repo.root, ["add", "-A"]);
  if (!result.ok) return { ok: false, root: repo.root, error: result.error };
  return { ok: true, root: repo.root, error: "" };
}
function parseRemoteRepo(url) {
  const raw = String(url ?? "").trim();
  if (raw.length === 0) return null;
  let path = "";
  if (/^git@[^:]+:/i.test(raw)) {
    path = raw.replace(/^git@[^:]+:/i, "");
  } else if (/^ssh:\/\//i.test(raw)) {
    path = raw.replace(/^ssh:\/\//i, "").replace(/^[^/]*@/, "").replace(/^[^/]*\//, "");
  } else if (/^https?:\/\//i.test(raw)) {
    path = raw.replace(/^https?:\/\//i, "").replace(/^[^/]*\//, "");
  } else {
    return null;
  }
  path = path.split("#")[0].split("?")[0];
  const normalized = normalizeRepo(path);
  if (!normalized || normalized === "*") return null;
  return normalized;
}
async function readRemotes(cwd) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", remotes: [], error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", upstream: "", upstreamRemote: "" };
  const root = repo.root;
  const result = await runGit(root, ["remote", "-v"]);
  if (!result.ok) return { ok: false, root, remotes: [], error: result.error, upstream: "", upstreamRemote: "" };
  const remotes = [];
  const seen = /* @__PURE__ */ new Set();
  for (const line of result.stdout.split("\n")) {
    if (line.trim().length === 0) continue;
    const [name2, url] = line.split("	");
    if (!name2 || seen.has(name2)) continue;
    seen.add(name2);
    remotes.push({ name: name2, url: (url ?? "").replace(/\s+\(.*\)$/, "") });
  }
  const up = await runGit(root, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  const upstream = up.ok ? up.stdout.trim() : "";
  const upstreamRemote = upstream.includes("/") ? upstream.split("/")[0] : "";
  return { ok: true, root, remotes, error: "", upstream, upstreamRemote };
}
async function addRemote(cwd, name2, url) {
  const remoteName = String(name2 ?? "").trim();
  const remoteUrl = String(url ?? "").trim();
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(remoteName)) return { ok: false, root: "", error: `remote \u540D\u79F0\u4E0D\u5408\u6CD5\uFF1A${remoteName}\uFF08\u5B57\u6BCD\u6570\u5B57._-\uFF09` };
  if (!/^https?:\/\/.+/i.test(remoteUrl) && !/^git@.+/.test(remoteUrl) && !/^ssh:\/\/.+/i.test(remoteUrl)) {
    return { ok: false, root: "", error: `URL \u4E0D\u5408\u6CD5\uFF1A${remoteUrl}\uFF08\u652F\u6301 https/git@/ssh\uFF09` };
  }
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const result = await runGit(repo.root, ["remote", "add", remoteName, remoteUrl]);
  if (!result.ok) return { ok: false, root: repo.root, error: result.error };
  return { ok: true, root: repo.root, error: "" };
}
async function removeRemote(cwd, name2) {
  const remoteName = String(name2 ?? "").trim();
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(remoteName)) return { ok: false, root: "", error: `remote \u540D\u79F0\u4E0D\u5408\u6CD5\uFF1A${remoteName}` };
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const result = await runGit(repo.root, ["remote", "remove", remoteName]);
  if (!result.ok) return { ok: false, root: repo.root, error: result.error };
  return { ok: true, root: repo.root, error: "" };
}
async function resetToCommit(cwd, rev, mode) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", output: "" };
  const root = repo.root;
  const revision = String(rev ?? "").trim();
  if (revision.length === 0) return { ok: false, root, error: "\u7F3A\u5C11\u76EE\u6807\u63D0\u4EA4", output: "" };
  if (revision.length > 200 || /^-/.test(revision)) return { ok: false, root, error: `\u63D0\u4EA4\u5F15\u7528\u4E0D\u5408\u6CD5\uFF1A${revision}`, output: "" };
  const flag = mode === "soft" ? "--soft" : mode === "hard" ? "--hard" : "--mixed";
  const result = await runGit(root, ["reset", flag, revision]);
  if (!result.ok) return { ok: false, root, error: result.error, output: clipLog(result.stderr || result.stdout) };
  return { ok: true, root, error: "", output: firstLine(result.stdout) || `\u5DF2\u56DE\u9000\u5230 ${revision.slice(0, 8)}\uFF08${flag}\uFF09` };
}
async function revertCommit(cwd, rev) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", output: "", conflicted: false };
  const root = repo.root;
  const revision = String(rev ?? "").trim();
  if (revision.length === 0) return { ok: false, root, error: "\u7F3A\u5C11\u8981\u64A4\u9500\u7684\u63D0\u4EA4", output: "", conflicted: false };
  if (revision.length > 200 || /^-/.test(revision)) return { ok: false, root, error: `\u63D0\u4EA4\u5F15\u7528\u4E0D\u5408\u6CD5\uFF1A${revision}`, output: "", conflicted: false };
  const result = await runGit(root, ["revert", "--no-edit", revision]);
  if (!result.ok) {
    const conflicted = /CONFLICT|after resolving the conflicts/iu.test(`${result.stderr}
${result.stdout}`);
    return {
      ok: false,
      root,
      error: conflicted ? "\u64A4\u9500\u65F6\u53D1\u751F\u51B2\u7A81\uFF1A\u8BF7\u5728\u7EC8\u7AEF\u89E3\u51B3\u51B2\u7A81\u540E\u6267\u884C git revert --continue\uFF08\u6216 git revert --abort \u653E\u5F03\uFF09" : result.error,
      output: clipLog(result.stderr || result.stdout),
      conflicted
    };
  }
  return { ok: true, root, error: "", output: firstLine(result.stdout), conflicted: false };
}
function classifySync(sub, code, stderr, stdout) {
  const text = `${stderr}
${stdout}`;
  if (/CONFLICT|Automatic merge failed|needs merge/i.test(text)) return { conflicted: true, rejected: false, missingConfig: false };
  if (sub === "push" && /rejected|non-fast-forward|fetch first/i.test(text)) return { conflicted: false, rejected: true, missingConfig: false };
  if (/no configured push destination|no upstream configured|does not appear to be a git repository|No tracking information|set-upstream/i.test(text)) {
    return { conflicted: false, rejected: false, missingConfig: true };
  }
  return { conflicted: false, rejected: false, missingConfig: false };
}
async function fetchRepo(cwd, remote) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", output: "", conflicted: false, rejected: false, missingConfig: false };
  const root = repo.root;
  const name2 = String(remote ?? "").trim();
  const args = name2.length > 0 ? ["fetch", "--", name2] : ["fetch", "--all"];
  const result = await runGit(root, args);
  if (!result.ok) {
    return {
      ok: false,
      root,
      error: result.error,
      output: clipLog(result.stderr || result.stdout),
      ...classifySync("fetch", result.code, result.stderr, result.stdout)
    };
  }
  return { ok: true, root, error: "", output: clipLog(result.stderr || result.stdout), conflicted: false, rejected: false, missingConfig: false };
}
async function pullRepo(cwd, remote, branch, strategy) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", output: "", conflicted: false, rejected: false, missingConfig: false };
  const root = repo.root;
  const args = ["pull", strategy === "rebase" ? "--rebase" : "--no-rebase"];
  const remoteName = String(remote ?? "").trim();
  const branchName = String(branch ?? "").trim();
  if (remoteName.length > 0 && !/^[\w.-]{1,60}$/.test(remoteName)) return { ok: false, root, error: `remote \u540D\u79F0\u4E0D\u5408\u6CD5\uFF1A${remoteName}`, output: "", conflicted: false, rejected: false, missingConfig: false };
  if (branchName.length > 0 && !validBranchName(branchName)) return { ok: false, root, error: `\u5206\u652F\u540D\u4E0D\u5408\u6CD5\uFF1A${branchName}`, output: "", conflicted: false, rejected: false, missingConfig: false };
  if (remoteName.length > 0) args.push("--", remoteName);
  if (branchName.length > 0) args.push(branchName);
  const result = await runGit(root, args);
  if (!result.ok) {
    return {
      ok: false,
      root,
      error: result.error,
      output: clipLog(result.stderr || result.stdout),
      ...classifySync("pull", result.code, result.stderr, result.stdout)
    };
  }
  return { ok: true, root, error: "", output: clipLog(result.stderr || result.stdout), conflicted: false, rejected: false, missingConfig: false };
}
async function pushRepo(cwd, remote, branch, options) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528", output: "", conflicted: false, rejected: false, missingConfig: false };
  const root = repo.root;
  const remoteName = String(remote ?? "").trim();
  const branchName = String(branch ?? "").trim();
  if (!remoteName || !/^[\w.-]{1,60}$/.test(remoteName)) return { ok: false, root, error: "\u7F3A\u5C11 remote \u540D\u79F0\uFF08\u5148\u5728\u8FDC\u7A0B\u4ED3\u5E93\u5F39\u7A97\u91CC\u914D\u7F6E\uFF09", output: "", conflicted: false, rejected: false, missingConfig: true };
  if (!branchName || !validBranchName(branchName)) return { ok: false, root, error: `\u5206\u652F\u540D\u4E0D\u5408\u6CD5\uFF1A${branchName}`, output: "", conflicted: false, rejected: false, missingConfig: false };
  const args = ["push"];
  if (options?.force) args.push("--force-with-lease");
  if (options?.tags) args.push("--follow-tags");
  if (options?.setUpstream) args.push("-u");
  args.push("--", remoteName, branchName);
  const result = await runGit(root, args);
  if (!result.ok) {
    return {
      ok: false,
      root,
      error: result.error,
      output: clipLog(result.stderr || result.stdout),
      ...classifySync("push", result.code, result.stderr, result.stdout)
    };
  }
  return { ok: true, root, error: "", output: clipLog(result.stderr || result.stdout), conflicted: false, rejected: false, missingConfig: false };
}
async function hasMergeConflicts(cwd) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return false;
  const result = await runGit(repo.root, ["status", "--porcelain"]);
  if (!result.ok) return false;
  return result.stdout.split("\n").some((line) => /^(DD|AU|UD|UA|DU|AA|UU)/.test(line.slice(0, 2)));
}
async function openDirectory(cwd) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const root = repo.root;
  const { spawn } = await import("node:child_process");
  const platform = process.platform;
  const command = platform === "win32" ? "explorer" : platform === "darwin" ? "open" : "xdg-open";
  return new Promise((resolvePromise) => {
    const child = spawn(command, [root], { detached: true, stdio: "ignore" });
    child.unref();
    child.on("error", (error) => resolvePromise({ ok: false, root, error: redact(error) }));
    child.on("exit", () => resolvePromise({ ok: true, root, error: "" }));
  });
}
async function discoverRepos(roots) {
  const { readdirSync } = await import("node:fs");
  const { join: join4 } = await import("node:path");
  const found = [];
  const seen = /* @__PURE__ */ new Set();
  const walk = (dir, depth) => {
    if (depth > 3 || found.length >= 50) return;
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true }).map((item) => item.name);
    } catch {
      return;
    }
    if (entries.includes(".git")) {
      try {
        const branchRes = runGitSync(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
        const remoteRes = runGitSync(dir, ["remote", "-v"]);
        const remotes = remoteRes.ok ? [...new Set(remoteRes.stdout.split(String.fromCharCode(10)).filter(Boolean).map((line) => line.split(String.fromCharCode(9))[0]))] : [];
        const key = dir.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          found.push({
            root: dir,
            name: dir.split(/[\/]/).filter(Boolean).pop() || dir,
            branch: branchRes.ok ? branchRes.stdout.trim() : "",
            remotes
          });
        }
      } catch {
      }
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      walk(join4(dir, entry), depth + 1);
    }
  };
  for (const root of roots) {
    if (root === "*") continue;
    walk(root, 0);
  }
  return found;
}
var MAX_TAGS = 500;
async function readTags(cwd) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", tags: [], error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const root = repo.root;
  const result = await runGit(root, [
    "for-each-ref",
    "--sort=-creatordate",
    "--count=500",
    "refs/tags",
    "--format=%(refname:short)%09%(objectname:short)%09%(creatordate:iso-local)%09%(taggername)%09%(subject)"
  ]);
  if (!result.ok) return { ok: false, root, tags: [], error: result.error };
  const tags = [];
  for (const line of result.stdout.split("\n")) {
    if (line.trim().length === 0) continue;
    const [name2, hash, date, tagger, ...rest] = line.split("	");
    if (!name2) continue;
    tags.push({
      name: name2,
      hash: hash ?? "",
      date: date ?? "",
      // 附注标签才有 tagger；轻量标签 tagger 为空，主题取提交标题。
      annotated: (tagger ?? "").length > 0,
      subject: rest.join("	")
    });
    if (tags.length >= MAX_TAGS) break;
  }
  return { ok: true, root, tags, error: "" };
}
function validTagName(name2) {
  return validBranchName(name2);
}
async function createTag(cwd, name2, ref, message) {
  const tag = String(name2 ?? "").trim();
  if (!validTagName(tag)) return { ok: false, root: "", error: `\u6807\u7B7E\u540D\u4E0D\u5408\u6CD5\uFF1A${tag || "(\u7A7A)"}` };
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const root = repo.root;
  const target = String(ref ?? "").trim() || "HEAD";
  if (target.startsWith("-") || /\s/.test(target)) {
    return { ok: false, root, error: `\u76EE\u6807\u63D0\u4EA4\u4E0D\u5408\u6CD5\uFF1A${target}` };
  }
  const text = String(message ?? "").trim();
  const args = ["tag"];
  if (text.length > 0) {
    if (text.length > 2e3) return { ok: false, root, error: "\u6807\u7B7E\u8BF4\u660E\u8FC7\u957F\uFF08\u4E0A\u9650 2000 \u5B57\u7B26\uFF09" };
    args.push("-a", tag, "-m", text, target);
  } else {
    args.push(tag, target);
  }
  const result = await runGit(root, args);
  if (!result.ok) {
    if (/already exists/i.test(result.stderr || result.stdout)) {
      return { ok: false, root, error: `\u6807\u7B7E\u5DF2\u5B58\u5728\uFF1A${tag}` };
    }
    return { ok: false, root, error: result.error };
  }
  return { ok: true, root, error: "" };
}
async function deleteTag(cwd, name2) {
  const tag = String(name2 ?? "").trim();
  if (!validTagName(tag)) return { ok: false, root: "", error: `\u6807\u7B7E\u540D\u4E0D\u5408\u6CD5\uFF1A${tag || "(\u7A7A)"}` };
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const result = await runGit(repo.root, ["tag", "-d", tag]);
  if (!result.ok) return { ok: false, root: repo.root, error: result.error };
  return { ok: true, root: repo.root, error: "" };
}
async function pushTag(cwd, remote, name2) {
  const tag = String(name2 ?? "").trim();
  if (!validTagName(tag)) return { ok: false, root: "", error: `\u6807\u7B7E\u540D\u4E0D\u5408\u6CD5\uFF1A${tag || "(\u7A7A)"}` };
  const target = String(remote ?? "").trim();
  if (!/^[\w.-]{1,80}$/.test(target)) return { ok: false, root: "", error: `\u8FDC\u7AEF\u540D\u4E0D\u5408\u6CD5\uFF1A${target || "(\u7A7A)"}` };
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const result = await runGit(repo.root, ["push", target, `refs/tags/${tag}`]);
  if (!result.ok) return { ok: false, root: repo.root, error: result.error };
  return { ok: true, root: repo.root, error: "" };
}
async function readStashes(cwd) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", stashes: [], error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const root = repo.root;
  const result = await runGit(root, ["stash", "list", "--date=iso-local", "--pretty=format:%gd%x09%gs"]);
  if (!result.ok) {
    if (/no stash entries/i.test(result.stderr || result.stdout)) {
      return { ok: true, root, stashes: [], error: "" };
    }
    return { ok: false, root, stashes: [], error: result.error };
  }
  const stashes = [];
  for (const line of result.stdout.split("\n")) {
    if (line.trim().length === 0) continue;
    const [ref, ...rest] = line.split("	");
    const match = /stash@\{(\d+)\}/.exec(ref ?? "");
    const message = rest.join("	");
    const branchMatch = /^(?:WIP on|On) ([^:]+):/.exec(message);
    stashes.push({
      index: match ? Number.parseInt(match[1], 10) : stashes.length,
      ref: ref ?? `stash@{${stashes.length}}`,
      branch: branchMatch ? branchMatch[1] : "",
      subject: message
    });
  }
  return { ok: true, root, stashes, error: "" };
}
function stashIndex(value) {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 0 || n > 999) return null;
  return Math.trunc(n);
}
async function stashSave(cwd, message, includeUntracked) {
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const root = repo.root;
  const text = String(message ?? "").trim();
  if (text.length > 500) return { ok: false, root, error: "\u8D2E\u85CF\u8BF4\u660E\u8FC7\u957F\uFF08\u4E0A\u9650 500 \u5B57\u7B26\uFF09" };
  const args = ["stash", "push"];
  if (includeUntracked) args.push("-u");
  if (text.length > 0) args.push("-m", text);
  const result = await runGit(root, args);
  if (!result.ok) return { ok: false, root, error: result.error };
  if (/No local changes to save/i.test(result.stdout)) {
    return { ok: false, root, error: "\u5F53\u524D\u6CA1\u6709\u53EF\u8D2E\u85CF\u7684\u6539\u52A8" };
  }
  return { ok: true, root, error: "" };
}
async function stashAction(cwd, action, index) {
  const n = stashIndex(index);
  if (n === null) return { ok: false, root: "", error: `\u8D2E\u85CF\u5E8F\u53F7\u4E0D\u5408\u6CD5\uFF1A${String(index)}` };
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { ok: false, root: "", error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  const root = repo.root;
  const result = await runGit(root, ["stash", action, `stash@{${n}}`]);
  if (!result.ok) {
    if (/no stash entries|is not a valid reference/i.test(result.stderr || result.stdout)) {
      return { ok: false, root, error: `\u8D2E\u85CF\u6761\u76EE\u4E0D\u5B58\u5728\uFF1Astash@{${n}}` };
    }
    if (action !== "drop" && /conflict/i.test(result.stderr || result.stdout)) {
      return { ok: false, root, error: `\u5E94\u7528\u8D2E\u85CF\u65F6\u53D1\u751F\u51B2\u7A81\uFF0C\u8BF7\u5728\u7EC8\u7AEF\u89E3\u51B3\u540E\u624B\u52A8\u5220\u9664 stash@{${n}}` };
    }
    return { ok: false, root, error: result.error };
  }
  return { ok: true, root, error: "" };
}
function runGitSync(cwd, args) {
  const { execFileSync } = __require("node:child_process");
  try {
    const stdout = execFileSync("git", ["-C", cwd, ...args], { timeout: 8e3, stdio: ["ignore", "pipe", "ignore"] });
    return { ok: true, stdout: stdout.toString(), stderr: "" };
  } catch (error) {
    const err = error;
    return { ok: false, stdout: err.stdout?.toString() ?? "", stderr: err.stderr?.toString() ?? "" };
  }
}

// src/node/files.ts
import { closeSync as closeSync2, openSync as openSync2, readSync as readSync2, realpathSync, statSync as statSync2 } from "node:fs";
import { readdir, readFile, realpath } from "node:fs/promises";
import { isAbsolute as isAbsolute2, join as join3, relative, resolve as resolve2, sep } from "node:path";
var MAX_FILE_BYTES = 512 * 1024;
var SNIFF_BYTES = 8 * 1024;
var MAX_ENTRIES = 2e3;
var MAX_IMAGE_BYTES = 4 * 1024 * 1024;
var IMAGE_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  svg: "image/svg+xml"
};
function imageMimeOf(filePath) {
  const name2 = filePath.split("/").pop() ?? filePath;
  const dot = name2.lastIndexOf(".");
  if (dot < 0) return "";
  return IMAGE_BY_EXT[name2.slice(dot + 1).toLowerCase()] ?? "";
}
var LANG_BY_EXT = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "xml",
  htm: "xml",
  xml: "xml",
  svg: "xml",
  vue: "xml",
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  swift: "swift",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  sql: "sql",
  diff: "diff",
  patch: "diff",
  lua: "lua",
  r: "r",
  dart: "dart",
  scala: "scala",
  pl: "perl",
  ex: "elixir",
  exs: "elixir"
};
function langOf(filePath) {
  const name2 = filePath.split("/").pop() ?? filePath;
  const lower = name2.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile") return "makefile";
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return "";
  return LANG_BY_EXT[lower.slice(dot + 1)] ?? "";
}
function normalizeRel(input) {
  if (typeof input !== "string") return "";
  const raw = input.replace(/\\/g, "/").trim();
  if (raw.length === 0) return "";
  if (raw.length > 1024) return null;
  if (raw.startsWith("/") || /^[A-Za-z]:/.test(raw)) return null;
  if (raw.includes("\0")) return null;
  const parts = [];
  for (const segment of raw.split("/")) {
    if (segment.length === 0 || segment === ".") continue;
    if (segment === "..") return null;
    if (segment.toLowerCase() === ".git") return null;
    parts.push(segment);
  }
  return parts.join("/");
}
async function realRoot(root) {
  try {
    const real = await realpath(root);
    const info = statSync2(real);
    return info.isDirectory() ? real : null;
  } catch {
    return null;
  }
}
async function resolveInside(root, rel) {
  const base = await realRoot(root);
  if (!base) return null;
  const target = rel.length === 0 ? base : resolve2(base, rel);
  let real;
  try {
    real = await realpath(target);
  } catch {
    return null;
  }
  const relFromBase = relative(base, real);
  if (relFromBase.length === 0) return real;
  if (relFromBase.startsWith("..") || isAbsolute2(relFromBase)) return null;
  return real;
}
function toPosix(p) {
  return p.split(sep).join("/");
}
async function listDir(root, relPath) {
  const rel = normalizeRel(relPath);
  if (rel === null) {
    return { ok: false, root, path: "", entries: [], truncated: false, error: `\u8DEF\u5F84\u4E0D\u5408\u6CD5\uFF1A${String(relPath)}` };
  }
  const dir = await resolveInside(root, rel);
  if (!dir) {
    return { ok: false, root, path: rel, entries: [], truncated: false, error: `\u76EE\u5F55\u4E0D\u53EF\u8BBF\u95EE\u6216\u4E0D\u5728\u6388\u6743\u8303\u56F4\u5185\uFF1A${rel || "."}` };
  }
  let raw = [];
  try {
    const items = await readdir(dir, { withFileTypes: true });
    raw = items.map((item) => ({
      name: item.name,
      isDir: item.isDirectory(),
      isFile: item.isFile(),
      isLink: item.isSymbolicLink()
    }));
  } catch (error) {
    return { ok: false, root, path: rel, entries: [], truncated: false, error: redact(error) };
  }
  const entries = [];
  let truncated = false;
  raw.sort((a, b) => {
    const aDir = a.isDir || a.isLink && !a.isFile;
    const bDir = b.isDir || b.isLink && !b.isFile;
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.name.localeCompare(b.name, "en");
  });
  for (const item of raw) {
    if (item.name.toLowerCase() === ".git") continue;
    if (entries.length >= MAX_ENTRIES) {
      truncated = true;
      break;
    }
    const childRel = rel.length === 0 ? item.name : `${rel}/${item.name}`;
    let kind = item.isDir ? "dir" : "file";
    let size = 0;
    try {
      const info = statSync2(join3(dir, item.name));
      kind = info.isDirectory() ? "dir" : "file";
      size = info.isDirectory() ? 0 : info.size;
    } catch {
    }
    entries.push({
      name: item.name,
      path: toPosix(childRel),
      kind,
      size,
      lang: kind === "file" ? langOf(item.name) : ""
    });
  }
  return { ok: true, root, path: rel, entries, truncated, error: "" };
}
async function readTextFile(root, relPath) {
  const rel = normalizeRel(relPath);
  const empty = { ok: false, root, path: "", content: "", size: 0, truncated: false, binary: false, lang: "", error: "" };
  if (rel === null || rel.length === 0) {
    return { ...empty, error: `\u8DEF\u5F84\u4E0D\u5408\u6CD5\uFF1A${String(relPath)}` };
  }
  const file = await resolveInside(root, rel);
  if (!file) {
    return { ...empty, path: rel, error: `\u6587\u4EF6\u4E0D\u53EF\u8BBF\u95EE\u6216\u4E0D\u5728\u6388\u6743\u8303\u56F4\u5185\uFF1A${rel}` };
  }
  let size = 0;
  try {
    const info = statSync2(file);
    if (!info.isFile()) return { ...empty, path: rel, error: `\u4E0D\u662F\u6587\u4EF6\uFF1A${rel}` };
    size = info.size;
  } catch (error) {
    return { ...empty, path: rel, error: redact(error) };
  }
  const lang = langOf(rel);
  try {
    const fd = openSync2(file, "r");
    const buffer = Buffer.alloc(Math.min(SNIFF_BYTES, size));
    try {
      readSync2(fd, buffer, 0, buffer.length, 0);
    } finally {
      closeSync2(fd);
    }
    if (buffer.includes(0)) {
      return { ok: true, root, path: rel, content: "", size, truncated: false, binary: true, lang, error: "" };
    }
  } catch (error) {
    return { ...empty, path: rel, error: redact(error) };
  }
  const truncated = size > MAX_FILE_BYTES;
  try {
    const buffer = await readFile(file);
    const slice = truncated ? buffer.subarray(0, MAX_FILE_BYTES) : buffer;
    const content = slice.toString("utf8").replace(/\uFFFD/g, "");
    return { ok: true, root, path: rel, content, size, truncated, binary: false, lang, error: "" };
  } catch (error) {
    return { ...empty, path: rel, error: redact(error) };
  }
}
async function readImageFile(root, relPath) {
  const rel = normalizeRel(relPath);
  const empty = { ok: false, root, path: "", size: 0, mime: "", dataUrl: "", truncated: false, error: "" };
  if (rel === null || rel.length === 0) {
    return { ...empty, error: `\u8DEF\u5F84\u4E0D\u5408\u6CD5\uFF1A${String(relPath)}` };
  }
  const mime = imageMimeOf(rel);
  if (mime === "") {
    return { ...empty, path: rel, error: `\u4E0D\u662F\u53EF\u9884\u89C8\u7684\u56FE\u7247\uFF1A${rel}` };
  }
  const file = await resolveInside(root, rel);
  if (!file) {
    return { ...empty, path: rel, mime, error: `\u6587\u4EF6\u4E0D\u53EF\u8BBF\u95EE\u6216\u4E0D\u5728\u6388\u6743\u8303\u56F4\u5185\uFF1A${rel}` };
  }
  let size = 0;
  try {
    const info = statSync2(file);
    if (!info.isFile()) return { ...empty, path: rel, mime, error: `\u4E0D\u662F\u6587\u4EF6\uFF1A${rel}` };
    size = info.size;
  } catch (error) {
    return { ...empty, path: rel, mime, error: redact(error) };
  }
  if (size > MAX_IMAGE_BYTES) {
    return { ok: true, root, path: rel, size, mime, dataUrl: "", truncated: true, error: "" };
  }
  try {
    const buffer = await readFile(file);
    return { ok: true, root, path: rel, size, mime, dataUrl: `data:${mime};base64,${buffer.toString("base64")}`, truncated: false, error: "" };
  } catch (error) {
    return { ...empty, path: rel, mime, error: redact(error) };
  }
}

// src/node/suggest.ts
var MAX_PROMPT_DIFF = 6e3;
var STYLE_SAMPLES = 8;
var MAX_TOKENS = 200;
function parsePinnedRoute(raw) {
  const text = raw.trim();
  const at = text.indexOf("/");
  if (at <= 0 || at === text.length - 1) return null;
  const provider = text.slice(0, at).trim();
  const model = text.slice(at + 1).trim();
  if (provider.length === 0 || model.length === 0) return null;
  return { provider, model };
}
function cleanMessage(raw) {
  let text = raw.trim();
  text = text.replace(/^```[a-zA-Z]*\s*/u, "").replace(/```$/u, "").trim();
  text = text.replace(/^(提交信息|commit message|message)\s*[:：]\s*/iu, "");
  const firstLine2 = text.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? "";
  return firstLine2.replace(/^["'「『]|["'」』]$/gu, "").trim();
}
async function suggestCommitMessage(deps, cwd, hint, pinned = "") {
  const none = (error) => ({
    ok: false,
    message: "",
    error,
    source: "none",
    provider: "",
    model: ""
  });
  const llm = deps.llm;
  if (!llm || typeof llm.prepareCall !== "function") {
    return none("\u5F53\u524D DSH \u672A\u63D0\u4F9B\u6A21\u578B\u670D\u52A1\uFF0C\u65E0\u6CD5\u751F\u6210\u63D0\u4EA4\u4FE1\u606F");
  }
  let route = parsePinnedRoute(pinned);
  try {
    if (route) {
    } else {
      const selection = deps.defaultModel?.currentSelection?.();
      if (selection && typeof selection.provider === "string" && typeof selection.model === "string" && selection.provider.length > 0 && selection.model.length > 0) {
        route = { provider: selection.provider, model: selection.model };
      }
    }
  } catch {
    route = null;
  }
  if (!route) return none("\u672A\u8BFB\u53D6\u5230\u53EF\u7528\u7684\u6A21\u578B\uFF0C\u8BF7\u5728 DSH \u91CC\u9009\u62E9\u6A21\u578B\u6216\u5728\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u56FA\u5B9A\u4E00\u4E2A\u6A21\u578B");
  const staged = await readDiff(cwd, "staged", "", "");
  if (!staged.ok) return none(staged.error || "\u8BFB\u53D6\u6682\u5B58\u533A\u5931\u8D25");
  let diff = staged.diff;
  if (diff.trim().length === 0) {
    const worktree = await readDiff(cwd, "worktree", "", "");
    if (worktree.ok) diff = worktree.diff;
  }
  if (diff.trim().length === 0) return none("\u5F53\u524D\u6CA1\u6709\u53EF\u63CF\u8FF0\u7684\u6539\u52A8");
  const recent = await readCommits(cwd, STYLE_SAMPLES, 0);
  const samples = recent.ok ? recent.commits.map((commit) => `- ${commit.subject}`).filter((line) => line.length > 3) : [];
  const clipped = diff.length > MAX_PROMPT_DIFF ? `${diff.slice(0, MAX_PROMPT_DIFF)}
\u2026\uFF08diff \u5DF2\u622A\u65AD\uFF09` : diff;
  const prompt = [
    "\u6839\u636E\u4E0B\u9762\u7684 git \u6539\u52A8\uFF0C\u5199\u4E00\u6761\u63D0\u4EA4\u4FE1\u606F\u3002",
    "",
    "\u8981\u6C42\uFF1A",
    "1. \u53EA\u8F93\u51FA\u63D0\u4EA4\u4FE1\u606F\u672C\u8EAB\uFF0C\u4E00\u884C\uFF0C\u4E0D\u8981\u89E3\u91CA\u3001\u4E0D\u8981\u5F15\u53F7\u3001\u4E0D\u8981\u4EE3\u7801\u5757\uFF1B",
    "2. \u4E2D\u6587\uFF0C\u52A8\u5BBE\u7ED3\u6784\uFF0C\u8BF4\u660E\u300C\u505A\u4E86\u4EC0\u4E48\u300D\u800C\u4E0D\u662F\u300C\u6539\u4E86\u54EA\u4E9B\u6587\u4EF6\u300D\uFF1B",
    "3. \u4E0D\u8D85\u8FC7 60 \u4E2A\u5B57\uFF0C\u7ED3\u5C3E\u4E0D\u52A0\u53E5\u53F7\uFF1B",
    samples.length > 0 ? "4. \u8BED\u6C14\u4E0E\u4E0B\u9762\u8FD9\u4E9B\u65E2\u6709\u63D0\u4EA4\u4FDD\u6301\u4E00\u81F4\uFF1A" : "",
    ...samples.length > 0 ? ["", "\u65E2\u6709\u63D0\u4EA4\u98CE\u683C\uFF1A", ...samples] : [],
    hint.trim().length > 0 ? `
\u8865\u5145\u8BF4\u660E\uFF08\u4F18\u5148\u91C7\u7EB3\uFF09\uFF1A${hint.trim()}` : "",
    "",
    "\u6539\u52A8\u5185\u5BB9\uFF1A",
    clipped
  ].filter((line) => line !== "").join("\n");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45e3);
  try {
    const call = await llm.prepareCall(
      { provider: route.provider, model: route.model, maxTokens: MAX_TOKENS },
      controller.signal,
      (controls) => ({ ...controls })
    );
    const options = {
      ...call.config,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      purpose: "dsh-git-panel:commit-message",
      signal: controller.signal
    };
    let text = "";
    for await (const chunk of call.stream(options)) {
      const item = chunk;
      if (item?.type === "text-delta" && typeof item.text === "string") text += item.text;
      else if (item?.type === "block-end" && item.block?.type === "text" && typeof item.block.text === "string") {
        if (text.length === 0) text = item.block.text;
      }
    }
    const message = cleanMessage(text);
    if (message.length === 0) return none("\u6A21\u578B\u6CA1\u6709\u8FD4\u56DE\u53EF\u7528\u7684\u63D0\u4EA4\u4FE1\u606F");
    return {
      ok: true,
      message,
      error: "",
      source: "model",
      provider: route.provider,
      model: route.model
    };
  } catch (error) {
    const detail = error?.message ?? String(error);
    deps.log?.("warn", `\u751F\u6210\u63D0\u4EA4\u4FE1\u606F\u5931\u8D25\uFF1A${detail}`);
    const aborted = controller.signal.aborted;
    return none(aborted ? "\u751F\u6210\u8D85\u65F6\uFF0845 \u79D2\uFF09\uFF0C\u8BF7\u91CD\u8BD5" : `\u751F\u6210\u5931\u8D25\uFF1A${detail}`);
  } finally {
    clearTimeout(timer);
  }
}
async function listModelCatalog(llm) {
  if (!llm || typeof llm.listProviders !== "function" || typeof llm.listModels !== "function") {
    return { ok: false, error: "\u5F53\u524D DSH \u672A\u63D0\u4F9B\u6A21\u578B\u76EE\u5F55", models: [] };
  }
  const out = [];
  let providers = [];
  try {
    providers = llm.listProviders();
  } catch {
    return { ok: false, error: "\u8BFB\u53D6\u6A21\u578B\u4F9B\u5E94\u5546\u5931\u8D25", models: [] };
  }
  for (const provider of providers) {
    if (!provider || typeof provider.id !== "string" || provider.id.length === 0) continue;
    try {
      const models = await llm.listModels(provider.id);
      for (const model of models) {
        if (!model || typeof model.id !== "string" || model.id.length === 0) continue;
        out.push({
          provider: provider.id,
          id: model.id,
          name: typeof model.name === "string" && model.name.length > 0 ? model.name : model.id,
          value: `${provider.id}/${model.id}`
        });
      }
    } catch {
    }
  }
  return { ok: true, error: "", models: out };
}

// src/node/providers.ts
var PROVIDERS = {
  github: {
    id: "github",
    label: "GitHub",
    host: "github.com",
    apiBase: "https://api.github.com",
    oauthHint: "\u8BBE\u5907\u7801\u6D41\u7A0B\uFF1A\u70B9\u300C\u8FDE\u63A5\u300D\u540E\u6D4F\u89C8\u5668\u6253\u5F00\u4E00\u6B21\u6388\u6743\u9875\u3001\u8F93\u5165 8 \u4F4D\u4EE3\u7801\u5373\u53EF\uFF0C\u65E0\u9700\u590D\u5236\u4EE4\u724C\u3002\u9002\u5408\u672C\u673A\u4EA4\u4E92\u5F0F\u4F7F\u7528\u3002",
    patHint: "\u4E2A\u4EBA\u8BBF\u95EE\u4EE4\u724C\uFF08Fine-grained / classic\uFF09\uFF1A\u9002\u5408 CI\u3001\u65E0\u4EBA\u503C\u5B88\u3001\u6216\u65E0\u6CD5\u6253\u5F00\u6D4F\u89C8\u5668\u65F6\uFF1B\u53EF\u7CBE\u786E\u9650\u5236\u5230\u5355\u4E2A\u4ED3\u5E93\u4E0E\u53EA\u8BFB\u6743\u9650\u3002",
    patUrl: "https://github.com/settings/tokens"
  },
  gitlab: {
    id: "gitlab",
    label: "GitLab",
    host: "gitlab.com",
    apiBase: "https://gitlab.com",
    oauthHint: "\u8BBE\u5907\u7801\u6D41\u7A0B\uFF1A\u9700\u8981\u5148\u5728 GitLab \u5E94\u7528\u8BBE\u7F6E\u91CC\u5F00\u542F device flow\uFF1B\u5F00\u542F\u540E\u4E0E GitHub \u4F53\u9A8C\u4E00\u81F4\u3002",
    patHint: "\u4E2A\u4EBA\u8BBF\u95EE\u4EE4\u724C\uFF08read_api / read_repository\uFF09\uFF1A\u9002\u5408\u81EA\u5EFA\u5B9E\u4F8B\u4E0E\u65E0\u4EBA\u503C\u5B88\u573A\u666F\uFF0C\u6743\u9650\u53EF\u6309 scope \u6536\u7D27\u3002",
    patUrl: "https://gitlab.com/-/user_settings/personal_access_tokens"
  },
  gitea: {
    id: "gitea",
    label: "Gitea / \u81EA\u5EFA",
    host: "",
    apiBase: "",
    oauthHint: "\u81EA\u5EFA\u5B9E\u4F8B\u901A\u5E38\u672A\u5F00\u542F\u8BBE\u5907\u7801\u6D41\u7A0B\uFF0C\u5EFA\u8BAE\u4F7F\u7528\u8BBF\u95EE\u4EE4\u724C\u63A5\u5165\u3002",
    patHint: "\u8BBF\u95EE\u4EE4\u724C\uFF1A\u5728\u5B9E\u4F8B\u7684\u300C\u8BBE\u7F6E \u2192 \u5E94\u7528 \u2192 \u751F\u6210\u4EE4\u724C\u300D\u521B\u5EFA\uFF0C\u5EFA\u8BAE\u53EA\u52FE\u9009 read:repository\u3002",
    patUrl: ""
  }
};
function providerOf(value) {
  return value === "gitlab" || value === "gitea" ? value : "github";
}
function resolveApiBase(provider, apiBase, host) {
  const explicit = (apiBase ?? "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  const meta = PROVIDERS[provider];
  if (meta.apiBase) return meta.apiBase.replace(/\/+$/, "");
  const bare = (host ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!bare) return "";
  return provider === "gitlab" ? `https://${bare}` : `https://${bare}/api/v1`;
}
var TIMEOUT_MS2 = 2e4;
async function request(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS2);
  const headers = {
    accept: "application/json",
    "user-agent": "dsh-git-panel/0.1.0",
    ...init.headers
  };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  try {
    const response = await fetch(url, { ...init, headers, signal: controller.signal });
    const text = await response.text();
    let json = null;
    try {
      json = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      json,
      text,
      headers: response.headers,
      error: response.ok ? "" : describeHttpError(response.status, json, text)
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: 0,
      json: null,
      text: "",
      headers: null,
      error: aborted ? `\u8BF7\u6C42\u8D85\u65F6\uFF08${TIMEOUT_MS2 / 1e3}s\uFF09` : `\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25\uFF1A${redact(error)}`
    };
  } finally {
    clearTimeout(timer);
  }
}
function describeHttpError(status, json, text) {
  const message = json && typeof json.message === "string" && json.message || json && typeof json.error === "string" && json.error || json && typeof json.error_description === "string" && json.error_description || (text || "").slice(0, 200);
  if (status === 401) return `\u4EE4\u724C\u65E0\u6548\u6216\u5DF2\u5931\u6548\uFF08401\uFF09${message ? "\uFF1A" + message : ""}`;
  if (status === 403) return `\u6743\u9650\u4E0D\u8DB3\u6216\u89E6\u53D1\u9650\u6D41\uFF08403\uFF09${message ? "\uFF1A" + message : ""}`;
  if (status === 404) return `\u4ED3\u5E93\u6216\u8D44\u6E90\u4E0D\u5B58\u5728\uFF0C\u6216\u4EE4\u724C\u65E0\u6743\u8BBF\u95EE\uFF08404\uFF09${message ? "\uFF1A" + message : ""}`;
  if (status === 429) return `\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF08429\uFF09\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5`;
  return `\u8BF7\u6C42\u5931\u8D25\uFF08${status}\uFF09${message ? "\uFF1A" + message : ""}`;
}
function parseScopes(headers) {
  if (!headers) return [];
  const raw = headers.get("x-oauth-scopes") ?? headers.get("x-gitlab-scopes") ?? "";
  if (!raw) return [];
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}
async function verifyToken(provider, token, apiBase, host) {
  if (typeof token !== "string" || token.trim().length === 0) return { ok: false, error: "\u4EE4\u724C\u4E3A\u7A7A" };
  const base = resolveApiBase(provider, apiBase, host);
  if (!base) return { ok: false, error: "\u8BE5\u5E73\u53F0\u9700\u8981\u586B\u5199 API \u5730\u5740\uFF08\u4F8B\u5982 https://git.example.com/api/v1\uFF09" };
  if (provider === "gitlab") {
    const result2 = await request(`${base}/api/v4/user`, { token });
    if (!result2.ok) return { ok: false, error: result2.error };
    const user2 = result2.json ?? {};
    return {
      ok: true,
      identity: {
        login: String(user2.username ?? ""),
        displayName: String(user2.name ?? user2.username ?? ""),
        avatarUrl: String(user2.avatar_url ?? ""),
        scopes: parseScopes(result2.headers)
      }
    };
  }
  const url = provider === "gitea" ? `${base}/user` : `${base}/user`;
  const result = await request(url, { token });
  if (!result.ok) return { ok: false, error: result.error };
  const user = result.json ?? {};
  return {
    ok: true,
    identity: {
      login: String(user.login ?? user.username ?? ""),
      displayName: String(user.name ?? user.full_name ?? user.login ?? ""),
      avatarUrl: String(user.avatar_url ?? ""),
      scopes: parseScopes(result.headers)
    }
  };
}
async function startDeviceFlow(provider, clientId, scope, apiBase, host) {
  if (!clientId || clientId.trim().length === 0) {
    return { ok: false, error: "\u8BF7\u5148\u5728\u8BBE\u7F6E\u91CC\u586B\u5199\u8BE5\u5E73\u53F0\u7684 OAuth App Client ID\uFF08OAuth \u9700\u8981\u4F60\u81EA\u5DF1\u7684\u5E94\u7528\u51ED\u636E\uFF09" };
  }
  const base = resolveApiBase(provider, apiBase, host);
  if (!base) return { ok: false, error: "\u8BE5\u5E73\u53F0\u9700\u8981\u586B\u5199 API \u5730\u5740\uFF08\u4F8B\u5982 https://git.example.com/api/v1\uFF09" };
  const endpoint = provider === "gitlab" ? `${base}/oauth/authorize_device` : `${base}/login/device/code`;
  const body = provider === "gitlab" ? new URLSearchParams({ client_id: clientId, scope }) : new URLSearchParams({ client_id: clientId, scope });
  const result = await request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  if (!result.ok) {
    const hint = provider === "gitlab" ? "\uFF08GitLab \u8BBE\u5907\u7801\u6D41\u7A0B\u9700\u5B9E\u4F8B\u5F00\u542F\uFF1B\u672A\u5F00\u542F\u65F6\u8BF7\u6539\u7528\u8BBF\u95EE\u4EE4\u724C\uFF09" : "";
    return { ok: false, error: result.error + hint };
  }
  const json = result.json ?? {};
  const deviceCode = String(json.device_code ?? "");
  const userCode = String(json.user_code ?? json.user_code ?? "");
  if (!deviceCode) return { ok: false, error: "\u6388\u6743\u670D\u52A1\u672A\u8FD4\u56DE device_code\uFF0C\u53EF\u80FD\u662F\u8BE5\u5B9E\u4F8B\u4E0D\u652F\u6301\u8BBE\u5907\u7801\u6D41\u7A0B" };
  return {
    ok: true,
    flow: {
      deviceCode,
      userCode,
      verificationUri: String(json.verification_uri ?? json.verification_uri_complete ?? ""),
      expiresIn: Number(json.expires_in) || 900,
      interval: Number(json.interval) || 5
    }
  };
}
async function pollDeviceFlow(provider, clientId, deviceCode, apiBase, host) {
  const base = resolveApiBase(provider, apiBase, host);
  if (!base) return { status: "error", error: "\u8BE5\u5E73\u53F0\u9700\u8981\u586B\u5199 API \u5730\u5740\uFF08\u4F8B\u5982 https://git.example.com/api/v1\uFF09" };
  const endpoint = provider === "gitlab" ? `${base}/oauth/token` : `${base}/login/oauth/access_token`;
  const body = new URLSearchParams({
    client_id: clientId,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code"
  });
  const result = await request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const json = result.json ?? {};
  const error = String(json.error ?? "");
  if (error === "authorization_pending") return { status: "pending" };
  if (error === "slow_down") return { status: "slow_down", retryAfter: Number(json.interval) || 10 };
  if (error === "expired_token") return { status: "expired", error: "\u8BBE\u5907\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77\u6388\u6743" };
  if (error === "access_denied") return { status: "denied", error: "\u6388\u6743\u88AB\u62D2\u7EDD" };
  if (!result.ok || error) {
    return { status: "error", error: result.error || `\u6388\u6743\u5931\u8D25\uFF1A${error || "\u672A\u77E5\u9519\u8BEF"}` };
  }
  const token = String(json.access_token ?? "");
  if (!token) return { status: "error", error: "\u6388\u6743\u670D\u52A1\u672A\u8FD4\u56DE access_token" };
  const scope = String(json.scope ?? "");
  return {
    status: "authorized",
    token,
    scopes: scope ? scope.split(/[,\s]+/).filter(Boolean) : []
  };
}
async function fetchRepo2(provider, token, fullName, apiBase, host) {
  const base = resolveApiBase(provider, apiBase, host);
  if (!base) return { ok: false, error: "\u8BE5\u5E73\u53F0\u9700\u8981\u586B\u5199 API \u5730\u5740\uFF08\u4F8B\u5982 https://git.example.com/api/v1\uFF09" };
  const [owner, name2] = fullName.split("/");
  if (!owner || !name2) return { ok: false, error: `\u4ED3\u5E93\u540D\u4E0D\u5408\u6CD5\uFF1A${fullName}` };
  const url = provider === "gitlab" ? `${base}/api/v4/projects/${encodeURIComponent(fullName)}` : `${base}/repos/${owner}/${name2}`;
  const result = await request(url, { token });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, repo: result.json };
}
var REPO_PAGE_SIZE = 100;
var REPO_MAX_PAGES = 5;
function accountReposEndpoint(provider, base, page = 1) {
  const root = String(base ?? "").replace(/\/+$/, "");
  const p = Math.max(1, Math.floor(page) || 1);
  if (provider === "gitlab") {
    return `${root}/api/v4/projects?membership=true&per_page=${REPO_PAGE_SIZE}&page=${p}`;
  }
  if (provider === "gitea") {
    return `${root}/user/repos?limit=${REPO_PAGE_SIZE}&page=${p}`;
  }
  return `${root}/user/repos?per_page=${REPO_PAGE_SIZE}&page=${p}&affiliation=owner,collaborator,organization_member`;
}
function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return "";
}
function mapAccountRepo(provider, raw) {
  if (!raw || typeof raw !== "object") return null;
  if (provider === "gitlab") {
    const path = pickString(raw.path_with_namespace);
    if (!path) return null;
    const segments2 = path.split("/");
    const name2 = pickString(raw.name) || segments2[segments2.length - 1] || "";
    const owner = segments2.slice(0, -1).join("/");
    return {
      fullName: path,
      name: name2,
      owner,
      url: pickString(raw.http_url_to_repo, raw.ssh_url_to_repo, raw.web_url),
      private: raw.visibility === "private",
      defaultBranch: pickString(raw.default_branch) || "main"
    };
  }
  const fullName = pickString(raw.full_name);
  if (!fullName) return null;
  const segments = fullName.split("/");
  return {
    fullName,
    name: pickString(raw.name) || segments[segments.length - 1] || "",
    owner: pickString(raw.owner?.login, raw.owner?.username, raw.namespace?.login) || segments.slice(0, -1).join("/"),
    url: pickString(raw.clone_url, raw.http_url_to_repo, raw.ssh_url, raw.web_url),
    private: raw.private === true || raw.visibility === "private",
    defaultBranch: pickString(raw.default_branch) || "main"
  };
}
function createRepoEndpoint(provider, base, owner) {
  const root = String(base ?? "").replace(/\/+$/, "");
  const scope = String(owner ?? "").trim();
  if (provider === "gitlab") {
    return `${root}/api/v4/projects`;
  }
  if (provider === "gitea") {
    return scope ? `${root}/orgs/${encodeURIComponent(scope)}/repos` : `${root}/user/repos`;
  }
  return scope ? `${root}/orgs/${encodeURIComponent(scope)}/repos` : `${root}/user/repos`;
}
var REPO_NAME_RE = /^[\w.-]{1,100}$/;
async function createAccountRepo(provider, token, options, apiBase, host) {
  if (typeof token !== "string" || token.trim().length === 0) {
    return { ok: false, error: "\u4EE4\u724C\u4E3A\u7A7A" };
  }
  const name2 = String(options?.name ?? "").trim();
  if (!name2) return { ok: false, error: "\u8BF7\u586B\u5199\u4ED3\u5E93\u540D" };
  if (!REPO_NAME_RE.test(name2)) {
    return { ok: false, error: `\u4ED3\u5E93\u540D\u4E0D\u5408\u6CD5\uFF1A${name2}\uFF08\u53EA\u80FD\u7528\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u3001\u70B9\u3001\u8FDE\u5B57\u7B26\uFF09` };
  }
  const base = resolveApiBase(provider, apiBase, host);
  if (!base) return { ok: false, error: "\u8BE5\u5E73\u53F0\u9700\u8981\u586B\u5199 API \u5730\u5740\uFF08\u4F8B\u5982 https://git.example.com/api/v1\uFF09" };
  const description = String(options?.description ?? "").trim();
  const isPrivate = options?.private === true;
  const payload = provider === "gitlab" ? { name: name2, path: name2, visibility: isPrivate ? "private" : "public", description } : { name: name2, private: isPrivate, description, auto_init: false };
  const result = await request(createRepoEndpoint(provider, base, options?.owner), {
    method: "POST",
    token,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!result.ok) {
    if (result.status === 401) return { ok: false, error: "\u4EE4\u724C\u65E0\u6548\u6216\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u6388\u6743" };
    if (result.status === 403) {
      return {
        ok: false,
        error: provider === "gitlab" ? "\u4EE4\u724C\u7F3A\u5C11\u521B\u5EFA\u4ED3\u5E93\u7684\u6743\u9650\uFF08\u9700\u8981 api \u8303\u56F4\uFF09" : provider === "gitea" ? "\u4EE4\u724C\u7F3A\u5C11\u521B\u5EFA\u4ED3\u5E93\u7684\u6743\u9650\uFF08\u9700\u8981 write:repository\uFF09" : "\u4EE4\u724C\u7F3A\u5C11\u521B\u5EFA\u4ED3\u5E93\u7684\u6743\u9650\uFF08\u9700\u8981 repo \u8303\u56F4\uFF09"
      };
    }
    if (result.status === 422 || result.status === 400) {
      return { ok: false, error: `\u521B\u5EFA\u5931\u8D25\uFF1A${result.error || "\u4ED3\u5E93\u5DF2\u5B58\u5728\u6216\u540D\u79F0\u4E0D\u5408\u6CD5"}` };
    }
    return { ok: false, error: result.error || "\u521B\u5EFA\u8FDC\u7A0B\u4ED3\u5E93\u5931\u8D25" };
  }
  const mapped = mapAccountRepo(provider, result.json);
  if (!mapped) return { ok: false, error: "\u4ED3\u5E93\u5DF2\u521B\u5EFA\uFF0C\u4F46\u5E73\u53F0\u8FD4\u56DE\u7684\u6570\u636E\u65E0\u6CD5\u89E3\u6790\uFF08\u8BF7\u5237\u65B0\u4ED3\u5E93\u5217\u8868\u786E\u8BA4\uFF09" };
  return { ok: true, repo: mapped };
}
async function listAccountRepos(provider, token, apiBase, host) {
  if (typeof token !== "string" || token.trim().length === 0) {
    return { ok: false, repos: [], error: "\u4EE4\u724C\u4E3A\u7A7A" };
  }
  const base = resolveApiBase(provider, apiBase, host);
  if (!base) return { ok: false, repos: [], error: "\u8BE5\u5E73\u53F0\u9700\u8981\u586B\u5199 API \u5730\u5740\uFF08\u4F8B\u5982 https://git.example.com/api/v1\uFF09" };
  const repos = [];
  const seen = /* @__PURE__ */ new Set();
  let truncated = false;
  for (let page = 1; page <= REPO_MAX_PAGES; page += 1) {
    const result = await request(accountReposEndpoint(provider, base, page), { token });
    if (!result.ok) {
      if (page === 1) return { ok: false, repos: [], error: result.error || "\u8BFB\u53D6\u4ED3\u5E93\u5217\u8868\u5931\u8D25" };
      truncated = true;
      break;
    }
    const list = Array.isArray(result.json) ? result.json : [];
    for (const item of list) {
      const mapped = mapAccountRepo(provider, item);
      if (!mapped) continue;
      if (seen.has(mapped.fullName)) continue;
      seen.add(mapped.fullName);
      repos.push(mapped);
    }
    if (list.length < REPO_PAGE_SIZE) {
      truncated = false;
      break;
    }
    if (page === REPO_MAX_PAGES) truncated = true;
  }
  return { ok: true, repos, truncated };
}

// src/node/handler.ts
var ROUTE_PREFIX = "/dsh-git-panel";
var MAX_BODY_BYTES = 256 * 1024;
function sendJson(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body), "utf8");
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("content-length", String(payload.length));
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  res.end(payload);
}
function isSameOrigin(req) {
  const site = req.headers["sec-fetch-site"];
  if (typeof site === "string" && site.toLowerCase() === "cross-site") return false;
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (typeof origin === "string" && origin.length > 0) {
    if (typeof host !== "string" || host.length === 0) return false;
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return true;
}
function readBody(req) {
  return new Promise((resolve3) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        resolve3({ ok: false, error: `\u8BF7\u6C42\u4F53\u8D85\u8FC7\u4E0A\u9650\uFF08${MAX_BODY_BYTES} \u5B57\u8282\uFF09` });
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (text.length === 0) {
        resolve3({ ok: true, body: {} });
        return;
      }
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          resolve3({ ok: false, error: "\u8BF7\u6C42\u4F53\u5FC5\u987B\u662F JSON \u5BF9\u8C61" });
          return;
        }
        resolve3({ ok: true, body: parsed });
      } catch {
        resolve3({ ok: false, error: "\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON" });
      }
    });
    req.on("error", () => resolve3({ ok: false, error: "\u8BFB\u53D6\u8BF7\u6C42\u4F53\u5931\u8D25" }));
  });
}
function str(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function createHandler(deps) {
  const startedAt = deps.startedAt ?? Date.now();
  return async function handler(req, res) {
    const method = (req.method ?? "GET").toUpperCase();
    const url = new URL(req.url ?? "/", "http://dsh.internal");
    const path = url.pathname.startsWith(ROUTE_PREFIX) ? url.pathname.slice(ROUTE_PREFIX.length) || "/" : url.pathname;
    try {
      if (path === "/health") {
        sendJson(res, 200, {
          status: "ok",
          plugin: "dsh-git-panel",
          version: deps.version,
          uptime: Math.round((Date.now() - startedAt) / 1e3),
          accounts: deps.store.accounts().length
        });
        return;
      }
      if (method === "GET" && path === "/state") {
        sendJson(res, 200, { ok: true, state: deps.store.snapshot(), providers: Object.values(PROVIDERS) });
        return;
      }
      if (method === "GET" && path === "/providers") {
        sendJson(res, 200, { ok: true, providers: Object.values(PROVIDERS) });
        return;
      }
      if (method === "GET" && path === "/account/repos") {
        const accountId = str(url.searchParams.get("accountId")).trim();
        const account = accountId ? deps.store.getAccount(accountId) : deps.store.activeAccount();
        if (!account) {
          sendJson(res, 200, {
            ok: false,
            error: accountId ? "\u8D26\u53F7\u4E0D\u5B58\u5728" : "\u5C1A\u672A\u8FDE\u63A5 Git \u8D26\u53F7\uFF0C\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u8FDE\u63A5\u8D26\u53F7",
            repos: []
          });
          return;
        }
        const token = deps.store.revealSecret(account.id);
        if (!token) {
          deps.store.markAccount(account.id, { status: "error", lastError: "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6" });
          sendJson(res, 200, { ok: false, error: "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6\uFF0C\u8BF7\u91CD\u65B0\u6388\u6743", repos: [] });
          return;
        }
        const result = await listAccountRepos(
          providerOf(account.provider),
          token,
          account.apiBase || void 0,
          account.host
        );
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error ?? "\u8BFB\u53D6\u4ED3\u5E93\u5217\u8868\u5931\u8D25", repos: [] });
          return;
        }
        const repos = result.repos.map((repo) => ({
          ...repo,
          permission: deps.store.repoPermission(account.id, repo.fullName)
        }));
        sendJson(res, 200, { ok: true, repos, truncated: result.truncated === true });
        return;
      }
      if (method === "GET" && path === "/repo/status") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        if (!cwd) {
          sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 cwd \u53C2\u6570", status: null });
          return;
        }
        const status = await readRepoStatus(cwd);
        if (status.isRepo && !deps.store.isRootAllowed(cwd)) {
          sendJson(res, 200, {
            ok: true,
            status: {
              isRepo: true,
              root: status.root,
              branch: status.branch,
              detached: status.detached,
              head: status.head,
              ahead: 0,
              behind: 0,
              changed: status.changed,
              authorized: false,
              error: ""
            }
          });
          return;
        }
        sendJson(res, 200, { ok: true, status: { ...status, authorized: true } });
        return;
      }
      if (method === "GET" && path === "/repo/graph") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        if (!cwd) {
          sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 cwd \u53C2\u6570", graph: null });
          return;
        }
        const graph = await readRepoGraph(cwd, url.searchParams.get("limit"));
        if (graph.isRepo && !deps.store.isRootAllowed(cwd)) {
          sendJson(res, 200, {
            ok: true,
            graph: {
              isRepo: true,
              root: graph.root,
              branch: graph.branch,
              head: graph.head,
              detached: graph.detached,
              reason: "repo",
              error: "",
              truncated: false,
              laneCount: 0,
              rows: [],
              authorized: false
            }
          });
          return;
        }
        sendJson(res, 200, { ok: true, graph: { ...graph, authorized: true } });
        return;
      }
      if (method === "GET" && path === "/repo/changes") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        if (!cwd) {
          sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 cwd \u53C2\u6570", changes: null });
          return;
        }
        const changes = await readRepoChanges(cwd);
        if (changes.isRepo && !deps.store.isRootAllowed(cwd)) {
          sendJson(res, 200, {
            ok: true,
            changes: { isRepo: true, root: "", branch: "", dirty: false, files: [] }
          });
          return;
        }
        sendJson(res, 200, { ok: true, changes });
        return;
      }
      const pathList = (value) => Array.isArray(value) ? value.map((item) => String(item).trim()).filter((item) => item.length > 0) : [];
      const requireRead = (cwd, errorPayload) => {
        const dir = str(cwd).trim();
        if (!dir) {
          sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 cwd \u53C2\u6570", ...errorPayload });
          return null;
        }
        if (!deps.store.isRootAllowed(dir)) {
          sendJson(res, 403, {
            ok: false,
            error: `\u76EE\u5F55\u4E0D\u5728\u53EF\u8BFB\u8303\u56F4\u5185\uFF1A${dir}\uFF08\u5DF2\u6388\u6743\u6839\u76EE\u5F55\uFF1A${deps.store.settings().allowedRoots.join("\u3001") || "\u65E0"}\uFF09`,
            ...errorPayload
          });
          return null;
        }
        return dir;
      };
      if (method === "GET" && path === "/repo/branches") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        const dir = requireRead(cwd, { branches: [], current: "" });
        if (!dir) return;
        const result = await readBranches(dir);
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, branches: [], current: "" });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root, current: result.current, branches: result.branches });
        return;
      }
      if (method === "GET" && path === "/repo/remotes") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        const dir = requireRead(cwd, { remotes: [] });
        if (!dir) return;
        const result = await readRemotes(dir);
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, remotes: [] });
          return;
        }
        sendJson(res, 200, {
          ok: true,
          root: result.root,
          remotes: result.remotes,
          upstream: result.upstream,
          upstreamRemote: result.upstreamRemote
        });
        return;
      }
      if (method === "GET" && path === "/repo/commits") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        const dir = requireRead(cwd, { commits: [] });
        if (!dir) return;
        const limit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
        const offset = Number.parseInt(url.searchParams.get("offset") ?? "", 10);
        const ref = str(url.searchParams.get("ref")).trim();
        const search = str(url.searchParams.get("search")).trim();
        const result = await readCommits(
          dir,
          Number.isFinite(limit) ? limit : 30,
          Number.isFinite(offset) ? offset : 0,
          ref || void 0,
          search || void 0
        );
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, commits: [] });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root, commits: result.commits, truncated: result.truncated });
        return;
      }
      if (method === "GET" && path === "/repo/tags") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        const dir = requireRead(cwd, { tags: [] });
        if (!dir) return;
        const result = await readTags(dir);
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, tags: [] });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root, tags: result.tags });
        return;
      }
      if (method === "GET" && path === "/repo/stash") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        const dir = requireRead(cwd, { stashes: [] });
        if (!dir) return;
        const result = await readStashes(dir);
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, stashes: [] });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root, stashes: result.stashes });
        return;
      }
      if (method === "GET" && path === "/repo/tree") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        const dir = requireRead(cwd, { entries: [] });
        if (!dir) return;
        const result = await listDir(dir, str(url.searchParams.get("path")).trim());
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, entries: [] });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root, path: result.path, entries: result.entries, truncated: result.truncated });
        return;
      }
      if (method === "GET" && path === "/repo/file") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        const dir = requireRead(cwd, { content: "" });
        if (!dir) return;
        const result = await readTextFile(dir, str(url.searchParams.get("path")).trim());
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, content: "" });
          return;
        }
        sendJson(res, 200, {
          ok: true,
          root: result.root,
          path: result.path,
          content: result.content,
          size: result.size,
          truncated: result.truncated,
          binary: result.binary,
          lang: result.lang,
          // 图片扩展名由 node 判定，前端据此决定走 <img> 还是文本预览。
          image: imageMimeOf(result.path)
        });
        return;
      }
      if (method === "GET" && path === "/repo/image") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        const dir = requireRead(cwd, { dataUrl: "" });
        if (!dir) return;
        const result = await readImageFile(dir, str(url.searchParams.get("path")).trim());
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, dataUrl: "" });
          return;
        }
        sendJson(res, 200, {
          ok: true,
          root: result.root,
          path: result.path,
          size: result.size,
          mime: result.mime,
          dataUrl: result.dataUrl,
          truncated: result.truncated
        });
        return;
      }
      if (method === "GET" && path === "/repo/commit") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        const rev = str(url.searchParams.get("rev")).trim();
        const dir = requireRead(cwd, { commit: null, files: [], diff: "" });
        if (!dir) return;
        const result = await readCommitDetail(dir, rev);
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, commit: null, files: [], diff: "" });
          return;
        }
        sendJson(res, 200, {
          ok: true,
          root: result.root,
          commit: result.commit,
          files: result.files,
          diff: result.diff,
          diffTruncated: result.diffTruncated
        });
        return;
      }
      if (method === "GET" && path === "/repo/diff") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        const dir = requireRead(cwd, { diff: "" });
        if (!dir) return;
        const modeRaw = str(url.searchParams.get("mode")).trim();
        const mode = modeRaw === "staged" || modeRaw === "commit" ? modeRaw : "worktree";
        const result = await readDiff(dir, mode, str(url.searchParams.get("path")).trim(), str(url.searchParams.get("rev")).trim());
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, diff: "", truncated: false, totalLines: 0 });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root, diff: result.diff, truncated: result.truncated, totalLines: result.totalLines });
        return;
      }
      if (method === "GET" && path === "/repo/discover") {
        const settings = deps.store.snapshot().settings;
        const roots = settings.allowedRoots.filter((root) => root !== "*");
        const repos = await discoverRepos(roots);
        sendJson(res, 200, { ok: true, repos });
        return;
      }
      if (method === "GET" && path === "/repo/open") {
        const cwd = str(url.searchParams.get("cwd")).trim();
        const dir = requireRead(cwd, {});
        if (!dir) return;
        const result = await openDirectory(dir);
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root });
        return;
      }
      if (method === "GET" && path === "/llm/models") {
        const catalog = await listModelCatalog(deps.llm);
        sendJson(res, 200, { ok: catalog.ok, error: catalog.error, models: catalog.models });
        return;
      }
      if (method !== "POST") {
        sendJson(res, 405, { ok: false, error: `\u4E0D\u652F\u6301\u7684\u8BF7\u6C42\u65B9\u6CD5\uFF1A${method}` });
        return;
      }
      if (!isSameOrigin(req)) {
        sendJson(res, 403, { ok: false, error: "\u62D2\u7EDD\u8DE8\u7AD9\u8BF7\u6C42\uFF08\u540C\u6E90\u6821\u9A8C\u672A\u901A\u8FC7\uFF09" });
        return;
      }
      const parsed = await readBody(req);
      if (!parsed.ok) {
        sendJson(res, 413, { ok: false, error: parsed.error });
        return;
      }
      const body = parsed.body ?? {};
      const requireWrite = (cwd) => {
        const dir = str(cwd).trim();
        if (!dir) {
          sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 cwd \u53C2\u6570" });
          return null;
        }
        if (!deps.store.isRootAllowed(dir)) {
          sendJson(res, 403, {
            ok: false,
            error: `\u76EE\u5F55\u4E0D\u5728 Agent \u53EF\u64CD\u4F5C\u8303\u56F4\u5185\uFF1A${dir}\uFF08\u5DF2\u6388\u6743\u6839\u76EE\u5F55\uFF1A${deps.store.settings().allowedRoots.join("\u3001") || "\u65E0"}\uFF09`
          });
          return null;
        }
        if (!deps.store.settings().allowWrite) {
          sendJson(res, 403, { ok: false, error: "\u5F53\u524D\u672A\u5F00\u542F\u5199\u64CD\u4F5C\u6743\u9650\uFF1A\u8BF7\u5728 DSH \u8BBE\u7F6E \u2192 Git \u2192 \u4ED3\u5E93\u8303\u56F4\u91CC\u6253\u5F00\u300C\u5141\u8BB8\u4FEE\u6539\u4ED3\u5E93\u300D" });
          return null;
        }
        return dir;
      };
      const requireRemoteWritable = async (cwd, payload, url2) => {
        const requestedId = str(payload.accountId).trim();
        const account = requestedId ? deps.store.getAccount(requestedId) : deps.store.activeAccount();
        if (requestedId && !account) {
          sendJson(res, 403, { ok: false, error: "\u8D26\u53F7\u4E0D\u5B58\u5728" });
          return false;
        }
        if (!account) {
          deps.log?.("warn", `\u8FDC\u7AEF\u64CD\u4F5C\u672A\u7ED1\u5B9A\u8D26\u53F7\uFF08\u8DF3\u8FC7\u5F52\u5C5E\u6821\u9A8C\uFF09\uFF1A${url2}`);
          return true;
        }
        const repoKey = parseRemoteRepo(url2);
        if (!repoKey) {
          deps.log?.("warn", `\u8FDC\u7AEF\u5730\u5740\u65E0\u6CD5\u89E3\u6790\u4E3A owner/repo\uFF08\u8DF3\u8FC7\u5F52\u5C5E\u6821\u9A8C\uFF09\uFF1A${url2}`);
          return true;
        }
        if (!deps.store.isRepoWritableFor(account.id, repoKey)) {
          sendJson(res, 403, {
            ok: false,
            error: `\u76EE\u6807\u8FDC\u7A0B\u4ED3\u5E93 ${repoKey} \u672A\u6388\u6743\u5199\u5165`
          });
          return false;
        }
        return true;
      };
      if (path === "/repo/stage") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const result = await stagePaths(cwd, pathList(body.paths));
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root });
        return;
      }
      if (path === "/repo/unstage") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const result = await unstagePaths(cwd, pathList(body.paths));
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root });
        return;
      }
      if (path === "/repo/discard") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        if (body.confirmed !== true) {
          sendJson(res, 400, { ok: false, error: "\u4E22\u5F03\u6539\u52A8\u662F\u7834\u574F\u6027\u64CD\u4F5C\uFF1A\u9700\u8981 confirmed:true \u624D\u80FD\u6267\u884C" });
          return;
        }
        const result = await discardPaths(cwd, pathList(body.paths));
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root });
        return;
      }
      if (path === "/repo/commit") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const result = await commitStaged(cwd, str(body.message), body.amend === true);
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, output: result.output });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root, hash: result.hash, output: result.output });
        return;
      }
      if (path === "/repo/suggest-message") {
        const dir = requireRead(body.cwd, { message: "", source: "none" });
        if (!dir) return;
        const result = await suggestCommitMessage(
          { llm: deps.llm, defaultModel: deps.defaultModel, log: deps.log },
          dir,
          str(body.hint),
          str(body.model)
        );
        sendJson(res, 200, {
          ok: result.ok,
          error: result.error,
          message: result.message,
          source: result.source,
          provider: result.provider,
          model: result.model
        });
        return;
      }
      if (path === "/repo/branches/create") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const result = await createBranch(cwd, str(body.name), str(body.startPoint), body.checkout !== false);
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root, output: result.output });
        return;
      }
      if (path === "/repo/branches/checkout") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const result = await checkoutBranch(cwd, str(body.name));
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root, output: result.output });
        return;
      }
      if (path === "/repo/branches/delete") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const result = await deleteBranch(cwd, str(body.name), body.force === true);
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root, output: result.output });
        return;
      }
      if (path === "/repo/branches/rename") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const result = await renameBranch(cwd, str(body.name), str(body.newName));
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root, output: result.output });
        return;
      }
      const remoteNameOf = (payload) => {
        const explicit = str(payload.remoteName).trim();
        if (explicit) return explicit;
        const legacy = str(payload.remote).trim();
        return legacy;
      };
      const remoteUrlsOf = async (cwd, name2) => {
        const result = await readRemotes(cwd);
        if (!result.ok) return [];
        if (name2.length === 0) return result.remotes.map((item) => item.url);
        const hit = result.remotes.find((item) => item.name === name2);
        return hit ? [hit.url] : [];
      };
      if (path === "/repo/fetch") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const remoteName = remoteNameOf(body);
        for (const url2 of await remoteUrlsOf(cwd, remoteName)) {
          if (!await requireRemoteWritable(cwd, body, url2)) return;
        }
        const result = await fetchRepo(cwd, str(body.remote));
        sendJson(res, 200, {
          ok: result.ok,
          error: result.error,
          output: result.output,
          conflicted: result.conflicted,
          rejected: result.rejected,
          missingConfig: result.missingConfig
        });
        return;
      }
      if (path === "/repo/pull") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const remoteName = remoteNameOf(body);
        for (const url2 of await remoteUrlsOf(cwd, remoteName)) {
          if (!await requireRemoteWritable(cwd, body, url2)) return;
        }
        const strategy = body.strategy === "rebase" ? "rebase" : "merge";
        const result = await pullRepo(cwd, str(body.remote), str(body.branch), strategy);
        sendJson(res, 200, {
          ok: result.ok,
          error: result.error,
          output: result.output,
          conflicted: result.conflicted,
          rejected: result.rejected,
          missingConfig: result.missingConfig
        });
        return;
      }
      if (path === "/repo/push") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const targetRemote = remoteNameOf(body);
        if (targetRemote.length > 0) {
          for (const url2 of await remoteUrlsOf(cwd, targetRemote)) {
            if (!await requireRemoteWritable(cwd, body, url2)) return;
          }
        }
        const options = typeof body === "object" && body !== null ? body : {};
        const result = await pushRepo(cwd, str(body.remote), str(body.branch), {
          force: options.force === true,
          setUpstream: options.setUpstream === true,
          tags: options.tags === true
        });
        sendJson(res, 200, {
          ok: result.ok,
          error: result.error,
          output: result.output,
          conflicted: result.conflicted,
          rejected: result.rejected,
          missingConfig: result.missingConfig
        });
        return;
      }
      if (path === "/repo/remotes/add") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const targetUrl = str(body.url);
        if (!await requireRemoteWritable(cwd, body, targetUrl)) return;
        const result = await addRemote(cwd, str(body.name), targetUrl);
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root });
        return;
      }
      if (path === "/repo/remotes/remove") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const result = await removeRemote(cwd, str(body.name));
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root });
        return;
      }
      if (path === "/repo/conflicts") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const conflicted = await hasMergeConflicts(cwd);
        sendJson(res, 200, { ok: true, conflicted });
        return;
      }
      if (path === "/repo/tags/create") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const result = await createTag(cwd, str(body.name), str(body.ref), str(body.message));
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root });
        return;
      }
      if (path === "/repo/tags/delete") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const result = await deleteTag(cwd, str(body.name));
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root });
        return;
      }
      if (path === "/repo/tags/push") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const targetRemote = str(body.remote).trim() || "origin";
        for (const url2 of await remoteUrlsOf(cwd, targetRemote)) {
          if (!await requireRemoteWritable(cwd, body, url2)) return;
        }
        const result = await pushTag(cwd, targetRemote, str(body.name));
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root });
        return;
      }
      if (path === "/repo/stash/save") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const result = await stashSave(cwd, str(body.message), body.includeUntracked === true);
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root });
        return;
      }
      if (path === "/repo/stash/action") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const action = str(body.action).trim();
        if (action !== "pop" && action !== "apply" && action !== "drop") {
          sendJson(res, 400, { ok: false, error: `\u4E0D\u652F\u6301\u7684\u8D2E\u85CF\u64CD\u4F5C\uFF1A${action || "(\u7A7A)"}` });
          return;
        }
        const result = await stashAction(cwd, action, body.index);
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root });
        return;
      }
      if (path === "/repo/reset") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const mode = str(body.mode).trim();
        if (mode !== "soft" && mode !== "mixed" && mode !== "hard") {
          sendJson(res, 400, { ok: false, error: `\u4E0D\u652F\u6301\u7684\u56DE\u9000\u6A21\u5F0F\uFF1A${mode || "(\u7A7A)"}` });
          return;
        }
        const result = await resetToCommit(cwd, str(body.rev).trim(), mode);
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, output: result.output });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root, output: result.output });
        return;
      }
      if (path === "/repo/revert") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const result = await revertCommit(cwd, str(body.rev).trim());
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, output: result.output, conflicted: result.conflicted });
          return;
        }
        sendJson(res, 200, { ok: true, root: result.root, output: result.output });
        return;
      }
      if (path === "/repo/init") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const branch = str(body.branch).trim() || "main";
        const result = await initRepo(cwd, branch);
        if (!result.ok) {
          sendJson(res, 400, { ok: false, error: result.error, result });
          return;
        }
        deps.log?.("info", `\u4ED3\u5E93\u521D\u59CB\u5316\uFF1A${result.root}\uFF08created=${result.created}\uFF09`);
        sendJson(res, 200, { ok: true, result });
        return;
      }
      if (path === "/repo/bootstrap") {
        const cwd = requireWrite(body.cwd);
        if (!cwd) return;
        const steps = [];
        const accountId = str(body.accountId).trim();
        const account = accountId ? deps.store.getAccount(accountId) : deps.store.activeAccount();
        if (!account) {
          sendJson(res, 200, { ok: false, error: accountId ? "\u8D26\u53F7\u4E0D\u5B58\u5728" : "\u5C1A\u672A\u8FDE\u63A5 Git \u8D26\u53F7\uFF0C\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u8FDE\u63A5\u8D26\u53F7" });
          return;
        }
        const token = deps.store.revealSecret(account.id);
        if (!token) {
          deps.store.markAccount(account.id, { status: "error", lastError: "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6" });
          sendJson(res, 200, { ok: false, error: "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6\uFF0C\u8BF7\u91CD\u65B0\u6388\u6743" });
          return;
        }
        const remoteMode = body.remoteMode === "existing" ? "existing" : "new";
        let remoteUrl = str(body.remoteUrl).trim();
        const repoFullName = str(body.repoFullName).trim();
        if (remoteMode === "existing") {
          if (!repoFullName) {
            sendJson(res, 200, { ok: false, error: "\u8BF7\u9009\u62E9\u8981\u4F7F\u7528\u7684\u8FDC\u7A0B\u4ED3\u5E93" });
            return;
          }
          if (!remoteUrl) {
            const listed = await listAccountRepos(
              providerOf(account.provider),
              token,
              account.apiBase || void 0,
              account.host
            );
            if (!listed.ok) {
              sendJson(res, 200, { ok: false, error: listed.error ?? "\u8BFB\u53D6\u8FDC\u7A0B\u4ED3\u5E93\u5217\u8868\u5931\u8D25" });
              return;
            }
            const hit = listed.repos.find((item) => item.fullName.toLowerCase() === repoFullName.toLowerCase());
            if (!hit) {
              sendJson(res, 200, { ok: false, error: `\u672A\u5728\u8BE5\u8D26\u53F7\u7684\u8FDC\u7A0B\u4ED3\u5E93\u4E2D\u627E\u5230 ${repoFullName}` });
              return;
            }
            remoteUrl = hit.url;
          }
        } else if (!remoteUrl) {
          sendJson(res, 200, { ok: false, error: "\u8BF7\u586B\u5199\u8FDC\u7A0B\u4ED3\u5E93\u5730\u5740" });
          return;
        }
        const repoKey = parseRemoteRepo(remoteUrl);
        if (repoKey && !deps.store.isRepoWritableFor(account.id, repoKey)) {
          sendJson(res, 403, { ok: false, error: `\u8FDC\u7A0B\u4ED3\u5E93 ${repoKey} \u672A\u6388\u6743\u5199\u5165` });
          return;
        }
        const branchName = str(body.branchName).trim() || "main";
        let root = cwd;
        const status = await readRepoStatus(cwd);
        if (!status.isRepo) {
          const init = await initRepo(cwd, branchName);
          if (!init.ok) {
            sendJson(res, 200, { ok: false, error: init.error ?? "\u521D\u59CB\u5316\u672C\u5730\u4ED3\u5E93\u5931\u8D25" });
            return;
          }
          root = init.root;
          steps.push("\u5DF2\u521D\u59CB\u5316\u672C\u5730\u4ED3\u5E93");
        } else {
          root = status.root;
        }
        const remotes = await readRemotes(root);
        const origin = remotes.ok ? remotes.remotes.find((item) => item.name === "origin") : void 0;
        if (origin) {
          if (origin.url !== remoteUrl) {
            sendJson(res, 200, { ok: false, error: "origin \u5DF2\u5B58\u5728\u4E14\u6307\u5411\u4E0D\u540C\u5730\u5740" });
            return;
          }
          steps.push("\u5DF2\u5B58\u5728\u8FDC\u7A0B origin");
        } else {
          const added = await addRemote(root, "origin", remoteUrl);
          if (!added.ok) {
            sendJson(res, 200, { ok: false, error: added.error ?? "\u6DFB\u52A0\u8FDC\u7A0B origin \u5931\u8D25" });
            return;
          }
          steps.push("\u5DF2\u6DFB\u52A0\u8FDC\u7A0B origin");
        }
        const branchMode = body.branchMode === "existing" ? "existing" : "new";
        let branch = branchName;
        const branchList = await readBranches(root);
        const branchExists = branchList.ok && branchList.branches.some((item) => item.kind === "local" && item.name === branchName);
        if (branchMode === "new" && !branchExists) {
          const created = await createBranch(root, branchName, "", true);
          if (!created.ok) {
            sendJson(res, 200, { ok: false, error: `\u521B\u5EFA\u5206\u652F ${branchName} \u5931\u8D25\uFF1A${created.error || "\u5206\u652F\u5DF2\u5B58\u5728\u6216\u540D\u79F0\u4E0D\u5408\u6CD5"}` });
            return;
          }
          steps.push(`\u5DF2\u521B\u5EFA\u5206\u652F ${branchName}`);
          steps.push(`\u5DF2\u5207\u6362\u5230\u5206\u652F ${branchName}`);
        } else {
          const switched = await checkoutBranch(root, branchName);
          if (!switched.ok) {
            sendJson(res, 200, { ok: false, error: `\u5207\u6362\u5230\u5206\u652F ${branchName} \u5931\u8D25\uFF1A${switched.error || "\u5206\u652F\u4E0D\u5B58\u5728"}` });
            return;
          }
          steps.push(branchMode === "new" ? `\u5206\u652F ${branchName} \u5DF2\u5B58\u5728\uFF0C\u5DF2\u5207\u6362\u5230\u8BE5\u5206\u652F` : `\u5DF2\u5207\u6362\u5230\u5206\u652F ${branchName}`);
        }
        const message = str(body.initialCommitMessage).trim();
        if (message.length > 0) {
          const staged = await stageAll(root);
          if (!staged.ok) {
            sendJson(res, 200, { ok: false, error: staged.error ?? "\u6682\u5B58\u6587\u4EF6\u5931\u8D25" });
            return;
          }
          const committed = await commitStaged(root, message, false);
          if (!committed.ok) {
            sendJson(res, 200, { ok: false, error: `\u521B\u5EFA\u9996\u6B21\u63D0\u4EA4\u5931\u8D25\uFF1A${committed.error || "\u672A\u77E5\u539F\u56E0"}` });
            return;
          }
          steps.push("\u5DF2\u521B\u5EFA\u9996\u6B21\u63D0\u4EA4");
        }
        deps.log?.("info", `\u4ED3\u5E93\u521D\u59CB\u5316\u5B8C\u6210\uFF1A${root}\uFF08origin=${remoteUrl}\uFF09`);
        sendJson(res, 200, { ok: true, root, branch, remoteName: "origin", remoteUrl, steps, error: "" });
        return;
      }
      if (path === "/repo/create") {
        const cwd = str(body.cwd).trim();
        if (cwd) {
          const allowed = requireWrite(cwd);
          if (!allowed) return;
        }
        const accountId = str(body.accountId).trim();
        const account = accountId ? deps.store.getAccount(accountId) : deps.store.activeAccount();
        if (!account) {
          sendJson(res, 200, { ok: false, error: accountId ? "\u8D26\u53F7\u4E0D\u5B58\u5728" : "\u5C1A\u672A\u8FDE\u63A5 Git \u8D26\u53F7\uFF0C\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u8FDE\u63A5\u8D26\u53F7" });
          return;
        }
        const token = deps.store.revealSecret(account.id);
        if (!token) {
          deps.store.markAccount(account.id, { status: "error", lastError: "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6" });
          sendJson(res, 200, { ok: false, error: "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6\uFF0C\u8BF7\u91CD\u65B0\u6388\u6743" });
          return;
        }
        const name2 = str(body.name).trim();
        if (!name2) {
          sendJson(res, 400, { ok: false, error: "\u8BF7\u586B\u5199\u4ED3\u5E93\u540D" });
          return;
        }
        const created = await createAccountRepo(
          providerOf(account.provider),
          token,
          {
            name: name2,
            private: body.private === true,
            description: str(body.description).trim(),
            owner: str(body.owner).trim() || void 0
          },
          account.apiBase || void 0,
          account.host
        );
        if (!created.ok || !created.repo) {
          sendJson(res, 200, { ok: false, error: created.error ?? "\u521B\u5EFA\u8FDC\u7A0B\u4ED3\u5E93\u5931\u8D25" });
          return;
        }
        deps.store.setRepoPermission(account.id, created.repo.fullName, "full");
        deps.log?.("info", `\u8FDC\u7A0B\u4ED3\u5E93\u5DF2\u521B\u5EFA\uFF1A${account.provider}/${created.repo.fullName}`);
        sendJson(res, 200, { ok: true, repo: created.repo, state: deps.store.snapshot() });
        return;
      }
      if (path === "/pat/connect") {
        const provider = providerOf(body.provider);
        const token = str(body.token).trim();
        const apiBase = str(body.apiBase).trim();
        const host = str(body.host).trim() || PROVIDERS[provider].host;
        if (token.length === 0) {
          sendJson(res, 400, { ok: false, error: "\u8BF7\u586B\u5199\u8BBF\u95EE\u4EE4\u724C" });
          return;
        }
        const verified = await verifyToken(provider, token, apiBase || void 0, host);
        if (!verified.ok || !verified.identity) {
          sendJson(res, 400, { ok: false, error: verified.error ?? "\u4EE4\u724C\u6821\u9A8C\u5931\u8D25" });
          return;
        }
        const identity = verified.identity;
        if (!identity.login) {
          sendJson(res, 400, { ok: false, error: "\u4EE4\u724C\u6709\u6548\u4F46\u65E0\u6CD5\u8BFB\u53D6\u8D26\u53F7\u8EAB\u4EFD\uFF08\u53EF\u80FD\u7F3A\u5C11 user:read \u6743\u9650\uFF09" });
          return;
        }
        const label = str(body.label).trim();
        const record = deps.store.addAccount({
          provider,
          kind: "pat",
          login: identity.login,
          displayName: label ? `${identity.displayName || identity.login}\uFF08${label}\uFF09` : identity.displayName,
          avatarUrl: identity.avatarUrl,
          host,
          apiBase,
          scopes: identity.scopes,
          token
        });
        deps.log?.("info", `PAT \u8D26\u53F7\u5DF2\u63A5\u5165\uFF1A${record.provider}/${record.login}`);
        sendJson(res, 200, { ok: true, account: { ...record, secret: "" }, state: deps.store.snapshot() });
        return;
      }
      if (path === "/oauth/start") {
        const provider = providerOf(body.provider);
        const clientId = str(body.clientId).trim();
        const scope = str(body.scope).trim() || (provider === "gitlab" ? "read_api read_repository" : "repo read:user");
        const apiBase = str(body.apiBase).trim();
        const host = str(body.host).trim() || PROVIDERS[provider].host;
        const started = await startDeviceFlow(provider, clientId, scope, apiBase || void 0, host);
        if (!started.ok || !started.flow) {
          sendJson(res, 400, { ok: false, error: started.error ?? "\u65E0\u6CD5\u53D1\u8D77 OAuth \u6388\u6743" });
          return;
        }
        const pollKey = randomBytes3(12).toString("hex");
        pendingFlows.set(pollKey, {
          provider,
          clientId,
          apiBase,
          host,
          deviceCode: started.flow.deviceCode,
          createdAt: Date.now()
        });
        sendJson(res, 200, {
          ok: true,
          pollKey,
          flow: {
            userCode: started.flow.userCode,
            verificationUri: started.flow.verificationUri,
            expiresIn: started.flow.expiresIn,
            interval: started.flow.interval
          }
        });
        return;
      }
      if (path === "/oauth/poll") {
        const pollKey = str(body.pollKey).trim();
        const pending = pendingFlows.get(pollKey);
        if (!pollKey || !pending) {
          sendJson(res, 400, { ok: false, status: "expired", error: "\u6388\u6743\u6D41\u7A0B\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77" });
          return;
        }
        if (Date.now() - pending.createdAt > 20 * 6e4) {
          pendingFlows.delete(pollKey);
          sendJson(res, 400, { ok: false, status: "expired", error: "\u6388\u6743\u6D41\u7A0B\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77" });
          return;
        }
        const provider = providerOf(pending.provider);
        const result = await pollDeviceFlow(provider, pending.clientId, pending.deviceCode, pending.apiBase || void 0, pending.host);
        if (result.status === "authorized" && result.token) {
          const verified = await verifyToken(provider, result.token, pending.apiBase || void 0, pending.host);
          if (!verified.ok || !verified.identity?.login) {
            pendingFlows.delete(pollKey);
            sendJson(res, 400, { ok: false, status: "error", error: verified.error ?? "\u6388\u6743\u6210\u529F\u4F46\u8BFB\u53D6\u8D26\u53F7\u8EAB\u4EFD\u5931\u8D25" });
            return;
          }
          const identity = verified.identity;
          const record = deps.store.addAccount({
            provider,
            kind: "oauth",
            login: identity.login,
            displayName: identity.displayName,
            avatarUrl: identity.avatarUrl,
            host: pending.host || PROVIDERS[provider].host,
            apiBase: pending.apiBase,
            scopes: result.scopes && result.scopes.length > 0 ? result.scopes : identity.scopes,
            token: result.token
          });
          pendingFlows.delete(pollKey);
          deps.log?.("info", `OAuth \u8D26\u53F7\u5DF2\u63A5\u5165\uFF1A${record.provider}/${record.login}`);
          sendJson(res, 200, { ok: true, status: "authorized", account: { ...record, secret: "" }, state: deps.store.snapshot() });
          return;
        }
        if (result.status === "denied" || result.status === "expired" || result.status === "error") {
          pendingFlows.delete(pollKey);
        }
        sendJson(res, 200, {
          ok: true,
          status: result.status,
          error: result.error ?? "",
          retryAfter: result.retryAfter ?? 0
        });
        return;
      }
      if (path === "/accounts/remove") {
        const id = str(body.id).trim();
        if (!id) {
          sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11\u8D26\u53F7 id" });
          return;
        }
        const removed = deps.store.removeAccount(id);
        deps.log?.("info", `\u8D26\u53F7\u5DF2\u65AD\u5F00\uFF1A${id}`);
        sendJson(res, 200, { ok: removed, error: removed ? void 0 : "\u8D26\u53F7\u4E0D\u5B58\u5728", state: deps.store.snapshot() });
        return;
      }
      if (path === "/accounts/recheck") {
        const id = str(body.id).trim();
        const account = deps.store.getAccount(id);
        if (!account) {
          sendJson(res, 404, { ok: false, error: "\u8D26\u53F7\u4E0D\u5B58\u5728" });
          return;
        }
        const token = deps.store.revealSecret(id);
        if (!token) {
          deps.store.markAccount(id, { status: "error", lastError: "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6" });
          sendJson(res, 400, { ok: false, error: "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6\uFF0C\u8BF7\u91CD\u65B0\u6388\u6743", state: deps.store.snapshot() });
          return;
        }
        const verified = await verifyToken(providerOf(account.provider), token, account.apiBase || void 0, account.host);
        if (!verified.ok) {
          deps.store.markAccount(id, { status: "expired", lastError: verified.error ?? "\u6821\u9A8C\u5931\u8D25" });
          sendJson(res, 200, { ok: false, error: verified.error ?? "\u6821\u9A8C\u5931\u8D25", state: deps.store.snapshot() });
          return;
        }
        deps.store.markAccount(id, {
          status: "connected",
          lastError: "",
          login: verified.identity?.login || account.login,
          displayName: verified.identity?.displayName || account.displayName,
          scopes: verified.identity?.scopes?.length ? verified.identity.scopes : account.scopes
        });
        sendJson(res, 200, { ok: true, state: deps.store.snapshot() });
        return;
      }
      if (path === "/repo/permission") {
        const accountId = str(body.accountId).trim();
        const repoFullName = str(body.repo).trim();
        const perm = str(body.permission).trim();
        if (!accountId || !repoFullName) {
          sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 accountId \u6216 repo \u53C2\u6570" });
          return;
        }
        if (perm !== "full" && perm !== "read" && perm !== "none") {
          sendJson(res, 400, { ok: false, error: `\u6743\u9650\u6863\u4F4D\u4E0D\u5408\u6CD5\uFF1A${perm || "(\u7A7A)"}` });
          return;
        }
        const account = deps.store.getAccount(accountId);
        if (!account) {
          sendJson(res, 404, { ok: false, error: "\u8D26\u53F7\u4E0D\u5B58\u5728" });
          return;
        }
        const applied = deps.store.setRepoPermission(accountId, repoFullName, perm);
        deps.log?.("info", `\u4ED3\u5E93\u6743\u9650\u5DF2\u66F4\u65B0\uFF1A${accountId.slice(0, 8)}\u2026 ${repoFullName}=${applied}`);
        sendJson(res, 200, {
          ok: true,
          repo: repoFullName,
          permission: applied,
          state: deps.store.snapshot()
        });
        return;
      }
      if (path === "/settings") {
        const patch = {};
        if ("allowedRepos" in body) patch.allowedRepos = normalizeRepos(body.allowedRepos);
        if ("allowedRoots" in body) patch.allowedRoots = normalizeRoots(body.allowedRoots);
        if ("allowWrite" in body) patch.allowWrite = body.allowWrite === true;
        if ("requireConfirm" in body) patch.requireConfirm = body.requireConfirm !== false;
        if ("defaultAccountId" in body) patch.defaultAccountId = str(body.defaultAccountId);
        if ("repoPermissions" in body) patch.repoPermissions = body.repoPermissions;
        const settings = deps.store.updateSettings(patch);
        deps.log?.("info", `\u8BBE\u7F6E\u5DF2\u66F4\u65B0\uFF1Arepos=${settings.allowedRepos.length} roots=${settings.allowedRoots.length} write=${settings.allowWrite}`);
        sendJson(res, 200, { ok: true, settings, state: deps.store.snapshot() });
        return;
      }
      sendJson(res, 404, { ok: false, error: `\u672A\u77E5\u63A5\u53E3\uFF1A${path}` });
    } catch (error) {
      deps.log?.("error", `\u63A5\u53E3\u5F02\u5E38 ${path}\uFF1A${redact(error)}`);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: `\u670D\u52A1\u5185\u90E8\u9519\u8BEF\uFF1A${redact(error)}` });
      else res.end();
    }
  };
}
var pendingFlows = /* @__PURE__ */ new Map();

// src/node/tools.ts
import { randomBytes as randomBytes4 } from "node:crypto";
var OBJECT_SCHEMA = { type: "object", additionalProperties: true };
var textBlocks = (text) => [{ type: "text", text }];
var PENDING_TTL_MS = 5 * 6e4;
var pendingWrites = /* @__PURE__ */ new Map();
function ok(value) {
  return { ok: true, ...value };
}
function fail(error, extra = {}) {
  return { ok: false, error, ...extra };
}
function requireAccount(ctx, accountId) {
  const account = ctx.store.activeAccount(accountId);
  if (!account) return { error: "\u5C1A\u672A\u63A5\u5165\u4EFB\u4F55 Git \u8D26\u53F7\uFF0C\u8BF7\u5148\u5728\u8F93\u5165\u6846\u5DE6\u4FA7\u7684 Git \u9762\u677F\u91CC\u8FDE\u63A5\u8D26\u53F7\uFF08\u652F\u6301 OAuth \u6216\u8BBF\u95EE\u4EE4\u724C\uFF09" };
  if (account.status === "expired") {
    return { error: `\u8D26\u53F7 ${account.login} \u7684\u6388\u6743\u5DF2\u5931\u6548\uFF0C\u8BF7\u5728 Git \u9762\u677F\u91CC\u91CD\u65B0\u6388\u6743` };
  }
  const token = ctx.store.revealSecret(account.id);
  if (!token) return { error: `\u8D26\u53F7 ${account.login} \u7684\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6\uFF0C\u8BF7\u91CD\u65B0\u6388\u6743` };
  return { account, token };
}
function resolveRoot(ctx, cwd) {
  if (typeof cwd !== "string" || cwd.trim().length === 0) return { error: "\u7F3A\u5C11\u5DE5\u4F5C\u76EE\u5F55\u53C2\u6570\uFF08cwd\uFF09" };
  if (!ctx.store.isRootAllowed(cwd)) {
    const allowed = ctx.store.settings().allowedRoots;
    return {
      error: `\u76EE\u5F55 ${cwd} \u4E0D\u5728\u5141\u8BB8\u8303\u56F4\u5185\u3002\u5DF2\u6388\u6743\u6839\u76EE\u5F55\uFF1A` + (allowed.length > 0 ? allowed.join("\u3001") : "\uFF08\u5C1A\u672A\u8BBE\u7F6E\uFF09") + "\u3002\u8BF7\u8BA9\u7528\u6237\u5728 Git \u9762\u677F\u7684\u300C\u4ED3\u5E93\u8303\u56F4\u300D\u91CC\u6DFB\u52A0\u8BE5\u76EE\u5F55\u3002"
    };
  }
  const repo = ensureRepo(cwd);
  if (!repo.ok) return { error: repo.error ?? "\u76EE\u5F55\u4E0D\u53EF\u7528" };
  return { root: repo.root };
}
function summarizeStatus(raw) {
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  const branchLine = lines.find((line) => line.startsWith("##")) ?? "";
  const files = lines.filter((line) => !line.startsWith("##"));
  return { branch: branchLine.replace(/^##\s*/, ""), changed: files.length, files: files.slice(0, 200) };
}
function registerGitTools(ctx) {
  const tools = ctx.tools;
  if (!tools || typeof tools.register !== "function") {
    ctx.log?.("warn", "tools \u670D\u52A1\u4E0D\u53EF\u7528\uFF0CAgent \u5DE5\u5177\u672A\u6CE8\u518C\uFF08\u9762\u677F\u529F\u80FD\u4ECD\u53EF\u7528\uFF09");
    return () => {
    };
  }
  const disposers = [];
  const add = (tool) => {
    try {
      const disposer = tools.register(tool);
      if (typeof disposer === "function") disposers.push(disposer);
    } catch (error) {
      ctx.log?.("error", `\u5DE5\u5177 ${tool?.name} \u6CE8\u518C\u5931\u8D25\uFF1A${redact(error)}`);
    }
  };
  add({
    name: "git_panel_status",
    description: "\u67E5\u770B Git \u63A5\u5165\u72B6\u6001\uFF1A\u5DF2\u8FDE\u63A5\u8D26\u53F7\uFF08\u8131\u654F\uFF09\u3001\u6388\u6743\u72B6\u6001\u3001\u5141\u8BB8 Agent \u64CD\u4F5C\u7684\u8FDC\u7AEF\u4ED3\u5E93\u4E0E\u672C\u5730\u76EE\u5F55\u3001\u662F\u5426\u5141\u8BB8\u5199\u64CD\u4F5C\u3002\u8C03\u7528\u4EFB\u4F55\u5176\u5B83 git_* \u5DE5\u5177\u524D\u53EF\u5148\u67E5\u8FD9\u4E2A\u786E\u8BA4\u6743\u9650\u8303\u56F4\u3002",
    parameters: { type: "object", properties: {}, required: [] },
    output: { schema: OBJECT_SCHEMA, render: (_args, value) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute() {
      const settings = ctx.store.settings();
      return ok({
        accounts: ctx.store.accounts().map((item) => ({
          id: item.id,
          provider: item.provider,
          kind: item.kind,
          login: item.login,
          status: item.status,
          scopes: item.scopes,
          lastCheckedAt: item.lastCheckedAt,
          lastError: item.lastError
        })),
        allowedRepos: settings.allowedRepos,
        allowedRoots: settings.allowedRoots,
        allowWrite: settings.allowWrite,
        requireConfirm: settings.requireConfirm,
        note: settings.allowedRepos.length === 0 ? "\u5C1A\u672A\u6388\u6743\u4EFB\u4F55\u8FDC\u7AEF\u4ED3\u5E93\uFF1A\u8FDC\u7AEF API \u64CD\u4F5C\u4F1A\u88AB\u62D2\u7EDD\uFF0C\u53EA\u80FD\u5BF9 allowedRoots \u5185\u7684\u672C\u5730\u4ED3\u5E93\u505A\u53EA\u8BFB\u64CD\u4F5C\u3002" : "\u8FDC\u7AEF\u64CD\u4F5C\u4EC5\u9650 allowedRepos \u5185\u4ED3\u5E93\u3002"
      });
    }
  });
  add({
    name: "git_repo_info",
    description: "\u8BFB\u53D6\u672C\u5730\u4ED3\u5E93\u57FA\u672C\u4FE1\u606F\uFF1A\u5F53\u524D\u5206\u652F\u3001\u8FDC\u7AEF\u5730\u5740\uFF08\u5DF2\u8131\u654F\uFF09\u3001\u5DE5\u4F5C\u533A\u6539\u52A8\u7EDF\u8BA1\u3001\u6700\u8FD1\u4E00\u6B21\u63D0\u4EA4\u3002cwd \u5FC5\u987B\u662F\u5DF2\u6388\u6743\u7684\u672C\u5730\u4ED3\u5E93\u6839\u76EE\u5F55\u3002",
    parameters: {
      type: "object",
      properties: { cwd: { type: "string", description: "\u672C\u5730\u4ED3\u5E93\u6839\u76EE\u5F55\u7684\u7EDD\u5BF9\u8DEF\u5F84" } },
      required: ["cwd"]
    },
    output: { schema: OBJECT_SCHEMA, render: (_args, value) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args) {
      const resolved = resolveRoot(ctx, String(args?.cwd ?? ""));
      if ("error" in resolved) return fail(resolved.error);
      const root = resolved.root;
      const [status, remote, branch, lastCommit] = await Promise.all([
        runGit(root, ["status", "--porcelain=v1", "--branch"]),
        runGit(root, ["remote", "-v"]),
        runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]),
        runGit(root, ["log", "-1", "--pretty=format:%h|%an|%ad|%s", "--date=iso"])
      ]);
      if (!status.ok) return fail(status.error);
      const summary = summarizeStatus(status.stdout);
      const last = lastCommit.ok ? lastCommit.stdout.split("|") : [];
      return ok({
        root,
        branch: branch.ok ? branch.stdout.trim() : summary.branch,
        remotes: remote.ok ? redact(remote.stdout.trim()) : "",
        changedFiles: summary.changed,
        files: summary.files,
        lastCommit: last.length >= 4 ? { hash: last[0], author: last[1], date: last[2], subject: last.slice(3).join("|") } : null
      });
    }
  });
  add({
    name: "git_branches",
    description: "\u5217\u51FA\u672C\u5730\u5206\u652F\uFF08\u542B\u662F\u5426\u8DDF\u8E2A\u8FDC\u7AEF\u3001\u6700\u8FD1\u63D0\u4EA4\u65F6\u95F4\u4E0E\u4F5C\u8005\uFF09\uFF0C\u53EF\u9009\u53EA\u770B\u67D0\u4E2A\u6A21\u5F0F\u5339\u914D\u7684\u5206\u652F\u3002",
    parameters: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "\u672C\u5730\u4ED3\u5E93\u6839\u76EE\u5F55\u7684\u7EDD\u5BF9\u8DEF\u5F84" },
        pattern: { type: "string", description: "\u53EF\u9009\uFF1A\u5206\u652F\u540D\u5305\u542B\u7684\u5B50\u4E32" }
      },
      required: ["cwd"]
    },
    output: { schema: OBJECT_SCHEMA, render: (_args, value) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args) {
      const resolved = resolveRoot(ctx, String(args?.cwd ?? ""));
      if ("error" in resolved) return fail(resolved.error);
      const result = await runGit(resolved.root, [
        "branch",
        "--list",
        "--verbose",
        "--no-abbrev",
        `*${String(args?.pattern ?? "")}*`
      ]);
      if (!result.ok) return fail(result.error);
      const rows = result.stdout.split("\n").filter((line) => line.trim().length > 0).map((line) => {
        const current = line.startsWith("*");
        const body = line.replace(/^\*\s*/, "").trim();
        const parts = body.split(/\s+/);
        return { name: parts[0], current, head: parts[1] ?? "", tracking: parts.slice(2).join(" ") };
      });
      return ok({ root: resolved.root, count: rows.length, branches: rows });
    }
  });
  add({
    name: "git_diff",
    description: "\u67E5\u770B\u4EE3\u7801\u5DEE\u5F02\uFF1A\u9ED8\u8BA4\u5DE5\u4F5C\u533A\u672A\u6682\u5B58\u6539\u52A8\uFF1Bmode=staged \u770B\u5DF2\u6682\u5B58\uFF1Bmode=commit \u770B\u67D0\u4E2A\u63D0\u4EA4\uFF08\u9700 rev\uFF09\uFF1Bmode=range \u770B\u4E24\u4E2A\u63D0\u4EA4\u4E4B\u95F4\uFF08\u9700 base/head\uFF09\u3002\u53EF\u4F20 path \u9650\u5B9A\u6587\u4EF6\u3002",
    parameters: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "\u672C\u5730\u4ED3\u5E93\u6839\u76EE\u5F55\u7684\u7EDD\u5BF9\u8DEF\u5F84" },
        mode: { type: "string", enum: ["worktree", "staged", "commit", "range"] },
        rev: { type: "string", description: "mode=commit \u65F6\u7684\u63D0\u4EA4\u53F7" },
        base: { type: "string", description: "mode=range \u7684\u8D77\u70B9" },
        head: { type: "string", description: "mode=range \u7684\u7EC8\u70B9" },
        path: { type: "string", description: "\u53EF\u9009\uFF1A\u9650\u5B9A\u67D0\u4E2A\u6587\u4EF6\u6216\u76EE\u5F55" },
        maxLines: { type: "number", description: "\u6700\u591A\u8FD4\u56DE\u591A\u5C11\u884C\uFF0C\u9ED8\u8BA4 400" }
      },
      required: ["cwd"]
    },
    output: { schema: OBJECT_SCHEMA, render: (_args, value) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args) {
      const resolved = resolveRoot(ctx, String(args?.cwd ?? ""));
      if ("error" in resolved) return fail(resolved.error);
      const mode = String(args?.mode ?? "worktree");
      const limit = Math.min(Math.max(Number(args?.maxLines) || 400, 20), 2e3);
      const gitArgs = ["diff", "--no-color"];
      if (mode === "staged") gitArgs.push("--cached");
      else if (mode === "commit") {
        const rev = String(args?.rev ?? "");
        if (!rev) return fail("mode=commit \u9700\u8981\u63D0\u4F9B rev\uFF08\u63D0\u4EA4\u53F7\u6216 HEAD~1\uFF09");
        gitArgs.push(`${rev}^`, rev);
      } else if (mode === "range") {
        const base = String(args?.base ?? "");
        const head = String(args?.head ?? "HEAD");
        if (!base) return fail("mode=range \u9700\u8981\u63D0\u4F9B base");
        gitArgs.push(base, head);
      }
      const path = String(args?.path ?? "").trim();
      if (path) gitArgs.push("--", path);
      const result = await runGit(resolved.root, gitArgs);
      if (!result.ok) return fail(result.error);
      const lines = result.stdout.split("\n");
      return ok({
        root: resolved.root,
        mode,
        path: path || null,
        truncated: lines.length > limit,
        totalLines: lines.length,
        diff: lines.slice(0, limit).join("\n")
      });
    }
  });
  add({
    name: "git_log",
    description: "\u8BFB\u53D6\u63D0\u4EA4\u8BB0\u5F55\uFF1A\u9ED8\u8BA4\u6700\u8FD1 20 \u6761\uFF1B\u53EF\u6309\u5206\u652F\u3001\u4F5C\u8005\u3001\u8DEF\u5F84\u3001\u65F6\u95F4\u8303\u56F4\u8FC7\u6EE4\uFF0C\u4E5F\u53EF\u7528 grep \u641C\u7D22\u63D0\u4EA4\u4FE1\u606F\u3002",
    parameters: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "\u672C\u5730\u4ED3\u5E93\u6839\u76EE\u5F55\u7684\u7EDD\u5BF9\u8DEF\u5F84" },
        limit: { type: "number", description: "\u8FD4\u56DE\u6761\u6570\uFF0C\u9ED8\u8BA4 20\uFF0C\u6700\u5927 200" },
        branch: { type: "string", description: "\u53EF\u9009\uFF1A\u5206\u652F\u540D\u6216\u63D0\u4EA4\u53F7" },
        author: { type: "string", description: "\u53EF\u9009\uFF1A\u4F5C\u8005\u8FC7\u6EE4" },
        grep: { type: "string", description: "\u53EF\u9009\uFF1A\u63D0\u4EA4\u4FE1\u606F\u5173\u952E\u8BCD" },
        path: { type: "string", description: "\u53EF\u9009\uFF1A\u9650\u5B9A\u6587\u4EF6/\u76EE\u5F55" },
        since: { type: "string", description: "\u53EF\u9009\uFF1A\u8D77\u59CB\u65F6\u95F4\uFF0C\u5982 2026-01-01 \u6216 3 weeks ago" }
      },
      required: ["cwd"]
    },
    output: { schema: OBJECT_SCHEMA, render: (_args, value) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args) {
      const resolved = resolveRoot(ctx, String(args?.cwd ?? ""));
      if ("error" in resolved) return fail(resolved.error);
      const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 200);
      const gitArgs = ["log", `-n${limit}`, "--pretty=format:%h%x09%an%x09%ad%x09%s", "--date=short"];
      const branch = String(args?.branch ?? "").trim();
      if (branch) gitArgs.push(branch);
      const author = String(args?.author ?? "").trim();
      if (author) gitArgs.push(`--author=${author}`);
      const grep = String(args?.grep ?? "").trim();
      if (grep) gitArgs.push(`--grep=${grep}`, "-i");
      const since = String(args?.since ?? "").trim();
      if (since) gitArgs.push(`--since=${since}`);
      const path = String(args?.path ?? "").trim();
      if (path) gitArgs.push("--", path);
      const result = await runGit(resolved.root, gitArgs);
      if (!result.ok) {
        if (/does not have any commits yet/i.test(result.stderr)) return ok({ root: resolved.root, commits: [], note: "\u4ED3\u5E93\u8FD8\u6CA1\u6709\u4EFB\u4F55\u63D0\u4EA4" });
        return fail(result.error);
      }
      const commits = result.stdout.split("\n").filter((line) => line.trim().length > 0).map((line) => {
        const [hash, authorName, date, ...rest] = line.split("	");
        return { hash, author: authorName, date, subject: rest.join("	") };
      });
      return ok({ root: resolved.root, count: commits.length, commits });
    }
  });
  add({
    name: "git_remote_info",
    description: "\u67E5\u8BE2\u5DF2\u6388\u6743\u8FDC\u7AEF\u4ED3\u5E93\u7684\u5143\u4FE1\u606F\uFF08\u9ED8\u8BA4\u5206\u652F\u3001\u53EF\u89C1\u6027\u3001\u6700\u8FD1\u63A8\u9001\u65F6\u95F4\u3001stars \u7B49\uFF09\u3002\u4ED3\u5E93\u5FC5\u987B\u5728\u7528\u6237\u6388\u6743\u7684 allowedRepos \u8303\u56F4\u5185\u3002",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string", description: "owner/repo \u5F62\u5F0F" },
        accountId: { type: "string", description: "\u53EF\u9009\uFF1A\u6307\u5B9A\u7528\u54EA\u4E2A\u5DF2\u8FDE\u63A5\u8D26\u53F7" }
      },
      required: ["repo"]
    },
    output: { schema: OBJECT_SCHEMA, render: (_args, value) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args) {
      const repo = String(args?.repo ?? "").trim();
      const repoKey = parseRemoteRepo(repo) ?? (normalizeRepo(repo) || null);
      const accountId = args?.accountId ? String(args.accountId) : void 0;
      const account0 = accountId ? ctx.store.getAccount(accountId) : ctx.store.activeAccount();
      if (accountId && !account0) {
        return fail(`\u8D26\u53F7 ${accountId} \u4E0D\u5B58\u5728\uFF0C\u8BF7\u5728 Git \u9762\u677F\u91CC\u91CD\u65B0\u9009\u62E9\u8D26\u53F7\u540E\u91CD\u8BD5\u3002`);
      }
      const permitted = account0 ? repoKey !== null && ctx.store.isRepoAllowedFor(account0.id, repoKey) : ctx.store.isRepoAllowed(repo);
      if (!permitted) {
        const allowed = ctx.store.settings().allowedRepos;
        return fail(
          `\u4ED3\u5E93 ${repo} \u4E0D\u5728\u6388\u6743\u8303\u56F4\u5185\u3002\u5DF2\u6388\u6743\uFF1A` + (allowed.length > 0 ? allowed.join("\u3001") : "\uFF08\u5C1A\u672A\u6388\u6743\u4EFB\u4F55\u4ED3\u5E93\uFF09") + "\u3002\u8BF7\u8BA9\u7528\u6237\u5728 Git \u9762\u677F\u91CC\u6DFB\u52A0\u8BE5\u4ED3\u5E93\u540E\u518D\u8BD5\u3002"
        );
      }
      const found = requireAccount(ctx, accountId);
      if ("error" in found) return fail(found.error);
      const account = found.account;
      const meta = PROVIDERS[providerOf(account.provider)];
      const result = await fetchRepo2(providerOf(account.provider), found.token, repo, account.apiBase || void 0, account.host);
      if (!result.ok) {
        if (/401/.test(result.error ?? "")) ctx.store.markAccount(account.id, { status: "expired", lastError: result.error });
        return fail(result.error ?? "\u67E5\u8BE2\u5931\u8D25");
      }
      const data = result.repo ?? {};
      const permission = repoKey ? ctx.store.repoPermission(account.id, repoKey) : "none";
      return ok({
        provider: meta.label,
        account: account.login,
        repo,
        repoKey,
        permission,
        writable: permission === "full",
        defaultBranch: data.default_branch ?? data.default_branch ?? "",
        private: data.private ?? data.visibility === "private",
        description: data.description ?? "",
        stars: data.stargazers_count ?? data.star_count ?? 0,
        pushedAt: data.pushed_at ?? data.last_activity_at ?? "",
        htmlUrl: data.html_url ?? data.web_url ?? ""
      });
    }
  });
  add({
    name: "git_write",
    description: "\u6267\u884C\u4F1A\u6539\u53D8\u4ED3\u5E93\u72B6\u6001\u7684\u64CD\u4F5C\uFF08add / commit / checkout / switch / restore / stash / tag\uFF09\u3002\u8C03\u7528\u524D\u5FC5\u987B\u5411\u7528\u6237\u8BF4\u660E\u5C06\u6267\u884C\u7684\u52A8\u4F5C\u4E0E\u76EE\u6807\u4ED3\u5E93\uFF1B\u82E5\u7528\u6237\u5F00\u542F\u4E86\u300C\u5199\u64CD\u4F5C\u9700\u786E\u8BA4\u300D\uFF0C\u672C\u5DE5\u5177\u53EA\u8FD4\u56DE\u5F85\u786E\u8BA4\u4FE1\u606F\u4E0E confirmToken\uFF0C\u9700\u518D\u8C03\u7528 git_confirm \u624D\u771F\u6B63\u6267\u884C\u3002",
    parameters: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "\u672C\u5730\u4ED3\u5E93\u6839\u76EE\u5F55\u7684\u7EDD\u5BF9\u8DEF\u5F84" },
        action: { type: "string", description: "\u52A8\u4F5C\u540D\uFF1Aadd / commit / checkout / switch / restore / stash / tag" },
        args: { type: "array", items: { type: "string" }, description: "\u4F20\u7ED9 git \u7684\u9644\u52A0\u53C2\u6570\uFF08\u4E0D\u542B\u5B50\u547D\u4EE4\uFF09" },
        reason: { type: "string", description: "\u4E3A\u4EC0\u4E48\u8981\u505A\u8FD9\u4E2A\u6539\u52A8\uFF08\u4F1A\u5C55\u793A\u7ED9\u7528\u6237\uFF09" }
      },
      required: ["cwd", "action", "args"]
    },
    output: { schema: OBJECT_SCHEMA, render: (_args, value) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args) {
      const settings = ctx.store.settings();
      if (!settings.allowWrite) {
        return fail("\u5F53\u524D\u672A\u5F00\u542F\u5199\u64CD\u4F5C\u6743\u9650\u3002\u8BF7\u8BA9\u7528\u6237\u5728 Git \u9762\u677F\u91CC\u6253\u5F00\u300C\u5141\u8BB8 Agent \u4FEE\u6539\u4ED3\u5E93\u300D\u540E\u518D\u8BD5\u3002");
      }
      const action = String(args?.action ?? "");
      const allowedActions = ["add", "commit", "checkout", "switch", "restore", "stash", "tag"];
      if (!allowedActions.includes(action)) {
        return fail(`\u4E0D\u652F\u6301\u7684\u5199\u52A8\u4F5C\uFF1A${action || "(\u7A7A)"}\u3002\u5141\u8BB8\uFF1A${allowedActions.join(" / ")}`);
      }
      const resolved = resolveRoot(ctx, String(args?.cwd ?? ""));
      if ("error" in resolved) return fail(resolved.error);
      const root = resolved.root;
      const rawArgs = Array.isArray(args?.args) ? args.args.map((item) => String(item)) : [];
      const reason = String(args?.reason ?? "").trim();
      if (settings.requireConfirm) {
        const token = randomBytes4(9).toString("hex");
        pendingWrites.set(token, {
          token,
          repo: root,
          root,
          args: [action, ...rawArgs],
          action,
          createdAt: Date.now()
        });
        for (const [key, item] of pendingWrites) {
          if (Date.now() - item.createdAt > PENDING_TTL_MS) pendingWrites.delete(key);
        }
        return ok({
          pending: true,
          confirmToken: token,
          summary: `\u5C06\u6267\u884C git ${action} ${rawArgs.join(" ")}\uFF08\u4ED3\u5E93\uFF1A${root}\uFF09`,
          reason: reason || "\uFF08\u672A\u8BF4\u660E\u539F\u56E0\uFF09",
          next: "\u8BF7\u5148\u5411\u7528\u6237\u786E\u8BA4\uFF0C\u518D\u8C03\u7528 git_confirm \u5E76\u4F20\u5165\u8BE5 confirmToken\u3002"
        });
      }
      const result = await runGit(root, [action, ...rawArgs]);
      if (!result.ok) return fail(result.error, { command: result.command, stdout: result.stdout });
      return ok({ executed: true, command: result.command, stdout: result.stdout, stderr: result.stderr });
    }
  });
  add({
    name: "git_confirm",
    description: "\u786E\u8BA4\u5E76\u6267\u884C\u4E0A\u4E00\u6B65 git_write \u8FD4\u56DE\u7684\u5F85\u786E\u8BA4\u5199\u64CD\u4F5C\u3002confirmToken \u6765\u81EA git_write \u7684\u8FD4\u56DE\u503C\u3002",
    parameters: {
      type: "object",
      properties: {
        confirmToken: { type: "string", description: "git_write \u8FD4\u56DE\u7684 confirmToken" },
        confirmed: { type: "boolean", description: "\u7528\u6237\u662F\u5426\u5DF2\u660E\u786E\u540C\u610F\u6267\u884C" }
      },
      required: ["confirmToken"]
    },
    output: { schema: OBJECT_SCHEMA, render: (_args, value) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args) {
      if (args?.confirmed === false) return fail("\u7528\u6237\u672A\u540C\u610F\u6267\u884C\uFF0C\u5DF2\u53D6\u6D88\u8BE5\u5199\u64CD\u4F5C");
      const token = String(args?.confirmToken ?? "");
      const pending = pendingWrites.get(token);
      if (!pending) return fail("\u786E\u8BA4\u4EE4\u724C\u65E0\u6548\u6216\u5DF2\u8FC7\u671F\uFF08\u6709\u6548\u671F 5 \u5206\u949F\uFF09\uFF0C\u8BF7\u91CD\u65B0\u8C03\u7528 git_write");
      pendingWrites.delete(token);
      if (Date.now() - pending.createdAt > PENDING_TTL_MS) return fail("\u786E\u8BA4\u5DF2\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u8C03\u7528 git_write");
      const result = await runGit(pending.root, pending.args);
      if (!result.ok) return fail(result.error, { command: result.command, stdout: result.stdout });
      return ok({ executed: true, command: result.command, stdout: result.stdout, stderr: result.stderr });
    }
  });
  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
      }
    }
    pendingWrites.clear();
  };
}

// src/index.ts
var name = "@zjj/dsh-git-panel";
var inject = ["webServer"];
var PLUGIN_VERSION = "0.1.0";
function apply(ctx) {
  const store = new PanelStore();
  const log = (level, message) => {
    const text = redact(message);
    if (level === "error") ctx.logger?.error?.(text);
    else if (level === "warn") ctx.logger?.warn?.(text);
    else ctx.logger?.info?.(text);
  };
  const handler = createHandler({
    store,
    version: PLUGIN_VERSION,
    log,
    // 软取：模型服务缺失时「生成提交信息」明确不可用，不阻塞其余能力。
    llm: ctx.get?.("llm"),
    defaultModel: ctx.get?.("agentDefaultModel")
  });
  ctx.effect(() => {
    const disposer = ctx.webServer?.register?.({
      kind: "prefix",
      path: ROUTE_PREFIX,
      handler
    });
    log("info", `\u5DF2\u6CE8\u518C\u63A5\u53E3 ${ROUTE_PREFIX}/*`);
    return () => {
      if (typeof disposer === "function") disposer();
    };
  }, "@zjj/dsh-git-panel:http");
  ctx.effect(() => {
    const dispose = registerGitTools({
      store,
      tools: ctx.get?.("tools"),
      log
    });
    return dispose;
  }, "@zjj/dsh-git-panel:tools");
}
export {
  PLUGIN_VERSION,
  apply,
  inject,
  name
};
