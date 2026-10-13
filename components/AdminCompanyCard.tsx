"use client";

import { useEffect, useRef, useState } from "react";
import CoverCard from "@/components/CoverCard";
import DetailLink from "@/components/DetailLink";
import { EyeOffIcon, MoreIcon, ShieldCheckIcon, ShieldIcon, SpinnerIcon, StarIcon, TrashIcon } from "@/components/icons";
import { formatDate, relativeTime } from "@/lib/register";
import type { AdminCompanySummary } from "@/types/api";

export type AdminFlag = "featured" | "spotlight";

type Props = {
  company: AdminCompanySummary;
  /** 상대 시각("3주 전 수정")의 기준. 목록이 한 번 정해 모든 카드에 같은 값을 준다 */
  now: number;
  /** 메뉴 동작(공개 전환·삭제·복구) 처리 중이면 그 이름. 카드 전체를 덮고 조작을 막는다 */
  busy: string | null;
  /** 지금 서버에 보내는 중인 스위치. 그 스위치만 잠근다 */
  pendingFlag: AdminFlag | null;
  onToggleFlag: (flag: AdminFlag) => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onRestore: () => void;
};

/**
 * 관리자 기업 목록의 카드. 몸통은 내 기업 카드와 같은 CoverCard 이고(디자인 "플랜틀리 내 기업 목록"), 자리만 관리자용으로 바꾼다.
 *  - 커버 위: 삭제됨 · 비공개 · 에디터 선정 · 등급 / 오른쪽 "⋯" 메뉴(공개 페이지 · 공개 전환 · 삭제 또는 복구)
 *  - 주소 뒤: 등록일 · 최근 수정
 *  - 아랫단: **추천 노출 · 스팟라이트 고정 스위치**(클라이언트 요구 — 목록에서 바로 켜고 끈다) + 국세청 인증 · 등록 출처
 *
 * 카드를 누르면 관리자 상세(`/admin/companies/{id}`)로 간다. 소유자 상세(`/manage`)는 멤버만 열려 관리자에게 403 이다.
 * "수정" 은 두지 않았다 — 소유자 수정 화면도 소유자 API 를 써서 관리자에게 403 이고, 관리자 수정 화면은 아직 없다.
 *
 * 두 스위치는 뜻이 다르다. 추천은 순수 관리자 큐레이션이라 끄면 추천 레일에서 바로 빠진다. 스팟라이트는 **수동 고정**이라
 * 유료 활성 구독(PREMIUM·ENTERPRISE)은 꺼져 있어도 요금제로 레일에 오른다 — 그 경우 스위치 옆에 "요금제로 노출"을 붙여
 * 꺼도 안 사라지는 이유를 보여준다(판정 규칙은 백엔드 ShowcaseCardRepository 의 SPOTLIGHT_SQL 과 같게 맞춘 표시용 사본이다).
 */
