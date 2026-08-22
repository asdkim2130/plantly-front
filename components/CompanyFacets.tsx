"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/icons";
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
  /** 세 축을 한꺼번에 비운다. 검색어는 건드리지 않는다(그건 남색 띠의 "조건 모두 지우기" 몫). */
  onClearAll: () => void;
  /** 선택지를 아직 못 받았는지. 못 받아도 결과는 볼 수 있어야 해서 이 칸만 자리표시자로 둔다. */
  loading: boolean;
  /** 선택지 요청이 실패했는지. 자리표시자 대신 이유와 "다시 시도"를 보여 준다. */
  failed: boolean;
  onRetry: () => void;
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
 *
 * 인증만 상자로 묶고 사이에 AND 를 적는 것도 그래서다 — 문구로만 알리면 같은 생김새의 체크박스가
 * 정반대로 움직이는 걸 눌러 보고 나서야 알게 된다.
 */
export default function CompanyFacets({
  categories,
  industries,
  certifications,
  selected,
  onToggle,
  onClear,
  onClearAll,
  loading,
  failed,
  onRetry,
}: Props) {
  const certificationGroups = CERTIFICATION_TYPE_ORDER.map((type) => ({
    type,
    items: certifications.filter((certification) => certification.type === type),
  })).filter((group) => group.items.length > 0);

  const total =
    selected.categoryIds.length + selected.industryIds.length + selected.certificationIds.length;

  return (
    <div>
      {/* 결과 머리(`검색 결과` h2 23px · pb-3)와 글자 크기·아래 여백을 맞춘다 — 두 단의 구분선이
          같은 높이에서 만나야 사이드바와 결과가 한 줄에서 시작하는 것처럼 읽힌다. */}
      <div className="mb-3.5 flex items-baseline gap-2 border-b border-line pb-3">
        <h2 className="text-[23px]">필터</h2>
        <span className="text-[11px] text-faint">분류 · 업종 · 인증</span>
        {total > 0 && (
          <button
            type="button"
            className="ml-auto text-[11px] text-faint underline underline-offset-2 hover:text-brand"
            onClick={onClearAll}
          >
            전체 지우기
          </button>
        )}
      </div>

      {failed ? (
        <p className="text-[12px] leading-[1.6] text-muted">
          필터 선택지를 불러오지 못했습니다. 목록은 그대로 볼 수 있습니다.{" "}
          <button
            type="button"
            className="text-brand-700 underline underline-offset-2"
            onClick={onRetry}
          >
            다시 시도
          </button>
        </p>
      ) : (
        <div>
          <Group
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
          </Group>

          <Group
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
          </Group>

          <Group
            title="인증"
            note="묶음 안에서는 하나만, 묶음끼리는 모두 만족해야 합니다"
            count={selected.certificationIds.length}
            onClear={() => onClear("certificationIds")}
            loading={loading}
          >
            {/* 높이를 막지 않는다 — 묶음 상자와 사이의 AND 가 잘리면 "묶음끼리 AND" 라는
                이 축의 규칙이 화면에서 사라진다. 길어지면 페이지째로 내려 본다. */}
            <div>
              {certificationGroups.map((group, i) => (
                <div key={group.type}>
                  {/* 상자와 상자 사이에만 놓는다 — 첫 상자 위의 AND 는 무엇과의 AND 인지 가리키는 데가 없다. */}
                  {i > 0 && (
                    <p className="certand" aria-hidden>
                      <span />
                      AND
                      <span />
                    </p>
                  )}
                  <div className="certbox">
                    <p className="certhd">{CERTIFICATION_TYPE_LABEL[group.type]}</p>
                    {group.items.map((certification) => (
                      <Check
                        key={certification.id}
                        label={certification.certificationName}
                        checked={selected.certificationIds.includes(certification.id)}
                        onChange={() => onToggle("certificationIds", certification.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Group>
        </div>
      )}
    </div>
  );
}

function Group({
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
    <section className="fgrp">
      <div className="fhd">
        <h3 className="n">{title}</h3>
        {count > 0 && (
          <span className="c" aria-label={`${count}개 선택됨`}>
            {count}
          </span>
        )}
        {count > 0 && (
          <button type="button" className="clr" onClick={onClear}>
            지우기
          </button>
        )}
      </div>
      <p className="fnote">{note}</p>
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
 *
 * 깊이는 왼쪽 여백과 inset 세로선으로만 준다(테두리가 아니라 그림자라 줄 높이가 밀리지 않는다).
 */
/**
 * 분류 트리.
 *
 * 줄 하나가 두 가지 일을 나눠 갖는다 — **고르기는 체크 상자에서만, 글자는 `+`/`-` 와 같다**
 * (누르면 하위가 펼쳐지고 다시 누르면 접힌다. 걸리지는 않는다). 평면 목록(업종·인증)의 `Check` 는
 * 줄 전체가 체크라 여기서 쓸 수 없어 markup 을 따로 둔다.
 *
 * 하위가 없는 분류는 글자를 눌러도 아무 일도 하지 않는다 — 펼칠 게 없는데 여기서만 체크가 걸리면
 * 같은 글자가 줄마다 다른 일을 하게 된다.
 *
 * **상위를 켜도 하위 상자는 따라 켜지지 않는다.** 결과로는 이미 따라온다(분류 패싯은 후손
 * 서브트리까지 잡는다) — 그걸 화면에서 한 번 더 그리면 하위 id 를 주소에 싣든(결과는 그대로인 채
 * 주소와 조건 칩만 수십 개로 불어난다) 켜진 채 잠그든 군더더기가 남는다. 상자는 각자 걸린 것만
 * 보여 주고, "하위까지 함께 찾습니다"는 묶음 제목 아래 한 줄이 맡는다.
 */
function CategoryTree({
  nodes,
  selected,
  onToggle,
  depth = 1,
}: {
  nodes: CategoryPublicResponse[];
  selected: number[];
  onToggle: (id: number) => void;
  depth?: number;
}) {
  const [opened, setOpened] = useState<Record<number, boolean>>({});

  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const open = opened[node.id] ?? containsSelected(node, selected);
        const checked = selected.includes(node.id);
        const toggleOpen = () => setOpened((prev) => ({ ...prev, [node.id]: !open }));

        return (
          <div key={node.id}>
            <div className={`ck ${checked ? "on" : ""} d${depth}`}>
              {/*
                펼침 표시(+ / -). 글자 버튼과 하는 일이 같아 보조기기에는 숨긴다 — 같은 줄에서
                같은 동작을 하는 컨트롤이 둘로 읽히지 않게. 이름을 가진 쪽은 글자 버튼이다.
                표시가 세모(▸/▾)가 아닌 이유는 이 크기에서 획이 뭉개져 방향은커녕 표시가 있는지도
                잘 안 보여서다. +/- 는 같은 자리에서 형태가 또렷하고 "누르면 열린다"가 바로 읽힌다.
              */}
              {hasChildren ? (
                <button type="button" className="cv" tabIndex={-1} aria-hidden onClick={toggleOpen}>
                  {open ? "-" : "+"}
                </button>
              ) : (
                <span className="cv" />
              )}

              <label className="ckbox">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => onToggle(node.id)}
                  // 상자만 감싸는 라벨이라 글자가 이름을 대신해 주지 않는다.
                  aria-label={node.categoryName}
                />
                <span className="bx" aria-hidden>
                  <CheckIcon size={9} />
                </span>
              </label>

              {hasChildren ? (
                <button type="button" className="cklabel" aria-expanded={open} onClick={toggleOpen}>
                  {node.categoryName}
                </button>
              ) : (
                <span className="cklabel">{node.categoryName}</span>
              )}
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
    </>
  );
}

/** 이 노드 아래(자기 자신 포함)에 켜진 항목이 있는지. 트리가 작아 매 렌더 훑어도 부담이 없다. */
function containsSelected(node: CategoryPublicResponse, selected: number[]): boolean {
  return (
    selected.includes(node.id) || node.children.some((child) => containsSelected(child, selected))
  );
}

/**
 * 평면 목록(업종·인증)의 체크 줄 하나. **줄 전체가 체크**라 글자를 눌러도 걸린다 —
 * 펼칠 하위가 없으니 글자에 다른 뜻을 줄 데가 없다(분류 트리는 글자가 펼침이라 markup 이 다르다).
 *
 * 네이티브 체크박스는 화면에서 감추고(sr-only) 14px 상자를 직접 그린다 — 브라우저마다 크기와
 * 세로 정렬이 달라 13px 글자 옆에서 줄이 흔들린다. 입력 자체는 살아 있어 키보드·스크린리더·
 * 라벨 클릭은 그대로 동작하고, 포커스 링은 `.ck:has(:focus-visible)` 이 줄 전체에 그린다.
 */
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
    <div className={`ck ${checked ? "on" : ""}`}>
      <label className="ckbody">
        <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
        <span className="bx" aria-hidden>
          <CheckIcon size={9} />
        </span>
        <span className="cktext">{label}</span>
      </label>
    </div>
  );
}
