/**
 * 구현된 화면을 한꺼번에 캡처한다 — 상태마다 전체 페이지 PNG, 그리고 그걸 상태 전환 띠로 넘겨 보는 index.html 하나.
 *
 *   node scripts/capture/capture.mjs                 # 전부
 *   node scripts/capture/capture.mjs register detail # id 에 이 글자가 든 상태만
 *   node scripts/capture/capture.mjs --check         # 캡처 없이 "목록에 없는 화면"만 확인(서버 불필요)
 *
 * 전제: 프론트(npm run dev, :3000)와 백엔드(local,seed, :8080)가 떠 있다.
 * 결과: captures/<날짜-시각>/  (gitignore)
 *
 * **쓰기 요청은 전부 막는다.** GET 이 아닌 /api 요청은 로그인 외에 서버로 나가지 않는다. 서버에 써야 나오는 상태
 * (인증 실패 배너·발행 완료)는 scenarios.mjs 의 mocks 로 응답을 지어 보여 준다. 캡처를 몇 번 돌려도 로컬 DB 와
 * 하루 인증 시도 횟수가 그대로다.
 *
 * 예전에는 스크립트를 뺀 정적 HTML 도 함께 만들었는데, 뷰어(iframe) 안에서 배치가 틀어져 보인다는 보고가 있어 뺐다.
 * 이 컴퓨터에서는 재현되지 않아 원인을 확정하지 못했다 — 되살리려면 git 이력의 serializeDom/rewriteHtml 을 본다.
 */

import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCENARIOS } from "./scenarios.mjs";
import { findUncovered } from "./routes.mjs";

const BASE = process.env.CAPTURE_BASE ?? "http://localhost:3000";
const WIDTH = 1240; // 판 1180px + 여백. Claude Design 원본의 $preview 폭과 같다
const PASSWORD = "Password1!";
const ACCOUNTS = {
  owner1: "owner1@plantly.local",
  empty: "empty@plantly.local",
  admin: "admin@plantly.local",
};
const ACCOUNT_LABEL = { anon: "비로그인", owner1: "owner1", empty: "empty", admin: "admin" };

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const outDir = path.join(root, "captures", stamp);

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const filters = args.filter((a) => !a.startsWith("--"));
const scenarios = filters.length ? SCENARIOS.filter((s) => filters.some((f) => s.id.includes(f))) : SCENARIOS;

const ALLOWED_WRITES = [/\/api\/v1\/auth\/login$/];

async function main() {
  if (checkOnly) {
    if (!(await reportUncovered())) console.log("app/ 의 모든 화면이 캡처 목록(scenarios.mjs)에 있습니다.");
    return;
  }
  await mkdir(path.join(outDir, "png"), { recursive: true });

  const browser = await chromium.launch({ channel: process.env.CAPTURE_CHANNEL ?? "chrome" });
  const contexts = {};
  const results = [];
  const blocked = [];

  async function contextFor(account) {
    if (contexts[account]) return contexts[account];
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: 900 },
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
    });
    // Next 개발 모드의 왼쪽 아래 표시를 감춘다(캡처에 찍히지 않게)
    await context.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
    });
    await context.route("**/api/v1/**", (route) => {
      const req = route.request();
      if (["GET", "HEAD", "OPTIONS"].includes(req.method()) || ALLOWED_WRITES.some((r) => r.test(new URL(req.url()).pathname))) {
        return route.fallback();
      }
      blocked.push(`${req.method()} ${new URL(req.url()).pathname}`);
      return route.abort("blockedbyclient");
    });
    if (account !== "anon") await login(context, ACCOUNTS[account]);
    contexts[account] = context;
    return context;
  }

  for (const scenario of scenarios) {
    const label = `${scenario.id} (${ACCOUNT_LABEL[scenario.account]})`;
    try {
      const context = await contextFor(scenario.account);
      const result = await capture(context, scenario);
      results.push(result);
      console.log(`✓ ${label}  ${result.height}px`);
    } catch (e) {
      results.push({ ...meta(scenario), error: String(e?.message ?? e).split("\n")[0] });
      console.log(`✗ ${label}  ${String(e?.message ?? e).split("\n")[0]}`);
    }
  }

  await browser.close();

  await writeIndex(results);

  const failed = results.filter((r) => r.error).length;
  console.log(`\n${results.length - failed}/${results.length} 상태 캡처 → ${path.relative(root, outDir)}${path.sep}index.html`);
  if (blocked.length) console.log(`막은 쓰기 요청 ${blocked.length}건:\n  ${[...new Set(blocked)].join("\n  ")}`);
  await reportUncovered();
}

