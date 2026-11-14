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
function maskSecret(plain) {
  if (typeof plain !== "string" || plain.length === 0) return "";
  const tail = plain.slice(-4);
  return "\u2022\u2022\u2022\u2022" + tail;
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
var NPM_PROVIDER = "npm";
var DEFAULT_SETTINGS = {
  allowWrite: false,
  requireConfirm: true,
  defaultAccountId: "",
  autoSubmit: false,
  npmActiveId: ""
};
function emptyState() {
  return { version: 3, accounts: [], settings: { ...DEFAULT_SETTINGS }, npmAccounts: [] };
}
function isNpmRecord(item) {
  return item.provider === NPM_PROVIDER;
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
        version: 3,
        accounts: accounts.filter((item) => item && typeof item.id === "string" && typeof item.secret === "string" && !isNpmRecord(item)).map((item) => ({
          id: item.id,
          provider: typeof item.provider === "string" ? item.provider : "github",
          kind: item.kind === "oauth" ? "oauth" : "pat",
          login: typeof item.login === "string" ? item.login : "",
          displayName: typeof item.displayName === "string" ? item.displayName : "",
          avatarUrl: typeof item.avatarUrl === "string" ? item.avatarUrl : "",
          clientId: typeof item.clientId === "string" ? item.clientId : "",
          scopes: Array.isArray(item.scopes) ? item.scopes.filter((s) => typeof s === "string") : [],
          secret: item.secret,
          createdAt: Number(item.createdAt) || Date.now(),
          lastCheckedAt: Number(item.lastCheckedAt) || 0,
          status: item.status === "expired" || item.status === "error" ? item.status : "connected",
          lastError: typeof item.lastError === "string" ? item.lastError : ""
        })),
        settings: {
          allowWrite: raw.settings?.allowWrite === true,
          requireConfirm: raw.settings?.requireConfirm !== false,
          defaultAccountId: typeof raw.settings?.defaultAccountId === "string" ? raw.settings.defaultAccountId : "",
          autoSubmit: raw.settings?.autoSubmit === true,
          npmActiveId: typeof raw.settings?.npmActiveId === "string" ? raw.settings.npmActiveId : ""
        },
        npmAccounts: (Array.isArray(raw.npmAccounts) ? raw.npmAccounts : []).filter((item) => item && typeof item.id === "string" && typeof item.secret === "string" && typeof item.login === "string").map((item) => ({
          id: item.id,
          login: item.login,
          secret: item.secret,
          createdAt: Number(item.createdAt) || Date.now(),
          lastCheckedAt: Number(item.lastCheckedAt) || 0,
          lastError: typeof item.lastError === "string" ? item.lastError : ""
        }))
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
      settings: { ...this.state.settings },
      npmAccounts: this.state.npmAccounts.map((item) => ({ ...item, secret: "" }))
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
      clientId: input.clientId ?? "",
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
    this.persist();
    return record;
  }
  removeAccount(id) {
    const before = this.state.accounts.length;
    this.state.accounts = this.state.accounts.filter((item) => item.id !== id);
    if (this.state.settings.defaultAccountId === id) {
      this.state.settings.defaultAccountId = this.state.accounts[0]?.id ?? "";
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
    if ("allowWrite" in patch) next.allowWrite = patch.allowWrite === true;
    if ("requireConfirm" in patch) next.requireConfirm = patch.requireConfirm !== false;
    if ("autoSubmit" in patch) next.autoSubmit = patch.autoSubmit === true;
    if (typeof next.defaultAccountId !== "string") next.defaultAccountId = "";
    if (typeof next.npmActiveId !== "string") next.npmActiveId = "";
    this.state.settings = next;
    this.persist();
    return { ...next };
  }
  // ---- v3.10 npm 凭据多账号 ----
  npmAccounts() {
    return this.state.npmAccounts;
  }
  getNpmAccount(id) {
    return this.state.npmAccounts.find((item) => item.id === id);
  }
  /** 新增/替换 npm 凭据：同 login 视为更新 token（换新 id 会丢历史，故原地换密文保留 id）。 */
  addNpmAccount(input) {
    const existing = this.state.npmAccounts.find((item) => item.login === input.login);
    if (existing) {
      existing.secret = seal(input.token);
      existing.lastCheckedAt = Date.now();
      existing.lastError = "";
      this.persist();
      return existing;
    }
    const record = {
      id: randomBytes2(8).toString("hex"),
      login: input.login,
      secret: seal(input.token),
      createdAt: Date.now(),
      lastCheckedAt: Date.now(),
      lastError: ""
    };
    this.state.npmAccounts.unshift(record);
    this.persist();
    return record;
  }
  removeNpmAccount(id) {
    const before = this.state.npmAccounts.length;
    this.state.npmAccounts = this.state.npmAccounts.filter((item) => item.id !== id);
    if (this.state.settings.npmActiveId === id) this.state.settings.npmActiveId = "";
    if (this.state.npmAccounts.length === before) return false;
    this.persist();
    return true;
  }
  markNpmAccount(id, patch) {
    const record = this.getNpmAccount(id);
    if (!record) return;
    Object.assign(record, patch, { lastCheckedAt: patch.lastCheckedAt ?? Date.now() });
    this.persist();
  }
  /** 读取 npm 明文 token（仅内存使用，不得写日志/返回值）。 */
  revealNpmSecret(id) {
    const record = this.getNpmAccount(id);
    if (!record) return null;
    try {
      return open(record.secret);
    } catch {
      return null;
    }
  }
  setNpmActiveId(id) {
    this.state.settings.npmActiveId = typeof id === "string" ? id : "";
    this.persist();
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
import { delimiter, dirname as dirname3, isAbsolute, join as join2, resolve } from "node:path";
var TIMEOUT_MS = 3e4;
var MAX_OUTPUT = 4e5;
function gitSupportDirs() {
  const dirs = [];
  const add = (p) => {
    if (typeof p === "string" && p.trim()) dirs.push(p.trim());
  };
  for (const key of ["DSH_GIT_PATH", "GIT_PATH"]) {
    const v = process.env[key];
    if (!v) continue;
    add(v.toLowerCase().endsWith(".exe") ? dirname3(v) : v);
  }
  if (process.platform === "win32") {
    const roots = [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.LOCALAPPDATA ? join2(process.env.LOCALAPPDATA, "Programs") : void 0,
      process.env.SystemDrive ? join2(process.env.SystemDrive, "Program Files") : void 0,
      process.env.SystemDrive ? join2(process.env.SystemDrive, "Program Files (x86)") : void 0
    ];
    for (const base of roots) {
      if (!base) continue;
      const git = join2(base, "Git");
      add(join2(git, "cmd"));
      add(join2(git, "bin"));
      add(join2(git, "usr", "bin"));
      add(join2(git, "mingw64", "bin"));
    }
  } else {
    for (const p of ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]) add(p);
  }
  const seen = /* @__PURE__ */ new Set();
  return dirs.filter((d) => {
    const key = process.platform === "win32" ? d.toLowerCase() : d;
    if (seen.has(key)) return false;
    seen.add(key);
    return existsSync2(d);
  });
}
function gitChildEnv() {
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_ASKPASS: "",
    GIT_PAGER: "cat",
    GIT_EDITOR: "true"
  };
  const pathKey = Object.keys(env).find((k) => k.toLowerCase() === "path") ?? "PATH";
  env[pathKey] = [...gitSupportDirs(), env[pathKey] ?? ""].filter(Boolean).join(delimiter);
  return env;
}
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
function initialCommit(cwd, msg = "init") {
  const clean = typeof msg === "string" && msg.length > 0 ? msg : "init";
  return runGit(cwd, ["commit", "--allow-empty", "-m", clean]);
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
        // 用增强后的子进程环境：PATH 已前置 Git 安装目录（GUI 启动缺 PATH 时也能找到 git），
        // 同时禁用交互提示/编辑器。只作用于 git 子进程，不改宿主进程与全局配置。
        env: gitChildEnv()
      },
      (error, stdoutRaw, stderrRaw) => {
        const stdout = clip(String(stdoutRaw ?? ""));
        const stderr = clip(String(stderrRaw ?? ""));
        if (!error) {
          resolvePromise({ ok: true, code: 0, stdout, stderr, error: "", command });
          return;
        }
        const errCode = error.code;
        const code = typeof errCode === "number" ? errCode : 1;
        const killed = error.killed === true;
        const spawnFailed = typeof errCode === "string" && (errCode === "ENOENT" || errCode === "EACCES" || errCode === "EPERM");
        const message = killed ? `git ${sub} \u8D85\u65F6\uFF08${TIMEOUT_MS / 1e3}s\uFF09\u88AB\u7EC8\u6B62` : spawnFailed ? `\u627E\u4E0D\u5230 git \u53EF\u6267\u884C\u6587\u4EF6\uFF08${errCode}\uFF09\uFF1A\u672C\u673A\u672A\u5B89\u88C5 Git\uFF0C\u6216\u5BBF\u4E3B\u8FDB\u7A0B PATH \u4E0D\u542B\u5176\u5B89\u88C5\u76EE\u5F55\u3002\u8BF7\u5B89\u88C5 Git\uFF0C\u6216\u5728\u542F\u52A8 DSH \u524D\u628A Git \u7684\u53EF\u6267\u884C\u76EE\u5F55\u52A0\u5165 PATH\uFF1B\u9AD8\u7EA7\u7528\u6237\u53EF\u8BBE DSH_GIT_PATH\uFF08\u6307\u5411 git \u53EF\u6267\u884C\u6587\u4EF6\u6216\u5176\u6240\u5728\u76EE\u5F55\uFF09\u3002` : describeFailure(sub, code, stderr, stdout);
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

// src/node/git-ops.ts
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

// src/node/providers.ts
var API = "https://api.github.com";
async function githubFetch(path, token, init = {}) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application+json",
      "user-agent": "dsh-git-panel",
      ...init.headers ?? {}
    }
  });
}
async function verifyToken(token) {
  try {
    const res = await githubFetch("/user", token);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: res.status === 401 ? "\u4EE4\u724C\u65E0\u6548\u6216\u5DF2\u64A4\u9500" : "\u4EE4\u724C\u88AB GitHub \u62D2\u7EDD\uFF08\u53EF\u80FD\u7F3A\u5C11 user \u8BFB\u53D6\u6743\u9650\uFF09" };
    }
    if (!res.ok) return { ok: false, error: `GitHub \u8FD4\u56DE ${res.status}` };
    const data = await res.json();
    const scopesRes = await fetch(`${API}/`, { headers: { authorization: `Bearer ${token}`, accept: "application+json" } });
    const scopes = (scopesRes.headers.get("x-oauth-scopes") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return {
      ok: true,
      identity: {
        login: String(data.login ?? ""),
        displayName: String(data.name || data.login || ""),
        avatarUrl: String(data.avatar_url ?? ""),
        scopes
      }
    };
  } catch (error) {
    return { ok: false, error: `\u7F51\u7EDC\u9519\u8BEF\uFF1A${redact(error)}` };
  }
}
async function listAccountRepos(token) {
  try {
    const res = await githubFetch("/user/repos?per_page=100&sort=pushed", token);
    if (!res.ok) return { ok: false, repos: [], truncated: false, error: `GitHub \u8FD4\u56DE ${res.status}` };
    const list = await res.json();
    const repos = list.slice(0, 100).map((item) => ({
      fullName: String(item.full_name ?? ""),
      description: String(item.description ?? ""),
      private: item.private === true,
      defaultBranch: String(item.default_branch ?? ""),
      pushedAt: String(item.pushed_at ?? "")
    }));
    return { ok: true, repos, truncated: list.length >= 100 };
  } catch (error) {
    return { ok: false, repos: [], truncated: false, error: `\u7F51\u7EDC\u9519\u8BEF\uFF1A${redact(error)}` };
  }
}
async function createRepo(token, name2, options = {}) {
  if (typeof token !== "string" || token.trim().length === 0) {
    return { ok: false, error: "\u7F3A\u5C11 GitHub \u4EE4\u724C\uFF08\u9700\u5148\u5728\u300C\u8D26\u53F7\u4E0E\u6388\u6743\u300D\u4E2D\u8FDE\u63A5 GitHub\uFF09" };
  }
  const safe = name2.trim();
  if (!/^[\w.-]{1,100}$/.test(safe)) {
    return { ok: false, error: "\u4ED3\u5E93\u540D\u53EA\u80FD\u542B\u5B57\u6BCD\u3001\u6570\u5B57\u3001. \u548C -\uFF0C\u6700\u957F 100 \u5B57\u7B26" };
  }
  try {
    const res = await githubFetch("/user/repos", token, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: safe, private: options.private === true, auto_init: false })
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "GitHub \u62D2\u7EDD\uFF08\u4EE4\u724C\u7F3A\u5C11 repo \u5199\u6743\u9650\u6216\u5DF2\u64A4\u9500\uFF09" };
    }
    if (res.status === 422) {
      const data2 = await res.json().catch(() => ({}));
      return { ok: false, error: `\u521B\u5EFA\u5931\u8D25\uFF1A${typeof data2.message === "string" ? data2.message : "\u4ED3\u5E93\u53EF\u80FD\u5DF2\u5B58\u5728"}` };
    }
    if (!res.ok) return { ok: false, error: `GitHub \u8FD4\u56DE ${res.status}` };
    const data = await res.json();
    return { ok: true, cloneUrl: String(data.clone_url ?? ""), htmlUrl: String(data.html_url ?? "") };
  } catch (error) {
    return { ok: false, error: `\u7F51\u7EDC\u9519\u8BEF\uFF1A${redact(error)}` };
  }
}
async function startDeviceFlow(clientId) {
  if (!clientId.trim()) return { ok: false, error: "\u7F3A\u5C11 OAuth App \u7684 Client ID\uFF08\u9700\u81EA\u5EFA\u540E\u586B\u5165\uFF0C\u672C\u63D2\u4EF6\u4E0D\u5185\u7F6E\u4EFB\u4F55\u5E94\u7528\u51ED\u636E\uFF09" };
  try {
    const res = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ client_id: clientId.trim(), scope: "repo read:user" }).toString()
    });
    const text = await res.text();
    const params = new URLSearchParams(text);
    if (!res.ok || !params.get("device_code")) {
      return { ok: false, error: `\u53D1\u8D77\u6388\u6743\u5931\u8D25\uFF08HTTP ${res.status}\uFF09\uFF1A${params.get("error") ?? text.slice(0, 120)}` };
    }
    return {
      ok: true,
      flow: {
        deviceCode: String(params.get("device_code")),
        userCode: String(params.get("user_code") ?? ""),
        verificationUri: String(params.get("verification_uri") ?? "https://github.com/login/device"),
        expiresIn: Number(params.get("expires_in") ?? 900),
        interval: Number(params.get("interval") ?? 5)
      }
    };
  } catch (error) {
    return { ok: false, error: `\u7F51\u7EDC\u9519\u8BEF\uFF1A${redact(error)}` };
  }
}
async function pollDeviceFlow(clientId, deviceCode) {
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ client_id: clientId.trim(), device_code: deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }).toString()
    });
    const data = await res.json().catch(() => ({}));
    if (data.access_token) return { status: "authorized", token: String(data.access_token) };
    const err = String(data.error ?? "");
    if (err === "authorization_pending") return { status: "pending" };
    if (err === "slow_down") return { status: "pending", retryAfter: Number(data.interval ?? 10) };
    if (err === "access_denied") return { status: "denied", error: "\u4F60\u5728\u6388\u6743\u9875\u62D2\u7EDD\u4E86\u672C\u6B21\u6388\u6743" };
    if (err === "expired_token") return { status: "expired", error: "\u8BBE\u5907\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77" };
    return { status: "error", error: err || "GitHub \u8FD4\u56DE\u5F02\u5E38" };
  } catch (error) {
    return { status: "error", error: `\u7F51\u7EDC\u9519\u8BEF\uFF1A${redact(error)}` };
  }
}

