@AGENTS.md

# Plantly Front

제조업 회사 디렉터리 서비스의 프론트엔드. 백엔드는 별도 리포(`../plantly`, Spring Boot 3.5 / Java 21 / PostgreSQL)이고
이 리포는 그 API를 소비만 한다. **API 계약의 정본은 백엔드 코드**이고, 여기 타입은 사본이다.

- 스택: Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS 4
- 작성자는 백엔드 개발자다. 프론트 관용구는 설명을 곁들이고, 익숙한 척 축약하지 않는다.

## 실행

```bash
npm run dev        # http://localhost:3000
```

백엔드는 별도 터미널에서 (경로 `../plantly`):

```bash
./gradlew bootRun --args='--spring.profiles.active=local'                            # 8080
./gradlew bootRun --args='--spring.profiles.active=local,seed'                       # + fake data (이미 심었으면 건너뜀)
./gradlew bootRun --args='--spring.profiles.active=local,seed --app.seed.reset=true' # 전부 지우고 다시 심기
```

`--app.seed.reset=true` 는 마스터 데이터를 뺀 로컬 DB 전체를 비운다. 손으로 만든 계정·회사도 같이 사라진다.

## 백엔드 호출 규칙

- **항상 상대경로 `/api/v1/...`.** `next.config.ts` 의 rewrite 가 `/api/*` 를 `localhost:8080` 으로 넘긴다.
  브라우저 입장에서는 같은 오리진이라 CORS도 쿠키 설정도 신경 쓸 게 없다. `http://localhost:8080` 을 코드에 직접 박지 않는다.
- **`fetch` 를 직접 쓰지 않는다.** `lib/api.ts` 의 `api.get/post/put/patch/delete` 를 쓴다.
  세션 쿠키(`credentials: "include"`), CSRF 헤더, 응답 봉투 벗기기를 거기서 한다.
- **회사 관련 호출은 `lib/companies.ts` 에 모은다.** 다른 도메인이 생기면 같은 모양으로 파일을 늘린다
  (`lib/auth.ts`, `lib/options.ts` …). 화면 컴포넌트에 경로 문자열이 흩어지면 백엔드가 바뀔 때 추적이 안 된다.

### 데이터 페칭은 클라이언트 컴포넌트에서

인증이 **세션 쿠키(JSESSIONID)** 기반이다. 서버 컴포넌트에서 백엔드를 부르면 브라우저 쿠키가 자동으로 실리지 않아
`cookies()` 로 꺼내 헤더에 직접 붙여야 하고, 상대경로 rewrite도 타지 않는다(절대 URL이 필요하다).

그래서 당분간 규칙은 하나다 — **데이터를 읽는 컴포넌트는 `"use client"`**. 서버 컴포넌트는 레이아웃·정적 페이지에만 쓴다.
나중에 SSR이 필요해지면 그때 서버 전용 클라이언트를 따로 만든다(이 결정을 뒤집을 땐 여기에 기록할 것).

### 응답 봉투

모든 응답은 `{ success, message, data, error }` 로 감싸여 온다. `lib/api.ts` 가 `data` 만 돌려주므로
화면 코드는 봉투를 볼 일이 없다.

**빈 필드는 키가 빠지는 게 아니라 `null` 로 온다**(`"brandColor":null`). 그래서 타입 사본은
`string | null` 이지 선택 속성(`?`)이 아니다 — `types/api.ts` 를 늘릴 때 이 구분을 지킨다.

실패는 `ApiError(status, message)` 로 던져진다. `error` 문자열은 사용자에게 그대로 보여줄 수 있는 한국어 문장이다.
`isUnauthorized`(401 → 로그인 페이지), `isForbidden`(403 → 권한 없음), `isNotFound`(404) 로 분기한다.

### 인증 / CSRF

| 동작 | 요청 |
| --- | --- |
| 회원가입 | `POST /api/v1/users/sign-up` |
| 로그인 | `POST /api/v1/auth/login` `{ email, password, remember }` |
| 로그아웃 | `POST /api/v1/auth/logout` |
| 내 프로필 | `GET /api/v1/users/me` |

- 비밀번호는 **10~60자 + 특수문자 1개 이상**(백엔드 검증). 시드 계정 공통 비밀번호는 `Password1!`.
- `remember: true` 면 30일 remember-me 쿠키가 추가로 발급된다.
- **GET 외 모든 요청에 CSRF 헤더가 필요하다.** `lib/api.ts` 가 `GET /api/v1/auth/csrf` 로 토큰을 받아 캐시하고
  `X-XSRF-TOKEN` 으로 보낸다. 로그인·로그아웃 직후에는 세션이 바뀌므로 `resetCsrf()` 를 호출한다
  (`lib/auth.ts` 가 이미 하고 있다 — 서버가 세션 고정 공격을 막으려고 인증 직후 세션 ID를 갈아 끼운다).
