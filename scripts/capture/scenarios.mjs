/**
 * 캡처할 화면 목록. 한 줄이 "상태 하나"다 — 화면(group) 하나에 상태가 여럿 붙는다.
 *
 *  - account : 어떤 계정으로 볼지(anon = 비로그인). 계정은 백엔드 시드(비밀번호 공통 Password1!)
 *  - path    : 처음 여는 주소
 *  - action  : 열고 나서 할 조작(입력·클릭). 상태를 만들기 위한 것이다
 *  - mocks   : 응답을 가짜로 바꿀 API. **쓰기 요청은 기본적으로 전부 막혀 있어서**(capture.mjs 의 guard)
 *              실패 배너·완료 화면처럼 서버에 무언가 써야 나오는 상태는 여기서 응답을 지어 보여 준다.
 *              그래서 캡처를 몇 번 돌려도 로컬 DB·인증 시도 횟수가 변하지 않는다.
 *  - clearStorage : 이 기기에 기억한 사업자번호를 지우고 연다(등록 화면이 이어쓰기를 제안하지 않게)
 *
 * id 는 파일 이름이 되므로 영문·숫자·하이픈만 쓴다.
 */

const fail = (status, code, error) => ({ status, body: { success: false, message: null, data: null, code, error, errors: [] } });
const ok = (data) => ({ status: 200, body: { success: true, message: null, data, code: null, error: null, errors: [] } });

const VERIFY = "**/api/v1/companies/verification";

/** 사업자 인증 칸 세 개를 채우고 "국세청 확인"을 누른다 */
async function submitVerify(page, number = "123-45-67890") {
  await page.fill("#v-number", number);
  await page.fill("#v-ceo", "홍길동");
  await page.fill("#v-date", "2015-06-24");
  await page.getByRole("button", { name: /국세청 확인/ }).click();
}

const verifyFailure = (id, title, mock, note) => ({
  id: `register-verify-${id}`,
  group: "기업정보 등록",
  title,
  account: "owner1",
  path: "/companies/new",
  clearStorage: true,
  mocks: { [VERIFY]: mock },
  action: (page) => submitVerify(page),
  note: `${note} (응답은 가짜 — 실제 인증 시도 횟수를 쓰지 않는다)`,
});

const resumeDraft = (number) => async (page) => {
  await page.getByRole("button", { name: "이어서 작성하기" }).click();
};

