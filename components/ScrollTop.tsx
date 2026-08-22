"use client";

import { ChevronUpIcon } from "@/components/icons";

/**
 * 화면 오른쪽 아래에 붙어 있는 "맨 위로" 버튼.
 *
 * 목록 화면은 조건을 만져도 스크롤이 그대로 남아 있어(`CompanyList` 의 `go(…, stay)`) 결과를
 * 한참 내려 보다 보면 검색창까지 돌아가는 길이 멀다. 그 길을 한 번에 준다.
 *
 * 스크롤 위치와 상관없이 늘 떠 있다 — 나타났다 사라지면 "있었나?" 하고 찾게 되고, 사라지는
 * 기준(몇 px 부터 보일지)이 화면마다 또 하나의 규칙이 된다.
 *
 * 부드럽게 올리되 "동작 줄이기"를 켠 사용자에게는 곧바로 올린다. CSS 의 `scroll-behavior` 와
 * 달리 스크립트로 주는 smooth 는 그 설정을 저절로 따르지 않아서 여기서 직접 본다.
 */
export default function ScrollTop() {
  const toTop = () =>
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });

  return (
    <button
      type="button"
      className="icbtn fixed right-5 bottom-5 z-30 h-11 w-11 shadow-[0_2px_10px_rgba(0,0,0,0.12)]"
      aria-label="맨 위로"
      onClick={toTop}
    >
      <ChevronUpIcon size={18} />
    </button>
  );
}