- 401은 "로그인 안 됨", 403은 "로그인은 됐지만 권한 없음(또는 CSRF 실패)". 둘을 같은 화면으로 처리하지 않는다.

**로그인 요청의 상태 코드는 뜻이 다르다.** `POST /auth/login` 에서는 401 = 자격증명 불일치,
403 = 정지·탈퇴 계정, 400 = 형식 위반이고, 셋 다 `ApiError.message` 에 그대로 보여줄 한국어 문장이 있다.
여기서 401을 "로그인 필요"로 읽어 로그인 화면으로 보내면 제자리를 맴돈다.

403이 업무상 의미인 것도 이 호출뿐이라, `lib/api.ts` 의 "403이면 CSRF가 낡은 것"이라는 기본 재시도를
`retryOnForbidden: false` 로 끈다 — 백엔드가 CSRF 실패와 권한 실패를 **같은 본문**으로 주기 때문에
화면이 구분할 방법이 없고, 켜 두면 실패한 로그인이 매번 두 번씩 서버에 도달한다.

### 페이지네이션

- 요청 `?page=1&size=20` — **page는 1-based**(0이 아니다). size 최대 100.
- 응답 `{ content: T[], pageInfo: { pageNumber, size, totalElement, totalPage } }`.

## 엔드포인트

**공개(비로그인 가능)**

| 경로 | 설명 |
| --- | --- |
| `GET /api/v1/companies` | 목록/검색. 통합 `keyword` + 고급검색 필드 + 패싯(`categoryIds`/`industryIds`/`certificationIds`) |
| `GET /api/v1/companies/showcase` | 메인 노출 영역. `{ spotlight[], featured[], latest[] }` — 페이지 아님(`pageInfo` 없음) |
| `GET /api/v1/companies/{id}` | 공개 상세 |
| `GET /api/v1/categories` | 카테고리 트리(`children` 재귀, depth 1~3) |
| `GET /api/v1/industries`, `GET /api/v1/certifications` | 검색 패싯 선택지 |
| `GET /api/v1/countries` | 250건 평면 — 대륙 그룹핑은 프론트가 `continent` 로 묶는다 |
| `GET /api/v1/domestic-regions` | 지역 트리(전국/시도/시군구) |

**로그인 필요**

| 경로 | 설명 |
| --- | --- |
| `GET /api/v1/companies/my`, `GET /api/v1/companies/favorites` | 내 회사 / 내 즐겨찾기 |
| `PUT`·`DELETE /api/v1/companies/{id}/like`, `.../favorite` | 좋아요·즐겨찾기 (멱등, 204) |
| `POST /api/v1/companies/verification` | 사업자 인증 → `verificationId` 발급 |
| `PUT`·`GET`·`DELETE /api/v1/companies/drafts/{verificationId}` | 임시저장(자동저장·복원·폐기) |
| `POST /api/v1/companies` | 회사 등록(`verificationId` 필요) |
| `GET /api/v1/companies/{id}/private`, `.../subscription` | 소유자 전용 상세·구독 |
| `PATCH /api/v1/companies/{id}` | 기본 정보 부분 수정(sparse: null=미변경) |
| `PATCH /api/v1/companies/{id}/visibility` | 공개/비공개 전환 |
| `DELETE /api/v1/companies/{id}` | 소유자 소프트 삭제(복구는 관리자만) |
| `PUT /api/v1/companies/{id}/{tags,materials,equipment,images,contacts,references,categories,industries,certifications,countries,regions}` | 컬렉션 **전체 교체** |

## 프론트가 틀리기 쉬운 도메인 규칙

- **등급 표시는 `effectiveGrade`.** `grade` 는 계약값이고, 만료·체험을 반영한 실제 등급은 서버가 파생해 내려준다.
  만료된 PREMIUM은 `grade=PREMIUM` 이지만 `effectiveGrade=FREE` 다(시드 C13이 이 케이스).
- **`verified` 와 `businessVerified` 는 다른 축.** 전자는 에디터 선정 큐레이션, 후자는 국세청 사업자 확인.
  배지를 하나로 합치지 않는다.
- **회사 등록은 2단계.** 사업자 인증(`POST /companies/verification`)으로 `verificationId` 를 먼저 받고,
  그걸 등록 요청에 실어 보낸다. 사업자번호·대표자명·개업일자는 요청 본문에 없다 — 서버가 인증본에서 채운다.
