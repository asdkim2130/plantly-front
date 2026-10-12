"use client";

import CoverCard from "@/components/CoverCard";
import LikeFavorite from "@/components/LikeFavorite";
import type { CompanySummary } from "@/types/api";

type Props = {
  company: CompanySummary;
  onError: (message: string) => void;
};

/**
 * "추천 기업" 레일의 카드. 위쪽 커버 위로 로고가 반쯤 걸쳐 내려온다.
 *
 * 커버는 스포트라이트와 같은 이미지(coverImageUrl)를 훨씬 납작한 비율로 자른 것이다.
 * 없는 회사는 디자인의 사선 해칭으로 떨어진다. 몸통은 내 기업 목록 카드와 함께 쓰는 CoverCard 다.
 */
export default function FeaturedCard({ company, onError }: Props) {
  return (
    <CoverCard
      company={company}
      badges={<span className="tag bg-brand font-medium text-white">FEATURED</span>}
      actions={<LikeFavorite company={company} onError={onError} buttonClassName="bg-white/90" />}
    />
  );
}
