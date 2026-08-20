"use client";

import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

type Props = {
  children: React.ReactNode;
  /**
   * 트랙에 붙일 클래스. 레일마다 배치가 달라서(스포트라이트는 한 줄,
   * 추천은 세로 2줄 격자) 여기서 받는다.
   */
  trackClassName: string;
  label: string;
};

/** 이 픽셀 이하로 남는 스크롤 여유는 페이지로 치지 않는다. */
const SLOP = 12;

/** smooth 스크롤이 끝났다는 신호(scrollend)를 못 받았을 때 쓰는 보험. */
const WRAP_TIMEOUT_MS = 900;

/** 지금 감고 있는 방향과, 그 때 트랙에 덧붙인 복제 슬라이드 수. */
type Wrap = { count: number; at: "start" | "end" };

/**
 * 트랙의 스크롤 좌표계에서 각 슬라이드의 왼쪽 위치와 폭.
 *
 * offsetLeft 를 안 쓰는 이유: 복제본은 display:contents 로 감싸서 자기 상자가 없다
 * (offsetLeft 가 0 으로 나온다). 그래서 상자가 없으면 안쪽 카드를 대신 잰다.
 */
function slideBoxes(track: HTMLElement) {
  const origin = track.getBoundingClientRect().left - track.scrollLeft;
  return Array.from(track.children).map((child) => {
    const el = child as HTMLElement;
    const box = el.getBoundingClientRect().width ? el : (el.firstElementChild as HTMLElement | null);
    const rect = box?.getBoundingClientRect();
    return rect ? { left: rect.left - origin, width: rect.width } : null;
  });
}

/**
 * 화살표와 점으로 넘기는 가로 스크롤 레일.
 *
 * 페이지 수는 "보이는 폭으로 몇 번 더 밀 수 있나"로 센다 — 카드 사이 간격 때문에
 * scrollWidth / clientWidth 가 딱 떨어지지 않아서, 실제 스크롤 여유(maxScroll)를 기준으로 잡는다.
 * 그래서 goTo/현재 페이지도 maxScroll 위의 비율로 계산한다. 마지막 페이지가 브라우저에 의해
 * 잘려도(끝까지 밀리지 않아도) 점 표시가 어긋나지 않는다.
 *
 * 양 끝에서는 되감지 않고 가던 방향으로 계속 흘러 반대편 페이지가 나온다 — wrapAround() 참고.
 */