- **컬렉션 수정은 전체 교체(PUT).** 부분 추가/삭제 API가 없다. `displayOrder` 는 보내지 않는다(서버가 배열 순서로 부여).
  빈 배열을 보내면 전부 비운다.
- **좋아요/즐겨찾기는 토글이 아니다.** 등록 PUT / 해제 DELETE로 나뉜 멱등 API이고 응답은 204.
  현재 상태는 조회 응답의 `likedByMe`/`favoritedByMe` 로 온다(총 카운트가 아니라 뷰어별 on/off).
- **비공개·삭제 회사는 공개 경로에서 아예 빠진다.** 목록에서 사라지고 상세는 404. "회색 처리"가 아니다.
- **컬렉션 항목의 `active` 는 회사와 정반대다.** 갤러리 이미지·카테고리에는 `active` 가 붙는데,
  등급 한도를 넘겨 가려진 항목(삭제 아님)을 뜻한다. 공개 조회에서는 꺼진 항목이 응답에서 빠지므로
  **항상 `true`** 이고, `false` 는 소유자/관리자 조회에서만 나타난다 — 그쪽 화면은 "저장은 살아 있지만
  지금은 공개되지 않는다"를 회색으로 구분해야 한다. 여기서 걸러내면 소유자가 데이터가 날아갔다고 오해한다.
- 카테고리 패싯은 **후손 서브트리까지** 잡힌다(대분류로 필터하면 소분류만 연결된 회사도 나온다).
  인증 패싯만 예외 — `type` 안에서는 OR, `type` 끼리는 AND.
- 지역은 `displayName`("경기 전역", "경기 오산")을 그대로 쓴다. 프론트가 부모명을 조합하지 않는다.

## 시드 데이터로 화면 확인하기

백엔드 시드는 "행을 채우기" 위한 게 아니라 **케이스 매트릭스**다. 각 회사에 안정 키(C01~C24, D01~D07)가 있고
회사명 앞에 그 코드가 박혀 있다. 케이스↔id 매핑과 각 행이 무엇을 증명하는지는 백엔드 리포의
`docs/seed/SEED_CASES.md` / `seed-manifest.json` 에 있다(gitignore라 백엔드 리포에만 있고, 시드를 돌리면 갱신된다).

계정(비밀번호 전부 `Password1!`):

| 계정 | 용도 |
| --- | --- |
| `owner1@plantly.local` | 회사 다수 소유 + 즐겨찾기 다수. 주 작업 계정 |
| `owner2@plantly.local` | 회사 1건 소유. U1으로 이 회사를 수정하면 차단되는지 확인용 |
| `empty@plantly.local` | 소유·즐겨찾기 0건. 빈 상태 화면 |
| `suspended@plantly.local` | 정지 계정. 로그인이 막혀야 한다 |
| `admin@plantly.local` | 관리자 |

자주 쓰는 케이스: C01 기본 공개 / C02 비공개 / C03 삭제됨 / C13 만료 구독 / C16 배지 없음 /
C20 빈 컬렉션(빈 섹션 렌더링) / C21 최대치(오버플로) / C22 긴 텍스트(말줄임·레이아웃) / C24 장비명 전용 검색어.

## Next.js 16 주의 (학습 데이터와 다른 부분)

`AGENTS.md` 가 안내하듯 새 API를 쓰기 전에 `node_modules/next/dist/docs/` 를 먼저 본다. 특히:

- `params`, `searchParams`, `cookies()`, `headers()` 는 **전부 Promise**. `await` 없이 접근할 수 없다.
  타입은 `PageProps<'/companies/[id]'>` 헬퍼를 쓴다(`npx next typegen`).
- `middleware.ts` 는 `proxy.ts` 로 이름이 바뀌었다(함수명도 `proxy`).
- Turbopack이 기본이다.
- `npm audit fix --force` **금지** — Next 9로 다운그레이드된다. 현재 경고 3건은 Next가 번들한 postcss/sharp 문제라
  우리 쪽에서 고칠 수 있는 게 없다.

## 백엔드를 같이 봐야 할 때

DTO 필드나 검증 규칙이 궁금하면 추측하지 말고 백엔드 코드를 연다.

```
/add-dir C:\Users\sooth\JAVA\plantly\plantly
```

주로 보는 곳: `domain/*/controller/`(엔드포인트), `domain/*/dto/`(요청·응답), `global/config/SecurityConfig.java`(공개/인증 경계),
`global/seed/`(시드 케이스 정의).

## 디자인

