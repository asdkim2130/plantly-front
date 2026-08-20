"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { POPUP_WINDOW_NAME, isPopupPath } from "@/lib/popup";

/**
 * 팝업 창 안에서만 `<html data-popup="1">` 을 세운다. 실제로 상단바를 감추는 건 그 표식을 보는
 * `globals.css` 쪽이다 — 헤더를 렌더할지 말지를 여기서 정하지 않는 이유는, 서버가 그린 HTML 과
 * 클라이언트가 그린 HTML 이 달라지면(hydration) 화면이 한 번 튀기 때문이다.
 *
 * 첫 페인트 전에 표식을 세우는 건 `app/layout.tsx` 의 인라인 스크립트다(그래야 상단바가 잠깐
 * 보였다 사라지지 않는다). 이 컴포넌트는 그다음 — **화면 안에서 경로가 바뀔 때**를 맡는다.
 * 그때는 문서를 새로 읽지 않아 스크립트가 다시 돌지 않는다.
 */
export default function PopupChrome() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    if (window.name === POPUP_WINDOW_NAME && isPopupPath(pathname)) {
      root.setAttribute("data-popup", "1");
    } else {
      root.removeAttribute("data-popup");
    }
  }, [pathname]);

  return null;
}
