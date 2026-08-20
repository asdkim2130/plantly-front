"use client";

import Cover from "@/components/Cover";
import DetailLink from "@/components/DetailLink";
import LikeFavorite from "@/components/LikeFavorite";
import Logo from "@/components/Logo";
import TagRow from "@/components/TagRow";
import { FactoryIcon, PinIcon, VerifiedIcon } from "@/components/icons";
import { prefersDarkText } from "@/lib/color";
import type { CompanySummary } from "@/types/api";
import type { CSSProperties } from "react";

type Props = {
  company: CompanySummary;
  /** "Spotlight · 2026.08 W1" 처럼 카드 위에 찍히는 회차 표시 */
  kicker: string;
  onError: (message: string) => void;
};

/**
 * "스포트라이트" 레일의 와이드 카드. 레일 폭을 통째로 쓴다.
 * 태그는 접지 않고 전부 펼쳐 보여준다(디자인의 의도 — 이 카드만 예외).
 *
 * 배경은 회사가 지정한 brandColor 다(없으면 디자인 기본 남색). 색이 임의라서 카드 안 색은
 * 전부 전경색 변수 --sl-fg 에서 파생시킨다 — 색 정의는 globals.css 의 `.spotlight` 블록에 있고,
 * 여기서는 배경값 한 개와 "글자를 뒤집을지"(data-tone) 만 넘긴다.
 *
 * 높이는 태그 네 줄까지 담기게 잡아 뒀다. 태그 한 줄이 24.5px + 줄간격 5px 라
 * 두 줄짜리 카드(265px)에 두 줄을 더할 자리를 준 값이 324px 다.
 * 그보다 태그가 많으면 카드가 알아서 더 길어진다.
 */
export default function SpotlightCard({ company, kicker, onError }: Props) {
  const industry = company.industryNames[0];

  return (
    <article
      className="pcard blueprint spotlight flex min-h-[324px] items-stretch"
      // 회사 색은 런타임 데이터라 토큰으로 만들 수 없는 유일한 값이다. 없으면 CSS 기본값(남색)이 남는다.
      style={company.brandColor ? ({ "--sl-bg": company.brandColor } as CSSProperties) : undefined}
      data-tone={prefersDarkText(company.brandColor) ? "light" : "dark"}
    >
      <Cover
        url={company.coverImageUrl}
        placeholderClassName="hatch-tint"
        className="hidden w-[340px] shrink-0 self-stretch rounded-l-[11px] sm:block"
      />
      <div className="flex flex-1 flex-col gap-[9px] px-6 py-[18px]">
        <div className="flex items-center gap-[9px]">
          <span className="sl-kicker font-heading text-[10px] tracking-[0.14em] uppercase">
            {kicker}
          </span>
          <span className="sl-rule h-px flex-1" />
        </div>
        <div className="flex items-center gap-3.5">
          <Logo
            url={company.logoUrl}
            name={company.companyName}
            className="size-[46px] rounded-lg"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-[7px]">
              <h3 className="min-w-0 truncate text-[25px] leading-[1.15]">
                {/*
                  이 카드에는 "기업 상세 보기" 버튼이 따로 있지만, 카드 본문을 눌렀을 때도 같은 곳으로
                  가는 게 맞다 — 덮개 방식의 이유는 CompanyCard 주석 참고.
                  (레일은 드래그 스크롤이 아니라 화살표·점·휠로 넘기므로 덮개가 드래그를 가로채지 않는다.)
                */}
                <DetailLink
                  companyId={company.id}
                  className="text-inherit no-underline after:absolute after:inset-0 after:content-['']"
                >
                  {company.companyName}
                </DetailLink>
              </h3>
              {company.verified && (
                <span title="플랜틀리 검수 완료" className="sl-kicker shrink-0">
                  <VerifiedIcon size={16} />
                </span>
              )}
            </div>
            <div className="mt-[5px] flex flex-wrap items-center gap-x-[9px] gap-y-1">
              {industry && (
                <span className="sl-label font-heading inline-flex items-center gap-[5px] rounded border px-2 py-0.5 text-xs tracking-[0.1em]">
                  <FactoryIcon size={12} />
                  {industry}
                </span>
              )}
              <span className="sl-meta inline-flex items-center gap-1 text-[13px]">
                <PinIcon size={13} />
                {company.address ?? "주소 미등록"}
              </span>
            </div>
          </div>
        </div>
        <p className="sl-body text-sm leading-[1.45]">
          {company.introTitle ?? "소개 문구가 아직 없습니다."}
        </p>
        {/*
          스포트라이트 레일은 트랙이 세로도 잘라서 접힌 칩의 펼침 패널이 보이지 않는다.
          그래서 이 카드만 접지 않고 카테고리·태그를 전부 펼쳐 둔다(디자인 의도와도 맞는다).
        */}
        <TagRow company={company} dark expand />
        {/* 덮개보다 위로 올린다 — 안 그러면 좋아요·즐겨찾기를 눌러도 상세로 넘어간다. */}
        <div className="relative z-[1] mt-auto flex gap-2 pt-2">
          <DetailLink companyId={company.id} className="btn sl-cta">
            기업 상세 보기
          </DetailLink>
          <LikeFavorite
            company={company}
            onError={onError}
            iconSize={17}
            buttonClassName="icbtn-dark size-[38px]"
          />
        </div>
      </div>
    </article>
  );
}