정본은 Claude Design 프로젝트(`claude_design` MCP · `35adbf07-748c-4702-b23f-3cfd44707f31`)의
화면별 파일이다 — 메인은 **"플랜틀리 메인 화면 확정 4a"**, 상세는 **"플랜틀리 기업 상세페이지 v2"**.
디자인이 갱신되면 그 파일을 다시 읽어 여기 코드에 반영한다.

성격은 **청사진(blueprint)** 이다 — 회색 바탕 위 1180px 흰 판, 상자마다 바깥으로 튀어나온
모서리 등록 마크, 방안지 격자, 사선 해칭. 제목은 콘덴스드체, 본문은 산세리프.

### 토큰

색·폰트는 `app/globals.css` 의 `@theme` 블록에서만 정의하고, 화면 코드는 이름으로만 쓴다.
디자인을 다듬을 때 그 블록만 바꾸면 전체가 따라오게 유지한다 — 컴포넌트에 hex 값이나 `blue-500` 같은
원시 유틸리티를 직접 박지 않는다.

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `brand` | `#0062F5` | 주 색상 (버튼, 강조 텍스트, 활성 상태) |
| `brand-hover` | `#0055D6` | 인터랙션 (hover/active). `brand-600` 과 같다 |
| `brand-soft` | `#EAF1FF` | 배지·선택 상태 배경. `brand-100` 과 같다 |
| `brand-100`…`900` | 램프 | `700` 강조 텍스트 / `900`(`#0B2148`) 스포트라이트 카드 배경 |
| `ink` | `#1D1F20` | 본문 기본 글자색 |
| `muted` | `#616161` | 설명·보조 텍스트 |
| `faint` | `#949494` | 라벨·캡션 |
| `line` | `#DBDBDB` | 카드 테두리 |
| `line-soft` | `#E8E8E8` | 카드 안쪽 구분선 |
| `page` | `#FFFFFF` | 컨테이너 바깥 바탕. 디자인 원본은 `#F2F2F3` 이지만 판과 같은 흰색으로 맞췄다 |
| `font-heading` | Barlow Condensed | 제목·숫자·라벨 |
| `font-body` | Barlow | 본문 |

두 폰트에 한글 글리프가 없어 한글은 시스템 폰트로 떨어진다. 디자인 원본도 같은 구조다.

### 컴포넌트 클래스

같은 파일의 `@layer components` 에 디자인 시스템의 어휘를 모아 뒀다. 배치·간격은 화면 코드에서
Tailwind 로 주고, "생김새"는 이 클래스로 준다.

| 클래스 | 뜻 |
| --- | --- |
| `.blueprint` + `<Corners />` | 청사진 프레임. 모서리 마크는 `.blueprint > .corner` 라서 **직계 자식**이어야 한다 |
| `.pcard` | 회사 카드. hover 시 뜨고 테두리가 brand 로 바뀐다 |
| `.btn` / `.btn-primary` / `.btn-secondary` / `.icbtn` / `.chip` | 버튼·칩 |
| `.tag` + `.tag-accent`(자유 태그 `#…`) / `.tagcat`(정식 카테고리, `#` 없음) / `.tag-dark` | 태그 |
| `.ind` | 업종 라벨 — 배지가 아니라 주소 줄 앞 아웃라인 라벨이다 |
| `.tagmore` / `.tagcount` | 자리에 안 들어가 접힌 칩과 "+N". 카드 hover 로 **같은 줄에 이어서** 펼쳐진다 |
| `.railtrack` / `.railbtn` / `.raildot` | 가로 레일 |
| `.skel` / `.hatch` / `.hatch-empty` / `.hatch-tint` / `.plate` | 자리표시자·바탕 무늬 |
| `.kick` | 제목 옆·카드 머리의 작은 대문자 라벨(Overview, 6건 …) |
| `.tabbtn` | 상세 화면 상단의 섹션 탭 |
| `.srow` / `.skey` / `.sval` | 사양 표 한 줄(라벨 왼쪽 · 값 오른쪽 · 점선 구분) |
| `.gshot` | 상세 갤러리의 사진 한 장. 높이를 정하지 않아 원본 비율이 그대로 산다 |
| `.tag-lg` | 상세 화면용 큰 칩. 색·모양은 `.tag*` 그대로고 치수만 한 단계 크다 |
| `.ind-dark` | 남색 히어로 위의 `.ind`(브랜드 파랑이 배경에 묻어 밝은 파랑으로 뒤집는다) |
| `.spotlight` + `.sl-*` | 스포트라이트 카드. 배경이 회사 색이라 안쪽 색을 전부 `--sl-fg` 에서 파생시킨다 |

