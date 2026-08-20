"use client";

import CardSlot from "@/components/CardSlot";
import Cover from "@/components/Cover";
import DetailLink from "@/components/DetailLink";
import LikeFavorite from "@/components/LikeFavorite";
import Logo from "@/components/Logo";
import TagRow from "@/components/TagRow";
import { PinIcon, VerifiedIcon } from "@/components/icons";
import type { CompanySummary } from "@/types/api";

type Props = {
  company: CompanySummary;
  onError: (message: string) => void;
};

/**
 * "추천 기업" 레일의 카드. 위쪽 커버 위로 로고가 반쯤 걸쳐 내려온다.
 *
 * 커버는 스포트라이트와 같은 이미지(coverImageUrl)를 훨씬 납작한 비율로 자른 것이다.
 * 없는 회사는 디자인의 사선 해칭으로 떨어진다.
 */
export default function FeaturedCard({ company, onError }: Props) {
  return (
    <CardSlot>
      <article className="pcard blueprint flex flex-col">
        {/* 로고가 커버 밖으로 나와야 해서 커버는 overflow 를 자르지 않는다. */}
        <div className="relative h-[150px] border-b border-line">
          <Cover
            url={company.coverImageUrl}
            placeholderClassName="hatch"
            className="absolute inset-0 size-full rounded-t-[11px]"
          />
          <span className="tag absolute top-3 left-3 bg-brand font-medium text-white">
            FEATURED
          </span>
          {/*
            z 를 주는 이유: 아래 회사명 링크가 카드 전체를 덮고 있고, 그 덮개는 DOM 에서
            이 버튼들보다 뒤에 온다. z 가 없으면 덮개가 위에 깔려 좋아요를 눌러도 상세로 넘어간다.
          */}
          <div className="absolute top-2.5 right-2.5 z-[2] flex gap-1.5">
            <LikeFavorite
              company={company}
              onError={onError}
              buttonClassName="bg-white/90"
            />
          </div>
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
                {/* 카드 전체가 클릭 대상이다 — 덮개 방식의 이유는 CompanyCard 주석 참고. */}
                <DetailLink
                  companyId={company.id}
                  className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:text-brand"
                >
                  {company.companyName}
                </DetailLink>
              </h3>
              {company.verified && (
                <span
                  title="플랜틀리 검수 완료"
                  className="shrink-0 text-brand"
                >
                  <VerifiedIcon size={15} />
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-[13px] leading-[1.45] text-muted">
              {company.introTitle ?? "소개 문구가 아직 없습니다."}
            </p>
          </div>
          <div className="flex items-center gap-[5px] text-xs text-muted">
            <PinIcon size={13} />
            <span className="truncate">{company.address ?? "주소 미등록"}</span>
          </div>
          <TagRow company={company} />
        </div>
      </article>
    </CardSlot>
  );
}