export default function AdminCompanyCard({
  company,
  now,
  busy,
  pendingFlag,
  onToggleFlag,
  onToggleVisibility,
  onDelete,
  onRestore,
}: Props) {
  const isPublic = company.visibility !== "PRIVATE";
  // 요금제 스팟라이트 자격. effectiveGrade 가 이미 만료를 반영하므로 만료일은 다시 보지 않는다.
  const paidSpotlight =
    company.status === "ACTIVE" &&
    (company.effectiveGrade === "PREMIUM" || company.effectiveGrade === "ENTERPRISE");
  const gradeNote =
    company.status === "TRIAL" ? " 체험" : company.status === "ADMIN_EXEMPT" ? " 면제" : "";

  return (
    <CoverCard
      company={company}
      href={`/admin/companies/${company.id}`}
      verifiedMark={false}
      fixedRows
      className={isPublic && !company.deleted ? "" : "own-priv"}
      badges={
        <>
          {company.deleted && (
            <span className="inline-flex items-center gap-[5px] rounded-md bg-danger px-[9px] py-[3px] text-xs font-medium whitespace-nowrap text-white">
              <TrashIcon size={12} />
              삭제됨
            </span>
          )}
          {!isPublic && (
            <span className="inline-flex items-center gap-[5px] rounded-md bg-ink px-[9px] py-[3px] text-xs font-medium whitespace-nowrap text-white">
              <EyeOffIcon size={13} />
              비공개
            </span>
          )}
          {company.verified && (
            <span className="cur">
              <StarIcon size={11} />
              에디터 선정
            </span>
          )}
          {company.effectiveGrade && (
            <span className="rounded-md bg-white/95 px-2 py-[3px] font-heading text-xs tracking-[0.06em] whitespace-nowrap text-brand-800">
              {company.effectiveGrade}
              {gradeNote}
            </span>
          )}
        </>
      }
      actions={
        <CardMenu
          company={company}
          isPublic={isPublic}
          disabled={busy !== null}
          onToggleVisibility={onToggleVisibility}
          onDelete={onDelete}
          onRestore={onRestore}
        />
      }
      meta={
        <span className="shrink-0 whitespace-nowrap">
          등록 {formatDate(company.createdAt)} · {relativeTime(company.updatedAt, now)} 수정
        </span>
      }
      emptyChips={<span className="text-xs text-faint">카테고리 · 태그 미입력</span>}
      footer={
        <div className="mt-auto flex flex-col gap-2 border-t border-line-soft px-4 py-[11px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <FlagSwitch
              label="추천 노출"
              on={company.featured}
              pending={pendingFlag === "featured"}
              disabled={company.deleted || busy !== null}
              onToggle={() => onToggleFlag("featured")}
            />
            <FlagSwitch
              label="스팟라이트 고정"
              on={company.spotlight}
              pending={pendingFlag === "spotlight"}
              disabled={company.deleted || busy !== null}
              onToggle={() => onToggleFlag("spotlight")}
            />
            {paidSpotlight && !company.spotlight && (
              <span
                className="text-xs whitespace-nowrap text-brand-700"
                title="유료 활성 구독(PREMIUM·ENTERPRISE)은 고정하지 않아도 스팟라이트 후보에 오릅니다"
              >
                요금제로 노출
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {company.businessVerified ? (
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-brand-700">
                <ShieldCheckIcon size={13} />
                국세청 인증
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <ShieldIcon size={13} />
                국세청 미인증
              </span>
            )}
            <span className="whitespace-nowrap">
              {company.registrationSource === "ADMIN" ? "관리자 등록" : "회원 등록"}
              {company.ownerUserId === null && " · 소유자 미연동"}
            </span>
          </div>
        </div>
      }
      overlay={
        busy && (
          <div className="absolute inset-0 z-[7] flex cursor-progress items-center justify-center gap-2.5 rounded-xl bg-white/80">
            <SpinnerIcon size={20} className="animate-spin text-brand" />
            <span className="text-[13px] text-brand-800">{busy}</span>
          </div>
        )
      }
    />
  );
}

/** 켬/끔 스위치 한 개. 누르면 바로 서버에 보낸다(확인 창 없음 — 다시 누르면 되돌아가는 가벼운 동작이다). */
function FlagSwitch({
  label,
  on,
  pending,
  disabled,
  onToggle,
}: {
  label: string;
  on: boolean;
  pending: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="swt"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      onClick={onToggle}
    >
      <span aria-hidden className="trk" />
      {label}
      {pending && <SpinnerIcon size={13} className="animate-spin text-brand" />}
    </button>
  );
}

/** 커버 오른쪽 위 "⋯". 내 기업 카드의 메뉴와 같은 모양이고, 삭제된 회사에서는 "삭제" 대신 "복구"가 나온다. */
function CardMenu({
  company,
  isPublic,
  disabled,
  onToggleVisibility,
  onDelete,
  onRestore,
}: {
  company: AdminCompanySummary;
  isPublic: boolean;
  disabled: boolean;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // 바깥을 누르거나 Esc 를 누르면 닫는다. 열려 있을 때만 듣는다.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  // 공개 페이지는 공개 상태이고 삭제되지 않았을 때만 있다(둘 중 하나라도 아니면 공개 상세가 404).
  const hasPublicPage = isPublic && !company.deleted;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        className={`icbtn bg-white/95 ${open ? "on" : ""}`}
        aria-label={`${company.companyName} 더 보기`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreIcon size={16} />
      </button>
      {open && (
        <div role="menu" className="omenu">
          {hasPublicPage ? (
            <DetailLink companyId={company.id} className="omi">
              공개 페이지 보기
              <span className="h">↗</span>
            </DetailLink>
          ) : (
            <span role="menuitem" aria-disabled className="omi dis">
              공개 페이지 보기<span className="h">{company.deleted ? "삭제됨" : "비공개 상태"}</span>
            </span>
          )}
          {company.deleted ? (
            <button type="button" role="menuitem" className="omi sep" onClick={() => run(onRestore)}>
              복구
            </button>
          ) : (
            <>
              <button type="button" role="menuitem" className="omi" onClick={() => run(onToggleVisibility)}>
                {isPublic ? "비공개로 전환" : "공개로 전환"}
              </button>
              <button type="button" role="menuitem" className="omi danger sep" onClick={() => run(onDelete)}>
                삭제
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
