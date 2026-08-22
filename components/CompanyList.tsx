"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CompanyCard from "@/components/CompanyCard";
import CompanyFacets from "@/components/CompanyFacets";
import CompanySearchForm, { type SearchText } from "@/components/CompanySearchForm";
import Pagination from "@/components/Pagination";
import ScrollTop from "@/components/ScrollTop";
import { CompanyPlaceholder } from "@/components/Placeholders";
import {
  CloseIcon,
  FactoryIcon,
  InfoIcon,
  SearchEmptyIcon,
  SortIcon,
  WarningIcon,
} from "@/components/icons";
import { ApiError } from "@/lib/api";
import {
  ADVANCED_FIELDS,
  ADVANCED_FIELD_LABEL,
  EMPTY_ADVANCED,
  FACET_KEYS,
  hasCondition,
  parseCompanySearch,
  toQueryString,
  toSearchQuery,
  toggleId,
  type CompanySearchState,
  type FacetKey,
} from "@/lib/companySearchParams";
import { searchCompanies } from "@/lib/companies";
import { flattenCategories, getCategories, getCertifications, getIndustries } from "@/lib/options";
import type {
  CategoryPublicResponse,
  CertificationPublicResponse,
  CompanySummary,
  IndustryPublicResponse,
  PageInfo,
} from "@/types/api";

/** 한 페이지에 담는 개수(3열 × 8줄). 백엔드 상한은 100 이다. */
const PAGE_SIZE = 24;

/** 선택지(마스터 데이터). 세 개를 함께 받아 한 덩이로 들고 있는다 — 패싯 칸이 한꺼번에 차야 해서다. */
type Options = {
  /** 어느 시도의 결과인지. 지금 시도 번호와 다르면 아직 안 온 것이다(아래 Listing 의 key 와 같은 수법). */
  retry: number;
  categories: CategoryPublicResponse[];
  industries: IndustryPublicResponse[];
  certifications: CertificationPublicResponse[];
  /** 못 받았는지. 결과는 정상이고 사이드바만 이유를 보여 준다. */
  failed: boolean;
};

/** 끝난 목록 요청 1건. key 가 지금 주소와 다르면 아직 결과가 안 온 것이다. */
type Listing = {
  key: string;
  companies: CompanySummary[];
  pageInfo: PageInfo | null;
  error: string;
};

/** 조건 칩 하나. 키(무슨 축인지)와 값을 나눠 들고 있다 — 남색 띠에서 굵기를 달리 그린다. */
type Chip = { id: string; key: string; value: string; onRemove: () => void };

/** 좋아요·즐겨찾기 실패 안내. 로그인만 하면 되는 실패면 안내 옆에 로그인 버튼이 붙는다. */
type Notice = { message: string; needsLogin: boolean };

/**
 * 공개 기업 목록/검색 — `GET /api/v1/companies`.
 *
 * 디자인 정본은 Claude Design 의 **"플랜틀리 공개 검색 목록 페이지"**.
 * 화면은 위에서부터 네 층이다 — 머리띠(제목 + 검색) · 남색 조건 띠 · 안내 · 본문 2단.
 * 앞의 세 층을 판 좌우 끝까지 붙이는 건 "무엇을 찾는 중인가"와 "무엇이 나왔나"를 가르기 위해서다.
 *
 * **조건의 정본은 주소다**(`lib/companySearchParams.ts`). 검색어·패싯·페이지를 state 로 들지 않고
 * URL 에서 읽어 그리므로 새로고침·뒤로가기·링크 공유가 그대로 동작한다. 메인 화면과 갈리는
 * 지점이 여기다 — 저쪽은 큐레이션 지면이라 조건이 화면 안에서만 살아 있어도 되지만,
 * 이 화면은 "찾은 결과를 다시 여는 것"이 목적이라 주소가 결과를 가리켜야 한다.
 *
 * **정렬 선택지는 두지 않는다.** 목록 API 의 기본 정렬(스팟라이트 → 추천 → 최신)은 편의를 위한
 * 기본값이 아니라 "어떤 검색어·패싯에도 유료 기업을 상위로"라는 요금제 계약이라, 사용자가 끌 수
 * 있는 스위치로 만들면 안 된다. 그래서 결과 머리에 정렬 기준을 적기만 한다.
 *
 * 인증이 세션 쿠키 기반이라 데이터를 읽는 이 컴포넌트는 클라이언트다(CLAUDE.md 페칭 규칙).
 */
