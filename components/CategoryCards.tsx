"use client";

import type { CategoryPublicResponse } from "@/types/api";

type Props = {
  /** 대분류(depth 1). 앞에서 4개까지만 카드로 그린다. */
  categories: CategoryPublicResponse[];
  selectedId: number | null;
  onSelect: (categoryId: number | null) => void;
};

/**
 * 히어로 아래의 대분류 진입 카드 4장.
 *
 * 카드마다 "N개 기업"을 적고 싶지만 카테고리 API 에 회사 수가 없다.
 * 대신 실제로 있는 값 — 하위 분류 이름과 개수 — 을 보여준다.
 * 누르면 목록의 카테고리 패싯이 걸린다(후손 서브트리까지 잡히므로 대분류로 눌러도 결과가 나온다).
 */
export default function CategoryCards({ categories, selectedId, onSelect }: Props) {
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
        const on = selectedId === category.id;
        const children = category.children.map((c) => c.categoryName);

        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(on ? null : category.id)}
            className={`cat blueprint ${on ? "on" : ""}`}
          >
            <span className="font-heading text-[11px] tracking-[0.14em] text-faint">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-heading text-[21px]">{category.categoryName}</span>
            <span className="line-clamp-2 text-[12.5px] leading-[1.5] text-muted">
              {children.length > 0 ? children.slice(0, 4).join(" · ") : "하위 분류 없음"}
            </span>
            <span className="text-brand-700 mt-0.5 text-[11.5px]">
              {children.length > 0 ? `하위 ${children.length}개 분류 →` : "전체 보기 →"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