### 스포트라이트 카드만 토큰을 안 쓰는 이유

이 카드의 배경은 회사가 지정한 `brandColor` 다. **런타임 데이터라 토큰으로 만들 수 없는 유일한 색**이고,
컴포넌트가 인라인 `style` 로 `--sl-bg` 하나만 넘긴다(그 외 hex 를 컴포넌트에 박는 규칙은 그대로 유효하다).

배경이 임의의 색이므로 카드 안 모든 색은 전경색 변수 `--sl-fg` 에서 `color-mix` 로 파생시킨다.
`brand-200`/`brand-300` 처럼 남색 전용으로 굳은 밝은 파랑을 앰버·자주 배경에 얹으면 그대로 안 보인다.

`--sl-fg` 는 `lib/color.ts` 의 `prefersDarkText()` 가 WCAG 상대 휘도로 판정해 `data-tone="light|dark"` 을
찍으면 CSS 가 고른다. 흰 글씨/검은 글씨 중 대비가 큰 쪽이 자동으로 선택된다.

상세 보기 버튼이 `.btn-primary` 가 아니라 `.sl-cta` 인 것도 같은 이유다 — 단색 브랜드 파랑을 쓰면
파란 카드 위 파란 버튼이 나온다. 카드 색을 뒤집어(`background: --sl-fg`) 어떤 배경에서도 대비를 확보한다.

## 파일 배치

```
app/layout.tsx           1180px 폭 제한 + 헤더·푸터 공통 틀, next/font 설정 (바탕 전체가 흰색, 좌우 테두리 없음)
app/page.tsx             첫 화면 — 히어로 검색 · 대분류 카드 · 스포트라이트/추천 레일 · 전체 기업 격자
app/companies/[id]/page.tsx  기업 상세(공개) — 남색 히어로 · 섹션 탭 · 본문 2단 (아래 "기업 상세 화면")
app/login/page.tsx       로그인. 성공하면 ?next= 로 돌아간다(오픈 리다이렉트 방어는 safeNext)
app/globals.css          디자인 토큰(@theme) + 컴포넌트 클래스(@layer components)
components/Corners.tsx   청사진 모서리 마크
components/icons.tsx     디자인에 쓰인 SVG 8개
components/*Card.tsx     CompanyCard(격자) / FeaturedCard(추천) / SpotlightCard(스포트라이트)
components/Logo.tsx      정사각 로고 배지. 없으면 이름 앞 두 글자
components/Cover.tsx     카드 커버 사진(와이드). 없으면 사선 해칭
lib/color.ts             회사 지정색 위 글자색 판정(WCAG 휘도) — 스포트라이트 카드 전용
components/TagRow.tsx    카테고리·태그 칩 줄. 두 줄에 들어가는 만큼 넣고 나머지는 "+N"
components/CardSlot.tsx  칩이 펼쳐져 카드가 커져도 격자가 밀리지 않게 자리를 못 박는 껍데기
components/Rail.tsx      화살표·점으로 넘기는 가로 스크롤 레일
components/DetailTabs.tsx  상세 화면 상단에 붙어 따라다니는 섹션 탭(현재 섹션 판정은 IntersectionObserver)
components/Placeholders.tsx  "데이터 준비 중" 자리표시자
components/SessionProvider.tsx  로그인 상태를 화면 전체가 나눠 쓰는 컨텍스트. layout 이 감싼다
components/HeaderNav.tsx  헤더 메뉴 + 로그인/로그아웃 (세션에 따라 바뀌어 클라이언트 컴포넌트)
lib/api.ts               fetch 래퍼 — 세션 쿠키 + CSRF + 봉투 처리
lib/auth.ts              로그인·로그아웃·내 프로필
lib/companies.ts         회사 API 호출
lib/options.ts           카테고리·업종·인증·국가·지역 (검색 패싯 선택지)
lib/labels.ts            enum(TRL·가격정책·인증 type) 한국어 표기. 응답에는 이름만 실려 온다
types/api.ts             백엔드 DTO 대응 타입
public/plantly-logo.png  헤더 로고 (디자인 프로젝트의 uploads/logo-trim.png)
```

## 디자인과 API가 어긋나는 곳

디자인은 목업이라 백엔드에 없는 값을 그린 자리가 있다. **숫자를 지어내지 않는다** —
디자인이 이미 갖고 있는 "데이터 준비 중" 자리표시자로 두거나, 실제로 셀 수 있는 축으로 바꿨다.

