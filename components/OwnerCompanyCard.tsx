"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import CoverCard from "@/components/CoverCard";
import DetailLink from "@/components/DetailLink";
import {
  EyeOffIcon,
  MoreIcon,
  PencilIcon,
  ShieldCheckIcon,
  ShieldIcon,
  SpinnerIcon,
  StarIcon,
} from "@/components/icons";
import { formatDate, relativeTime } from "@/lib/register";
import type { CompanySummary } from "@/types/api";

type Props = {
  company: CompanySummary;
  /** 상대 시각("3주 전 수정")의 기준. 목록이 한 번 정해 모든 카드에 같은 값을 준다 */
  now: number;
  /** 처리 중이면 그 동작 이름("비공개로 전환하는 중"). 카드 전체를 덮고 조작을 막는다 */
  busy: string | null;
  onToggleVisibility: () => void;
  onDelete: () => void;
};

/**
 * 내 기업 목록의 카드. 몸통은 메인 "추천 기업" 카드와 같은 CoverCard 이고, 자리만 소유자용으로 바꿔 끼운다.
 *  - 커버 위: 비공개 표시 + 운영 큐레이션 배지 / 오른쪽 "⋯" 메뉴(좋아요·즐겨찾기 대신)
 *  - 주소 뒤: 등록일 · 최근 수정
 *  - 아랫단: 공개 상태 · 국세청 인증 · 수정
 *
 * 카드를 눌러도 이동하지 않는다. 가야 할 곳은 소유자 상세 화면인데 아직 없다 — 생기면 CoverCard 의 덮개 링크를
 * 그쪽 주소로 연다. 공개 상세로 보내지 않는 이유: 비공개 회사는 공개 상세가 404 다.
 *
 * "국세청 인증하기"(미인증 회사)는 디자인에 있지만 그리지 않는다. 서버의 재인증은 이미 인증된 회사의
 * 대표자·개업일자를 바꾸는 길이라 미인증 회사는 거절한다(COMPANY_NOT_BUSINESS_VERIFIED) — 처음 인증하는 길이 생기면 붙인다.
 */
export default function OwnerCompanyCard({ company, now, busy, onToggleVisibility, onDelete }: Props) {
  const isPublic = company.visibility !== "PRIVATE";
  const curation = [
    company.verified && "에디터 선정",
    company.featured && "추천 노출",
    company.spotlight && "스팟라이트 고정",
  ].filter((label): label is string => !!label);

  return (
    <CoverCard
      company={company}
      linked={false}
      verifiedMark={false}
      fixedRows
      className={isPublic ? "" : "own-priv"}
      badges={
        (!isPublic || curation.length > 0) && (
          <>
            {!isPublic && (
              <span className="inline-flex items-center gap-[5px] rounded-md bg-ink px-[9px] py-[3px] text-xs font-medium whitespace-nowrap text-white">
                <EyeOffIcon size={13} />
                비공개
              </span>
            )}
            {curation.map((label) => (
              <span key={label} className="cur">
                <StarIcon size={11} />
                {label}
              </span>
            ))}
          </>
        )
      }
      actions={
        <CardMenu
          company={company}
          isPublic={isPublic}
          disabled={busy !== null}
          onToggleVisibility={onToggleVisibility}
          onDelete={onDelete}
        />
      }
      meta={
        company.createdAt && (
          <span className="shrink-0 whitespace-nowrap">
            등록 {formatDate(company.createdAt)}
            {company.updatedAt && ` · ${relativeTime(company.updatedAt, now)} 수정`}
          </span>
        )
      }
      emptyChips={<span className="text-xs text-faint">카테고리 · 태그 미입력</span>}
      footer={
        <div className="mt-auto flex min-h-9 flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-line-soft px-4 py-[11px] text-[13px]">
          {isPublic ? (
            <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-ink">
              <span aria-hidden className="size-[7px] rounded-full bg-brand" />
              공개 중
            </span>
          ) : (
            <span className="text-xs whitespace-nowrap text-muted">검색·메인에 나오지 않습니다</span>
          )}
          {company.businessVerified ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-brand-700">
              <ShieldCheckIcon size={14} />
              국세청 인증
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-muted">
              <ShieldIcon size={14} />
              국세청 미인증
            </span>
          )}
          <Link
            href={`/companies/${company.id}/edit`}
            className="btn btn-outline ml-auto hidden px-3 py-[5px] text-[13px] sm:inline-flex"
          >
            <PencilIcon size={13} />
            수정
          </Link>
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

/** 커버 오른쪽 위 "⋯". 자주 쓰는 "수정"만 아랫단에 꺼내 두고 나머지는 여기 모은다(좁은 화면에서는 수정도 여기로). */
function CardMenu({
  company,
  isPublic,
  disabled,
  onToggleVisibility,
  onDelete,
}: {
  company: CompanySummary;
  isPublic: boolean;
  disabled: boolean;
  onToggleVisibility: () => void;
  onDelete: () => void;
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
          <Link role="menuitem" href={`/companies/${company.id}/edit`} className="omi sm:hidden">
            수정
          </Link>
          {isPublic ? (
            <DetailLink companyId={company.id} className="omi">
              공개 페이지 보기
              <span className="h">↗</span>
            </DetailLink>
          ) : (
            <span role="menuitem" aria-disabled className="omi dis">
              공개 페이지 보기<span className="h">비공개 상태</span>
            </span>
          )}
          <button type="button" role="menuitem" className="omi" onClick={() => run(onToggleVisibility)}>
            {isPublic ? "비공개로 전환" : "공개로 전환"}
          </button>
          <button type="button" role="menuitem" className="omi danger sep" onClick={() => run(onDelete)}>
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
