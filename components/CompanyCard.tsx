"use client";

import CardSlot from "@/components/CardSlot";
import DetailLink from "@/components/DetailLink";
import LikeFavorite from "@/components/LikeFavorite";
import Logo from "@/components/Logo";
import TagRow from "@/components/TagRow";
import { FactoryIcon, PinIcon, VerifiedIcon } from "@/components/icons";
import type { CompanySummary } from "@/types/api";

type Props = {
  company: CompanySummary;
  onError: (message: string, needsLogin: boolean) => void;
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
            className="size-[52px] rounded-lg border border-line"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="min-w-0 truncate text-[18px] leading-tight">
                {/*
                  카드 전체가 상세로 가는 클릭 대상이다. 카드를 통째로 <Link> 로 감싸는 대신
                  회사명 링크를 카드 크기만큼 늘린다(::after 로 카드를 덮는다) — 이유가 둘이다.
                   1. 좋아요·즐겨찾기가 <button> 이라, 링크로 감싸면 링크 안에 버튼이 들어간다(중첩 금지).
                   2. 스크린리더의 링크 목록에 "회사명"으로 잡힌다. 카드를 감싸면 카드 안 글자가
                      전부 링크 이름이 되어 읽어 주기 어려워진다.
                  덮개의 기준은 .blueprint 의 position:relative 다.
                */}
                <DetailLink
                  companyId={company.id}
                  className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:text-brand"
                >
                  {company.companyName}
                </DetailLink>
              </h3>
              {/* verified = 에디터 선정 큐레이션. 사업자 확인(businessVerified)과는 다른 축이다. */}
              {company.verified && (
                <span title="플랜틀리 검수 완료" className="shrink-0 text-brand">
                  <VerifiedIcon size={14} />
                </span>
              )}
            </div>
            {/* 한 줄짜리 소개도 두 줄 자리를 차지하게 둔다 — 카드마다 아랫단이 어긋나지 않게. */}
            <p className="mt-[3px] line-clamp-2 min-h-[2lh] text-[13px] leading-[1.45] text-muted">
              {company.introTitle ?? "소개 문구가 아직 없습니다."}
            </p>
          </div>
        </div>
        {/*
          업종 라벨 + 주소는 무슨 일이 있어도 한 줄이다. 줄바꿈을 허용하면 주소가 긴 회사만
          카드가 한 줄 만큼 길어져 격자에서 아랫단이 들쭉날쭉해진다 — 넘치면 말줄임으로 자른다.
        */}
        <div className="flex items-center gap-x-[5px] text-xs text-muted">
          {industry && (
            <span className="ind max-w-[45%] shrink-0">
              <FactoryIcon size={12} className="shrink-0" />
              <span className="truncate">{industry}</span>
            </span>
          )}
          <span className="inline-flex min-w-0 items-center gap-[5px]">
            <PinIcon size={13} className="shrink-0" />
            <span className="truncate">{company.address ?? "주소 미등록"}</span>
          </span>
        </div>
        {/* 칩이 한 줄뿐이거나 아예 없는 회사(C20)도 두 줄 자리는 그대로 비워 둔다. */}
        <div className="tagrow">
          <TagRow company={company} />
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-line-soft pt-[11px]">
          {/*
            "여기를 누르면 된다"를 보여주는 표시일 뿐, 링크가 아니다 — 카드 전체가 이미 링크라
            여기에 <a> 를 또 두면 스크린리더의 링크 목록에 같은 목적지가 "기업 상세"라는
            쓸모없는 이름으로 한 번 더 들어간다. 클릭은 위의 덮개가 받는다.
          */}
          <span
            aria-hidden
            className="font-heading text-[11px] tracking-[0.08em] text-faint uppercase"
          >
            기업 상세 →
          </span>
          {/* 덮개보다 위로 올린다. 안 그러면 좋아요·즐겨찾기를 눌러도 상세로 넘어간다. */}
          <div className="relative z-[1] flex gap-1.5">
            <LikeFavorite company={company} onError={onError} />
          </div>
        </div>
      </article>
    </CardSlot>
  );
}