export default function Rail({ children, trackClassName, label }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  // 자식을 배열로 펴서 앞뒤 몇 개를 복제할 수 있게 한다.
  // (호출부가 `{목록.map(...)}{자리표시자.map(...)}` 처럼 여러 덩어리로 넘겨도 한 줄로 합쳐진다.)
  const items = Children.toArray(children);

  const [wrap, setWrap] = useState<Wrap | null>(null);
  // 감는 중에는 복제본 때문에 scrollWidth 가 부풀어 있다 — 그 값으로 페이지를 다시 세면 안 된다.
  const wrapping = useRef(false);

  const measure = useCallback(() => {
    const track = trackRef.current;
    // 첫 렌더에 폭이 0이면 나누기가 Infinity 가 된다 — 그럴 땐 그냥 1페이지로 둔다.
    if (!track || !track.clientWidth || wrapping.current) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    // 몇 px 남는 건 반올림 오차지 "다음 페이지"가 아니다 —
    // 빼지 않으면 딱 맞는 레일에 점이 하나 더 생긴다.
    const nextPages = maxScroll <= SLOP ? 1 : 1 + Math.ceil((maxScroll - SLOP) / track.clientWidth);
    setPages(nextPages);
    setPage(maxScroll <= SLOP ? 0 : Math.round((track.scrollLeft / maxScroll) * (nextPages - 1)));
  }, []);

  // 자식(카드)이 늦게 도착하면 페이지 수가 달라진다. 매 렌더 뒤에 다시 잰다 —
  // 값이 그대로면 setState 가 리렌더를 일으키지 않으므로 반복되지 않는다.
  useEffect(measure);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  /**
   * 앞쪽(start)에 복제본을 끼운 직후의 보정.
   *
   * 앞에 뭔가 들어오면 원래 내용이 그 폭만큼 오른쪽으로 밀려서 화면이 통째로 튄다.
   * useLayoutEffect 는 DOM 이 바뀐 뒤 "그리기 전에" 동기로 실행되므로, 여기서 스크롤을
   * 같은 폭만큼 옮겨 두면 사용자는 아무 변화도 못 본다. (뒤쪽에 붙이는 end 방향은
   * 이미 보고 있는 내용이 안 밀리므로 이 보정이 필요 없다.)
   */
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (wrap?.at !== "start" || !track) return;
    const firstReal = slideBoxes(track)[wrap.count];
    if (!firstReal) return;
    track.style.scrollBehavior = "auto";
    track.scrollLeft = firstReal.left;
    track.style.scrollBehavior = "";
  }, [wrap]);

  /**
   * 복제본이 자리를 잡은 뒤 실제로 감는 부분.
   *
   * 가려는 쪽에 "반대편 페이지의 복제본"이 놓여 있으니 평소처럼 그쪽으로 스크롤한다.
   * 도착하면 화면은 진짜 목적지 페이지와 똑같으므로, 애니메이션 없이 진짜 위치로
   * 옮겨도 아무것도 움직이지 않는다. 그 다음 복제본을 치운다.
   */
  useEffect(() => {
    const track = trackRef.current;
    if (!wrap || !track) return;

    const boxes = slideBoxes(track);
    let target: number;
    if (wrap.at === "end") {
      // 뒤에 붙인 복제본의 첫 칸을 왼쪽 끝에 맞춘다 = 첫 페이지와 같은 그림.
      const firstPhantom = boxes[items.length];
      if (!firstPhantom) return;
      target = firstPhantom.left;
    } else {
      // 앞에 붙인 복제본의 오른쪽 끝을 화면 오른쪽에 맞춘다 = 마지막 페이지와 같은 그림
      // (마지막 페이지는 왼쪽 정렬이 아니라 오른쪽 끝에 붙어 있다).
      const firstReal = boxes[wrap.count];
      if (!firstReal) return;
      target = Math.max(0, firstReal.left - track.clientWidth);
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      track.removeEventListener("scrollend", onScrollEnd);
      track.style.scrollBehavior = "auto";
      // end 방향은 첫 페이지(0), start 방향은 마지막 페이지(끝까지). 둘 다 복제본을
      // 지우기 전에 먼저 옮겨야 한다 — 순서가 바뀌면 scrollWidth 가 먼저 변하며 화면이 튄다.
      track.scrollLeft = wrap.at === "end" ? 0 : track.scrollWidth;
      requestAnimationFrame(() => {
        track.style.scrollBehavior = "";
        wrapping.current = false;
        setWrap(null);
      });
    };

    /*
      "목적지에 도착한 scrollend" 만 받아들인다.
      start 방향은 바로 위 useLayoutEffect 가 위치를 보정하면서 이미 한 번 스크롤을 했고,
      그 scrollend 가 여기로 날아든다 — 그냥 받으면 애니메이션이 시작하기도 전에 끝나 버린다.
      브라우저가 목표를 스크롤 끝으로 잘라낼 수 있으니 비교 대상도 같이 잘라 준다.
    */
    const onScrollEnd = () => {
      const max = track.scrollWidth - track.clientWidth;
      if (Math.abs(track.scrollLeft - Math.min(target, max)) <= 2) finish();
    };

    track.scrollTo({ left: target, behavior: "smooth" });
    track.addEventListener("scrollend", onScrollEnd);
    const timer = setTimeout(finish, WRAP_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
      track.removeEventListener("scrollend", onScrollEnd);
    };
  }, [wrap, items.length]);

  function goTo(next: number) {
    const track = trackRef.current;
    if (!track || pages < 2 || wrapping.current) return;
    const target = (next + pages) % pages;
    // 중간 페이지는 보이는 폭의 배수로 정확히 멈추고, 마지막만 끝까지 민다.
    const maxScroll = track.scrollWidth - track.clientWidth;
    const left = target === pages - 1 ? maxScroll : target * track.clientWidth;
    track.scrollTo({ left, behavior: "smooth" });
  }

  /**
   * 양 끝에서 반대편으로 감기. 되감는 대신 가던 방향으로 계속 흐르게 보이려면
   * 그 방향에 갈 곳이 있어야 하므로, 반대편 페이지의 슬라이드를 복제해 그쪽에 붙인다.
   * 실제 스크롤은 위 두 훅이 한다(복제본이 DOM 에 들어간 뒤라야 위치를 잴 수 있다).
   */
  function wrapAround(at: "start" | "end") {
    const track = trackRef.current;
    if (!track || wrapping.current) return;

    const boxes = slideBoxes(track);
    const maxScroll = track.scrollWidth - track.clientWidth;
    const count =
      at === "end"
        ? // 첫 페이지 = 왼쪽 끝에서 한 화면 안에 시작점이 들어오는 슬라이드들
          boxes.filter((b) => b && b.left < track.clientWidth - 4).length
        : // 마지막 페이지 = 오른쪽 끝 화면에 걸치는 슬라이드들
          boxes.filter((b) => b && b.left + b.width > maxScroll + 4).length;

    if (!count) {
      goTo(at === "end" ? 0 : pages - 1);
      return;
    }

    wrapping.current = true;
    setPage(at === "end" ? 0 : pages - 1); // 점은 미리 옮겨 둔다 — 감는 동안 measure 는 쉰다.
    setWrap({ count, at });
  }

  /** 복제 슬라이드. 감는 동안에만 존재한다. */
  const phantoms = (at: "start" | "end") =>
    wrap?.at !== at
      ? null
      : (at === "end" ? items.slice(0, wrap.count) : items.slice(items.length - wrap.count)).map(
          (child, i) => (
            /*
              display:contents 라 이 <div> 자체는 상자를 만들지 않는다 — 안의 카드가 그대로
              flex/grid 아이템이 되므로 레일 배치가 어긋나지 않는다.
              inert 는 복제본을 포커스·스크린리더 대상에서 빼서 같은 카드가 두 번 읽히지 않게 한다.
            */
            <div key={`phantom-${at}-${i}`} inert style={{ display: "contents" }}>
              {child}
            </div>
          ),
        );

  return (
    <div>
      {/*
        pointer-events-none 은 레일이 **아래 콘텐츠의 클릭을 먹는 것**을 막는다.

        트랙은 hover 로 커지는 카드가 잘리지 않게 아래쪽에 큰 padding 을 두고(overflow-x:auto 는
        세로도 같이 자른다) 그만큼을 음수 margin 으로 되당긴다. 그런데 음수 margin 은 이 래퍼 밖으로
        빠져나가(margin collapsing) 레이아웃만 당길 뿐, 트랙과 래퍼의 **박스는 그대로 아래를 덮는다.**
        비워둔 자리라 눈에는 안 보이지만 히트 테스트에는 잡혀서, 레일 바로 아래 요소(섹션 제목,
        카테고리 칩 줄)가 클릭되지 않았다.

        그래서 껍데기는 이벤트를 통과시키고 실제 내용물만 다시 켠다 — 카드는 .railtrack > * 로,
        화살표는 .railbtn 으로 globals.css 에서 pointer-events:auto 를 받는다. 빈 padding 영역만
        투명해지므로 카드 hover 도 가로 스크롤도 그대로다(휠 이벤트는 카드에서 트랙으로 버블링된다).
      */}
      <div className="pointer-events-none relative">
        <div ref={trackRef} className={`railtrack ${trackClassName}`} onScroll={measure}>
          {phantoms("start")}
          {items}
          {phantoms("end")}
        </div>

        {pages > 1 && (
          <>
            <button
              type="button"
              className="railbtn left-[-13px]"
              onClick={() => (page === 0 ? wrapAround("start") : goTo(page - 1))}
              aria-label={`${label} 이전`}
            >
              <ChevronLeftIcon size={17} />
            </button>
            <button
              type="button"
              className="railbtn right-[-13px]"
              onClick={() => (page === pages - 1 ? wrapAround("end") : goTo(page + 1))}
              aria-label={`${label} 다음`}
            >
              <ChevronRightIcon size={17} />
            </button>
          </>
        )}
      </div>

      {pages > 1 && (
        <div className="relative z-[6] mt-3.5 flex h-3 items-center justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`raildot ${i === page ? "on" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`${label} ${i + 1}번째 페이지`}
              aria-current={i === page}
            />
          ))}
        </div>
      )}
    </div>
  );
}