| 디자인 | 지금 |
| --- | --- |
| 현황 "이번 주 신규 / 검수 완료율" | 업종 수 / 인증 항목 수로 교체 (마스터 데이터에서 실제로 온다) |
| 현황 "최근 등록" 3건 | showcase 의 `latest` 앞 3건. 별도 호출 없음 |
| 카테고리 카드 "96개 기업" | "하위 N개 분류". 카테고리 API 에 회사 수가 없다 |
| "추천순 · 최신순 · 인기순" | 정렬 UI 는 없다. 목록 API 의 정렬은 요금제 계약(유료 상위)이라 끌 수 있는 옵션이 아니고, 최신순은 지면을 나눠(showcase `latest`) 푼다. 인기순은 집계 컬럼이 없어 불가 |
| "지역 · 업종 필터" | 업종만. 검색 쿼리의 패싯은 category/industry/certification 셋뿐이다 |
| 카드 하단 "기업 상세 →" | 표시만 남았다. 카드 **전체**가 `/companies/{id}` 로 가는 링크다 |

- **스포트라이트·추천은 목록을 걸러서 만들지 않는다.** 전용 `GET /companies/showcase` 를 쓴다.
  카드의 `spotlight` 플래그는 "관리자 수동 고정(pin)"이지 "메인에 노출 중"이 아니다 — 요금제 자격으로
  노출되는 회사는 이 값이 `false` 인 채로 레일에 오른다(자격은 서버가 구독을 보고 조회 시점에 파생한다).
  자리 수도 서버 설정이라 프론트는 받은 만큼 그린다. 레일끼리 같은 회사가 겹쳐도 **중복 제거하지 않는다.**

### 메인 기업 데이터의 출처가 조건에 따라 갈린다

조건이 없으면 **showcase 응답 하나**로 세 영역(스포트라이트·추천·기업 격자)을 다 채우고 목록 API 를
아예 부르지 않는다. 검색어·패싯이 걸리거나 "전체 기업 보기"로 넘어갈 때만 목록 API 를 쓴다.

정렬 규칙이 두 지면에서 다른 건 실수가 아니라 설계다. 목록 API 의 기본 정렬
(`spotlight → featured → 최신`)은 편의를 위한 기본값이 아니라 **"어떤 검색어·패싯에도 유료 기업을
상위로"라는 요금제 계약**이다. 메인 상단은 이미 두 레일이 그 노출을 끝낸 자리라, 같은 정렬을 바로 아래
격자에 다시 적용하면 방금 배너로 본 기업이 첫 줄에 같은 순서로 재등장한다. 그래서 기본 격자만
순수 최신순(`latest`)으로 떼어냈고, **패싯이 걸리면 유료 상위 노출이 다시 적용되는 게 맞다.**

`sort` 같은 파라미터로 끄지 않은 이유도 같다 — 그런 스위치는 요금제 계약을 사용자가 끌 수 있게 만든다.

## 아직 안 한 것 (메인 화면 기준)

- 검색어·필터·페이지가 URL에 없다 → 새로고침하면 초기화되고 링크 공유가 안 된다. `searchParams` 로 옮기는 게 다음 후보.
- 인증(certification) 패싯 UI 없음. 옵션 API와 `lib/options.ts` 는 이미 있다.
- 히어로 아래 **대분류 카드는 누를 수 없다**. 원래는 같은 화면 격자에 패싯을 걸었는데, 그러면 검색 상태가 되어
  바로 아래 스포트라이트·추천 레일이 접혔다 — 맨 위 카드를 눌렀는데 그 아래 큐레이션이 통째로 사라지는 모양이다.
  이 카드의 목적지는 메인 격자가 아니라 별도 목록 화면이라, 그 라우트가 생기면 `<a href="/companies?categoryId=…">`
  로 되살린다. 분류로 좁혀 보는 건 격자 위 칩 줄이 맡는다.

### 레일을 접는 조건은 "검색어"뿐이다

격자 위 카테고리 칩과 업종 필터는 **그 섹션의 손잡이**다. 누르면 격자 내용만 갈아 끼우고 스포트라이트·추천
레일은 그대로 둔다 — 칩 하나 눌렀다고 위쪽 큐레이션이 사라지면 보고 있던 격자가 화면 위로 튄다.
반대로 히어로 검색은 "찾으러 왔다"는 의도라 큐레이션이 결과와 섞이면 헷갈리므로 그때만 접는다.
`app/page.tsx` 의 `searching`(접는 조건, 검색어만)과 `filtered`(목록 API 를 쓰는 조건, 패싯 포함)는 다른 값이다.
- 헤더의 "카테고리"·"기업정보 등록"은 아직 비활성 텍스트다(라우트가 없다).
- 회사 로고는 `<img>` 로 그린다(호스트가 유동적). 이미지 정책이 정해지면 `next/image` + `remotePatterns` 로 바꾼다.
- 모바일 내비게이션 없음 — 좁은 화면에서는 헤더 메뉴를 감춘다.
- 디자인의 3단 카테고리 상단바(`.catbar`)는 이 화면에 없다. 별도 "카테고리" 화면을 만들 때 가져온다.