export const SCENARIOS = [
  // ── 메인 ──
  { id: "home", group: "메인", title: "기본 (비로그인)", account: "anon", path: "/" },
  {
    id: "home-search",
    group: "메인",
    title: "히어로 검색 결과",
    account: "anon",
    path: "/",
    action: async (page) => {
      await page.fill('input[type="search"]', "정밀");
      await page.press('input[type="search"]', "Enter");
    },
    note: "검색어가 걸리면 스포트라이트·추천 레일이 접힌다",
  },
  { id: "home-owner", group: "메인", title: "로그인 (owner1)", account: "owner1", path: "/" },

  // ── 목록/검색 ──
  { id: "list", group: "기업 목록/검색", title: "조건 없음", account: "anon", path: "/companies" },
  {
    id: "list-advanced",
    group: "기업 목록/검색",
    title: "고급검색 펼침",
    account: "anon",
    path: "/companies",
    action: (page) => page.locator("summary", { hasText: "고급검색" }).first().click(),
  },
  { id: "list-filtered", group: "기업 목록/검색", title: "검색어 + 분류 패싯", account: "anon", path: "/companies?keyword=정밀&categoryIds=4" },
  { id: "list-empty", group: "기업 목록/검색", title: "결과 없음", account: "anon", path: "/companies?keyword=존재하지않는검색어" },
  { id: "list-out-of-range", group: "기업 목록/검색", title: "페이지 범위 밖", account: "anon", path: "/companies?page=99" },

  // ── 공개 상세 ──
  { id: "detail-c01", group: "기업 상세(공개)", title: "C01 기본 공개", account: "anon", path: "/companies/1" },
  { id: "detail-c14", group: "기업 상세(공개)", title: "C14 검수 배지만", account: "anon", path: "/companies/14" },
  { id: "detail-c16", group: "기업 상세(공개)", title: "C16 배지 없음", account: "anon", path: "/companies/16" },
  { id: "detail-c17", group: "기업 상세(공개)", title: "C17 추천 + 에디터 선정", account: "anon", path: "/companies/17" },
  { id: "detail-c20", group: "기업 상세(공개)", title: "C20 빈 컬렉션", account: "anon", path: "/companies/20" },
  { id: "detail-c21", group: "기업 상세(공개)", title: "C21 최대치", account: "anon", path: "/companies/21" },
  { id: "detail-c22", group: "기업 상세(공개)", title: "C22 긴 텍스트", account: "anon", path: "/companies/22" },
  { id: "detail-404", group: "기업 상세(공개)", title: "비공개 회사(404)", account: "anon", path: "/companies/2" },

  // ── 로그인 ──
  { id: "login", group: "로그인", title: "기본", account: "anon", path: "/login" },
  {
    id: "login-wrong",
    group: "로그인",
    title: "비밀번호 불일치",
    account: "anon",
    path: "/login",
    action: async (page) => {
      await page.fill("#email", "owner1@plantly.local");
      await page.fill("#password", "WrongPassword1!");
      await page.click('button[type="submit"]');
    },
  },
  {
    id: "login-suspended",
    group: "로그인",
    title: "정지 계정",
    account: "anon",
    path: "/login",
    action: async (page) => {
      await page.fill("#email", "suspended@plantly.local");
      await page.fill("#password", "Password1!");
      await page.click('button[type="submit"]');
    },
  },

  // ── 내 기업 ──
  { id: "my", group: "내 기업 목록", title: "owner1 · 1페이지", account: "owner1", path: "/companies/my" },
  { id: "my-page2", group: "내 기업 목록", title: "owner1 · 2페이지", account: "owner1", path: "/companies/my?page=2" },
  { id: "my-empty", group: "내 기업 목록", title: "빈 상태 (empty)", account: "empty", path: "/companies/my" },

  // ── 소유자 상세 ──
  { id: "manage-c01", group: "소유자 기업 상세", title: "C01 공개", account: "owner1", path: "/companies/1/manage" },
  { id: "manage-c02", group: "소유자 기업 상세", title: "C02 비공개", account: "owner1", path: "/companies/2/manage" },
  { id: "manage-forbidden", group: "소유자 기업 상세", title: "남의 회사(403)", account: "owner1", path: "/companies/7/manage" },

  // ── 수정 ──
  { id: "edit-c01", group: "기업정보 수정", title: "C01 처음 연 상태", account: "owner1", path: "/companies/1/edit" },
  {
    id: "edit-c01-dirty",
    group: "기업정보 수정",
    title: "고친 섹션 (저장 줄)",
    account: "owner1",
    path: "/companies/1/edit",
    action: async (page) => {
      const field = page.getByLabel("한 줄 요약").first();
      await field.fill("캡처용으로 고친 한 줄 요약 — 저장은 하지 않는다");
    },
    note: "저장 버튼은 누르지 않는다(눌러도 쓰기 요청은 막혀 있다)",
  },

  // ── 등록 ──
  { id: "register-verify", group: "기업정보 등록", title: "1단계 · 사업자 인증", account: "owner1", path: "/companies/new", clearStorage: true },
  verifyFailure("mismatch", "인증 · 정보 불일치", fail(400, "VERIFICATION_MISMATCH", "사업자등록번호·대표자명·개업일자가 국세청 등록 정보와 일치하지 않습니다."), "대표자명·개업일자 칸이 빨갛게"),
  verifyFailure("closed", "인증 · 폐업", fail(400, "VERIFICATION_CLOSED", "폐업한 사업자는 등록할 수 없습니다."), "고칠 입력이 없어 다른 번호로"),
  verifyFailure("suspended", "인증 · 휴업", fail(400, "VERIFICATION_SUSPENDED", "휴업 중인 사업자는 등록할 수 없습니다."), "고칠 입력이 없어 다른 번호로"),
  verifyFailure("not-registered", "인증 · 미등록", fail(400, "VERIFICATION_NOT_REGISTERED", "국세청에 등록되지 않은 사업자등록번호입니다."), "고칠 입력이 없어 다른 번호로"),
  verifyFailure("taken", "인증 · 이미 등록됨", fail(409, "BUSINESS_NUMBER_TAKEN", "이미 사용 중인 사업자번호입니다."), "중복 등록"),
  verifyFailure("limit", "인증 · 하루 횟수 초과", fail(429, "VERIFICATION_LIMIT_EXCEEDED", "하루 인증 시도 횟수를 초과했습니다. 내일 다시 시도해주세요."), "429"),
  verifyFailure("unavailable", "인증 · 국세청 지연", fail(503, "VERIFICATION_UNAVAILABLE", "국세청 시스템 점검 등으로 확인이 지연되고 있습니다. 잠시 후 다시 시도해주세요."), "503 — 입력 오류처럼 보이지 않게"),
  {
    id: "register-resume",
    group: "기업정보 등록",
    title: "인증 · 초안 발견(이어쓰기)",
    account: "owner1",
    path: "/companies/new?resume=7000003003",
    note: "시드 D03 — 기본 정보만 채운 초안",
  },
  {
    id: "register-orphan",
    group: "기업정보 등록",
    title: "인증 · 초안은 있는데 인증이 없음",
    account: "owner1",
    path: "/companies/new?resume=7000003005",
    mocks: {
      "**/api/v1/companies/drafts/7000003005": {
        method: "GET",
        ...ok({ businessNumber: "7000003005", payload: { companyName: "서일도장산업" }, verification: null, updatedAt: "2026-10-30T10:00:00" }),
      },
    },
    note: "초안 응답의 verification 이 null(전부 회수됨)인 경우 — 응답은 가짜",
  },
  {
    id: "register-form-partial",
    group: "기업정보 등록",
    title: "2단계 · 작성 (일부 채움)",
    account: "owner1",
    path: "/companies/new?resume=7000003003",
    action: resumeDraft(),
    note: "시드 D03",
  },
  {
    id: "register-form-full",
    group: "기업정보 등록",
    title: "2단계 · 작성 (전부 채움)",
    account: "owner1",
    path: "/companies/new?resume=7000003004",
    action: resumeDraft(),
    note: "시드 D04 — 발행 가능한 완전 초안",
  },
  {
    id: "register-form-errors",
    group: "기업정보 등록",
    title: "2단계 · 발행 시 오류 모음",
    account: "owner1",
    path: "/companies/new?resume=7000003002",
    action: async (page) => {
      await resumeDraft()(page);
      await page.getByRole("button", { name: "발행하기" }).first().click();
      await page.evaluate(() => window.scrollTo(0, 0));
    },
    note: "시드 D02(거의 빈 초안)에서 발행 — 화면 검증만 돌고 서버로는 가지 않는다",
  },
  {
    id: "register-done",
    group: "기업정보 등록",
    title: "3단계 · 발행 완료",
    account: "owner1",
    path: "/companies/new?resume=7000003004",
    mocks: { "**/api/v1/companies": { method: "POST", ...ok({ id: 1 }) } },
    action: async (page) => {
      await resumeDraft()(page);
      await page.getByRole("button", { name: "발행하기" }).first().click();
    },
    note: "시드 D04 를 발행 — 발행 응답은 가짜(id=1)라 실제로 회사가 생기지 않는다",
  },

  // ── 관리자 ──
  { id: "admin-list", group: "관리자 기업 목록", title: "전체", account: "admin", path: "/admin/companies" },
  { id: "admin-list-featured", group: "관리자 기업 목록", title: "추천 노출", account: "admin", path: "/admin/companies?f=featured" },
  { id: "admin-list-spotlight", group: "관리자 기업 목록", title: "스팟라이트 고정", account: "admin", path: "/admin/companies?f=spotlight" },
  { id: "admin-list-deleted", group: "관리자 기업 목록", title: "삭제됨", account: "admin", path: "/admin/companies?f=deleted" },
  { id: "admin-detail-c01", group: "관리자 기업 상세", title: "C01 자가등록", account: "admin", path: "/admin/companies/1" },
  { id: "admin-detail-c03", group: "관리자 기업 상세", title: "C03 삭제됨", account: "admin", path: "/admin/companies/3" },
  { id: "admin-detail-c05", group: "관리자 기업 상세", title: "C05 관리자 등록", account: "admin", path: "/admin/companies/5" },
  { id: "admin-edit-c01", group: "관리자 기업 수정", title: "C01 국세청 인증 회사", account: "admin", path: "/admin/companies/1/edit" },
  { id: "admin-edit-c05", group: "관리자 기업 수정", title: "C05 미인증(신원 직접 수정)", account: "admin", path: "/admin/companies/5/edit" },
  { id: "admin-new", group: "관리자 기업 등록", title: "작성", account: "admin", path: "/admin/companies/new" },
  {
    id: "admin-new-errors",
    group: "관리자 기업 등록",
    title: "발행 시 오류 모음",
    account: "admin",
    path: "/admin/companies/new",
    action: async (page) => {
      await page.getByRole("button", { name: "발행하기" }).first().click();
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
];
