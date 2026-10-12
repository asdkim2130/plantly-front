/**
 * 디자인에 쓰인 SVG 아이콘 모음. 전부 24×24 뷰박스에 stroke 1.5 로 그려져 있어
 * size 만 바꿔 끼우면 굵기가 자연스럽게 따라온다.
 *
 * 아이콘 라이브러리를 쓰지 않는 이유: 디자인 원본이 이 몇 개만 쓰고,
 * 패키지를 하나 더 얹는 것보다 여기 모아두는 편이 추적이 쉽다.
 */

/** 굵기는 1.5 가 기본이다. 아주 작게 그리는 글리프(체크·×)만 굵혀 쓴다. */
type IconProps = { size?: number; className?: string; strokeWidth?: number };

function Svg({
  size = 16,
  className,
  strokeWidth = 1.5,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
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

export function ChevronUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 15l7-7 7 7" />
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

/** 목록 위의 정렬 표기 앞 — 줄 세 개 + 내림 화살표. 누를 수 있는 버튼이 아니라 표시다. */
export function SortIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h11M4 12h7M4 17h4M17 6v12l3-3" />
    </Svg>
  );
}

/** 결과가 0건일 때. 돋보기 안이 빼기라 "찾았는데 없다"로 읽힌다(검색 아이콘과 구분된다). */
export function SearchEmptyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.3-4.3M9 11h4" />
    </Svg>
  );
}

/** 안내 한 줄 앞 */
export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01M12 11v5" />
    </Svg>
  );
}

/** 요청이 실패했을 때 */
export function WarningIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17v.01" />
    </Svg>
  );
}

/** 체크박스(.bx) 안에 들어가는 글리프. 9px 로 그려서 기본 굵기로는 보이지 않는다. */
export function CheckIcon({ strokeWidth = 3.5, ...props }: IconProps) {
  return (
    <Svg {...props} strokeWidth={strokeWidth}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </Svg>
  );
}

/** 조건 칩의 해제 버튼(.qx) 안. 체크와 같은 이유로 굵다. */
export function CloseIcon({ strokeWidth = 2.5, ...props }: IconProps) {
  return (
    <Svg {...props} strokeWidth={strokeWidth}>
      <path d="M6 6l12 12M18 6L6 18" />
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

// ── 기업정보 등록 화면 ─────────────────────────────────────────────

/** 입력칸 아래 오류 한 줄·배너 앞(동그라미 느낌표) */
export function AlertCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </Svg>
  );
}

/** 등록할 수 없는 사업자(휴업·폐업·미등록) — 금지 표시 */
export function BanIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </Svg>
  );
}

/** 이미 등록된 사업자번호 — 공장 지붕 */
export function BuildingIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 21V9l6 3V9l6 3V4l6 3v14z" />
    </Svg>
  );
}

/** 시도 횟수 초과·국세청 지연 — 시계 */
export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

/** 돌아가는 원호. `animate-spin` 과 함께 쓴다 */
export function SpinnerIcon({ strokeWidth = 2, ...props }: IconProps) {
  return (
    <Svg {...props} strokeWidth={strokeWidth}>
      <path d="M21 12a9 9 0 1 1-9-9" />
    </Svg>
  );
}

/** 자동저장 완료 — 구름 + 체크 */
export function CloudCheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8a4 4 0 0 1 0 10z" />
      <path d="M9.5 13l2 2 3.5-3.5" />
    </Svg>
  );
}

/** 자동저장 실패 — 구름 + 느낌표 */
export function CloudAlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8a4 4 0 0 1 0 10z" />
      <path d="M12 10v3M12 15.5v.01" />
    </Svg>
  );
}

/** 업로드 자리 — 사진 틀 */
export function ImageIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

/** 등급이 막은 입력(동영상·레퍼런스 이미지) */
export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

/** 국세청 인증 완료 배지 — 방패 + 체크 */
export function ShieldCheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

/** 인증 통과 — 동그라미 체크 */
export function CheckCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2l2.8 2.8L16 9.5" />
    </Svg>
  );
}

/** 국세청 미인증 — 빈 방패 */
export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    </Svg>
  );
}

/** 비공개 — 사선 그은 눈 */
export function EyeOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.5 6.6C3.8 8.3 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Svg>
  );
}

/** 운영 큐레이션 배지(에디터 선정·추천 노출·스팟라이트 고정) — 채운 별 */
export function StarIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" />
    </svg>
  );
}

/** 더 보기 메뉴 — 가로 점 셋 */
export function MoreIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Svg>
  );
}

/** 작성 중인 등록(초안) — 문서 + 연필 */
export function DraftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M9 15l5-5 2 2-5 5H9z" />
    </Svg>
  );
}

/** 내 기업 — 창문 달린 건물 */
export function OfficeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4" />
    </Svg>
  );
}