### 카드 전체가 상세로 가는 링크다

세 카드(격자·추천·스포트라이트) 모두 **카드를 통째로 `<Link>` 로 감싸지 않고**, 회사명 링크에
`after:absolute after:inset-0` 덮개를 씌워 카드 크기만큼 늘렸다. 이유가 둘이다.

1. 좋아요·즐겨찾기가 `<button>` 이라, 카드를 링크로 감싸면 링크 안에 버튼이 들어간다(HTML 이 금지한다).
2. 스크린리더의 링크 목록에 **회사명**으로 잡힌다. 카드를 감싸면 카드 안 글자가 전부 링크 이름이 된다.

덮개의 기준은 `.blueprint` 의 `position: relative` 다. 그래서 **카드 안에 클릭할 것을 새로 넣으면
`relative z-[1]` 을 줘야 한다** — 덮개가 위에 깔려 클릭을 가로챈다. 지금 그렇게 올려 둔 것은
좋아요·즐겨찾기 묶음과 스포트라이트의 "기업 상세 보기" 버튼이다.

레일 안에서도 안전한 건 `Rail.tsx` 가 드래그 스크롤을 쓰지 않기 때문이다(화살표·점·휠로만 넘긴다).
드래그로 넘기는 방식을 나중에 넣는다면 덮개가 드래그를 클릭으로 삼키지 않는지 다시 봐야 한다.

## 기업 상세 화면 (`/companies/[id]`)

정본은 Claude Design 의 **"플랜틀리 기업 상세페이지 v2"** 다. 구조는 세 층이다.

1. **남색 히어로** — 빵부스러기 · 로고 · 회사명 · 배지 · 주소 · 소개 한 줄 · 업종 라벨 · 숫자 줄,
   오른쪽에 문의/웹사이트/좋아요·즐겨찾기/공유. 커버 사진은 오른쪽 430px 에 흐리게 깔리고
   왼쪽으로 갈수록 남색에 묻는다(회사 배경색 `brandColor` 는 쓰지 않는다 — 그건 카드 전용이다).
2. **따라다니는 섹션 탭**(`DetailTabs`) — 라우팅이 아니라 같은 문서 안 이동이다. 상세 응답 하나로
   모든 섹션이 이미 그려져 있어 탭마다 다시 부를 데이터가 없다.
3. **본문 2단** — 왼쪽은 서술(소개 · 제공 분야 · 프로젝트 · 상세 이미지), 오른쪽 296px 은
   훑어보는 값(기본 정보 · 연락처 · A/S · 검수 배지)이 붙어 따라온다.

원본의 모서리 등록 마크(`.corner`)와 방안지 격자(`.plate`)는 메인에서 뺀 것과 같은 이유로 여기서도
쓰지 않는다 — 되살릴 거면 두 화면을 함께 되살린다.

- **없는 섹션은 아예 그리지 않고, 탭도 같은 조건으로 만든다.** "등록된 항목이 없습니다"를 열 줄
  늘어놓으면 최소 회사(C20)가 빈 상자 카탈로그가 되고, 눌러도 아무 데도 가지 않는 탭이 남는다.
  사이드바의 사양 표도 값이 있는 줄만 남긴다(`대표자` 는 NOT NULL 이라 표가 통째로 비진 않는다).
- **커버 사진도 없으면 자리를 만들지 않는다.** 히어로는 사진이 없어도 남색 판으로 성립한다 —
  해칭 자리표시자를 깔면 "여기 사진이 들어갈 자리"를 약속하는 셈이다(카드와 다른 판단이다 —
  카드는 격자 높이가 걸려 있다).
- **갤러리는 격자가 아니라 본문 폭을 채우는 세로 띠다.** 사진 비율이 제각각인데 상자를 못 박으면
  설비 사진이 잘리는데, 그게 이 섹션이 보여주려는 내용이다. 앞 4장만 펼치고 나머지는 접는다.
- **`params` 는 `use()` 로 푼다.** 데이터를 읽으니 클라이언트 컴포넌트고, 클라이언트에서는 `await` 를
  쓸 수 없다. 타입은 `PageProps<'/companies/[id]'>`.
