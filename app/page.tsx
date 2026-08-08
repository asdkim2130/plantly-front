"use client";

import { useEffect, useState } from "react";
import CategoryCards from "@/components/CategoryCards";
import CompanyCard from "@/components/CompanyCard";
import FeaturedCard from "@/components/FeaturedCard";
import HeroSearch from "@/components/HeroSearch";
import {
  CompanyPlaceholder,
  FeaturedPlaceholder,
  SpotlightPlaceholder,
} from "@/components/Placeholders";
import Rail from "@/components/Rail";
import SpotlightCard from "@/components/SpotlightCard";
import StatsPanel from "@/components/StatsPanel";
import { FilterIcon } from "@/components/icons";
import { ApiError } from "@/lib/api";
import { getShowcase, searchCompanies } from "@/lib/companies";
import { flattenCategories, getCategories, getCertifications, getIndustries } from "@/lib/options";
import type {
  CategoryPublicResponse,
  CompanyShowcaseResponse,
  CompanySummary,
  IndustryPublicResponse,
  PageInfo,
} from "@/types/api";

/** 격자 한 번에 채우는 개수(3열 × 4줄). "기업 더 보기"가 이만큼씩 이어 붙인다. */
const PAGE_SIZE = 12;

/**
 * 스포트라이트 레일이 무너지지 않게 지키는 **최소** 칸 수.
 *
 * 실제 노출 자리 수는 서버 설정(`app.showcase.spotlight-slots`)이고 프론트는 받은 만큼 그린다 —
 * 이 값은 받은 게 그보다 적을 때 "데이터 준비 중" 자리표시자로 메워 레일 높이를 유지하는 바닥값이다.
 */
const SPOTLIGHT_MIN_SLIDES = 3;

type Request = {
  keyword: string;
  categoryId: number | null;
  industryId: number | null;
  page: number;
};

/** 완료된 목록 요청 1건의 결과. key 가 현재 조건과 다르면 아직 로딩 중이라는 뜻이다. */
type Listing = {
  key: string;
  companies: CompanySummary[];
  pageInfo: PageInfo | null;
  error: string;
};

const keyOf = (r: Request) => `${r.keyword}|${r.categoryId}|${r.industryId}|${r.page}`;

/**
 * 첫 화면 — 히어로 검색 + 대분류 진입 + 스포트라이트/추천 레일 + 전체 기업 격자.
 *
 * 인증이 세션 쿠키 기반이라 데이터를 읽는 컴포넌트는 전부 클라이언트다(CLAUDE.md 페칭 규칙).
 * 검색어·필터는 아직 URL 에 싣지 않는다 — 공유 링크가 필요해지면 searchParams 로 옮긴다.
 */
