"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import {
  ADVANCED_FIELDS,
  ADVANCED_FIELD_LABEL,
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
      <div className="blueprint flex items-center gap-3 bg-white px-4 py-3">
        <SearchIcon size={18} className="shrink-0 text-brand" />
        <input
          className="srch"
          type="search"
          value={draft.keyword}
          onChange={(e) => setDraft((prev) => ({ ...prev, keyword: e.target.value }))}
          aria-label="기업 통합 검색"
          // 백엔드는 공백으로 나눈 단어를 각각 AND 로 훑는다 — 두 단어가 서로 다른 필드에 있어도 맞는다.
          placeholder="기업명, 솔루션, 태그, 장비명 — 띄어쓴 단어를 모두 포함하는 기업만 나옵니다"
        />
        <button type="submit" className="btn btn-primary px-[22px]">
          검색
        </button>
      </div>

      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="w-fit cursor-pointer text-[13px] text-muted">
          고급검색{advancedCount > 0 && ` · ${advancedCount}칸 입력됨`}
        </summary>

        <div className="blueprint mt-2 flex flex-col gap-3 p-4">
          <p className="text-[12px] text-faint">
            채운 칸은 그 항목에만 부분일치로 걸린다. 통합 검색어와 함께 쓰면 둘 다 만족하는 기업만
            남는다.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ADVANCED_FIELDS.map((field) => (
              <label key={field} className="flex flex-col gap-1 text-[12px] text-muted">
                {ADVANCED_FIELD_LABEL[field]}
                <input
                  className="field"
                  type="text"
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

          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>
      </details>
    </form>
  );
}