- **긴 한글 제목은 `break-keep wrap-anywhere` 두 겹으로 잡는다.** `break-keep` 만으로는 공백 없는
  긴 덩어리(C22 는 60여 자가 한 덩이)가 판을 뚫고 나간다. `break-words` 가 아니라 `wrap-anywhere`
  여야 하는 이유는 flex 자식의 min-content 폭까지 줄여 주기 때문이다.
- 동영상은 embed 하지 않고 링크로만 연다 — 호스트가 유튜브인지 무엇인지 계약에 없다.
  (등급이 낮으면 `videoUrl` 이 아예 null 로 오므로 화면이 등급을 볼 일은 없다. C13 이 그 표본)
- 연락처·레퍼런스는 응답에 대표 1건씩만 온다. "더보기"는 백엔드에 전용 조회가 생겨야 붙는다.

### 상세 화면에서 디자인과 API가 어긋나는 곳

메인과 같은 규칙이다 — **숫자를 지어내지 않는다.** 실제로 셀 수 있는 축으로 바꾸거나 뺐다.

| 디자인 | 지금 |
| --- | --- |
| 히어로 "문의하기"(플랜틀리 중개, 영업일 1일 내 회신) | 문의 API 가 없다. 대표 연락처로 바로 연결한다(이메일 있으면 `mailto:`, 없으면 `tel:`). 둘 다 없으면 버튼은 비활성이고 아래 안내 문구가 이유를 말한다 |
| 숫자 줄 "평균 납기 4주" | 뺐다. `leadTime` 은 "4주 내외" 같은 자유 문자열이라 큰 숫자로 세울 수 없어 사이드바 사양 표로 보냈다. 그 자리는 셀 수 있는 축(보유 장비)으로 채운다 |
| 숫자 줄 "업력 29년" | `establishmentDate` 에서 오늘 기준으로 센다(서버가 담아 줄 수 없는 값이라 화면 계산이다). 날짜가 없으면 칸을 뺀다 |
| "Verified by Plantly · 최종 검수 2026.07.18" | 검수 일자가 응답에 없다. 날짜 줄은 빼고, `businessVerified` 일 때만 "국세청 사업자 확인 완료" 한 줄을 붙인다 |
| 빵부스러기 "기업 찾기 / 제조 솔루션 / 회사명" | 가운데는 depth 가 가장 작은 분류다(대분류가 연결돼 있으리란 보장이 없다 — C01 은 소분류만 달려 있다). 목록 라우트가 없어 링크가 아니라 글자다 |
| 갤러리 "사진 22장 더 보기" | 장수는 실제 `galleryImages` 수다. 접는 기준만 화면이 정한다(앞 4장) |

## 로그인 상태

세션 쿠키(JSESSIONID)는 HttpOnly 라 **JS 가 읽을 수 없다.** 로그인 여부는 `GET /users/me` 를
불러 봐야 알고, 그래서 `SessionProvider` 가 앱 위에서 한 번만 물어보고 결과를 나눠 준다.
화면에서는 `useSession()` 으로 `{ user, loading, refresh }` 를 받는다.

- **`loading` 동안에는 어느 쪽으로도 단정하지 않는다.** "로그인"을 먼저 그렸다가 이름으로 바꾸면
  로그인한 사용자가 새로고침할 때마다 자기 헤더가 깜빡이는 걸 본다. 헤더는 그동안 자리만 잡아 둔다.
- **`getMe` 의 401 은 오류가 아니라 "비로그인"이라는 답이다.** 첫 방문자에게 경고를 띄우면 안 된다.
- 로그인 성공 뒤에는 `session.refresh()` 를 부르고 **그다음에** 이동한다. 순서를 뒤집으면 새 화면이
  옛 세션 상태로 먼저 그려진다.
- **로그아웃은 통째로 새로 읽는다**(`window.location.assign("/")`). 컨텍스트만 비우면, 이미 그려진
  카드의 좋아요·즐겨찾기가 켜진 채로 남는다 — `likedByMe` 는 로그인 뷰어 기준으로 받은 값이고
  `LikeFavorite` 가 그걸 자기 state 로 복사해 들고 있어서다.
- **`?next=` 는 주소창에서 오는 값이라 그대로 믿지 않는다.** `/` 로 시작하는 상대경로만 통과시킨다
  (`//evil.com`, `/\evil.com` 은 브라우저가 다른 호스트로 해석한다 — 로그인 링크를 미끼로 쓰는 수법).

회원가입 화면은 아직 없다. 백엔드(`POST /users/sign-up`)는 이미 있으므로 라우트만 만들면 된다.