// src/node/npm.ts
import { existsSync as existsSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync3, mkdirSync as mkdirSync3, copyFileSync } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { join as join3 } from "node:path";
import { spawn } from "node:child_process";
var REGISTRY = "https://registry.npmjs.org";
var TOKEN_KEY = "//registry.npmjs.org/:_authToken";
function npmrcPath() {
  const fromEnv = process.env.NPM_CONFIG_USERCONFIG;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) return fromEnv.trim();
  return join3(homedir2(), ".npmrc");
}
function npmTokenFromNpmrc() {
  try {
    const file = npmrcPath();
    if (!existsSync3(file)) return "";
    for (const line of readFileSync3(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\/\/registry\.npmjs\.org\/:_authToken\s*=\s*(.+)$/);
      if (m && m[1].trim().length > 0) return m[1].trim();
    }
  } catch {
  }
  return "";
}
async function whoamiNpm(token) {
  if (typeof token !== "string" || token.trim().length === 0) return { ok: false, error: "\u7F3A\u5C11 token" };
  try {
    const res = await fetch(`${REGISTRY}/-/whoami`, { headers: { authorization: `Bearer ${token.trim()}` } });
    if (res.status === 401 || res.status === 403) return { ok: false, status: res.status, error: "token \u65E0\u6548\u6216\u65E0\u6743\u9650\uFF08npm \u5B98\u65B9\u6E90\u62D2\u7EDD\uFF09" };
    if (!res.ok) return { ok: false, status: res.status, error: `npm \u5B98\u65B9\u6E90\u8FD4\u56DE ${res.status}` };
    const data = await res.json().catch(() => ({}));
    const username = typeof data.username === "string" ? data.username : "";
    if (!username) return { ok: false, error: "whoami \u8FD4\u56DE\u7F3A\u5C11 username \u5B57\u6BB5" };
    return { ok: true, username, status: res.status };
  } catch (error) {
    return { ok: false, error: `\u7F51\u7EDC\u9519\u8BEF\uFF1A${redact(error)}` };
  }
}
function configureNpmToken(token) {
  if (typeof token !== "string" || token.trim().length === 0) return { ok: false, error: "\u7F3A\u5C11 token" };
  const file = npmrcPath();
  try {
    let lines = [];
    if (existsSync3(file)) {
      const raw = readFileSync3(file, "utf8");
      if (raw.trim().length > 0) {
        lines = raw.split(/\r?\n/);
        try {
          mkdirSync3(pluginDir(), { recursive: true });
          const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
          const backup = join3(pluginDir(), `npmrc.bak-${stamp}`);
          copyFileSync(file, backup);
          try {
            writeFileSync3(backup, raw, { mode: 384 });
          } catch {
          }
        } catch {
        }
      }
    }
    const kept = lines.filter((line) => !line.trim().startsWith(TOKEN_KEY));
    kept.push(`${TOKEN_KEY}=${token.trim()}`);
    const out = kept.join("\n") + "\n";
    try {
      writeFileSync3(file, out, { mode: 384 });
    } catch {
      writeFileSync3(file, out);
    }
    return { ok: true, backup: void 0 };
  } catch (error) {
    return { ok: false, error: `\u5199\u5165 npmrc \u5931\u8D25\uFF1A${redact(error)}` };
  }
}
function npmConfigState() {
  const token = npmTokenFromNpmrc();
  return { configured: token.length > 0, masked: maskSecret(token), token };
}
function npmConfigView() {
  const state = npmConfigState();
  return { configured: state.configured, masked: state.masked };
}
function getPackageName(cwd) {
  if (typeof cwd !== "string" || cwd.trim().length === 0) return { ok: false, name: "", error: "\u7F3A\u5C11\u5DE5\u4F5C\u76EE\u5F55\u53C2\u6570" };
  try {
    const raw = readFileSync3(join3(cwd, "package.json"), "utf8");
    const data = JSON.parse(raw);
    if (typeof data.name !== "string") return { ok: false, name: "", error: "package.json \u7F3A\u5C11 name \u5B57\u6BB5" };
    return { ok: true, name: data.name, error: "" };
  } catch (error) {
    return { ok: false, name: "", error: `\u8BFB\u53D6 package.json \u5931\u8D25\uFF1A${redact(error)}` };
  }
}
function setPackageName(cwd, name2) {
  if (typeof cwd !== "string" || cwd.trim().length === 0) return { ok: false, error: "\u7F3A\u5C11\u5DE5\u4F5C\u76EE\u5F55\u53C2\u6570" };
  const clean = typeof name2 === "string" ? name2.trim() : "";
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(clean)) {
    return { ok: false, error: "\u5305\u540D\u4E0D\u7B26\u5408 npm \u547D\u540D\u89C4\u8303" };
  }
  const file = join3(cwd, "package.json");
  if (!existsSync3(file)) return { ok: false, error: "\u672A\u627E\u5230 package.json" };
  try {
    const raw = readFileSync3(file, "utf8");
    const data = JSON.parse(raw);
    data.name = clean;
    writeFileSync3(file, `${JSON.stringify(data, null, 2)}
`);
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: `\u5199\u5165 package.json \u5931\u8D25\uFF1A${redact(error)}` };
  }
}
function publishPackage(cwd) {
  return new Promise((resolve2) => {
    if (typeof cwd !== "string" || cwd.trim().length === 0) {
      resolve2({ ok: false, output: "", error: "\u7F3A\u5C11\u5DE5\u4F5C\u76EE\u5F55\u53C2\u6570" });
      return;
    }
    const child = spawn(
      "npm",
      ["publish", "--access=public", "--registry=https://registry.npmjs.org"],
      { cwd, windowsHide: true, timeout: 18e4 }
    );
    let out = "";
    let err = "";
    child.stdout?.on("data", (chunk) => {
      out += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      err += String(chunk);
    });
    child.on("error", (error) => resolve2({ ok: false, output: out, error: `\u542F\u52A8 npm \u5931\u8D25\uFF1A${redact(error)}` }));
    child.on("close", (code) => {
      if (code === 0) resolve2({ ok: true, output: out, error: "" });
      else resolve2({ ok: false, output: out + err, error: `npm publish \u9000\u51FA\u7801 ${code}` });
    });
  });
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
  return new Promise((resolve2) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        resolve2({ ok: false, error: `\u8BF7\u6C42\u4F53\u8D85\u8FC7\u4E0A\u9650\uFF08${MAX_BODY_BYTES} \u5B57\u8282\uFF09` });
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (text.length === 0) {
        resolve2({ ok: true, body: {} });
        return;
      }
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          resolve2({ ok: false, error: "\u8BF7\u6C42\u4F53\u5FC5\u987B\u662F JSON \u5BF9\u8C61" });
          return;
        }
        resolve2({ ok: true, body: parsed });
      } catch {
        resolve2({ ok: false, error: "\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON" });
      }
    });
    req.on("error", () => resolve2({ ok: false, error: "\u8BFB\u53D6\u8BF7\u6C42\u4F53\u5931\u8D25" }));
  });
}
function str(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
var pendingFlows = /* @__PURE__ */ new Map();
function createHandler(deps) {
  const startedAt = deps.startedAt ?? Date.now();
  return async function handler(req, res) {
    const method = (req.method ?? "GET").toUpperCase();
    const url = new URL(req.url ?? "/", "http://dsh.internal");
    const path = url.pathname.startsWith(ROUTE_PREFIX) ? url.pathname.slice(ROUTE_PREFIX.length) || "/" : url.pathname;
    try {
      if (!isSameOrigin(req)) {
        sendJson(res, 403, { ok: false, error: "\u62D2\u7EDD\u8DE8\u7AD9\u8BF7\u6C42" });
        return;
      }
      if (method === "GET") {
        if (path === "/health") {
          sendJson(res, 200, { ok: true, version: deps.version, startedAt });
          return;
        }
        if (path === "/state") {
          sendJson(res, 200, { ok: true, state: deps.store.snapshot() });
          return;
        }
        if (path === "/repo/status") {
          const cwd = str(url.searchParams.get("cwd")).trim();
          if (!cwd) {
            sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 cwd \u53C2\u6570", status: null });
            return;
          }
          const status = await readRepoStatus(cwd);
          sendJson(res, 200, { ok: true, status: { ...status, authorized: true } });
          return;
        }
        if (path === "/repo/changes") {
          const cwd = str(url.searchParams.get("cwd")).trim();
          if (!cwd) {
            sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 cwd \u53C2\u6570", changes: null });
            return;
          }
          const changes = await readRepoChanges(cwd);
          sendJson(res, 200, { ok: true, changes });
          return;
        }
        const requireRead = (errorPayload) => {
          const dir = str(url.searchParams.get("cwd")).trim();
          if (!dir) {
            sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 cwd \u53C2\u6570", ...errorPayload });
            return null;
          }
          return dir;
        };
        if (path === "/repo/branches") {
          const dir = requireRead({ branches: [], current: "" });
          if (!dir) return;
          const result = await readBranches(dir);
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error, branches: [], current: "" });
            return;
          }
          sendJson(res, 200, { ok: true, root: result.root, current: result.current, branches: result.branches });
          return;
        }
        if (path === "/repo/remotes") {
          const dir = requireRead({ remotes: [] });
          if (!dir) return;
          const result = await readRemotes(dir);
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error, remotes: [] });
            return;
          }
          sendJson(res, 200, { ok: true, root: result.root, remotes: result.remotes, upstream: result.upstream });
          return;
        }
        if (path === "/repo/commits") {
          const dir = requireRead({ commits: [] });
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
        if (path === "/repo/tags") {
          const dir = requireRead({ tags: [] });
          if (!dir) return;
          const result = await readTags(dir);
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error, tags: [] });
            return;
          }
          sendJson(res, 200, { ok: true, root: result.root, tags: result.tags });
          return;
        }
        if (path === "/repo/stash") {
          const dir = requireRead({ stashes: [] });
          if (!dir) return;
          const result = await readStashes(dir);
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error, stashes: [] });
            return;
          }
          sendJson(res, 200, { ok: true, root: result.root, stashes: result.stashes });
          return;
        }
        if (path === "/repo/commit") {
          const rev = str(url.searchParams.get("rev")).trim();
          const dir = requireRead({ commit: null, files: [], diff: "" });
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
        if (path === "/repo/diff") {
          const dir = requireRead({ diff: "" });
          if (!dir) return;
          const modeRaw = str(url.searchParams.get("mode")).trim();
          const mode = modeRaw === "staged" || modeRaw === "commit" ? modeRaw : "worktree";
          const result = await readDiff(
            dir,
            mode,
            str(url.searchParams.get("path")).trim(),
            str(url.searchParams.get("rev")).trim()
          );
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error, diff: "", truncated: false, totalLines: 0 });
            return;
          }
          sendJson(res, 200, {
            ok: true,
            root: result.root,
            diff: result.diff,
            truncated: result.truncated,
            totalLines: result.totalLines
          });
          return;
        }
        if (path === "/account/repos") {
          const accountId = str(url.searchParams.get("accountId")).trim();
          const account = accountId ? deps.store.getAccount(accountId) : deps.store.activeAccount();
          if (!account) {
            sendJson(res, 200, { ok: false, error: accountId ? "\u8D26\u53F7\u4E0D\u5B58\u5728" : "\u5C1A\u672A\u8FDE\u63A5 Git \u8D26\u53F7", repos: [] });
            return;
          }
          const token = deps.store.revealSecret(account.id);
          if (!token) {
            deps.store.markAccount(account.id, { status: "error", lastError: "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6" });
            sendJson(res, 200, { ok: false, error: "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6\uFF0C\u8BF7\u91CD\u65B0\u6388\u6743", repos: [] });
            return;
          }
          const result = await listAccountRepos(token);
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error ?? "\u8BFB\u53D6\u4ED3\u5E93\u5217\u8868\u5931\u8D25", repos: [] });
            return;
          }
          sendJson(res, 200, { ok: true, repos: result.repos, truncated: result.truncated });
          return;
        }
        if (path === "/npm/name") {
          const cwd = str(url.searchParams.get("cwd")).trim();
          if (!cwd) {
            sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 cwd \u53C2\u6570" });
            return;
          }
          const result = getPackageName(cwd);
          sendJson(res, result.ok ? 200 : 200, { ok: result.ok, name: result.name, error: result.error });
          return;
        }
        sendJson(res, 404, { ok: false, error: `\u672A\u77E5\u63A5\u53E3\uFF1AGET ${path}` });
        return;
      }
      if (method !== "POST") {
        sendJson(res, 405, { ok: false, error: `\u4E0D\u652F\u6301\u7684\u65B9\u6CD5\uFF1A${method}` });
        return;
      }
      const parsed = await readBody(req);
      if (!parsed.ok) {
        sendJson(res, 400, { ok: false, error: parsed.error });
        return;
      }
      const body = parsed.body ?? {};
      if (path === "/pat/connect") {
        const token = str(body.token).trim();
        if (token.length === 0) {
          sendJson(res, 400, { ok: false, error: "\u8BF7\u586B\u5199\u8BBF\u95EE\u4EE4\u724C" });
          return;
        }
        const verified = await verifyToken(token);
        if (!verified.ok || !verified.identity) {
          sendJson(res, 400, { ok: false, error: verified.error ?? "\u4EE4\u724C\u6821\u9A8C\u5931\u8D25" });
          return;
        }
        const identity = verified.identity;
        if (!identity.login) {
          sendJson(res, 400, { ok: false, error: "\u4EE4\u724C\u6709\u6548\u4F46\u65E0\u6CD5\u8BFB\u53D6\u8D26\u53F7\u8EAB\u4EFD\uFF08\u53EF\u80FD\u7F3A\u5C11 user \u8BFB\u53D6\u6743\u9650\uFF09" });
          return;
        }
        const label = str(body.label).trim();
        const record = deps.store.addAccount({
          provider: "github",
          kind: "pat",
          login: identity.login,
          displayName: label ? `${identity.displayName || identity.login}\uFF08${label}\uFF09` : identity.displayName,
          avatarUrl: identity.avatarUrl,
          scopes: identity.scopes,
          token
        });
        deps.log?.("info", `PAT \u8D26\u53F7\u5DF2\u63A5\u5165\uFF1A${record.login}`);
        sendJson(res, 200, { ok: true, account: { ...record, secret: "" }, state: deps.store.snapshot() });
        return;
      }
      if (path === "/oauth/start") {
        const clientId = str(body.clientId).trim();
        const started = await startDeviceFlow(clientId);
        if (!started.ok || !started.flow) {
          sendJson(res, 400, { ok: false, error: started.error ?? "\u65E0\u6CD5\u53D1\u8D77 OAuth \u6388\u6743" });
          return;
        }
        const pollKey = randomBytes3(12).toString("hex");
        pendingFlows.set(pollKey, { clientId, deviceCode: started.flow.deviceCode, createdAt: Date.now() });
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
        const result = await pollDeviceFlow(pending.clientId, pending.deviceCode);
        if (result.status === "authorized" && result.token) {
          const verified = await verifyToken(result.token);
          if (!verified.ok || !verified.identity?.login) {
            pendingFlows.delete(pollKey);
            sendJson(res, 400, { ok: false, status: "error", error: verified.error ?? "\u6388\u6743\u6210\u529F\u4F46\u8BFB\u53D6\u8D26\u53F7\u8EAB\u4EFD\u5931\u8D25" });
            return;
          }
          const identity = verified.identity;
          const record = deps.store.addAccount({
            provider: "github",
            kind: "oauth",
            login: identity.login,
            displayName: identity.displayName,
            avatarUrl: identity.avatarUrl,
            clientId: pending.clientId,
            scopes: identity.scopes,
            token: result.token
          });
          pendingFlows.delete(pollKey);
          deps.log?.("info", `OAuth \u8D26\u53F7\u5DF2\u63A5\u5165\uFF1A${record.login}`);
          sendJson(res, 200, { ok: true, status: "authorized", account: { ...record, secret: "" }, state: deps.store.snapshot() });
          return;
        }
        if (result.status === "denied" || result.status === "expired" || result.status === "error") {
          pendingFlows.delete(pollKey);
        }
        sendJson(res, 200, { ok: true, status: result.status, error: result.error ?? "", retryAfter: result.retryAfter ?? 0 });
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
        const verified = await verifyToken(token);
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
      const migrateNpmrcIfNeeded = async () => {
        if (deps.store.npmAccounts().length > 0) return;
        const legacy = npmTokenFromNpmrc();
        if (!legacy) return;
        const identity = await whoamiNpm(legacy);
        if (identity.ok && identity.username) {
          const rec = deps.store.addNpmAccount({ login: identity.username, token: legacy });
          deps.store.setNpmActiveId(rec.id);
          deps.log?.("info", `npm \u51ED\u636E\u5DF2\u4ECE ~/.npmrc \u6536\u7F16\uFF1A${identity.username}`);
        }
      };
      if (path === "/npm/connect") {
        const token = str(body.token).trim();
        if (token.length === 0) {
          sendJson(res, 400, { ok: false, error: "\u8BF7\u586B\u5199 npm token" });
          return;
        }
        const identity = await whoamiNpm(token);
        if (!identity.ok || !identity.username) {
          sendJson(res, 400, { ok: false, error: identity.error ?? "token \u9A8C\u8BC1\u5931\u8D25" });
          return;
        }
        const record = deps.store.addNpmAccount({ login: identity.username, token });
        const written = configureNpmToken(token);
        if (!written.ok) {
          sendJson(res, 500, { ok: false, error: `\u51ED\u636E\u5DF2\u4FDD\u5B58\u4F46 ~/.npmrc \u540C\u6B65\u5931\u8D25\uFF1A${written.error ?? "\u672A\u77E5\u539F\u56E0"}` });
          return;
        }
        deps.store.setNpmActiveId(record.id);
        deps.log?.("info", `npm \u51ED\u636E\u5DF2\u63A5\u5165\u5E76\u8BBE\u4E3A\u5F53\u524D\uFF1A${identity.username}`);
        sendJson(res, 200, { ok: true, id: record.id, login: identity.username });
        return;
      }
      if (path === "/npm/switch") {
        const id = str(body.id).trim();
        const record = deps.store.getNpmAccount(id);
        if (!record) {
          sendJson(res, 404, { ok: false, error: "npm \u51ED\u636E\u4E0D\u5B58\u5728" });
          return;
        }
        const token = deps.store.revealNpmSecret(id);
        if (!token) {
          deps.store.markNpmAccount(id, { lastError: "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6" });
          sendJson(res, 400, { ok: false, error: "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6\uFF0C\u8BF7\u91CD\u65B0\u7C98\u8D34 token" });
          return;
        }
        const identity = await whoamiNpm(token);
        if (!identity.ok) {
          deps.store.markNpmAccount(id, { lastError: identity.error ?? "\u9A8C\u8BC1\u5931\u8D25" });
          sendJson(res, 400, { ok: false, error: `\u5207\u6362\u88AB\u62D2\u7EDD\uFF1A${identity.error ?? "token \u9A8C\u8BC1\u5931\u8D25"}` });
          return;
        }
        const written = configureNpmToken(token);
        if (!written.ok) {
          sendJson(res, 500, { ok: false, error: `~/.npmrc \u540C\u6B65\u5931\u8D25\uFF1A${written.error ?? "\u672A\u77E5\u539F\u56E0"}` });
          return;
        }
        deps.store.setNpmActiveId(id);
        deps.store.markNpmAccount(id, { lastError: "" });
        deps.log?.("info", `npm \u5F53\u524D\u51ED\u636E\u5DF2\u5207\u6362\uFF1A${record.login}`);
        sendJson(res, 200, { ok: true, id, login: record.login });
        return;
      }
      if (path === "/npm/remove") {
        const id = str(body.id).trim();
        if (!deps.store.removeNpmAccount(id)) {
          sendJson(res, 404, { ok: false, error: "npm \u51ED\u636E\u4E0D\u5B58\u5728" });
          return;
        }
        deps.log?.("info", `npm \u51ED\u636E\u5DF2\u79FB\u9664\uFF1A${id.slice(0, 8)}\u2026`);
        sendJson(res, 200, { ok: true });
        return;
      }
      if (path === "/npm/status") {
        await migrateNpmrcIfNeeded();
        const list = deps.store.npmAccounts();
        const activeId = deps.store.settings().npmActiveId;
        let activeState = "connected";
        let activeError = "";
        for (const item of list) {
          if (item.id === activeId) {
            const token = deps.store.revealNpmSecret(item.id);
            if (!token) {
              activeState = "error";
              activeError = "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6";
            } else {
              const ident = await whoamiNpm(token);
              activeState = ident.ok ? "connected" : "error";
              activeError = ident.ok ? "" : ident.error ?? "\u9A8C\u8BC1\u5931\u8D25";
            }
          }
        }
        sendJson(res, 200, {
          ok: true,
          npm: {
            accounts: list.map((item) => ({
              id: item.id,
              login: item.login,
              masked: maskSecret(deps.store.revealNpmSecret(item.id) ?? ""),
              active: item.id === activeId,
              state: item.id === activeId ? activeState : "saved",
              error: item.id === activeId ? activeError : item.lastError
            })),
            activeState,
            activeError,
            npmrcConfigured: npmConfigView().configured
          }
        });
        return;
      }
      if (path === "/settings") {
        const patch = {};
        if ("allowWrite" in body) patch.allowWrite = body.allowWrite === true;
        if ("requireConfirm" in body) patch.requireConfirm = body.requireConfirm !== false;
        if ("autoSubmit" in body) patch.autoSubmit = body.autoSubmit === true;
        if ("defaultAccountId" in body) patch.defaultAccountId = str(body.defaultAccountId);
        const settings = deps.store.updateSettings(patch);
        sendJson(res, 200, { ok: true, settings, state: deps.store.snapshot() });
        return;
      }
      const writeSettings = deps.store.settings();
      const requireWrite = () => {
        if (writeSettings.allowWrite !== true) {
          return { allowed: false };
        }
        return { allowed: true };
      };
      if (path === "/repo/setup") {
        const gate = requireWrite();
        if (!gate.allowed) {
          sendJson(res, 403, { ok: false, error: "\u672A\u5F00\u542F\u300C\u5141\u8BB8 Agent \u4FEE\u6539\u4ED3\u5E93\u300D\uFF0C\u8BF7\u5728\u300C\u8D26\u53F7\u4E0E\u6388\u6743\u300D\u4E2D\u5F00\u542F" });
          return;
        }
        const cwd = str(body.cwd).trim();
        const name2 = str(body.name).trim();
        const isPrivate = body.private === true;
        if (!cwd) {
          sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 cwd \u53C2\u6570" });
          return;
        }
        if (!/^[\w.-]{1,100}$/.test(name2)) {
          sendJson(res, 400, { ok: false, error: "\u4ED3\u5E93\u540D\u4E0D\u7B26\u5408 GitHub \u547D\u540D\u89C4\u8303" });
          return;
        }
        const initResult = await initRepo(cwd, "main");
        if (!initResult.ok) {
          sendJson(res, 200, { ok: false, error: initResult.error ?? "\u521D\u59CB\u5316\u4ED3\u5E93\u5931\u8D25" });
          return;
        }
        const account = writeSettings.defaultAccountId ? deps.store.getAccount(writeSettings.defaultAccountId) : deps.store.activeAccount();
        if (!account) {
          sendJson(res, 200, { ok: false, error: "\u5C1A\u672A\u8FDE\u63A5 Git \u8D26\u53F7\uFF0C\u65E0\u6CD5\u521B\u5EFA\u8FDC\u7A0B\u4ED3\u5E93" });
          return;
        }
        const token = deps.store.revealSecret(account.id);
        if (!token) {
          sendJson(res, 200, { ok: false, error: "\u51ED\u636E\u65E0\u6CD5\u89E3\u5BC6\uFF0C\u8BF7\u91CD\u65B0\u6388\u6743" });
          return;
        }
        const repo = await createRepo(token, name2, { private: isPrivate });
        if (!repo.ok) {
          sendJson(res, 200, { ok: false, error: repo.error ?? "\u521B\u5EFA\u8FDC\u7A0B\u4ED3\u5E93\u5931\u8D25" });
          return;
        }
        const remoteUrl = `https://github.com/${account.login}/${name2}.git`;
        const addResult = await addRemote(cwd, "origin", remoteUrl);
        if (!addResult.ok) {
          sendJson(res, 200, { ok: false, error: addResult.error ?? "\u5173\u8054\u8FDC\u7A0B\u4ED3\u5E93\u5931\u8D25", remoteUrl });
          return;
        }
        let committed = false;
        if (body.commit !== false) {
          const commitResult = await initialCommit(cwd, "init");
          committed = commitResult.ok;
        }
        sendJson(res, 200, { ok: true, root: initResult.root, branch: initResult.branch, remoteUrl, committed });
        return;
      }
      if (path === "/npm/set-name") {
        const gate = requireWrite();
        if (!gate.allowed) {
          sendJson(res, 403, { ok: false, error: "\u672A\u5F00\u542F\u300C\u5141\u8BB8 Agent \u4FEE\u6539\u4ED3\u5E93\u300D\uFF0C\u8BF7\u5728\u300C\u8D26\u53F7\u4E0E\u6388\u6743\u300D\u4E2D\u5F00\u542F" });
          return;
        }
        const cwd = str(body.cwd).trim();
        const name2 = str(body.name).trim();
        if (!cwd) {
          sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 cwd \u53C2\u6570" });
          return;
        }
        const result = setPackageName(cwd, name2);
        sendJson(res, result.ok ? 200 : 200, { ok: result.ok, error: result.error });
        return;
      }
      if (path === "/npm/publish") {
        const gate = requireWrite();
        if (!gate.allowed) {
          sendJson(res, 403, { ok: false, error: "\u672A\u5F00\u542F\u300C\u5141\u8BB8 Agent \u4FEE\u6539\u4ED3\u5E93\u300D\uFF0C\u8BF7\u5728\u300C\u8D26\u53F7\u4E0E\u6388\u6743\u300D\u4E2D\u5F00\u542F" });
          return;
        }
        const cwd = str(body.cwd).trim();
        if (!cwd) {
          sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 cwd \u53C2\u6570" });
          return;
        }
        const result = await publishPackage(cwd);
        sendJson(res, result.ok ? 200 : 200, { ok: result.ok, output: result.output, error: result.error });
        return;
      }
      sendJson(res, 404, { ok: false, error: `\u672A\u77E5\u63A5\u53E3\uFF1APOST ${path}\uFF08\u4ED3\u5E93\u5199\u64CD\u4F5C\u8BF7\u8D70 Agent \u5DE5\u5177 git_write / git_confirm\uFF09` });
    } catch (error) {
      deps.log?.("error", `\u63A5\u53E3\u5F02\u5E38 ${method} ${path}\uFF1A${redact(error)}`);
      sendJson(res, 500, { ok: false, error: "\u5185\u90E8\u9519\u8BEF" });
    }
  };
}

