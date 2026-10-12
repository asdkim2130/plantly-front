"use client";

import CardSlot from "@/components/CardSlot";
import Cover from "@/components/Cover";
import DetailLink from "@/components/DetailLink";
import Logo from "@/components/Logo";
import TagRow from "@/components/TagRow";
import { PinIcon, VerifiedIcon } from "@/components/icons";
import type { CompanySummary } from "@/types/api";

type Props = {
  company: CompanySummary;
  /**
   * 회사명을 카드 전체를 덮는 상세 링크로 만든다. 끄면 회사명은 글자일 뿐이고 카드를 눌러도 어디로도 가지 않는다
   * (내 기업 목록 — 소유자 상세 화면이 생기면 그쪽 링크로 바꾼다).
   */
  linked?: boolean;
  /** 커버 왼쪽 위 배지 줄 */
  badges?: React.ReactNode;
  /** 커버 오른쪽 위 버튼 자리. 덮개 링크보다 위로 올라가 있다 */
  actions?: React.ReactNode;
  /** 회사명 옆 검수 마크(verified). 배지 줄에 같은 뜻을 이미 그리는 카드는 끈다 */
  verifiedMark?: boolean;
  /** 주소 줄 뒤에 이어 붙는 한 줄 정보 */
  meta?: React.ReactNode;
  /**
   * 소개·칩 줄의 자리를 늘 두 줄씩 잡는다. 격자에 나란히 놓여 카드 아랫단(footer)이 맞아야 하는 화면에서 켠다.
   * 레일은 카드마다 높이가 달라도 되므로 끈 채로 둔다.
   */
  fixedRows?: boolean;
  /** 칩이 하나도 없을 때 대신 보일 글 */
  emptyChips?: React.ReactNode;
  footer?: React.ReactNode;
  /** article 에 덧붙일 클래스(상태별 모양: 비공개 등) */
  className?: string;
  /** 카드 전체를 덮는 막(처리 중 표시 등) */
  overlay?: React.ReactNode;
};

/**
 * 커버 띠 + 걸쳐 내려오는 로고 + 이름·소개·지역·칩으로 된 카드 틀. 메인 "추천 기업" 카드(FeaturedCard)의 몸통이다.
 *
 * 내 기업 목록의 카드가 같은 디자인이라 몸통을 여기로 꺼냈다. 두 카드가 다른 것은 자리(slot)뿐이다 —
 * 커버 위 배지·버튼, 주소 뒤 정보, 아랫단. 몸통의 치수와 칩 접기를 한 곳에서 고치면 두 화면이 같이 바뀐다.
 */
export default function CoverCard({
  company,
  linked = true,
  badges,
  actions,
  verifiedMark = true,
  meta,
  fixedRows = false,
  emptyChips,
  footer,
  className = "",
  overlay,
}: Props) {
  const hasChips = company.categoryNames.length + company.tagNames.length > 0;

  return (
    <CardSlot>
      <article className={`pcard blueprint flex flex-col ${className}`}>
        {/* 로고가 커버 밖으로 나와야 해서 커버는 overflow 를 자르지 않는다. */}
        <div className="relative h-[150px] border-b border-line">
          <Cover
            url={company.coverImageUrl}
            placeholderClassName="hatch"
            className="cover absolute inset-0 size-full rounded-t-[11px]"
          />
          {badges && (
            <div className="absolute top-3 right-14 left-3 flex flex-wrap gap-[5px]">{badges}</div>
          )}
          {/*
            z 를 주는 이유: 아래 회사명 링크가 카드 전체를 덮고 있고, 그 덮개는 DOM 에서
            이 버튼들보다 뒤에 온다. z 가 없으면 덮개가 위에 깔려 버튼을 눌러도 상세로 넘어간다.
          */}
          {actions && <div className="absolute top-2.5 right-2.5 z-[6] flex gap-1.5">{actions}</div>}
          <Logo
            url={company.logoUrl}
            name={company.companyName}
            className="absolute bottom-[-24px] left-4 z-[3] size-[54px] rounded-lg border border-line shadow-[0_1px_6px_rgba(11,33,72,.12)]"
          />
        </div>
        <div className="flex flex-col gap-2.5 px-4 pt-[34px] pb-4">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="min-w-0 truncate text-[19px] leading-tight">
                {linked ? (
                  /* 카드 전체가 클릭 대상이다 — 덮개 방식의 이유는 CompanyCard 주석 참고. */
                  <DetailLink
                    companyId={company.id}
                    className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:text-brand"
                  >
                    {company.companyName}
                  </DetailLink>
                ) : (
                  company.companyName
                )}
              </h3>
              {verifiedMark && company.verified && (
                <span title="플랜틀리 검수 완료" className="shrink-0 text-brand">
                  <VerifiedIcon size={15} />
                </span>
              )}
            </div>
            <p
              className={`mt-1 line-clamp-2 text-[13px] leading-[1.45] text-muted ${fixedRows ? "min-h-[2lh]" : ""}`}
            >
              {company.introTitle ?? "소개 문구가 아직 없습니다."}
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-x-2.5 text-xs text-muted">
            <span className="inline-flex min-w-0 items-center gap-[5px]">
              <PinIcon size={13} className="shrink-0" />
              <span className="truncate">{company.address ?? "주소 미등록"}</span>
            </span>
            {meta}
          </div>
          {fixedRows ? (
            <div className="tagrow">
              {hasChips ? <TagRow company={company} /> : emptyChips}
            </div>
          ) : hasChips ? (
            <TagRow company={company} />
          ) : (
            emptyChips
          )}
        </div>
        {footer}
        {overlay}
      </article>
    </CardSlot>
  );
}
