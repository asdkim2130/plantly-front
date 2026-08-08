"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 카드가 마우스 오버로 커질 때 격자를 밀지 않게, "평소 높이"만큼의 자리를 잡아 두는 껍데기.
 *
 * 자리(height)를 픽셀로 못 박아 두면 안쪽 카드가 커져도 격자·레일이 쓰는 높이는 그대로다.
 * 카드는 그 자리를 넘어 아래로 흘러나오고, .pcard:hover 의 z-index 덕분에 아래 카드 위에 얹힌다.
 * (원본 디자인은 카드를 absolute 로 띄워 같은 효과를 냈는데, 자리 높이만 고정해도 결과가 같다.)
 *
 * 높이는 잴 수밖에 없다 — 칩이 몇 줄인지는 글자 길이에 달려 있어 CSS 로는 알 수 없다.
 */
export default function CardSlot({ children }: { children: React.ReactNode }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const card = slotRef.current?.firstElementChild as HTMLElement | null;
    if (!card) return;

    const sync = () => {
      // 펼쳐져 있는 동안의 높이는 "평소 높이"가 아니다 — 그대로 굳히면 자리가 계속 커진다.
      if (card.matches(":hover")) return;
      const next = card.offsetHeight;
      if (next)
        setHeight((prev) => (prev !== undefined && Math.abs(prev - next) < 0.5 ? prev : next));
    };

    // 칩 줄 수가 정해지거나 창 크기가 바뀌면 카드 높이가 달라진다.
    const observer = new ResizeObserver(sync);
    observer.observe(card);
    // 마우스가 빠져나가 카드가 원래 크기로 돌아온 다음 프레임에 다시 잰다.
    const onLeave = () => requestAnimationFrame(sync);
    card.addEventListener("mouseleave", onLeave);

    return () => {
      observer.disconnect();
      card.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={slotRef} style={{ height }}>
      {children}
    </div>
  );
}
