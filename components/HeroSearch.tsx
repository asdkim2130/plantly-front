"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/icons";

type Props = {
  /** 현재 적용 중인 검색어(부모가 가진 값) */
  value: string;
  onSearch: (keyword: string) => void;
};

/** 인기 검색어 — 아직 집계 API 가 없어 고정 예시다. 누르면 그대로 통합 검색어가 된다. */
const POPULAR = ["스마트팩토리", "AGV", "비전 검사", "집진 설비", "MES"];

/**
 * 히어로의 통합 검색. 백엔드 keyword 는 회사명·소개글·태그·장비명까지 한 번에 훑는다.
 * 타이핑마다 요청하지 않고 제출(엔터/버튼/칩)에만 검색한다.
 */
export default function HeroSearch({ value, onSearch }: Props) {
  const [text, setText] = useState(value);

  // 인기 검색 칩을 누르거나 필터가 검색어를 지우면 입력창도 따라가야 한다.
  // 이건 effect 가 아니라 "prop 이 바뀌면 state 를 맞추는" 렌더 중 조정이다 —
  // React 가 이 렌더를 버리고 새 값으로 즉시 다시 그리므로 화면이 두 번 깜빡이지 않는다.
  const [appliedKeyword, setAppliedKeyword] = useState(value);
  if (value !== appliedKeyword) {
    setAppliedKeyword(value);
    setText(value);
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className="blueprint flex items-center gap-3 bg-white px-4 py-[15px]"
        style={{ borderColor: "rgba(0,0,0,.5)" }}
      >
        <SearchIcon size={19} className="shrink-0 text-brand" />
        <input
          className="srch"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch(text.trim());
          }}
          aria-label="기업 통합 검색"
          placeholder="기업명, 솔루션, 태그로 검색 — 예) 비전 검사, MES, AGV"
        />
        <button
          type="button"
          className="btn btn-primary px-[22px]"
          onClick={() => onSearch(text.trim())}
        >
          검색
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-[7px]">
        <span className="font-heading text-xs tracking-[0.08em] text-faint">인기 검색</span>
        {POPULAR.map((word) => (
          <button
            key={word}
            type="button"
            className={`chip ${value === word ? "on" : ""}`}
            onClick={() => onSearch(value === word ? "" : word)}
          >
            {word}
          </button>
        ))}
        {value && !POPULAR.includes(value) && (
          <button type="button" className="chip on" onClick={() => onSearch("")}>
            {value} ×
          </button>
        )}
      </div>
    </div>
  );
}
