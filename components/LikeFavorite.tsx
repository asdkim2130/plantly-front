"use client";

import { useState } from "react";
import { BookmarkIcon, HeartIcon } from "@/components/icons";
import { ApiError } from "@/lib/api";
import { favorite, like, unfavorite, unlike } from "@/lib/companies";
import type { CompanySummary } from "@/types/api";

type Props = {
  company: CompanySummary;
  /** 실패(주로 비로그인)를 화면 위쪽에 한 번만 띄우기 위해 부모로 올린다. */
  onError: (message: string) => void;
  /** 아이콘 픽셀 크기. 버튼 크기는 className 으로 조절한다. */
  iconSize?: number;
  /** 남색 카드 위 등, .icbtn 에 덧붙일 클래스 */
  buttonClassName?: string;
};

/**
 * 좋아요 + 즐겨찾기 아이콘 버튼 한 쌍.
 *
 * 백엔드는 토글이 아니라 등록(PUT)/해제(DELETE)로 나뉜 멱등 API 이고 응답은 204 다.
 * 현재 상태는 목록 응답의 likedByMe/favoritedByMe 로 온다(익명 뷰어면 항상 false).
 */
export default function LikeFavorite({
  company,
  onError,
  iconSize = 15,
  buttonClassName = "",
}: Props) {
  return (
    <>
      <ToggleButton
        on={company.likedByMe}
        onLabel="좋아요 취소"
        offLabel="좋아요"
        failMessage="좋아요는 로그인 후 사용할 수 있습니다."
        turnOn={() => like(company.id)}
        turnOff={() => unlike(company.id)}
        onError={onError}
        className={buttonClassName}
        render={(on) => <HeartIcon size={iconSize} filled={on} />}
      />
      <ToggleButton
        on={company.favoritedByMe}
        onLabel="즐겨찾기 해제"
        offLabel="즐겨찾기"
        failMessage="즐겨찾기는 로그인 후 사용할 수 있습니다."
        turnOn={() => favorite(company.id)}
        turnOff={() => unfavorite(company.id)}
        onError={onError}
        className={buttonClassName}
        render={(on) => <BookmarkIcon size={iconSize} filled={on} />}
      />
    </>
  );
}

function ToggleButton({
  on: initial,
  onLabel,
  offLabel,
  failMessage,
  turnOn,
  turnOff,
  onError,
  className,
  render,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  failMessage: string;
  turnOn: () => Promise<void>;
  turnOff: () => Promise<void>;
  onError: (message: string) => void;
  className: string;
  render: (on: boolean) => React.ReactNode;
}) {
  const [on, setOn] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    const next = !on;

    // 낙관적 반영 — 멱등 API 라 중복 클릭이 서버를 깨뜨리지는 않는다. 거절당하면 되돌린다.
    setOn(next);
    setPending(true);
    try {
      await (next ? turnOn() : turnOff());
    } catch (e) {
      setOn(!next);
      onError(
        e instanceof ApiError && e.isUnauthorized ? failMessage : "요청을 처리하지 못했습니다.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? onLabel : offLabel}
      className={`icbtn ${on ? "on" : ""} ${className}`}
    >
      {render(on)}
    </button>
  );
}