export default function HomePage() {
  const [notice, setNotice] = useState("");

  // ── 마스터 데이터(대분류 카드 · 필터 칩 · 현황 숫자) ─────────────────────
  const [categories, setCategories] = useState<CategoryPublicResponse[]>([]);
  const [industries, setIndustries] = useState<IndustryPublicResponse[]>([]);
  const [certificationCount, setCertificationCount] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getCategories(controller.signal),
      getIndustries(controller.signal),
      getCertifications(controller.signal),
    ])
      .then(([cats, inds, certs]) => {
        setCategories(cats);
        setIndustries(inds);
        setCertificationCount(certs.length);
      })
      .catch(() => {
        // 선택지를 못 받아도 목록 자체는 볼 수 있어야 하므로 조용히 넘어간다.
        // 백엔드가 아예 죽었다면 아래 목록 요청이 에러 화면을 띄운다.
      });
    return () => controller.abort();
  }, []);

  // ── 스포트라이트 / 추천 레일 ─────────────────────────────────────────────
  // 어느 회사가 어느 자리를 차지하는지는 서버가 정한다. 목록을 받아 플래그로 거르면 안 되는데,
  // 요금제 자격으로 노출되는 회사는 spotlight 플래그가 false 라 걸러지지 않고(자격은 구독에서
  // 조회 시점에 파생된다) 후보가 자리보다 많을 때 누가 잘리는지도 프론트가 알 수 없어서다.
  const [showcase, setShowcase] = useState<CompanyShowcaseResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getShowcase(controller.signal)
      // 레일을 못 받아도 아래 목록은 보여야 한다 — 빈 레일로 두면 자리표시자가 그려진다.
      .then(setShowcase)
      .catch(() => setShowcase({ spotlight: [], featured: [] }));
    return () => controller.abort();
  }, []);

  // 두 레일에 같은 회사가 겹쳐 나올 수 있고, 그건 의도된 동작이라 중복을 제거하지 않는다
  // (관리자 고정 + 추천은 각각 독립적인 노출이다).
  const spotlights = showcase?.spotlight ?? [];
  const featured = showcase?.featured ?? [];

  // ── 전체 등록 기업 수(히어로·현황) ───────────────────────────────────────
  // 아래 목록 요청의 totalElement 를 재활용하지 않는다 — 검색·필터가 걸리면 그건 걸러진 수라
  // 히어로의 "N COMPANIES" 가 조건에 따라 출렁인다. 조건 없는 1건짜리 요청으로 따로 센다.
  const [totalCompanies, setTotalCompanies] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    searchCompanies({ page: 1, size: 1 }, controller.signal)
      .then((result) => setTotalCompanies(result.pageInfo.totalElement))
      .catch(() => {
        // 숫자 하나 못 받은 것뿐이다. 자리는 비워 두고 화면은 그대로 간다.
      });
    return () => controller.abort();
  }, []);

  // ── 전체 기업 목록 ───────────────────────────────────────────────────────
  const [request, setRequest] = useState<Request>({
    keyword: "",
    categoryId: null,
    industryId: null,
    page: 1,
  });
  const [listing, setListing] = useState<Listing | null>(null);

  const key = keyOf(request);
  const loading = listing?.key !== key;
  const loadingMore = loading && request.page > 1;

  const companies = listing?.companies ?? [];
  const pageInfo = listing?.pageInfo ?? null;
  const error = listing?.error ?? "";

  useEffect(() => {
    const controller = new AbortController();

    searchCompanies(
      {
        keyword: request.keyword || undefined,
        categoryIds: request.categoryId ? [request.categoryId] : undefined,
        industryIds: request.industryId ? [request.industryId] : undefined,
        page: request.page,
        size: PAGE_SIZE,
      },
      controller.signal,
    )
      .then((result) =>
        setListing((prev) => ({
          key,
          // 2페이지부터는 이어 붙인다("기업 더 보기"). 조건이 바뀌면 page 가 1로 돌아가 새로 담긴다.
          companies:
            request.page > 1 && prev ? [...prev.companies, ...result.content] : result.content,
          pageInfo: result.pageInfo,
          error: "",
        })),
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
  }, [key, request]);

  /** 조건이 바뀌면 항상 첫 페이지부터 다시 담는다. */
  const apply = (patch: Partial<Omit<Request, "page">>) =>
    setRequest((prev) => ({ ...prev, ...patch, page: 1 }));

  const topLevel = categories.filter((c) => c.depth === 1);
  const filtered = Boolean(request.keyword || request.categoryId || request.industryId);
  const hasMore = pageInfo ? pageInfo.pageNumber < pageInfo.totalPage : false;

  return (
    <>
      {/* ── 히어로 ─────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-9 px-4 pt-11 pb-[38px] sm:px-[30px] lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div>
            <p className="font-heading text-brand-700 mb-2 text-[11px] tracking-[0.14em] uppercase">
              Manufacturing Network
              {totalCompanies !== null && ` · ${totalCompanies.toLocaleString()} Companies`}
            </p>
            <h1 className="text-[clamp(30px,5vw,44px)] leading-[1.1] tracking-[-0.02em]">
              제조의 모든 연결,
              <br />
              플랜틀리에서 시작됩니다
            </h1>
            <p className="mt-3 text-[15px] text-muted text-pretty">
              프로젝트를 맡길 기업과 해결할 기업이 한 곳에서 만나는 제조 플랫폼
            </p>
          </div>

          <HeroSearch value={request.keyword} onSearch={(keyword) => apply({ keyword })} />
        </div>

        <StatsPanel
          companyCount={totalCompanies}
          categoryCount={categories.length ? flattenCategories(categories).length : null}
          industryCount={industries.length || null}
          certificationCount={certificationCount}
        />
      </section>

      <CategoryCards
        categories={topLevel}
        selectedId={request.categoryId}
        onSelect={(categoryId) => {
          apply({ categoryId });
          document.getElementById("companies")?.scrollIntoView({ behavior: "smooth" });
        }}
      />

      <div className="flex flex-col gap-[34px] px-4 pt-[34px] pb-9 sm:px-[30px]">
        {notice && (
          <p
            role="status"
            className="bg-brand-soft text-brand-700 -mb-4 rounded-lg px-3 py-2 text-[12.5px]"
          >
            {notice}
          </p>
        )}

        {/*
          검색·필터가 걸리면 큐레이션 레일은 접는다 — 검색 결과와 섞이면
          "이게 내 검색 결과인가?" 하고 헷갈린다.
        */}
        {!filtered && (
          <>
            <section className="flex flex-col gap-[13px]">
              <SectionHead title="스포트라이트" note="플랜틀리가 이번 주 직접 소개하는 기업" />
              {/*
                슬라이드 하나가 트랙 폭 그대로다(간격 없음) — 그래야 한 번 넘길 때 정확히 한 장이 온다.
                위아래 여백은 hover 때 카드가 2px 떠오르고 그림자가 퍼질 자리다.
                overflow-x:auto 는 세로도 같이 자르기 때문에 padding 으로 벌리고 margin 으로 되당긴다.
              */}
              <Rail label="스포트라이트" trackClassName="-my-3 flex py-3">
                {spotlights.map((company, i) => (
                  <div key={company.id} className="w-full shrink-0">
                    <SpotlightCard
                      company={company}
                      kicker={`Spotlight ${String(i + 1).padStart(2, "0")}`}
                      onError={setNotice}
                    />
                  </div>
                ))}
                {Array.from(
                  { length: Math.max(0, SPOTLIGHT_MIN_SLIDES - spotlights.length) },
                  (_, i) => (
                    <div key={`ph-${i}`} className="w-full shrink-0">
                      <SpotlightPlaceholder index={spotlights.length + i + 1} />
                    </div>
                  ),
                )}
              </Rail>
            </section>

            <section className="flex flex-col gap-[13px]">
              <SectionHead
                title="추천 기업"
                note="관심 카테고리 기준으로 골라낸 기업 · 가로로 더 봐도 됩니다"
              />
              {/*
                2줄 격자를 가로로 흘린다(grid-auto-flow:column).

                칸 너비는 minmax 가 아니라 고정값이어야 한다 — minmax 로 두면 격자가 칸을
                컨테이너 폭에 맞춰 좁히기 때문에, 카드가 줄어들 뿐 가로로 넘치지 않아 스크롤이 안 생긴다.
                좁은 화면 대비로 78vw 상한만 씌운다.

                아래 여백은 카드에 마우스를 올렸을 때 펼쳐지는 태그가, 위 여백은 2px 떠오르는
                hover 효과가 잘리지 않게 두는 자리다 — overflow-x:auto 는 세로도 같이 자르기 때문에
                padding 으로 벌리고 margin 으로 되당긴다.
              */}
              <Rail
                label="추천 기업"
                trackClassName="-mt-3 -mb-[126px] grid grid-flow-col auto-cols-[min(359px,78vw)] grid-rows-2 gap-5 pt-3 pb-[130px]"
              >
                {featured.map((company) => (
                  <FeaturedCard key={company.id} company={company} onError={setNotice} />
                ))}
                {Array.from(
                  { length: fillTo(featured.length, 2, showcase === null ? 4 : 0) },
                  (_, i) => (
                    <FeaturedPlaceholder key={`ph-${i}`} />
                  ),
                )}
              </Rail>
            </section>
          </>
        )}

        {/* ── 전체 기업 ─────────────────────────────────────────────────── */}
        <section id="companies" className="flex scroll-mt-4 flex-col gap-[13px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-[23px]">{filtered ? "검색 결과" : "전체 기업"}</h2>
              <span className="text-[12.5px] text-faint">
                {pageInfo ? (
                  <>
                    총 <b className="text-brand-700">{pageInfo.totalElement.toLocaleString()}</b>개
                  </>
                ) : (
                  " "
                )}
              </span>
            </div>

            {/*
              디자인의 "지역 · 업종 필터" 자리. 지역은 검색 쿼리에 대응하는 파라미터가 없어서
              (categoryIds / industryIds / certificationIds 세 개뿐) 지금은 업종만 건다.
            */}
            <div className={`btn ${request.industryId ? "btn-primary" : "btn-secondary"}`}>
              <FilterIcon size={14} />
              <select
                aria-label="업종 필터"
                className="font-body cursor-pointer bg-transparent text-[13px] font-normal outline-none"
                value={request.industryId ?? ""}
                onChange={(e) =>
                  apply({
                    industryId: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">업종 전체</option>
                {industries.map((industry) => (
                  <option key={industry.id} value={industry.id}>
                    {industry.industryName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-[7px] border-b border-line-soft pb-[18px]">
            <button
              type="button"
              className={`btn text-[13px] ${request.categoryId === null ? "btn-primary" : "btn-secondary"}`}
              onClick={() => apply({ categoryId: null })}
            >
              전체
            </button>
            {topLevel.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`btn text-[13px] ${
                  request.categoryId === category.id ? "btn-primary" : "btn-secondary"
                }`}
                onClick={() => apply({ categoryId: category.id })}
              >
                {category.categoryName}
              </button>
            ))}
          </div>

          {error ? (
            <ErrorState
              message={error}
              onRetry={() => setRequest((prev) => ({ ...prev, page: prev.page }))}
            />
          ) : loading && !loadingMore ? (
            <Grid>
              {Array.from({ length: 6 }, (_, i) => (
                <CompanyPlaceholder key={i} />
              ))}
            </Grid>
          ) : companies.length === 0 ? (
            <EmptyState
              filtered={filtered}
              onReset={() => apply({ keyword: "", categoryId: null, industryId: null })}
            />
          ) : (
            <Grid>
              {companies.map((company) => (
                <CompanyCard key={company.id} company={company} onError={setNotice} />
              ))}
            </Grid>
          )}

          {hasMore && !error && (
            <div className="mt-1.5 flex justify-center">
              <button
                type="button"
                className="btn btn-secondary min-w-[200px]"
                disabled={loading}
                onClick={() => setRequest((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                {loadingMore ? "불러오는 중…" : "기업 더 보기"}
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/** 레일 칸을 줄 수(rows)의 배수로 맞춘다. 아무것도 없을 때는 최소 min 칸을 그린다. */
function fillTo(count: number, rows: number, min: number) {
  if (count === 0) return Math.max(min, rows);
  return (rows - (count % rows)) % rows;
}

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2.5">
      <h2 className="text-[23px]">{title}</h2>
      <span className="text-xs text-faint">{note}</span>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-[18px] sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}

function EmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  return (
    <div className="blueprint flex flex-col items-center gap-3 border-dashed py-16 text-center">
      <p className="font-heading text-lg">
        {filtered ? "조건에 맞는 기업이 없습니다." : "등록된 기업이 없습니다."}
      </p>
      <p className="text-[12.5px] text-muted">
        {filtered
          ? "검색어를 줄이거나 필터를 풀어 보세요."
          : "백엔드 시드를 심으면 여기에 기업이 표시됩니다."}
      </p>
      {filtered && (
        <button type="button" className="btn btn-secondary" onClick={onReset}>
          조건 모두 지우기
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
