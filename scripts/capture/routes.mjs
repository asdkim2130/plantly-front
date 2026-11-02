/**
 * app/ 의 화면(page.tsx)과 scenarios.mjs 를 대 보고, 캡처 목록에 한 번도 안 나오는 화면을 찾는다.
 *
 * 새 페이지를 만들고 scenarios.mjs 에 줄을 넣는 걸 잊었을 때 알려 주려는 것이다. 자동으로 찍지는 않는다 —
 * `[id]` 에 어떤 회사를 넣을지, 어느 계정으로 볼지는 사람이 정해야 한다.
 *
 * 폴더 이름 → 주소 규칙(App Router):
 *   (group)      주소에 안 나온다          _private, @slot  화면이 아니다(건너뛴다)
 *   [id]         한 조각 아무거나          [...slug]       한 조각 이상          [[...slug]]  0조각 이상
 */

import { readdir } from "node:fs/promises";
import path from "node:path";

const PAGE_FILE = /^page\.(tsx|ts|jsx|js|mdx)$/;

/** app/ 아래 page 파일마다 { route: "/companies/[id]", file } */
export async function listRoutes(appDir) {
  const found = [];
  async function walk(dir, segments) {
    const entries = await readdir(dir, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && PAGE_FILE.test(e.name))) {
      const file = entries.find((e) => e.isFile() && PAGE_FILE.test(e.name)).name;
      found.push({ route: "/" + segments.join("/"), file: path.join(dir, file) });
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith("_") || e.name.startsWith("@")) continue;
      const isGroup = e.name.startsWith("(") && e.name.endsWith(")");
      await walk(path.join(dir, e.name), isGroup ? segments : [...segments, e.name]);
    }
  }
  await walk(appDir, []);
  return found.sort((a, b) => a.route.localeCompare(b.route));
}

/** "/companies/[id]/edit" → 주소("/companies/7/edit")에 맞는지 보는 정규식 */
export function routePattern(route) {
  const parts = route.split("/").filter(Boolean).map((seg) => {
    if (/^\[\[\.\.\..+\]\]$/.test(seg)) return "(?:/[^/]+)*";
    if (/^\[\.\.\..+\]$/.test(seg)) return "(?:/[^/]+)+";
    if (/^\[.+\]$/.test(seg)) return "/[^/]+";
    return "/" + seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  return new RegExp(`^${parts.join("") || "/"}$`);
}

/** 캡처 목록(path 의 주소 부분)이 하나도 닿지 않는 화면 */
export async function findUncovered(appDir, scenarios) {
  const paths = scenarios.map((s) => new URL(s.path, "http://x").pathname.replace(/\/$/, "") || "/");
  const routes = await listRoutes(appDir);
  return routes.filter(({ route }) => {
    const re = routePattern(route);
    return !paths.some((p) => re.test(p));
  });
}