export default function CompanyList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 주소 문자열을 기준으로 다시 만든다 — 훅이 돌려주는 객체의 동일성에 기대지 않기 위해서다.
  const queryString = searchParams.toString();
  const state = useMemo(() => parseCompanySearch(new URLSearchParams(queryString)), [queryString]);

  /** 좋아요·즐겨찾기 실패(주로 비로그인). 목록은 그대로 두고 한 줄로 알린다. */
  const [notice, setNotice] = useState<Notice | null>(null);

  // ── 선택지(분류·업종·인증) ──────────────────────────────────────────────
  const [options, setOptions] = useState<Options | null>(null);
  /** 선택지 "다시 시도"용. 같은 값을 두 번 넣어도 effect 가 다시 돌게 숫자를 올린다. */
  const [optionsRetry, setOptionsRetry] = useState(0);

  /** 지금 시도의 결과가 아직 안 왔는지. "다시 시도"를 누른 직후도 여기 포함된다. */
  const optionsLoading = options?.retry !== optionsRetry;

  useEffect(() => {
    const controller = new AbortController();
    const retry = optionsRetry;

    Promise.all([
      getCategories(controller.signal),
      getIndustries(controller.signal),
      getCertifications(controller.signal),
    ])
      .then(([categories, industries, certifications]) =>
        setOptions({
          retry,
          categories,
          industries,
          certifications,
          failed: false,
        }),
      )
      // 선택지를 못 받아도 결과 목록은 볼 수 있어야 한다. 빈 값으로 확정해 자리표시자를 걷는다.
      .catch(() => {
        if (controller.signal.aborted) return;
        setOptions({
          retry,
          categories: [],
          industries: [],
          certifications: [],
          failed: true,
        });
      });

    return () => controller.abort();
  }, [optionsRetry]);

  // ── 목록 ────────────────────────────────────────────────────────────────
  const key = toQueryString(state);
  const [listing, setListing] = useState<Listing | null>(null);
  const loading = listing?.key !== key;

  /**
   * "다시 시도"용. 조건이 그대로면 주소가 안 바뀌어 effect 가 다시 돌 이유가 없으므로,
   * 다시 돌 이유를 이 값으로 만든다(같은 주소를 두 번 push 해도 아무 일도 일어나지 않는다).
   */
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    searchCompanies(toSearchQuery(state, PAGE_SIZE), controller.signal)
      .then((result) =>
        setListing({
          key,
          companies: result.content,
          pageInfo: result.pageInfo,
          error: "",
        }),
      )
      .catch((e: unknown) => {
        // 조건이 바뀌어 취소된 요청은 실패가 아니다(개발 모드의 이중 실행 포함).
        if (controller.signal.aborted) return;
        setListing({
          key,
          companies: [],
          pageInfo: null,
          error:
            e instanceof ApiError
              ? e.message
              : "기업 목록 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        });
      });

    return () => controller.abort();
  }, [key, state, retry]);

  // ── 조건 바꾸기 = 주소 바꾸기 ───────────────────────────────────────────
  /**
   * `stay` 는 "스크롤을 건드리지 말라"는 뜻이다. App Router 는 이동할 때마다 화면을 맨 위로
   * 올리는데, 사이드바에서 체크를 하나 켤 때마다 그러면 조건을 두세 개 걸기가 어렵다 —
   * 방금 누른 줄이 화면 밖으로 사라진다. 조건을 만지는 동안에는 제자리에 둔다.
   *
   * 반대로 페이지를 넘길 때는 맨 위로 올리는 게 맞다(새 페이지를 중간부터 읽을 이유가 없다).
   * 그래서 기본값은 그대로 두고 조건 조작에서만 켠다.
   */
  const go = (next: CompanySearchState, stay = false) =>
    router.push(`/companies${toQueryString(next)}`, { scroll: !stay });

  /** 조건이 바뀌면 언제나 1페이지부터 다시 본다 — 5페이지에 있던 채로 조건만 좁히면 빈 화면이 된다. */
  const apply = (patch: Partial<CompanySearchState>, stay = false) =>
    go({ ...state, ...patch, page: 1 }, stay);

  const applyText = (text: SearchText) => apply({ keyword: text.keyword, advanced: text.advanced });

  const toggleFacet = (facet: FacetKey, id: number) =>
    apply({ [facet]: toggleId(state[facet], id) }, true);

  const clearFacet = (facet: FacetKey) => apply({ [facet]: [] }, true);

  /** 사이드바의 "전체 지우기" — 패싯 세 축만 비운다. 검색어는 남긴다(그건 남색 띠 몫이다). */
  const clearFacets = () => apply({ categoryIds: [], industryIds: [], certificationIds: [] }, true);

  const clearAll = () =>
    go(
      {
        keyword: "",
        advanced: EMPTY_ADVANCED,
        categoryIds: [],
        industryIds: [],
        certificationIds: [],
        page: 1,
      },
      true,
    );

  // ── 지금 걸린 조건을 칩으로 ─────────────────────────────────────────────
  // 패싯은 주소에 id 만 실려 있어 이름을 선택지에서 되찾는다. 아직 못 받았으면 id 를 그대로 보여준다 —
  // 칩을 감추면 "필터가 걸려 있는데 화면에는 안 보이는" 상태가 된다.
  const facetNames = useMemo<Record<FacetKey, Map<number, string>>>(
    () => ({
      categoryIds: new Map(
        flattenCategories(options?.categories ?? []).map((c) => [c.id, c.categoryName]),
      ),
      industryIds: new Map((options?.industries ?? []).map((i) => [i.id, i.industryName])),
      certificationIds: new Map(
        (options?.certifications ?? []).map((c) => [c.id, c.certificationName]),
      ),
    }),
    [options],
  );

  const FACET_LABEL: Record<FacetKey, string> = {
    categoryIds: "분류",
    industryIds: "업종",
    certificationIds: "인증",
  };

  const chips: Chip[] = [
    ...(state.keyword
      ? [
          {
            id: "keyword",
            key: "검색어",
            value: state.keyword,
            onRemove: () => apply({ keyword: "" }, true),
          },
        ]
      : []),
    ...ADVANCED_FIELDS.filter((field) => state.advanced[field]).map((field) => ({
      id: `adv-${field}`,
      key: ADVANCED_FIELD_LABEL[field],
      value: state.advanced[field],
      onRemove: () => apply({ advanced: { ...state.advanced, [field]: "" } }, true),
    })),
    ...FACET_KEYS.flatMap((facet) =>
      state[facet].map((id) => ({
        id: `${facet}-${id}`,
        key: FACET_LABEL[facet],
        value: facetNames[facet].get(id) ?? `#${id}`,
        onRemove: () => toggleFacet(facet, id),
      })),
    ),
  ];

  const filtered = hasCondition(state);
  const pageInfo = listing?.pageInfo ?? null;
  const error = listing?.error ?? "";

  return (
    <div className="flex flex-col">
      {/* ── 머리띠 — 제목과 검색을 한 덩이로 묶는다 ─────────────────────── */}
      <div className="border-b border-line-soft px-4 pt-[26px] pb-[22px] sm:px-[30px]">
        <p className="kick text-brand-700 mb-[7px]">Company Directory</p>
        <div className="flex flex-wrap items-end gap-3.5">
          <h1 className="text-[30px] leading-[1.1]">기업 찾기</h1>
          <p className="mb-[3px] text-[13px] text-muted">
            공개 등록된 기업을 검색어와 필터로 찾습니다. 비공개로 돌렸거나 삭제된 기업은 나오지
            않습니다.
          </p>
        </div>

        <div className="mt-[18px]">
          <CompanySearchForm
            keyword={state.keyword}
            advanced={state.advanced}
            onSubmit={applyText}
          />
        </div>
      </div>

      {/* ── 지금 걸린 조건 ────────────────────────────────────────────────
          남색으로 깔아 흰 지면에서 떼어 놓는다. 조건은 결과를 만든 원인이라 결과보다 먼저,
          그리고 결과와 다른 바탕 위에 있어야 "이것 때문에 이만큼만 나왔다"가 읽힌다.

          조건이 하나도 없어도 띠는 남긴다 — 자리가 생겼다 사라지면 첫 조건을 걸 때 아래 지면이
          통째로 밀리고, "지금은 아무 조건도 안 걸렸다"를 말해 줄 자리도 함께 없어진다.
          min-h 는 칩이 들어찬 높이(30px + 상하 여백)라 조건이 붙어도 띠가 커지지 않는다. */}
      <div className="bg-brand-900 flex min-h-[54px] flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-[30px]">
        <span className="kick text-brand-300 mr-0.5">선택 조건</span>
        {chips.length === 0 ? (
          <span className="text-[13px] text-white/55">
            선택된 조건이 없습니다 — 검색창 또는 왼쪽 필터를 이용하세요.
          </span>
        ) : (
          <>
            {chips.map((chip) => (
              <span key={chip.id} className="qchip">
                <b>{chip.key}</b>
                {chip.value}
                <button
                  type="button"
                  className="qx"
                  aria-label={`${chip.key} 조건 지우기`}
                  onClick={chip.onRemove}
                >
                  <CloseIcon size={10} />
                </button>
              </span>
            ))}
            {/* 지울 게 있을 때만 보인다. 눌러도 아무 일이 없는 버튼을 띠에 남겨 두지 않는다. */}
            <button
              type="button"
              className="btn btn-ghost ml-auto text-[13px] text-white/70 hover:text-white"
              onClick={clearAll}
            >
              조건 모두 지우기
            </button>
          </>
        )}
      </div>

      {/* 좋아요·즐겨찾기 실패. 로그인만 하면 되는 실패면 갈 곳까지 같이 준다. */}
      {notice && (
        <p
          role="status"
          className="border-brand-300 bg-brand-soft mx-4 mt-3 flex items-center gap-2.5 rounded-lg border px-3 py-2.5 sm:mx-[30px]"
        >
          <InfoIcon size={16} className="text-brand-700 shrink-0" />
          <span className="text-brand-800 text-[13px]">{notice.message}</span>
          {notice.needsLogin && (
            <Link
              href="/login?next=%2Fcompanies"
              className="btn btn-primary ml-auto shrink-0 px-3.5 py-1.5 text-[13px]"
            >
              로그인
            </Link>
          )}
        </p>
      )}

      <div className="flex flex-col gap-7 px-4 pt-5 pb-[34px] sm:px-[30px] lg:flex-row lg:items-start lg:gap-[26px]">
        {/* 따라오게(sticky) 두지 않는다 — 세 축을 다 펼치면 사이드바가 960px 남짓이라 뷰포트보다
            길고, 그러면 위에 고정된 채 아래쪽 인증 묶음이 화면에 영영 안 들어온다. 페이지와 함께
            내려가면 조건을 바꾸러 위로 올라와야 하지만, 손이 닿지 않는 것보다는 낫다. */}
        <aside className="lg:w-[200px] lg:flex-none">
          <CompanyFacets
            categories={options?.categories ?? []}
            industries={options?.industries ?? []}
            certifications={options?.certifications ?? []}
            selected={state}
            onToggle={toggleFacet}
            onClear={clearFacet}
            onClearAll={clearFacets}
            loading={optionsLoading}
            // 다시 시도하는 동안에는 실패 안내가 아니라 자리표시자를 보여야 한다.
            failed={!optionsLoading && (options?.failed ?? false)}
            onRetry={() => setOptionsRetry((n) => n + 1)}
          />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-2.5 border-b border-line pb-3">
            <h2 className="text-[23px]">{filtered ? "검색 결과" : "전체 기업"}</h2>
            <span className="text-[13px] text-muted">
              {loading
                ? "조건에 맞는 기업을 찾는 중"
                : pageInfo && (
                    <>
                      총 <b className="text-brand-700">{pageInfo.totalElement.toLocaleString()}</b>
                      개
                      {pageInfo.totalPage > 1 &&
                        ` · ${pageInfo.pageNumber} / ${pageInfo.totalPage} 페이지`}
                    </>
                  )}
            </span>
            {/*
              정렬은 고를 수 없다(요금제 계약이라 끄는 스위치를 두지 않는다). 대신 무슨 순서인지는
              적어 둔다 — 최신순이 아닌데 최신순처럼 읽히면 그게 더 나쁘다.
            */}
            <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-faint">
              <SortIcon size={13} />
              정렬 · 스포트라이트 → 추천 노출 → 최신 등록
            </span>
          </div>

          {error ? (
            <ErrorState
              message={error}
              onRetry={() => {
                // 자리표시자로 되돌려 놔야 "다시 시도"를 눌렀다는 게 화면에 보인다.
                setListing(null);
                setRetry((n) => n + 1);
              }}
            />
          ) : loading ? (
            <Grid>
              {Array.from({ length: 6 }, (_, i) => (
                <CompanyPlaceholder key={i} label="불러오는 중" />
              ))}
            </Grid>
          ) : listing && listing.companies.length === 0 ? (
            /*
              결과가 없는 이유가 둘이다. 조건에 맞는 게 없는 것과, 조건에는 맞지만 **그 페이지가
              범위 밖**인 것(주소를 직접 고쳤거나 오래된 링크). 뒤쪽에 "조건을 풀어 보세요"를
              띄우면 아무 관계도 없는 안내가 된다 — 총 개수가 0 인지로 가른다.
            */
            pageInfo && pageInfo.totalElement > 0 ? (
              <OutOfRangeState
                page={state.page}
                totalPage={pageInfo.totalPage}
                onFirst={() => go({ ...state, page: 1 })}
                onLast={() => go({ ...state, page: pageInfo.totalPage })}
              />
            ) : filtered ? (
              <EmptyState
                onClearAll={clearAll}
                onClearCertifications={
                  state.certificationIds.length > 0
                    ? () => clearFacet("certificationIds")
                    : undefined
                }
              />
            ) : (
              <NoCompanyState />
            )
          ) : (
            <Grid>
              {listing?.companies.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  onError={(message, needsLogin) => setNotice({ message, needsLogin })}
                />
              ))}
            </Grid>
          )}

          {pageInfo && !error && (
            <Pagination
              page={pageInfo.pageNumber}
              totalPage={pageInfo.totalPage}
              onChange={(page) => go({ ...state, page })}
            />
          )}
        </section>
      </div>

      <ScrollTop />
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-[18px] pt-0.5 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

