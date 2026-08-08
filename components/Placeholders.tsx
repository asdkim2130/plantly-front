/**
 * 채울 데이터가 아직 없는 자리. 빈 칸으로 두거나 카드 수에 맞춰 격자가 무너지게 두는 대신,
 * 디자인이 정해 둔 점선 + 해칭 자리표시자를 그린다.
 *
 * 스포트라이트·추천은 "몇 칸"이 레이아웃의 일부라(레일 페이지 계산) 부족분을 이걸로 메운다.
 */

/** 스포트라이트 레일의 와이드 자리. 높이는 SpotlightCard 와 맞춘다 — 레일을 넘길 때 높이가 튀면 안 된다. */
export function SpotlightPlaceholder({ index }: { index: number }) {
  return (
    <div className="blueprint flex min-h-[324px] items-stretch border-dashed">
      <div className="hatch-empty hidden w-[340px] shrink-0 border-r border-dashed border-line sm:block" />
      <div className="flex flex-1 flex-col justify-center gap-[11px] px-6 py-[22px]">
        <div className="skel h-[11px] w-[170px]" />
        <div className="skel h-[21px] w-[42%]" />
        <div className="skel h-[11px] w-[64%]" />
        <div className="flex gap-[5px]">
          <span className="skel h-[19px] w-[84px]" />
          <span className="skel h-[19px] w-[68px]" />
          <span className="skel h-[19px] w-[74px]" />
        </div>
        <p className="font-heading text-[11px] tracking-[0.08em] text-faint">
          SPOTLIGHT {String(index).padStart(2, "0")} · 데이터 준비 중
        </p>
      </div>
    </div>
  );
}

/** 추천 기업 레일의 카드 자리 */
export function FeaturedPlaceholder() {
  return (
    <div className="blueprint flex flex-col border-dashed">
      <div className="hatch-empty h-[150px] border-b border-dashed border-line" />
      <div className="flex flex-col gap-2.5 p-4">
        <div className="mt-[-40px] size-[54px] border border-dashed border-line bg-white" />
        <div className="skel h-[15px] w-1/2" />
        <div className="skel h-2.5 w-[76%]" />
        <div className="skel h-2.5 w-[32%]" />
        <div className="flex gap-[5px]">
          <span className="skel h-[19px] w-[74px]" />
          <span className="skel h-[19px] w-[58px]" />
        </div>
      </div>
    </div>
  );
}

/** 전체 기업 격자의 카드 자리. 로딩 중 스켈레톤으로도 쓴다. */
export function CompanyPlaceholder() {
  return (
    <div className="blueprint flex min-h-[172px] flex-col gap-3 border-dashed p-[18px]">
      <div className="flex gap-[13px]">
        <div className="size-[52px] shrink-0 border border-dashed border-line" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="skel h-3.5 w-[46%]" />
          <div className="skel h-2.5 w-[80%]" />
        </div>
      </div>
      <div className="skel h-2.5 w-[30%]" />
      <div className="flex gap-[5px]">
        <span className="skel h-[19px] w-[78px]" />
        <span className="skel h-[19px] w-[60px]" />
      </div>
      <p className="font-heading mt-auto border-t border-dashed border-line-soft pt-[11px] text-[11px] tracking-[0.08em] text-faint">
        데이터 준비 중
      </p>
    </div>
  );
}
