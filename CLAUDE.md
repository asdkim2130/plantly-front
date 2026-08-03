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

## 파일 배치

```
app/                 라우트 (App Router)
lib/api.ts           fetch 래퍼 — 세션 쿠키 + CSRF + 봉투 처리
lib/companies.ts     회사 API 호출
types/api.ts         백엔드 DTO 대응 타입
```