// src/node/tools.ts
import { randomBytes as randomBytes4 } from "node:crypto";
var OBJECT_SCHEMA = { type: "object", additionalProperties: true };
var textBlocks = (text) => [{ type: "text", text }];
var PENDING_TTL_MS = 5 * 6e4;
var pendingWrites = /* @__PURE__ */ new Map();
var WRITE_ACTIONS = [
  "init",
  "add",
  "commit",
  "checkout",
  "switch",
  "restore",
  "reset",
  "stash",
  "merge",
  "rebase",
  "push",
  "pull",
  "fetch",
  "cherry-pick",
  "revert",
  "tag",
  "branch",
  "clean"
];
function ok(value) {
  return { ok: true, ...value };
}
function fail(error, extra = {}) {
  return { ok: false, error, ...extra };
}
function resolveRoot(ctx, cwd) {
  if (typeof cwd !== "string" || cwd.trim().length === 0) return { error: "\u7F3A\u5C11\u5DE5\u4F5C\u76EE\u5F55\u53C2\u6570\uFF08cwd\uFF09" };
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
    description: "\u67E5\u770B Git \u9762\u677F\u72B6\u6001\uFF1A\u5DF2\u8FDE\u63A5\u8D26\u53F7\uFF08\u8131\u654F\uFF09\u3001\u662F\u5426\u5141\u8BB8\u5199\u64CD\u4F5C\u3001\u5199\u64CD\u4F5C\u662F\u5426\u9700\u786E\u8BA4\u3002\u8C03\u7528\u4EFB\u4F55\u5176\u5B83 git_* \u5DE5\u5177\u524D\u53EF\u5148\u67E5\u8FD9\u4E2A\u786E\u8BA4\u6743\u9650\u8303\u56F4\u3002",
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
        allowWrite: settings.allowWrite,
        requireConfirm: settings.requireConfirm,
        note: "\u672C\u5730\u76EE\u5F55\u4E0D\u9650\uFF08v3.3 \u8D77\u65E0\u76EE\u5F55\u767D\u540D\u5355\uFF09\uFF1B\u8BFB\u64CD\u4F5C\u76F4\u63A5\u6267\u884C\uFF0C\u5199\u64CD\u4F5C\u53D7 allowWrite \u4E0E requireConfirm \u7EA6\u675F\u3002"
      });
    }
  });
  add({
    name: "git_repo_info",
    description: "\u8BFB\u53D6\u672C\u5730\u4ED3\u5E93\u57FA\u672C\u4FE1\u606F\uFF1A\u5F53\u524D\u5206\u652F\u3001\u8FDC\u7AEF\u5730\u5740\uFF08\u5DF2\u8131\u654F\uFF09\u3001\u5DE5\u4F5C\u533A\u6539\u52A8\u7EDF\u8BA1\u3001\u6700\u8FD1\u4E00\u6B21\u63D0\u4EA4\u3002cwd \u9700\u662F\u672C\u5730\u4ED3\u5E93\u6839\u76EE\u5F55\uFF08\u7EDD\u5BF9\u8DEF\u5F84\uFF09\u3002",
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
    name: "git_write",
    description: "\u6267\u884C\u4F1A\u6539\u53D8\u4ED3\u5E93\u72B6\u6001\u7684\u64CD\u4F5C\uFF08init / add / commit / checkout / switch / restore / reset / stash / merge / rebase / push / pull / fetch / cherry-pick / revert / tag / branch / clean\uFF09\u3002\u8C03\u7528\u524D\u5FC5\u987B\u5411\u7528\u6237\u8BF4\u660E\u5C06\u6267\u884C\u7684\u52A8\u4F5C\u4E0E\u76EE\u6807\u4ED3\u5E93\uFF1B\u82E5\u7528\u6237\u5F00\u542F\u4E86\u300C\u5199\u64CD\u4F5C\u9700\u786E\u8BA4\u300D\uFF0C\u672C\u5DE5\u5177\u53EA\u8FD4\u56DE\u5F85\u786E\u8BA4\u4FE1\u606F\u4E0E confirmToken\uFF0C\u9700\u518D\u8C03\u7528 git_confirm \u624D\u771F\u6B63\u6267\u884C\u3002",
    parameters: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "\u672C\u5730\u4ED3\u5E93\u6839\u76EE\u5F55\u7684\u7EDD\u5BF9\u8DEF\u5F84" },
        action: { type: "string", description: `\u52A8\u4F5C\u540D\uFF1A${WRITE_ACTIONS.join(" / ")}` },
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
      if (!WRITE_ACTIONS.includes(action)) {
        return fail(`\u4E0D\u652F\u6301\u7684\u5199\u52A8\u4F5C\uFF1A${action || "(\u7A7A)"}\u3002\u5141\u8BB8\uFF1A${WRITE_ACTIONS.join(" / ")}`);
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
      const token = String(args?.confirmToken ?? "");
      if (args?.confirmed === false) {
        pendingWrites.delete(token);
        return fail("\u7528\u6237\u672A\u540C\u610F\u6267\u884C\uFF0C\u5DF2\u53D6\u6D88\u8BE5\u5199\u64CD\u4F5C\uFF08confirmToken \u5DF2\u4F5C\u5E9F\uFF09");
      }
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
var name = "@zjjlivingfree/dsh-git-panel";
var inject = ["webServer"];
var PLUGIN_VERSION = "0.12.1";
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
    log
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
  }, "@zjjlivingfree/dsh-git-panel:http");
  ctx.effect(() => {
    const dispose = registerGitTools({
      store,
      tools: ctx.get?.("tools"),
      log
    });
    return dispose;
  }, "@zjjlivingfree/dsh-git-panel:tools");
}
export {
  PLUGIN_VERSION,
  apply,
  inject,
  name
};
