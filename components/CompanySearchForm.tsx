"use client";

import { useState } from "react";
import { FilterIcon, SearchIcon } from "@/components/icons";
import {
  ADVANCED_FIELDS,
  ADVANCED_FIELD_LABEL,
  ADVANCED_FIELD_PLACEHOLDER,
  EMPTY_ADVANCED,
  type AdvancedField,
} from "@/lib/companySearchParams";

/** 이 폼이 제출하는 값 — 텍스트 조건만이다. 패싯(체크박스)은 누르는 즉시 반영되므로 여기 없다. */
export type SearchText = {
  keyword: string;
  advanced: Record<AdvancedField, string>;
};

type Props = SearchText & {
  onSubmit: (next: SearchText) => void;
};

/**
 * 목록 화면의 검색 폼 — 통합 검색어 한 줄 + 접어 둔 고급검색 9칸.
 *
 * **둘을 한 `<form>` 으로 묶은 이유**는 백엔드가 둘을 AND 로 걸기 때문이다. 통합 검색어와
 * 고급검색 칸을 따로 제출하게 만들면 "장비명만 다시 검색"처럼 보이지만 실제로는 앞서 넣은
 * 검색어가 그대로 남아 함께 걸린다 — 화면이 그 사실을 감추게 된다. 한 번에 같이 낸다.
 *
 * 타이핑마다 요청하지 않는다(제출에만 검색). 패싯과 달리 텍스트는 중간 상태가 의미 없어서다.
 */
export default function CompanySearchForm({ keyword, advanced, onSubmit }: Props) {
  const [draft, setDraft] = useState<SearchText>({ keyword, advanced });

  /*
   * 주소가 바뀌면(뒤로가기, 조건 칩 삭제, 조건 초기화) 입력칸도 따라가야 한다.
   * effect 가 아니라 "prop 이 바뀌면 state 를 맞추는" 렌더 중 조정이다 — HeroSearch 와 같은 방식.
   */
  const applied = [keyword, ...ADVANCED_FIELDS.map((field) => advanced[field])].join(" ");
  const [lastApplied, setLastApplied] = useState(applied);
  if (applied !== lastApplied) {
    setLastApplied(applied);
    setDraft({ keyword, advanced });
  }

  const advancedCount = ADVANCED_FIELDS.filter((field) => draft.advanced[field].trim()).length;
  const [open, setOpen] = useState(advancedCount > 0);

  const submit = (next: SearchText) =>
    onSubmit({
      keyword: next.keyword.trim(),
      advanced: Object.fromEntries(
        ADVANCED_FIELDS.map((field) => [field, next.advanced[field].trim()]),
      ) as Record<AdvancedField, string>,
    });

  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(draft);
      }}
    >
      {/*
        테두리가 카드보다 진하다(line 이 아니라 ink/50). 이 화면에서 제일 먼저 손이 가는 칸이라
        같은 회색 테두리 상자가 위아래로 이어지면 어디에 타이핑하는 자리인지 눈에 안 띈다.
      */}
      <div className="blueprint flex items-center gap-3 border-ink/50 bg-white px-3.5 py-3">
        <SearchIcon size={19} className="shrink-0 text-brand" />
        <input
          className="srch"
          type="search"
          value={draft.keyword}
          onChange={(e) => setDraft((prev) => ({ ...prev, keyword: e.target.value }))}
          aria-label="기업 통합 검색"
          // 백엔드는 공백으로 나눈 단어를 각각 AND 로 훑는다 — 두 단어가 서로 다른 필드에 있어도 맞는다.
          placeholder="띄어쓴 단어를 모두 가진 기업을 찾습니다 — 예) 몰드 금형"
        />
        <button type="submit" className="btn btn-primary px-[22px]">
          검색
        </button>
      </div>

      <details
        open={open}
        onToggle={(e) => setOpen(e.currentTarget.open)}
        className="rounded-[10px] border border-line bg-white"
      >
        {/* 기본 삼각형 마커를 지우고 필터 아이콘을 세운다(마커는 브라우저마다 모양이 다르다). */}
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[13px] text-muted [&::-webkit-details-marker]:hidden">
          <FilterIcon size={14} className="shrink-0" />
          고급검색
          {advancedCount > 0 && (
            <span className="font-heading text-brand-700 rounded border border-brand/30 px-1.5 py-px text-[11px] tracking-[0.1em]">
              {advancedCount}칸 입력됨
            </span>
          )}
          {/* 접힌 채로도 이 칸들이 무엇인지 알려 준다 — 열어 봐야 아는 서랍이 되지 않게. */}
          <span className="ml-auto hidden text-[11px] text-faint sm:inline">
            통합 검색어와 함께 9개 항목을 각각 검색합니다
          </span>
        </summary>

        <div className="flex flex-col gap-3 border-t border-line-soft px-3.5 pt-4 pb-3.5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ADVANCED_FIELDS.map((field) => (
              <label key={field} className="flex flex-col gap-1 text-[12px] text-muted">
                {ADVANCED_FIELD_LABEL[field]}
                <input
                  className="field"
                  type="text"
                  placeholder={ADVANCED_FIELD_PLACEHOLDER[field]}
                  value={draft.advanced[field]}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      advanced: { ...prev.advanced, [field]: e.target.value },
                    }))
                  }
                />
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn btn-primary">
              검색
            </button>
            {/* 비우기만 하고 끝내면 화면과 결과가 어긋난다 — 비운 상태로 곧바로 다시 검색한다. */}
            <button
              type="button"
              className="btn btn-secondary"
              disabled={advancedCount === 0}
              onClick={() => submit({ keyword: draft.keyword, advanced: EMPTY_ADVANCED })}
            >
              고급검색 비우기
            </button>
            <span className="text-[11px] text-faint">비우면 곧바로 다시 검색합니다</span>
          </div>
        </div>
      </details>
    </form>
  );
}
