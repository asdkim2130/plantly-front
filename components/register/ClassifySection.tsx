"use client";

/**
 * 등록 폼 E — 분류(카테고리 3단 트리) · 산업군 · 태그.
 *
 * 카테고리는 대·중·소 어느 단계든 고를 수 있다. 검색 패싯이 **후손 서브트리까지** 잡으므로 대분류만
 * 골라도 그 아래 회사로 검색된다 — 그래서 상위를 골라도 하위를 따라 켜지 않는다(목록 화면과 같은 판단).
 * 개수 한도는 등급이 정하고(limits.maxCategories) 인증 응답이 알려 준다.
 */

import { useMemo, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { ChipInput, ErrorLine, FieldHead, RemovableChip, Section } from "@/components/register/parts";
import { ruleValue } from "@/lib/meta";
import { sectionId, type SectionProps } from "@/lib/register";
import type { CategoryPublicResponse } from "@/types/api";

type CategoryEntry = { node: CategoryPublicResponse; path: string[] };

/** id → (노드, 조상 이름 경로). 칩의 "제조 솔루션 › 금형" 접두어를 만들 때 쓴다 */
function indexCategories(roots: CategoryPublicResponse[]) {
  const index = new Map<number, CategoryEntry>();
  const walk = (node: CategoryPublicResponse, path: string[]) => {
    index.set(node.id, { node, path });
    node.children.forEach((child) => walk(child, [...path, node.categoryName]));
  };
  roots.forEach((root) => walk(root, []));
  return index;
}

export default function ClassifySection({ form, update, errors, masters, limits, removed }: SectionProps) {
  const roots = masters.categories;
  const index = useMemo(() => indexCategories(roots), [roots]);

  // 지금 펼쳐 둔 대분류·중분류. 처음에는 첫 줄을 펼쳐 둬서 빈 칸 두 개로 시작하지 않는다.
  const [majorId, setMajorId] = useState<number | null>(null);
  const [midId, setMidId] = useState<number | null>(null);
  const major = roots.find((node) => node.id === majorId) ?? roots[0];
  const mid = major?.children.find((node) => node.id === midId) ?? major?.children[0];

  const selected = form.categoryIds;
  const full = selected.length >= limits.maxCategories;

  function toggle(id: number) {
    update((f) =>
      f.categoryIds.includes(id)
        ? { categoryIds: f.categoryIds.filter((x) => x !== id) }
        : f.categoryIds.length < limits.maxCategories
          ? { categoryIds: [...f.categoryIds, id] }
          : {},
    );
  }

  const rowClass = (node: CategoryPublicResponse, active: boolean) => {
    const on = selected.includes(node.id);
    return `rck ${on ? "on" : !on && full ? "dis" : ""} ${active ? "act" : ""}`;
  };

  /** 대·중분류 줄: 상자는 고르기, 글자는 펼치기 — 한 줄이 두 가지 일을 하면 펼치려다 고르게 된다 */
  const branchRow = (node: CategoryPublicResponse, active: boolean, open: () => void) => {
    const on = selected.includes(node.id);
    return (
      <div key={node.id} className={rowClass(node, active)}>
        <button
          type="button"
          className="bx"
          role="checkbox"
          aria-checked={on}
          aria-label={`${node.categoryName} 선택`}
          disabled={!on && full}
          onClick={() => toggle(node.id)}
        >
          <CheckIcon size={9} />
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={open} aria-expanded={active}>
          {node.categoryName}
        </button>
        {node.children.length > 0 && (
          <span aria-hidden className="text-xs text-faint">
            ›
          </span>
        )}
      </div>
    );
  };

  const maxIndustries = ruleValue(masters.constraints, "industryIds", "maxItems");
  const industriesFull = maxIndustries !== undefined && form.industryIds.length >= maxIndustries;

  return (
    <Section id={sectionId("E")} letter="E" title="분류" sub="검색 필터 · 분류와 업종에 쓰입니다">
      <div className="flex flex-col gap-1.5">
        <FieldHead label="카테고리" count={selected.length} max={limits.maxCategories} />
        <p className="fhint">
          대분류, 중분류, 소분류 중 원하는 단계까지 선택할 수 있습니다. 카테고리명을 클릭하면 하위 분류가
          표시되며, 소분류까지 선택하지 않아도 됩니다.
        </p>
        <div className="flex min-h-[26px] flex-wrap gap-1.5">
          {selected.map((id) => {
            const entry = index.get(id);
            const gone = removed.categoryIds?.get(id);
            return (
              <RemovableChip
                key={id}
                gone={!entry}
                prefix={entry?.path.join(" › ")}
                onRemove={() => update((f) => ({ categoryIds: f.categoryIds.filter((x) => x !== id) }))}
              >
                {entry ? entry.node.categoryName : `${gone ?? `#${id}`} · 삭제됨`}
              </RemovableChip>
            );
          })}
        </div>
        {full && (
          <span className="fhint text-brand-700">
            최대 {limits.maxCategories}개까지 선택할 수 있습니다. 다른 항목을 선택하려면 기존 항목 중 하나를
            삭제해 주세요.
          </span>
        )}
        <div className="rtree sm:grid-cols-3">
          <div className="rcol">
            <div className="rcolh">대분류</div>
            {roots.map((node) =>
              branchRow(node, node.id === major?.id, () => {
                setMajorId(node.id);
                setMidId(null);
              }),
            )}
          </div>
          <div className="rcol">
            <div className="rcolh">{major ? `${major.categoryName} · 중분류` : "중분류"}</div>
            {major?.children.map((node) => branchRow(node, node.id === mid?.id, () => setMidId(node.id)))}
            {major && major.children.length === 0 && <span className="fhint px-2 py-1.5">하위 분류가 없습니다</span>}
          </div>
          <div className="rcol">
            <div className="rcolh">{mid ? `${mid.categoryName} · 소분류` : "소분류"}</div>
            {mid?.children.map((node) => {
              const on = selected.includes(node.id);
              return (
                <button
                  key={node.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={!on && full}
                  className={rowClass(node, false)}
                  onClick={() => toggle(node.id)}
                >
                  <span className="bx">
                    <CheckIcon size={9} />
                  </span>
                  {node.categoryName}
                </button>
              );
            })}
            {(!mid || mid.children.length === 0) && <span className="fhint px-2 py-1.5">하위 분류가 없습니다</span>}
          </div>
        </div>
        <ErrorLine message={errors.categoryIds} />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldHead label="산업군" count={form.industryIds.length} max={maxIndustries} />
        <div className="flex flex-wrap gap-1.5">
          {masters.industries.map((industry) => {
            const on = form.industryIds.includes(industry.id);
            const dis = !on && industriesFull;
            return (
              <button
                key={industry.id}
                type="button"
                aria-pressed={on}
                disabled={dis}
                className={`chip ${on ? "on" : dis ? "dis" : ""}`}
                onClick={() =>
                  update((f) => ({
                    industryIds: f.industryIds.includes(industry.id)
                      ? f.industryIds.filter((x) => x !== industry.id)
                      : [...f.industryIds, industry.id],
                  }))
                }
              >
                {industry.industryName}
              </button>
            );
          })}
          {form.industryIds
            .filter((id) => !masters.industries.some((industry) => industry.id === id))
            .map((id) => (
              <RemovableChip
                key={id}
                gone
                onRemove={() => update((f) => ({ industryIds: f.industryIds.filter((x) => x !== id) }))}
              >
                {removed.industryIds?.get(id) ?? `#${id}`} · 삭제됨
              </RemovableChip>
            ))}
        </div>
        <ErrorLine message={errors.industryIds} />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldHead
          label="태그"
          count={form.tagNames.length}
          max={ruleValue(masters.constraints, "tagNames", "maxItems")}
        />
        <ChipInput
          label="태그 추가"
          values={form.tagNames}
          onChange={(tagNames) => update({ tagNames })}
          max={ruleValue(masters.constraints, "tagNames", "maxItems")}
          maxLength={ruleValue(masters.constraints, "tagNames[]", "maxLength")}
          prefix="#"
          placeholder={`입력 후 Enter${
            ruleValue(masters.constraints, "tagNames[]", "maxLength")
              ? ` · 개당 ${ruleValue(masters.constraints, "tagNames[]", "maxLength")}자`
              : ""
          }`}
        />
        <ErrorLine message={errors.tagNames} />
      </div>
    </Section>
  );
}
