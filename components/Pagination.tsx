"use client";

type Props = {
  /** 1-based. 백엔드 `pageInfo.pageNumber` 를 그대로 쓴다. */
  page: number;
  totalPage: number;
  onChange: (page: number) => void;
};

/** 한 번에 보여줄 페이지 번호 개수. 넘치는 쪽은 이전/다음으로 넘긴다. */
const WINDOW = 7;

/**
 * 목록 화면의 페이지 이동.
 *
 * 메인의 "기업 더 보기"(이어 붙이기)와 다른 방식인 게 맞다 — 여기서는 조건과 페이지가 주소에
 * 실리므로, 3페이지에서 본 기업을 다시 열려면 그 주소가 3페이지를 그대로 가리켜야 한다.
 * 이어 붙이기는 1~3페이지를 한 주소에 뭉쳐 놓아 그걸 표현할 수 없다.
 */
export default function Pagination({ page, totalPage, onChange }: Props) {
  if (totalPage <= 1) return null;

  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPage - WINDOW + 1));
  const pages = Array.from({ length: Math.min(WINDOW, totalPage) }, (_, i) => start + i);

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="페이지 이동">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        이전
      </button>

      {pages.map((n) => (
        <button
          key={n}
          type="button"
          className={`btn min-w-[38px] ${n === page ? "btn-primary" : "btn-secondary"}`}
          // 스크린리더에 "지금 이 페이지"를 알린다. 색만으로는 전달되지 않는다.
          aria-current={n === page ? "page" : undefined}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}

      <button
        type="button"
        className="btn btn-secondary"
        disabled={page >= totalPage}
        onClick={() => onChange(page + 1)}
      >
        다음
      </button>
    </nav>
  );
}