/** 상태 판의 공통 껍데기. 점선은 "아직 안 채워진 자리", 실선은 "일이 벌어진 자리"다. */
function StatePanel({
  tone = "empty",
  children,
}: {
  tone?: "empty" | "solid" | "error";
  children: React.ReactNode;
}) {
  const skin = {
    empty: "border-dashed border-ink/20",
    solid: "border-ink/15",
    error: "border-brand/35 bg-brand/4",
  }[tone];

  return (
    <div
      className={`blueprint flex flex-col items-center gap-3 px-[30px] text-center ${skin} ${
        tone === "empty" ? "py-13" : "py-11"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * 조건에 맞는 게 없을 때.
 *
 * 힌트가 두 갈래인 이유는 0건이 되는 길이 둘이라서다 — 통합 검색어의 단어가 늘어난 경우(AND 라
 * 단어마다 좁아진다)와 인증을 서로 다른 묶음에서 고른 경우(묶음끼리 AND 라 급격히 좁아진다).
 * 인증이 실제로 걸려 있을 때만 그 버튼을 준다.
 */
function EmptyState({
  onClearAll,
  onClearCertifications,
}: {
  onClearAll: () => void;
  onClearCertifications?: () => void;
}) {
  return (
    <StatePanel>
      <SearchEmptyIcon size={30} className="text-brand-400" />
      <p className="font-heading text-[22px] font-semibold">조건에 맞는 기업이 없습니다</p>
      <p className="max-w-[420px] text-[13px] leading-[1.6] text-muted">
        통합 검색어는 띄어쓴 단어를 <b className="font-semibold text-ink">모두</b> 가진 기업만
        찾습니다. 단어를 하나 줄이거나, 인증 필터를 서로 다른 묶음에서 고르지 않았는지 확인해
        보세요.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={onClearAll}>
          조건 모두 지우기
        </button>
        {onClearCertifications && (
          <button type="button" className="btn btn-secondary" onClick={onClearCertifications}>
            인증 필터만 풀기
          </button>
        )}
      </div>
    </StatePanel>
  );
}

/** 조건에는 맞지만 그 페이지가 없을 때. 갈 곳을 주는 게 요점이라 안내보다 버튼이 중요하다. */
function OutOfRangeState({
  page,
  totalPage,
  onFirst,
  onLast,
}: {
  page: number;
  totalPage: number;
  onFirst: () => void;
  onLast: () => void;
}) {
  return (
    <StatePanel tone="solid">
      <p className="kick text-brand-700">
        Page {page} / {totalPage}
      </p>
      <p className="font-heading text-[22px] font-semibold">{totalPage}페이지까지만 있습니다</p>
      <p className="max-w-[420px] text-[13px] leading-[1.6] text-muted">
        주소에 실린 페이지 번호가 결과 범위를 벗어났습니다.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={onFirst}>
          첫 페이지로
        </button>
        {totalPage > 1 && (
          <button type="button" className="btn btn-secondary" onClick={onLast}>
            {totalPage}페이지로
          </button>
        )}
      </div>
    </StatePanel>
  );
}

/** 조건 없이 0건 — 데이터가 아직 없는 것이라 사용자가 할 일이 없다. 버튼을 두지 않는다. */
function NoCompanyState() {
  return (
    <StatePanel>
      <FactoryIcon size={30} className="text-ink/30" />
      <p className="font-heading text-[22px] font-semibold">공개된 기업이 없습니다</p>
      <p className="text-[13px] text-muted">기업이 등록되면 이 목록에 바로 나타납니다.</p>
    </StatePanel>
  );
}

/** 요청 자체가 실패했을 때. 제목은 우리가 정하고, 본문은 서버가 준 한국어 문장을 그대로 쓴다. */
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <StatePanel tone="error">
      <WarningIcon size={28} className="text-brand-700" />
      <p className="font-heading text-[22px] font-semibold">목록을 불러오지 못했습니다</p>
      <p className="text-brand-800 max-w-[460px] text-[13px] leading-[1.6]">{message}</p>
      <button type="button" className="btn btn-primary mt-1" onClick={onRetry}>
        다시 시도
      </button>
    </StatePanel>
  );
}
