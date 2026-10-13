"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import AdminCompanyCard, { type AdminFlag } from "@/components/AdminCompanyCard";
import {
  ConfirmDialog,
  type ConfirmText,
  ListError,
  ListSkeleton,
  ToastView,
  failMessage,
  useToast,
} from "@/components/ManageListParts";
import Pagination from "@/components/Pagination";
import { useSession } from "@/components/SessionProvider";
import { PlusIcon, SearchIcon } from "@/components/icons";
import {
  changeAdminFlags,
  changeAdminVisibility,
  deleteAdminCompany,
  listAdminCompanies,
  restoreAdminCompany,
} from "@/lib/admin";
import type { AdminCompanyQuery, AdminCompanySummary, PageResponse } from "@/types/api";

const PAGE_SIZE = 20;
const BASE = "/admin/companies";

/** 목록 위 필터 칩. 서버 필터(불리언 3-상태) 중 운영에서 자주 찾는 셋만 꺼냈다 */
const FILTERS = [
  { key: "all", label: "전체", query: {} },
  { key: "featured", label: "추천 노출", query: { featured: true } },
  { key: "spotlight", label: "스팟라이트 고정", query: { spotlight: true } },
  { key: "deleted", label: "삭제됨", query: { deleted: true } },
] as const satisfies readonly { key: string; label: string; query: AdminCompanyQuery }[];

type FilterKey = (typeof FILTERS)[number]["key"];

type Confirm = { kind: "private" | "delete"; company: AdminCompanySummary };

/**
 * 관리자 기업 목록. 화면 구성은 내 기업 목록(`MyCompanies`, 디자인 "플랜틀리 내 기업 목록")과 같고 다른 점은 셋이다.
 *
 *  - **작성 중인 등록 영역이 없다.** 초안은 "그 사용자가 국세청 인증을 받은 사업자번호"에만 저장되는데,
 *    관리자 등록(`POST /admin/companies`)은 국세청 인증 없이 사업자번호를 직접 넣는 경로라 초안을 둘 수 없다.
 *  - **필터 칩 + 회사명 검색**이 있다. 추천·스팟라이트를 켜고 끌 대상을 찾는 화면이라서다. 조건은 주소에 싣는다(`?f=&q=&page=`).
 *  - 카드 아랫단의 **추천 노출 · 스팟라이트 고정 스위치**(AdminCompanyCard).
 *
 * "새 기업 등록" 은 관리자 등록 화면이 아직 없어 비활성이다. 화면이 생기면 `/admin/companies/new` 링크로 바꾼다.
 * 소유자용 등록(`/companies/new`)으로 보내지 않는 이유: 그 길은 국세청 인증을 거쳐 누른 사람을 소유자로 만든다.
 *
 * 권한: 화면은 `userRole` 로 관리자가 아니면 그리지 않지만, 실제로 막는 건 서버다(관리자 API 는 MEMBER 에게 403).
 */
