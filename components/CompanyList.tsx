"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CompanyCard from "@/components/CompanyCard";
import CompanyFacets from "@/components/CompanyFacets";
import CompanySearchForm, { type SearchText } from "@/components/CompanySearchForm";
import Pagination from "@/components/Pagination";
import { CompanyPlaceholder } from "@/components/Placeholders";
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
  categories: CategoryPublicResponse[];
  industries: IndustryPublicResponse[];
  certifications: CertificationPublicResponse[];
};

/** 끝난 목록 요청 1건. key 가 지금 주소와 다르면 아직 결과가 안 온 것이다. */
type Listing = {
  key: string;
  companies: CompanySummary[];
  pageInfo: PageInfo | null;
  error: string;
};

/** 조건 칩 하나. 지우면 그 조건만 빠진 주소로 이동한다. */
type Chip = { id: string; label: string; onRemove: () => void };

/**
 * 공개 기업 목록/검색 — `GET /api/v1/companies`.
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
  const state = useMemo(
    () => parseCompanySearch(new URLSearchParams(queryString)),
    [queryString],
  );

  /** 좋아요·즐겨찾기 실패(주로 비로그인). 목록은 그대로 두고 한 줄로 알린다. */
  const [notice, setNotice] = useState("");

  // ── 선택지(분류·업종·인증) ──────────────────────────────────────────────
  const [options, setOptions] = useState<Options | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getCategories(controller.signal),
      getIndustries(controller.signal),
      getCertifications(controller.signal),
    ])
      .then(([categories, industries, certifications]) =>
        setOptions({ categories, industries, certifications }),
      )
      // 선택지를 못 받아도 결과 목록은 볼 수 있어야 한다. 빈 값으로 확정해 자리표시자를 걷는다.
      .catch(() => setOptions({ categories: [], industries: [], certifications: [] }));
    return () => controller.abort();
  }, []);

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
        setListing({ key, companies: result.content, pageInfo: result.pageInfo, error: "" }),
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
              : "기업 목록을 불러오지 못했습니다. 백엔드가 켜져 있는지 확인하세요.",
        });
      });

    return () => controller.abort();
  }, [key, state, retry]);

  // ── 조건 바꾸기 = 주소 바꾸기 ───────────────────────────────────────────
  const go = (next: CompanySearchState) => router.push(`/companies${toQueryString(next)}`);

  /** 조건이 바뀌면 언제나 1페이지부터 다시 본다 — 5페이지에 있던 채로 조건만 좁히면 빈 화면이 된다. */
  const apply = (patch: Partial<CompanySearchState>) => go({ ...state, ...patch, page: 1 });

  const applyText = (text: SearchText) =>
    apply({ keyword: text.keyword, advanced: text.advanced });

  const toggleFacet = (facet: FacetKey, id: number) =>
    apply({ [facet]: toggleId(state[facet], id) });

  const clearFacet = (facet: FacetKey) => apply({ [facet]: [] });

  const clearAll = () =>
    go({
      keyword: "",
      advanced: EMPTY_ADVANCED,
      categoryIds: [],
      industryIds: [],
      certificationIds: [],
      page: 1,
    });

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
            label: `검색어: ${state.keyword}`,
            onRemove: () => apply({ keyword: "" }),
          },
        ]
      : []),
    ...ADVANCED_FIELDS.filter((field) => state.advanced[field]).map((field) => ({
      id: `adv-${field}`,
      label: `${ADVANCED_FIELD_LABEL[field]}: ${state.advanced[field]}`,
      onRemove: () => apply({ advanced: { ...state.advanced, [field]: "" } }),
    })),
    ...FACET_KEYS.flatMap((facet) =>
      state[facet].map((id) => ({
        id: `${facet}-${id}`,
        label: `${FACET_LABEL[facet]}: ${facetNames[facet].get(id) ?? `#${id}`}`,
        onRemove: () => toggleFacet(facet, id),
      })),
    ),
  ];

  const filtered = hasCondition(state);
  const pageInfo = listing?.pageInfo ?? null;
  const error = listing?.error ?? "";

  return (
    <div className="flex flex-col gap-5 px-4 pt-8 pb-10 sm:px-[30px]">
      <header className="flex flex-col gap-1">
        <p className="kick">Company Directory</p>
        <h1 className="text-[30px] leading-tight">기업 찾기</h1>
        <p className="text-[13px] text-muted">
          공개 등록된 기업을 검색어와 필터로 좁혀 봅니다. 비공개로 돌렸거나 삭제된 기업은 나오지
          않습니다.
        </p>
      </header>

      <CompanySearchForm
        keyword={state.keyword}
        advanced={state.advanced}
        onSubmit={applyText}
      />

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button key={chip.id} type="button" className="chip on" onClick={chip.onRemove}>
              {chip.label} ×
            </button>
          ))}
          <button
            type="button"
            className="text-brand-700 ml-1 text-[13px] underline underline-offset-2"
            onClick={clearAll}
          >
            조건 모두 지우기
          </button>
        </div>
      )}

      {notice && (
        <p role="status" className="bg-brand-soft text-brand-700 rounded-lg px-3 py-2 text-[13px]">
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:gap-8">
        <aside className="lg:w-[240px] lg:shrink-0">
          <CompanyFacets
            categories={options?.categories ?? []}
            industries={options?.industries ?? []}
            certifications={options?.certifications ?? []}
            selected={state}
            onToggle={toggleFacet}
            onClear={clearFacet}
            loading={options === null}
          />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-2.5 border-b border-line-soft pb-3">
            <h2 className="text-[19px]">{filtered ? "검색 결과" : "전체 기업"}</h2>
            <span className="text-[13px] text-faint">
              {pageInfo && !loading && (
                <>
                  총 <b className="text-brand-700">{pageInfo.totalElement.toLocaleString()}</b>개
                  {pageInfo.totalPage > 1 && ` · ${pageInfo.pageNumber}/${pageInfo.totalPage} 페이지`}
                </>
              )}
            </span>
            {/*
              정렬은 고를 수 없다(요금제 계약이라 끄는 스위치를 두지 않는다). 대신 무슨 순서인지는
              적어 둔다 — 최신순이 아닌데 최신순처럼 읽히면 그게 더 나쁘다.
            */}
            <span className="ml-auto text-[12px] text-faint">정렬 · 추천 노출 → 최신 등록</span>
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
                <CompanyPlaceholder key={i} />
              ))}
            </Grid>
          ) : listing && listing.companies.length === 0 ? (
            /*
              결과가 없는 이유가 둘이다. 조건에 맞는 게 없는 것과, 조건에는 맞지만 **그 페이지가
              범위 밖**인 것(주소를 직접 고쳤거나 오래된 링크). 뒤쪽에 "조건을 풀어 보세요"를
              띄우면 아무 관계도 없는 안내가 된다 — 총 개수가 0 인지로 가른다.
            */
            pageInfo && pageInfo.totalElement > 0 ? (
              <EmptyState
                title={`${pageInfo.totalPage}페이지까지만 있습니다.`}
                hint="주소의 page 값이 결과 범위를 넘었습니다."
                actionLabel="첫 페이지로"
                onAction={() => go({ ...state, page: 1 })}
              />
            ) : filtered ? (
              <EmptyState
                title="조건에 맞는 기업이 없습니다."
                hint="검색어를 줄이거나 필터를 풀어 보세요. 인증은 묶음끼리 AND 라 여럿 고르면 빠르게 좁혀집니다."
                actionLabel="조건 모두 지우기"
                onAction={clearAll}
              />
            ) : (
              <EmptyState
                title="공개된 기업이 없습니다."
                hint="백엔드 시드를 심으면 여기에 기업이 표시됩니다."
              />
            )
          ) : (
            <Grid>
              {listing?.companies.map((company) => (
                <CompanyCard key={company.id} company={company} onError={setNotice} />
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
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-[18px] sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}

function EmptyState({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="blueprint flex flex-col items-center gap-3 border-dashed py-16 text-center">
      <p className="font-heading text-lg">{title}</p>
      <p className="max-w-[420px] text-[13px] text-muted">{hint}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-secondary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="blueprint flex flex-col items-center gap-3 py-16 text-center">
      <p className="font-heading text-lg">{message}</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        다시 시도
      </button>
    </div>
  );
}
