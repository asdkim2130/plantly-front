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

모든 응답은 `{ success, message, data, error }` 로 감싸여 오고, **null 필드는 JSON에서 아예 빠진다**.
`lib/api.ts` 가 `data` 만 돌려주므로 화면 코드는 봉투를 볼 일이 없다.

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
  `X-XSRF-TOKEN` 으로 보낸다. 로그인·로그아웃 직후에는 세션이 바뀌므로 `resetCsrf()` 를 호출한다.
- 401은 "로그인 안 됨", 403은 "로그인은 됐지만 권한 없음(또는 CSRF 실패)". 둘을 같은 화면으로 처리하지 않는다.

### 페이지네이션

- 요청 `?page=1&size=20` — **page는 1-based**(0이 아니다). size 최대 100.
- 응답 `{ content: T[], pageInfo: { pageNumber, size, totalElement, totalPage } }`.

## 엔드포인트

**공개(비로그인 가능)**

| 경로 | 설명 |
| --- | --- |
| `GET /api/v1/companies` | 목록/검색. 통합 `keyword` + 고급검색 필드 + 패싯(`categoryIds`/`industryIds`/`certificationIds`) |
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

정본은 Claude Design 프로젝트의 **"플랜틀리 메인 화면 확정 4a"** 다
(`claude_design` MCP · 프로젝트 `35adbf07-748c-4702-b23f-3cfd44707f31`).
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
| `page` | `#F2F2F3` | 흰 컨테이너 바깥 바탕 |
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
app/layout.tsx           1180px 흰 판 + 헤더·푸터 공통 틀, next/font 설정
app/page.tsx             첫 화면 — 히어로 검색 · 대분류 카드 · 스포트라이트/추천 레일 · 전체 기업 격자
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
components/Placeholders.tsx  "데이터 준비 중" 자리표시자
lib/api.ts               fetch 래퍼 — 세션 쿠키 + CSRF + 봉투 처리
lib/companies.ts         회사 API 호출
lib/options.ts           카테고리·업종·인증·국가·지역 (검색 패싯 선택지)
types/api.ts             백엔드 DTO 대응 타입
public/plantly-logo.png  헤더 로고 (디자인 프로젝트의 uploads/logo-trim.png)
```

## 디자인과 API가 어긋나는 곳

디자인은 목업이라 백엔드에 없는 값을 그린 자리가 있다. **숫자를 지어내지 않는다** —
디자인이 이미 갖고 있는 "데이터 준비 중" 자리표시자로 두거나, 실제로 셀 수 있는 축으로 바꿨다.

| 디자인 | 지금 |
| --- | --- |
| 현황 "이번 주 신규 / 검수 완료율" | 업종 수 / 인증 항목 수로 교체 (마스터 데이터에서 실제로 온다) |
| 현황 "최근 등록" 3건 | 스켈레톤. 목록 응답에 등록일이 없어 "최근"을 고를 수 없다 |
| 카테고리 카드 "96개 기업" | "하위 N개 분류". 카테고리 API 에 회사 수가 없다 |
| "추천순 · 최신순 · 인기순" | 없음. 목록 API 에 정렬 파라미터가 없다 |
| "지역 · 업종 필터" | 업종만. 검색 쿼리의 패싯은 category/industry/certification 셋뿐이다 |
| 카드 하단 "기업 상세 →" | 분류 이름. 상세 라우트가 아직 없다 |

- **스포트라이트·추천은 목록 첫 100건에서 플래그로 걸러 쓴다.** `spotlight`/`featured` 만 뽑는
  파라미터가 없어서다(`app/page.tsx` 의 `HIGHLIGHT_POOL`). 뒤쪽 페이지에만 있는 추천 기업은 레일에 안 잡힌다.

## 아직 안 한 것 (메인 화면 기준)

- 검색어·필터·페이지가 URL에 없다 → 새로고침하면 초기화되고 링크 공유가 안 된다. `searchParams` 로 옮기는 게 다음 후보.
- 인증(certification) 패싯 UI 없음. 옵션 API와 `lib/options.ts` 는 이미 있다.
- 상세 화면 미구현 → 카드의 "기업 상세 보기"는 비활성이다.
- 로그인 화면이 없어 좋아요·즐겨찾기는 401로 막힌다. 헤더 메뉴도 비활성 텍스트다.
- 회사 로고는 `<img>` 로 그린다(호스트가 유동적). 이미지 정책이 정해지면 `next/image` + `remotePatterns` 로 바꾼다.
- 모바일 내비게이션 없음 — 좁은 화면에서는 헤더 메뉴를 감춘다.
- 디자인의 3단 카테고리 상단바(`.catbar`)는 이 화면에 없다. 별도 "카테고리" 화면을 만들 때 가져온다.
