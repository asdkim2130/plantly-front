"use client";

import CardSlot from "@/components/CardSlot";
import LikeFavorite from "@/components/LikeFavorite";
import Logo from "@/components/Logo";
import TagRow from "@/components/TagRow";
import { FactoryIcon, PinIcon, VerifiedIcon } from "@/components/icons";
import type { CompanySummary } from "@/types/api";

type Props = {
  company: CompanySummary;
  onError: (message: string) => void;
};

/** "전체 기업" 격자의 카드. 사진 없이 로고 + 텍스트만 쓰는 밀도 높은 형태다. */
export default function CompanyCard({ company, onError }: Props) {
  const industry = company.industryNames[0];

  return (
    <CardSlot>
      <article className="pcard blueprint flex flex-col gap-3 px-[18px] pt-[18px] pb-4">
        <div className="flex items-start gap-[13px]">
          <Logo
            url={company.logoUrl}
            name={company.companyName}
            className="size-[52px] border border-line"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[18px] leading-tight">{company.companyName}</h3>
              {/* verified = 에디터 선정 큐레이션. 사업자 확인(businessVerified)과는 다른 축이다. */}
              {company.verified && (
                <span title="플랜틀리 검수 완료" className="shrink-0 text-brand">
                  <VerifiedIcon size={14} />
                </span>
              )}
            </div>
            <p className="mt-[3px] line-clamp-2 text-[12.5px] leading-[1.45] text-muted">
              {company.introTitle ?? "소개 문구가 아직 없습니다."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-[5px] gap-y-1 text-xs text-muted">
          {industry && (
            <span className="ind">
              <FactoryIcon size={12} />
              {industry}
            </span>
          )}
          <span className="inline-flex items-center gap-[5px]">
            <PinIcon size={13} />
            {company.address ?? "주소 미등록"}
          </span>
        </div>
        <TagRow company={company} />
        <div className="mt-auto flex items-center justify-between border-t border-line-soft pt-[11px]">
          {/*
          상세 화면이 아직 없어 비워 두는 자리. 분류 '이름'은 위 TagRow 가 칩으로 그리므로
          여기서는 개수만 적는다 — 같은 값을 한 카드에 두 번 찍지 않기 위해서다.
          상세가 붙으면 "기업 상세 →" 링크로 바꾼다.
        */}
          <span className="font-heading text-[11px] tracking-[0.08em] text-faint uppercase">
            {company.categoryNames.length > 0 ? `분류 ${company.categoryNames.length}개` : "미분류"}
          </span>
          <div className="flex gap-1.5">
            <LikeFavorite company={company} onError={onError} />
          </div>
        </div>
      </article>
    </CardSlot>
  );
}