/**
 * app/ 에 있는데 scenarios.mjs 에 한 번도 안 나오는 화면을 알린다. 새 페이지를 만들고 줄 추가를 잊었을 때를 위한 것.
 * 일부만 찍은 실행(필터)이어도 전체 목록 기준으로 본다. 반환값은 빠진 화면 수
 */
async function reportUncovered() {
  const missing = await findUncovered(path.join(root, "app"), SCENARIOS);
  if (missing.length) {
    console.log(`\n⚠ 캡처 목록에 없는 화면 ${missing.length}개 — scripts/capture/scenarios.mjs 에 상태를 추가하세요:`);
    const width = Math.max(...missing.map((m) => m.route.length));
    for (const m of missing) console.log(`  ${m.route.padEnd(width)}   (${path.relative(root, m.file).replaceAll(path.sep, "/")})`);
  }
  return missing.length;
}

/** 세션 쿠키를 컨텍스트에 심는다. 화면 로그인을 거치지 않고 API 로 바로 — 쿠키는 컨텍스트와 공유된다 */
async function login(context, email) {
  const csrf = await (await context.request.get(`${BASE}/api/v1/auth/csrf`)).json();
  const res = await context.request.post(`${BASE}/api/v1/auth/login`, {
    headers: { [csrf.headerName]: csrf.token },
    data: { email, password: PASSWORD, remember: false },
  });
  if (!res.ok()) throw new Error(`${email} 로그인 실패 (HTTP ${res.status()})`);
}

function meta(s) {
  return { id: s.id, group: s.group, title: s.title, account: ACCOUNT_LABEL[s.account], path: s.path, note: s.note ?? "" };
}

async function capture(context, scenario) {
  const page = await context.newPage();
  page.on("dialog", (d) => d.dismiss()); // beforeunload 확인 창이 캡처를 멈추지 않게

  if (scenario.clearStorage) {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("plantly:register:businessNumber");
      } catch {}
    });
  }
  for (const [pattern, mock] of Object.entries(scenario.mocks ?? {})) {
    await page.route(pattern, (route) => {
      if (mock.method && route.request().method() !== mock.method) return route.fallback();
      return route.fulfill({ status: mock.status, contentType: "application/json", body: JSON.stringify(mock.body) });
    });
  }

  try {
    await page.goto(BASE + scenario.path, { waitUntil: "networkidle" });
    await settle(page);
    if (scenario.action) {
      await scenario.action(page);
      await settle(page);
    }
    await loadLazy(page);

    const file = scenario.id;
    await page.screenshot({ path: path.join(outDir, "png", `${file}.png`), fullPage: true });
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    return { ...meta(scenario), url: page.url().replace(BASE, ""), png: `png/${file}.png`, height };
  } finally {
    await page.close();
  }
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // 세션 확인·데이터 로딩 중의 자리표시(aria-busy)가 걷힐 때까지. 끝내 안 걷히면 그 상태 그대로 찍는다
  await page.waitForFunction(() => !document.querySelector("main [aria-busy='true'], main [aria-busy='']"), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
}

/** loading="lazy" 사진은 화면에 들어와야 받으므로 끝까지 한 번 내려갔다 올라온다 */
async function loadLazy(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(300);
}

// ── 상태 전환 뷰어 ──

async function writeIndex(results) {
  const template = await readFile(path.join(here, "viewer.html"), "utf8");
  const data = {
    generatedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    base: BASE,
    width: WIDTH,
    states: results,
  };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  await writeFile(path.join(outDir, "index.html"), template.replace("/*__DATA__*/null", json));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
