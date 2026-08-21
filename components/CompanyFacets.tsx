"use client";

import { useState } from "react";
import { CERTIFICATION_TYPE_LABEL, CERTIFICATION_TYPE_ORDER } from "@/lib/labels";
import type { FacetKey } from "@/lib/companySearchParams";
import type {
  CategoryPublicResponse,
  CertificationPublicResponse,
  IndustryPublicResponse,
} from "@/types/api";

type Props = {
  categories: CategoryPublicResponse[];
  industries: IndustryPublicResponse[];
  certifications: CertificationPublicResponse[];
  /** 지금 켜져 있는 id 들. 주소에서 읽은 값이라 화면이 따로 들고 있지 않는다. */
  selected: Record<FacetKey, number[]>;
  onToggle: (key: FacetKey, id: number) => void;
  onClear: (key: FacetKey) => void;
  /** 선택지를 아직 못 받았는지. 못 받아도 결과는 볼 수 있어야 해서 이 칸만 자리표시자로 둔다. */
  loading: boolean;
};

/**
 * 목록 화면의 패싯 필터 — 분류 / 업종 / 인증.
 *
 * 누르는 즉시 반영된다(검색 폼과 다르다). 체크박스는 중간 상태가 그대로 의미를 갖는 조건이라
 * "적용" 버튼을 한 번 더 누르게 할 이유가 없다.
 *
 * 세 축의 결합 규칙이 서로 달라서 묶음마다 한 줄로 적어 둔다 — 백엔드 계약이 그렇다.
 *  - 분류: 고른 것 중 하나만 맞아도 되고(OR), **후손 서브트리까지** 잡힌다(대분류로 걸면 소분류만 단 회사도 나온다).
 *  - 업종: 고른 것 중 하나만 맞으면 된다(OR).
 *  - 인증: 같은 묶음 안에서는 OR 이지만 **묶음끼리는 AND** 다(경영시스템 하나 + 시장진입 하나를 고르면 둘 다 가진 회사만).
 */
export default function CompanyFacets({
  categories,
  industries,
  certifications,
  selected,
  onToggle,
  onClear,
  loading,
}: Props) {
  const certificationGroups = CERTIFICATION_TYPE_ORDER.map((type) => ({
    type,
    items: certifications.filter((certification) => certification.type === type),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="분류"
        note="고른 분류의 하위까지 함께 찾습니다"
        count={selected.categoryIds.length}
        onClear={() => onClear("categoryIds")}
        loading={loading}
      >
        <CategoryTree
          nodes={categories}
          selected={selected.categoryIds}
          onToggle={(id) => onToggle("categoryIds", id)}
        />
      </Section>

      <Section
        title="업종"
        note="하나만 맞아도 결과에 나옵니다"
        count={selected.industryIds.length}
        onClear={() => onClear("industryIds")}
        loading={loading}
      >
        <div className="max-h-[260px] overflow-y-auto pr-1">
          {industries.map((industry) => (
            <Check
              key={industry.id}
              label={industry.industryName}
              checked={selected.industryIds.includes(industry.id)}
              onChange={() => onToggle("industryIds", industry.id)}
            />
          ))}
        </div>
      </Section>

      <Section
        title="인증"
        note="묶음 안에서는 하나만, 묶음끼리는 모두 만족해야 합니다"
        count={selected.certificationIds.length}
        onClear={() => onClear("certificationIds")}
        loading={loading}
      >
        <div className="flex max-h-[320px] flex-col gap-3 overflow-y-auto pr-1">
          {certificationGroups.map((group) => (
            <div key={group.type}>
              <p className="kick mb-1">{CERTIFICATION_TYPE_LABEL[group.type]}</p>
              {group.items.map((certification) => (
                <Check
                  key={certification.id}
                  label={certification.certificationName}
                  checked={selected.certificationIds.includes(certification.id)}
                  onChange={() => onToggle("certificationIds", certification.id)}
                />
              ))}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  note,
  count,
  onClear,
  loading,
  children,
}: {
  title: string;
  note: string;
  count: number;
  onClear: () => void;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5 border-b border-line-soft pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[15px]">{title}</h3>
        {count > 0 && <span className="text-brand-700 text-[12px]">{count}개 선택</span>}
        {count > 0 && (
          <button
            type="button"
            className="ml-auto text-[12px] text-faint underline underline-offset-2"
            onClick={onClear}
          >
            지우기
          </button>
        )}
      </div>
      <p className="mb-1 text-[12px] text-faint">{note}</p>
      {loading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="skel h-3.5 w-[70%]" />
          ))}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/**
 * 분류 트리(depth 1~3). 자식이 있는 노드는 접었다 펼 수 있다.
 *
 * 펼침은 사용자가 누른 것을 우선하고, 누른 적이 없으면 "이 아래에 켜진 항목이 있는가"로 정한다 —
 * 주소로 들어온 조건(예: 메인의 대분류 카드가 넘긴 소분류)이 접힌 채로 숨어 있으면
 * 어디에 걸렸는지 알 수 없다.
 */
function CategoryTree({
  nodes,
  selected,
  onToggle,
  depth = 0,
}: {
  nodes: CategoryPublicResponse[];
  selected: number[];
  onToggle: (id: number) => void;
  depth?: number;
}) {
  const [opened, setOpened] = useState<Record<number, boolean>>({});

  return (
    <div className={depth > 0 ? "ml-[18px] border-l border-line-soft pl-2" : undefined}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const open = opened[node.id] ?? containsSelected(node, selected);

        return (
          <div key={node.id}>
            <div className="flex items-start gap-1">
              {hasChildren ? (
                <button
                  type="button"
                  aria-label={`${node.categoryName} 하위 분류 ${open ? "접기" : "펼치기"}`}
                  aria-expanded={open}
                  className="mt-[3px] w-3.5 shrink-0 text-[11px] text-faint"
                  onClick={() => setOpened((prev) => ({ ...prev, [node.id]: !open }))}
                >
                  {open ? "-" : "+"}
                </button>
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              <Check
                label={node.categoryName}
                checked={selected.includes(node.id)}
                onChange={() => onToggle(node.id)}
              />
            </div>
            {hasChildren && open && (
              <CategoryTree
                nodes={node.children}
                selected={selected}
                onToggle={onToggle}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 이 노드 아래(자기 자신 포함)에 켜진 항목이 있는지. 트리가 작아 매 렌더 훑어도 부담이 없다. */
function containsSelected(node: CategoryPublicResponse, selected: number[]): boolean {
  return (
    selected.includes(node.id) ||
    node.children.some((child) => containsSelected(child, selected))
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 py-[3px] text-[13px] text-ink">
      <input
        type="checkbox"
        className="mt-[3px] shrink-0 accent-brand"
        checked={checked}
        onChange={onChange}
      />
      <span className="min-w-0 break-keep">{label}</span>
    </label>
  );
}