export default function AdminCompanies() {
  const { user, loading } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const filter: FilterKey = FILTERS.find((f) => f.key === searchParams.get("f"))?.key ?? "all";
  const keyword = searchParams.get("q")?.trim() ?? "";

  const [companies, setCompanies] = useState<PageResponse<AdminCompanySummary> | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  // 검색칸은 입력 중인 값이라 주소(q)와 따로 든다. 주소가 바뀌면(뒤로 가기 등) 칸도 따라간다.
  const [draftKeyword, setDraftKeyword] = useState(keyword);
  const [syncedKeyword, setSyncedKeyword] = useState(keyword);
  if (syncedKeyword !== keyword) {
    setSyncedKeyword(keyword);
    setDraftKeyword(keyword);
  }

  const [busy, setBusy] = useState<Record<number, string>>({});
  const [pendingFlags, setPendingFlags] = useState<Record<number, AdminFlag>>({});
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [toast, setToast] = useToast();
  const [now] = useState(() => Date.now());

  const isAdmin = user?.userRole === "ADMIN";

  useEffect(() => {
    if (!loading && !user) {
      const here = `${BASE}${searchParams.size ? `?${searchParams}` : ""}`;
      router.replace(`/login?next=${encodeURIComponent(here)}`);
    }
  }, [loading, user, router, searchParams]);

  // 다시 받는 동안에도 지금 목록을 지우지 않는다 — 삭제·복구 뒤 목록이 스켈레톤으로 깜빡이지 않게.
  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    const query: AdminCompanyQuery = {
      ...FILTERS.find((f) => f.key === filter)!.query,
      companyName: keyword || undefined,
      page,
      size: PAGE_SIZE,
    };
    listAdminCompanies(query, controller.signal).then(
      (result) => {
        // 마지막 장의 마지막 하나가 필터에서 빠졌다 — 빈 페이지 대신 앞 장으로 간다.
        if (result.content.length === 0 && page > 1) {
          router.replace(urlFor({ filter, keyword, page: page - 1 }));
          return;
        }
        setCompanies(result);
        setError(false);
      },
      () => !controller.signal.aborted && setError(true),
    );
    return () => controller.abort();
  }, [isAdmin, filter, keyword, page, reload, router]);

  function go(next: { filter?: FilterKey; keyword?: string; page?: number }) {
    // 필터·검색어가 바뀌면 1쪽부터. 페이지만 바뀔 때만 page 를 유지한다.
    router.push(urlFor({ filter: next.filter ?? filter, keyword: next.keyword ?? keyword, page: next.page ?? 1 }));
  }

  function setCardBusy(id: number, label: string | null) {
    setBusy((prev) => {
      const next = { ...prev };
      if (label) next[id] = label;
      else delete next[id];
      return next;
    });
  }

  function patchCard(id: number, change: Partial<AdminCompanySummary>) {
    setCompanies(
      (prev) => prev && { ...prev, content: prev.content.map((c) => (c.id === id ? { ...c, ...change } : c)) },
    );
  }

  async function toggleFlag(company: AdminCompanySummary, flag: AdminFlag) {
    const target = !company[flag];
    const label = flag === "featured" ? "추천 노출" : "스팟라이트 고정";
    setPendingFlags((prev) => ({ ...prev, [company.id]: flag }));
    try {
      await changeAdminFlags(company.id, { [flag]: target });
      patchCard(company.id, { [flag]: target });
      setToast({ message: `‘${company.companyName}’ ${label}을(를) ${target ? "켰습니다" : "껐습니다"}`, ok: true });
    } catch (e) {
      setToast({ message: failMessage(e, `${label}을(를) 바꾸지 못했습니다. 다시 시도해 주세요`), ok: false });
    } finally {
      setPendingFlags((prev) => {
        const next = { ...prev };
        delete next[company.id];
        return next;
      });
    }
  }

  async function applyVisibility(company: AdminCompanySummary, target: "PUBLIC" | "PRIVATE") {
    const word = target === "PUBLIC" ? "공개" : "비공개";
    setCardBusy(company.id, `${word}로 전환하는 중`);
    try {
      await changeAdminVisibility(company.id, target);
      patchCard(company.id, { visibility: target });
      setToast({ message: `${word}로 전환했습니다`, ok: true });
    } catch (e) {
      setToast({ message: failMessage(e, `${word}로 전환하지 못했습니다. 다시 시도해 주세요`), ok: false });
    } finally {
      setCardBusy(company.id, null);
    }
  }

  // 삭제·복구는 그 자리에서 고치지 않고 목록을 다시 받는다 — "삭제됨" 필터에서는 카드가 빠지거나 들어와야 해서다.
  async function runAndReload(company: AdminCompanySummary, label: string, done: string, action: () => Promise<void>) {
    setCardBusy(company.id, label);
    try {
      await action();
      setReload((n) => n + 1);
      setToast({ message: done, ok: true });
    } catch (e) {
      setToast({ message: failMessage(e, "처리하지 못했습니다. 다시 시도해 주세요"), ok: false });
    } finally {
      setCardBusy(company.id, null);
    }
  }

  function onConfirm() {
    if (!confirm) return;
    setConfirm(null);
    const { company } = confirm;
    if (confirm.kind === "private") applyVisibility(company, "PRIVATE");
    else runAndReload(company, "삭제하는 중", "기업을 삭제했습니다", () => deleteAdminCompany(company.id));
  }

  if (loading || !user) return <div className="px-4 py-16 sm:px-[30px]" aria-busy />;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-20 text-center sm:px-[30px]">
        <p className="text-sm text-muted">관리자만 볼 수 있는 화면입니다.</p>
        <Link href="/" className="btn btn-secondary">
          메인으로
        </Link>
      </div>
    );
  }

  const total = companies?.pageInfo.totalElement ?? 0;
  const filtered = filter !== "all" || keyword !== "";

  return (
    <div className="flex flex-col">
      <div className="border-b border-line-soft px-4 pt-[26px] pb-[22px] sm:px-[30px]">
        <p className="kick mb-[7px] text-brand-700">Admin · Companies</p>
        <div className="flex flex-col items-stretch gap-3.5 sm:flex-row sm:items-end">
          <div className="mr-auto flex items-baseline gap-2.5">
            <h1 className="text-[30px] leading-[1.1]">기업 관리</h1>
            {companies && !error && <span className="font-heading text-xl text-brand-700">{total}개</span>}
          </div>
          {/* 관리자 등록 화면이 생기면 Link href="/admin/companies/new" 로 바꾼다(위 주석). */}
          <button
            type="button"
            disabled
            title="관리자 등록 화면을 준비하고 있습니다"
            className="btn btn-primary justify-center px-[18px]"
          >
            <PlusIcon size={15} strokeWidth={1.8} />새 기업 등록
            <span className="text-xs font-normal opacity-80">준비 중</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-[22px] px-4 pt-[22px] pb-10 sm:px-[30px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2" role="group" aria-label="필터">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                className={`tag tag-lg ${filter === f.key ? "border-brand bg-brand text-white" : "tag-neutral"}`}
                onClick={() => filter !== f.key && go({ filter: f.key })}
              >
                {f.label}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2 sm:ml-auto"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              go({ keyword: draftKeyword.trim() });
            }}
          >
            <label className="relative flex-1 sm:w-[260px] sm:flex-none">
              <span className="sr-only">회사명 검색</span>
              <SearchIcon size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
              <input
                type="search"
                className="field w-full pl-9"
                placeholder="회사명 검색"
                value={draftKeyword}
                onChange={(e) => setDraftKeyword(e.target.value)}
              />
            </label>
            <button type="submit" className="btn btn-secondary">
              검색
            </button>
          </form>
        </div>

        {error ? (
          <ListError
            title="기업 목록을 불러오지 못했습니다"
            onRetry={() => {
              setError(false);
              setCompanies(null);
              setReload((n) => n + 1);
            }}
          />
        ) : companies === null ? (
          <ListSkeleton />
        ) : total === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-line px-[18px] py-[22px] text-sm leading-[1.6] text-muted">
            {filtered ? "조건에 맞는 기업이 없습니다." : "등록된 기업이 없습니다."}
            {filtered && (
              <button type="button" className="elink" onClick={() => router.push(BASE)}>
                조건 지우기
              </button>
            )}
          </div>
        ) : (
          <section className="flex flex-col gap-2.5" aria-labelledby="companies-title">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 id="companies-title" className="text-[19px]">
                등록된 기업
              </h2>
              <span className="text-xs text-faint">
                최신 등록순{filter === "all" && " · 삭제된 기업 포함"}
              </span>
            </div>
            <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {companies.content.map((company) => (
                <AdminCompanyCard
                  key={company.id}
                  company={company}
                  now={now}
                  busy={busy[company.id] ?? null}
                  pendingFlag={pendingFlags[company.id] ?? null}
                  onToggleFlag={(flag) => toggleFlag(company, flag)}
                  onToggleVisibility={() =>
                    company.visibility === "PRIVATE"
                      ? applyVisibility(company, "PUBLIC")
                      : setConfirm({ kind: "private", company })
                  }
                  onDelete={() => setConfirm({ kind: "delete", company })}
                  onRestore={() =>
                    runAndReload(company, "복구하는 중", "기업을 복구했습니다", () => restoreAdminCompany(company.id))
                  }
                />
              ))}
            </div>
            <Pagination page={page} totalPage={companies.pageInfo.totalPage} onChange={(p) => go({ page: p })} />
          </section>
        )}
      </div>

      {confirm && (
        <ConfirmDialog text={confirmText(confirm)} onCancel={() => setConfirm(null)} onConfirm={onConfirm} />
      )}

      <ToastView toast={toast} />
    </div>
  );
}

function urlFor({ filter, keyword, page }: { filter: FilterKey; keyword: string; page: number }) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("f", filter);
  if (keyword) params.set("q", keyword);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${BASE}?${qs}` : BASE;
}

function confirmText({ kind, company }: Confirm): ConfirmText {
  return kind === "private"
    ? {
        title: "비공개로 전환할까요?",
        body: `‘${company.companyName}’이(가) 검색·메인·즐겨찾기 목록에서 사라집니다. 언제든 다시 공개할 수 있습니다.`,
        ok: "비공개로 전환",
        danger: false,
      }
    : {
        title: `‘${company.companyName}’을(를) 삭제할까요?`,
        body: "삭제하면 공개 화면과 소유자 목록에서 사라집니다. 이 목록의 \"삭제됨\" 에서 복구할 수 있습니다.",
        ok: "삭제",
        danger: true,
      };
}
