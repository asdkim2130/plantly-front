/**
 * 디자인에 쓰인 SVG 아이콘 모음. 전부 24×24 뷰박스에 stroke 1.5 로 그려져 있어
 * size 만 바꿔 끼우면 굵기가 자연스럽게 따라온다.
 *
 * 아이콘 라이브러리를 쓰지 않는 이유: 디자인 원본이 이 8개만 쓰고,
 * 패키지를 하나 더 얹는 것보다 여기 모아두는 편이 추적이 쉽다.
 */

type IconProps = { size?: number; className?: string };

function Svg({ size = 16, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.3-4.3" />
    </Svg>
  );
}

/** 주소 앞의 위치 핀 */
export function PinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

/** 업종 라벨 앞의 공장 실루엣 */
export function FactoryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 21V9l6 3V9l6 3V4l6 3v14z" />
    </Svg>
  );
}

/**
 * 검수 배지. CompanySummary.verified(에디터 선정 큐레이션) 전용이다 —
 * businessVerified(국세청 사업자 확인)는 다른 축이라 같은 아이콘을 쓰지 않는다.
 */
export function VerifiedIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2.5l2.4 1.7 2.9-.2.9 2.8 2.4 1.7-1 2.8 1 2.8-2.4 1.7-.9 2.8-2.9-.2L12 21.5l-2.4-1.7-2.9.2-.9-2.8-2.4-1.7 1-2.8-1-2.8 2.4-1.7.9-2.8 2.9.2z" />
      <path d="M9 12.2l2.1 2.1 4-4.3" />
    </Svg>
  );
}

export function HeartIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  const d = "M19 14c1.5-1.5 2-3.3 2-5a5 5 0 0 0-9-3 5 5 0 0 0-9 3c0 1.7.5 3.5 2 5l7 7 7-7Z";
  if (filled) {
    return (
      <svg
        width={props.size ?? 16}
        height={props.size ?? 16}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d={d} />
      </svg>
    );
  }
  return (
    <Svg {...props}>
      <path d={d} />
    </Svg>
  );
}

export function BookmarkIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  const d = "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z";
  if (filled) {
    return (
      <svg
        width={props.size ?? 16}
        height={props.size ?? 16}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d={d} />
      </svg>
    );
  }
  return (
    <Svg {...props}>
      <path d={d} />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </Svg>
  );
}

/** 공유(링크 복사) — 세 점을 잇는 노드 모양 */
export function ShareIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="M8.4 10.8l7.2-4.1M8.4 13.2l7.2 4.1" />
    </Svg>
  );
}

/**
 * 소개 영상. 다른 아이콘과 달리 선이 아니라 채운 삼각형이라 Svg 헬퍼(stroke)를 쓰지 않는다.
 */
export function PlayIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M8 5l12 7-12 7z" />
    </svg>
  );
}
