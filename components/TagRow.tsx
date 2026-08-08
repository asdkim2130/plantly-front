"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CompanySummary } from "@/types/api";

type Props = {
  company: CompanySummary;
  /** 접지 않고 전부 그린다. 펼침이 잘리는 레일(스포트라이트)에서 쓴다. */
  expand?: boolean;
  /**
   * 스포트라이트 카드용 반전 칩. 실제 색은 그 카드가 배경(brandColor)에서 파생시키므로
   * (globals.css 의 `.spotlight .tag-dark`) 여기서는 "반전 계열을 쓴다"는 것만 정한다.
   */
  dark?: boolean;
};

type ChipData = { key: string; label: string; category: boolean };

/** 요약 카드에서 칩 줄이 차지할 수 있는 줄 수. */
const MAX_LINES = 2;

/** 칩 사이 간격. 아래 flex 컨테이너의 gap 과 같은 값이어야 한다. */
const GAP = 5;

/**
 * 카드 하단의 칩 줄.
 *
 * 두 종류가 섞여 있고 생김새로 구분한다.
 *  - categoryNames: 정식 분류. '#' 없이 아웃라인 칩(.tagcat)
 *  - tagNames: 회사가 직접 단 자유 태그. '#' 붙은 채움 칩(.tag-accent)
 *
 * **카테고리가 항상 먼저다.** 정식 분류가 자유 태그보다 정보량이 크고, 순서가 고정돼야
 * 카드끼리 눈으로 비교가 된다. 카테고리를 다 넣은 다음에야 태그가 들어간다.
 *
 * 개수를 고정하지 않고 MAX_LINES 줄에 **들어가는 만큼** 넣는다 — 칩 글자 수가 제각각이라
 * ("#AMR" vs "#EOL(최종 성능 검사)") 개수로 자르면 어떤 카드는 휑하고 어떤 카드는 넘친다.
 * 넘치는 칩은 .tagmore 로 숨겨 두고, 카드에 마우스를 올리면 같은 줄에 이어서 펼쳐진다(CSS 처리).
 * 그때 카드가 세로로 커지는데, 격자가 밀리지 않게 잡아 주는 건 CardSlot 이다.
 *
 * 접기는 화면 밀도 문제일 뿐이라 응답에서 온 값은 하나도 버리지 않는다.
 */
export default function TagRow({ company, expand = false, dark = false }: Props) {
  const chips: ChipData[] = [
    ...company.categoryNames.map((name) => ({ key: `c:${name}`, label: name, category: true })),
    ...company.tagNames.map((name) => ({ key: `t:${name}`, label: name, category: false })),
  ];

  const rowRef = useRef<HTMLDivElement>(null);
  const measuredWidth = useRef(0);
  /** 접지 않고 보여줄 칩 수. null 이면 아직 재기 전 — 그 렌더에서는 전부 그려 놓고 잰다. */
  const [fit, setFit] = useState<number | null>(null);

  /*
   * 재는 건 useLayoutEffect 에서 한다. DOM 이 올라온 뒤 "그리기 전에" 실행되므로
   * 전부 펼쳐진 중간 상태가 화면에 비치지 않는다 — 여기서 setState 하면 React 가
   * 페인트 전에 다시 그린다.
   */
  useLayoutEffect(() => {
    if (expand || fit !== null) return;
    const row = rowRef.current;
    if (!row?.clientWidth) return;
    measuredWidth.current = row.clientWidth;

    const rowRect = row.getBoundingClientRect();
    const kids = Array.from(row.children) as HTMLElement[];
    // 마지막 칸은 폭을 재려고 띄워 둔 "+N" 칩이다(보이지는 않는다).
    const plusWidth = kids.at(-1)?.getBoundingClientRect().width ?? 0;
    const boxes = kids.slice(0, -1).map((el) => {
      const r = el.getBoundingClientRect();
      // top 이 같은 칩끼리 한 줄. 소수점 오차가 있어 반올림해서 묶는다.
      return { top: Math.round(r.top - rowRect.top), right: r.right - rowRect.left };
    });

    const lines = [...new Set(boxes.map((b) => b.top))].sort((a, b) => a - b);
    const overflowAt = boxes.findIndex((b) => lines.indexOf(b.top) >= MAX_LINES);
    if (overflowAt === -1) {
      setFit(chips.length); // 다 들어간다 — "+N" 이 아예 필요 없다
      return;
    }

    // 접힌 게 있으면 "+N" 칩이 앉을 자리를 마지막 줄 끝에 남겨 둔다.
    let n = overflowAt;
    while (n > 1 && boxes[n - 1].right + GAP + plusWidth > rowRect.width) n--;
    setFit(n);
    // fit 이 정해지면 위에서 바로 빠져나오므로 다시 재는 일은 없다(폭이 변해 null 로 되돌릴 때만).
  }, [expand, fit, chips.length]);

  // 카드 폭이 바뀌면 몇 개가 들어가는지도 달라진다 — 다시 재게 만든다.
  useEffect(() => {
    const row = rowRef.current;
    if (!row || expand) return;
    const observer = new ResizeObserver(() => {
      if (Math.abs(row.clientWidth - measuredWidth.current) > 1) setFit(null);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [expand]);

  if (chips.length === 0) return null;

  const measuring = fit === null && !expand;
  const limit = expand ? chips.length : (fit ?? chips.length);
  const hidden = chips.length - limit;

  return (
    <div ref={rowRef} className="flex flex-wrap items-center gap-[5px]">
      {chips.map((chip, i) => (
        <Chip key={chip.key} chip={chip} dark={dark} folded={i >= limit} />
      ))}

      {hidden > 0 && (
        <span className={`tag tagcount ${dark ? "tag-dark" : "tag-neutral"}`}>+{hidden}</span>
      )}

      {/* 폭 재기용. 실제로 그려질 "+N" 과 같은 모양이라 자리 계산이 맞는다. */}
      {measuring && (
        <span className={`tag invisible ${dark ? "tag-dark" : "tag-neutral"}`}>
          +{chips.length}
        </span>
      )}
    </div>
  );
}

function Chip({
  chip,
  dark,
  folded,
}: {
  chip: ChipData;
  dark: boolean;
  /** 자리에 안 들어가 접힌 칩. 카드 hover 때만 보인다. */
  folded: boolean;
}) {
  const tone = chip.category ? (dark ? "tagcat-dark" : "tagcat") : dark ? "tag-dark" : "tag-accent";
  return (
    <span className={`tag ${tone}${folded ? " tagmore" : ""}`}>
      {chip.category ? chip.label : `#${chip.label}`}
    </span>
  );
}
