"use client";

import type { CategoryPublicResponse } from "@/types/api";

type Props = {
  /** 대분류(depth 1). 앞에서 4개까지만 카드로 그린다. */
  categories: CategoryPublicResponse[];
};

/**
 * 히어로 아래의 대분류 진입 카드 4장.
 *
 * 카드마다 "N개 기업"을 적고 싶지만 카테고리 API 에 회사 수가 없다.
 * 대신 실제로 있는 값 — 하위 분류 이름과 개수 — 을 보여준다.
 *
 * **지금은 누를 수 없다.** 원래는 같은 화면의 격자에 카테고리 패싯을 걸었는데, 그러면 검색 상태로
 * 들어가면서 바로 위 스포트라이트·추천 레일이 접혔다 — 화면 맨 위 카드를 눌렀는데 그 아래 큐레이션이
 * 통째로 사라지는 모양새다. 이 카드의 목적지는 메인 격자가 아니라 별도 목록 화면이므로,
 * 그 라우트가 생기면 `<a href="/companies?categoryId=…">` 로 바꾼다(후손 서브트리까지 잡히니
 * 대분류로 넘겨도 결과가 나온다).
 */
export default function CategoryCards({ categories }: Props) {
  if (categories.length === 0) {
    return (
      <div className="grid gap-4 px-4 pb-[34px] sm:px-[30px] sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="blueprint flex flex-col gap-2 border-dashed p-[18px]">
            <div className="skel h-2.5 w-6" />
            <div className="skel h-5 w-1/2" />
            <div className="skel h-2.5 w-[86%]" />
            <div className="skel h-2.5 w-[40%]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 px-4 pb-[34px] sm:px-[30px] sm:grid-cols-2 lg:grid-cols-4">
      {categories.slice(0, 4).map((category, i) => {
        const children = category.children.map((c) => c.categoryName);

        return (
          <div key={category.id} className="cat blueprint">
            <span className="font-heading text-[11px] tracking-[0.14em] text-faint">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-heading text-[21px]">{category.categoryName}</span>
            <span className="line-clamp-2 text-[13px] leading-[1.5] text-muted">
              {children.length > 0 ? children.slice(0, 4).join(" · ") : "하위 분류 없음"}
            </span>
            {/* 화살표(→)는 뺀다 — 지금은 아무 데도 가지 않는다. 목록 라우트가 생기면 링크와 함께 돌아온다. */}
            {children.length > 0 && (
              <span className="text-brand-700 mt-0.5 text-[12px]">
                하위 {children.length}개 분류
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
