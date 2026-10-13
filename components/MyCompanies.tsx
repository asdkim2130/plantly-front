"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import OwnerCompanyCard from "@/components/OwnerCompanyCard";
import Pagination from "@/components/Pagination";
import { useSession } from "@/components/SessionProvider";
import {
  ConfirmDialog,
  type ConfirmText,
  ListError,
  ListSkeleton,
  ToastView,
  failMessage,
  useToast,
} from "@/components/ManageListParts";
import { DraftIcon, OfficeIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { changeVisibility, deleteCompany, deleteDraft, getMyCompanies, listDrafts } from "@/lib/companies";
import { formatBusinessNumber, relativeTime } from "@/lib/register";
import type { CompanyDraftSummary, CompanySummary, PageResponse } from "@/types/api";

const PAGE_SIZE = 20;

type Confirm =
  | { kind: "private"; company: CompanySummary }
  | { kind: "delete"; company: CompanySummary }
  | { kind: "draft"; draft: CompanyDraftSummary };

/**
 * 내 기업 목록(소유자). 정본은 Claude Design 의 **"플랜틀리 내 기업 목록"**.
 *
 * 두 목록을 함께 받는다 — 등록한 기업(`/companies/my`, 페이지)과 작성 중인 등록(`/companies/drafts`, 전부).
 * 둘은 따로 실패할 수 있다. 기업 목록이 실패하면 화면이 할 일이 없어 오류 화면을 띄우지만, 초안 목록만 실패하면
 * 기업 목록은 그대로 보여 주고 초안 자리에 다시 시도를 둔다.
 *
 * 페이지는 주소(`?page=`)에 싣는다 — 수정 화면에 갔다가 뒤로 오면 보던 페이지로 돌아와야 한다.
 */
export default function MyCompanies() {
  const { user, loading } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [companies, setCompanies] = useState<PageResponse<CompanySummary> | null>(null);
  const [companiesError, setCompaniesError] = useState(false);
  const [drafts, setDrafts] = useState<CompanyDraftSummary[] | null>(null);
  const [draftsError, setDraftsError] = useState(false);
  // 다시 받기 신호. 값 자체는 의미 없고 바뀌는 것만 본다(삭제 뒤 빈자리 채우기·다시 시도).
  const [reload, setReload] = useState(0);
  const [draftsReload, setDraftsReload] = useState(0);

  const [busy, setBusy] = useState<Record<number, string>>({});
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [toast, setToast] = useToast();
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent("/companies/my")}`);
  }, [loading, user, router]);

  // 다시 받는 동안에도 지금 목록을 지우지 않는다 — 삭제 뒤 빈자리를 채울 때 목록이 스켈레톤으로 깜빡이지 않게.
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    getMyCompanies(page, PAGE_SIZE, controller.signal).then(
      (result) => {
        // 마지막 장의 마지막 하나를 지웠다 — 빈 페이지 대신 앞 장으로 간다.
        if (result.content.length === 0 && page > 1) {
          router.replace(page - 1 === 1 ? "/companies/my" : `/companies/my?page=${page - 1}`);
          return;
        }
        setCompanies(result);
        setCompaniesError(false);
      },
      () => !controller.signal.aborted && setCompaniesError(true),
    );
    return () => controller.abort();
  }, [user, page, reload, router]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    listDrafts(controller.signal).then(
      (result) => {
        setDrafts(result);
        setDraftsError(false);
      },
      () => !controller.signal.aborted && setDraftsError(true),
    );
    return () => controller.abort();
  }, [user, draftsReload]);

  function goPage(next: number) {
    router.push(next === 1 ? "/companies/my" : `/companies/my?page=${next}`);
  }

  function retry() {
    setCompaniesError(false);
    setCompanies(null);
    setReload((n) => n + 1);
    setDraftsReload((n) => n + 1);
  }

  function setCardBusy(id: number, label: string | null) {
    setBusy((prev) => {
      const next = { ...prev };
      if (label) next[id] = label;
      else delete next[id];
      return next;
    });
  }

  async function applyVisibility(company: CompanySummary, target: "PUBLIC" | "PRIVATE") {
    const word = target === "PUBLIC" ? "공개" : "비공개";
    setCardBusy(company.id, `${word}로 전환하는 중`);
    try {
      await changeVisibility(company.id, target);
      setCompanies((prev) =>
        prev && {
          ...prev,
          content: prev.content.map((c) => (c.id === company.id ? { ...c, visibility: target } : c)),
        },
      );
      setToast({ message: `${word}로 전환했습니다`, ok: true });
    } catch (e) {
      setToast({ message: failMessage(e, `${word}로 전환하지 못했습니다. 다시 시도해 주세요`), ok: false });
    } finally {
      setCardBusy(company.id, null);
    }
  }

  async function removeCompany(company: CompanySummary) {
    setCardBusy(company.id, "삭제하는 중");
    try {
      await deleteCompany(company.id);
      // 지운 자리는 다음 페이지 첫 기업이 채운다 — 목록을 다시 받는다.
      setReload((n) => n + 1);
      setToast({ message: "기업을 삭제했습니다", ok: true });
    } catch (e) {
      setToast({ message: failMessage(e, "삭제하지 못했습니다. 다시 시도해 주세요"), ok: false });
    } finally {
      setCardBusy(company.id, null);
    }
  }

  async function removeDraft(draft: CompanyDraftSummary) {
    try {
      await deleteDraft(draft.businessNumber);
      setDrafts((prev) => prev && prev.filter((d) => d.businessNumber !== draft.businessNumber));
      setToast({ message: "작성 중인 내용을 삭제했습니다", ok: true });
    } catch (e) {
      setToast({ message: failMessage(e, "삭제하지 못했습니다. 다시 시도해 주세요"), ok: false });
    }
  }

  function onConfirm() {
    if (!confirm) return;
    setConfirm(null);
    if (confirm.kind === "private") applyVisibility(confirm.company, "PRIVATE");
    else if (confirm.kind === "delete") removeCompany(confirm.company);
    else removeDraft(confirm.draft);
  }

  if (loading || !user) return <div className="px-4 py-16 sm:px-[30px]" aria-busy />;

  const total = companies?.pageInfo.totalElement ?? 0;
  const draftList = drafts ?? [];
  const ready = companies !== null && !companiesError;
  // 초안 목록이 아직 안 왔거나 실패했으면 "아무것도 없음"이라고 단정하지 않는다.
  const emptyAll = ready && total === 0 && drafts !== null && draftList.length === 0;

  return (
    <div className="flex flex-col">
      <div className="border-b border-line-soft px-4 pt-[26px] pb-[22px] sm:px-[30px]">
        <p className="kick mb-[7px] text-brand-700">My Companies</p>
        <div className="flex flex-col items-stretch gap-3.5 sm:flex-row sm:items-end">
          <div className="mr-auto flex items-baseline gap-2.5">
            <h1 className="text-[30px] leading-[1.1]">내 기업</h1>
            {ready && <span className="font-heading text-xl text-brand-700">{total}개</span>}
          </div>
          {!emptyAll && (
            <Link href="/companies/new" className="btn btn-primary justify-center px-[18px]">
              <PlusIcon size={15} strokeWidth={1.8} />새 기업 등록
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-[30px] px-4 pt-[22px] pb-10 sm:px-[30px]">
        {companiesError ? (
          <ListError title="내 기업 목록을 불러오지 못했습니다" onRetry={retry} />
        ) : companies === null ? (
          <ListSkeleton />
        ) : emptyAll ? (
          <div className="blueprint flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
            <div className="mb-1 grid size-16 place-items-center rounded-xl border border-brand-300 bg-white">
              <OfficeIcon size={30} className="text-brand-500" />
            </div>
            <p className="font-heading text-2xl">아직 등록한 기업이 없습니다</p>
            <p className="max-w-[400px] text-sm leading-[1.65] text-muted">
              사업자등록번호를 인증하고 기업 정보를 등록하면, 이곳에서 공개 상태와 인증을 관리할 수 있습니다.
            </p>
            <Link href="/companies/new" className="btn btn-primary mt-1.5 px-[22px]">
              기업 등록하기
            </Link>
          </div>
        ) : (
          <>
            {draftList.length > 0 && (
              <section className="flex flex-col gap-2.5" aria-labelledby="drafts-title">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 id="drafts-title" className="text-[19px]">
                    작성 중인 등록 <span className="text-brand-700">{draftList.length}건</span>
                  </h2>
                  <span className="text-xs text-faint">아직 등록되지 않아 공개되지 않습니다</span>
                </div>
                {draftList.map((draft) => (
                  <DraftRow
                    key={draft.businessNumber}
                    draft={draft}
                    now={now}
                    onDelete={() => setConfirm({ kind: "draft", draft })}
                  />
                ))}
              </section>
            )}
            {draftsError && (
              <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                작성 중인 등록을 불러오지 못했습니다.
                <button type="button" className="elink" onClick={() => setDraftsReload((n) => n + 1)}>
                  다시 시도
                </button>
              </p>
            )}

            <section className="flex flex-col gap-2.5" aria-labelledby="companies-title">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 id="companies-title" className="text-[19px]">
                  등록한 기업
                </h2>
                <span className="text-xs text-faint">최신 등록순</span>
              </div>
              {total === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-[18px] py-[22px] text-sm leading-[1.6] text-muted">
                  아직 등록을 마친 기업이 없습니다. 위의 작성 중인 등록을 이어서 마치면 이곳에 나타납니다.
                </p>
              ) : (
                <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {companies.content.map((company) => (
                    <OwnerCompanyCard
                      key={company.id}
                      company={company}
                      now={now}
                      busy={busy[company.id] ?? null}
                      onToggleVisibility={() =>
                        company.visibility === "PRIVATE"
                          ? applyVisibility(company, "PUBLIC")
                          : setConfirm({ kind: "private", company })
                      }
                      onDelete={() => setConfirm({ kind: "delete", company })}
                    />
                  ))}
                </div>
              )}
              <Pagination page={page} totalPage={companies.pageInfo.totalPage} onChange={goPage} />
            </section>
          </>
        )}
      </div>

      {confirm && (
        <ConfirmDialog text={confirmText(confirm)} onCancel={() => setConfirm(null)} onConfirm={onConfirm} />
      )}

      <ToastView toast={toast} />
    </div>
  );
}

/** 작성 중인 등록 한 줄. 기업 카드와 다른 모양(점선 테두리 + "등록 전")으로 아직 발행 전임을 드러낸다. */
function DraftRow({ draft, now, onDelete }: { draft: CompanyDraftSummary; now: number; onDelete: () => void }) {
  return (
    <div className="drow">
      <div className="grid size-10 flex-none place-items-center rounded-lg border border-dashed border-brand-400 bg-white text-brand-500">
        <DraftIcon size={18} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-heading text-[17px] ${draft.companyName ? "text-ink" : "text-faint"}`}>
            {draft.companyName ?? "이름 미입력"}
          </span>
          <span className="tag border-dashed border-brand-400 bg-white text-brand-700">등록 전</span>
        </div>
        <div className="flex flex-wrap gap-3 text-[13px] text-muted">
          <span className="whitespace-nowrap">
            사업자등록번호{" "}
            <span className="font-heading text-sm tracking-[0.03em] text-ink">
              {formatBusinessNumber(draft.businessNumber)}
            </span>
          </span>
          <span className="whitespace-nowrap">{relativeTime(draft.updatedAt, now)} 저장</span>
        </div>
      </div>
      <div className="dacts flex items-center gap-1.5">
        {/* 등록 화면이 이 번호로 초안과 이어 쓸 인증을 되찾는다(VerifyStep). */}
        <Link href={`/companies/new?resume=${draft.businessNumber}`} className="btn btn-outline">
          이어서 작성
        </Link>
        <button type="button" className="icbtn" aria-label="작성 중인 내용 삭제" onClick={onDelete}>
          <TrashIcon size={15} />
        </button>
      </div>
    </div>
  );
}

function confirmText(confirm: Confirm): ConfirmText {
  return confirm.kind === "private"
    ? {
        title: "비공개로 전환할까요?",
        body: `‘${confirm.company.companyName}’이(가) 검색·메인·즐겨찾기 목록에서 사라집니다. 언제든 다시 공개할 수 있습니다.`,
        ok: "비공개로 전환",
        danger: false,
      }
    : confirm.kind === "delete"
      ? {
          title: `‘${confirm.company.companyName}’을(를) 삭제할까요?`,
          body: "삭제하면 목록에서 사라지고, 되살리려면 관리자에게 문의해야 합니다.",
          ok: "삭제",
          danger: true,
        }
      : {
          title: "작성 중인 내용을 삭제할까요?",
          body: `${confirm.draft.companyName ? `‘${confirm.draft.companyName}’` : "이름 미입력"} (${formatBusinessNumber(
            confirm.draft.businessNumber,
          )}) 초안을 삭제합니다. 삭제하면 되돌릴 수 없습니다.`,
          ok: "삭제",
          danger: true,
        };
}
