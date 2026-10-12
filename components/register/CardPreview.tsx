"use client";

/**
 * 오른쪽 카드 미리보기와 "검색 노출" 점검표. 완료 화면도 같은 카드를 쓴다.
 *
 * 카드는 디자인이 그린 "메인 · 검색 목록 카드"의 모양이다 — 커버가 없으면 브랜드 컬러 바탕에
 * 기업명 두 글자를 크게 깔고, 로고가 없으면 같은 두 글자 배지를 쓴다. 바탕색이 회사 지정색(런타임 값)이라
 * 스포트라이트 카드처럼 인라인 style 로만 넘긴다(그 밖의 색은 토큰).
 */

import { CheckIcon, PinIcon } from "@/components/icons";
import {
  DEFAULT_BRAND_COLOR,
  hasReference,
  isBrandColor,
  monogram,
  shortAddress,
  type RegisterForm,
  type RegisterMasters,
} from "@/lib/register";

export function PreviewCard({ form, masters }: { form: RegisterForm; masters: RegisterMasters }) {
  const color = isBrandColor(form.brandColor) ? form.brandColor : DEFAULT_BRAND_COLOR;
  const mono = monogram(form.companyName);
  const name = form.companyName.trim();
  const category = findCategoryName(masters, form.categoryIds[0]);
  const industries = form.industryIds
    .map((id) => masters.industries.find((industry) => industry.id === id)?.industryName)
    .filter(Boolean)
    .slice(0, 2);
  const certs = [
    ...form.certificationIds.map(
      (id) => masters.certifications.find((cert) => cert.id === id)?.certificationName,
    ),
    ...(form.customCertNames ?? []),
  ]
    .filter((value): value is string => !!value && value.trim() !== "")
    .slice(0, 3);
  const place = shortAddress(form.roadAddress);

  return (
    <div className="blueprint flex flex-col bg-white">
      <div className="relative h-[150px] rounded-t-[12px] border-b border-line" style={{ background: color }}>
        <div className="absolute inset-0 overflow-hidden rounded-t-[12px]">
          <span
            aria-hidden
            className="absolute right-3 -bottom-3.5 font-heading text-[96px] leading-none font-semibold text-white/15"
          >
            {mono}
          </span>
          {form.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.coverImageUrl} alt="" className="absolute inset-0 size-full object-cover" />
          )}
        </div>
        <div className="absolute -bottom-6 left-4 grid size-[54px] place-items-center rounded-lg border border-line bg-white">
          {form.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logoUrl} alt="" className="size-[42px] rounded-md object-cover" />
          ) : (
            <span
              className="grid size-[42px] place-items-center rounded-md text-[15px] font-bold text-white"
              style={{ background: color }}
            >
              {mono}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2.5 px-4 pt-[34px] pb-4">
        <div>
          <h3 className={`text-[19px] leading-tight break-keep wrap-anywhere ${name ? "" : "text-faint"}`}>
            {name || "기업명"}
          </h3>
          <p className="mt-1 text-[13px] leading-[1.45] text-muted">
            {form.introTitle.trim() || "한 줄 요약이 여기에 보입니다"}
          </p>
        </div>
        <div className="flex items-center gap-[5px] text-xs text-muted">
          <PinIcon size={13} className="shrink-0" />
          {place || "주소 미등록"}
        </div>
        {(category || form.tagNames.length > 0) && (
          <div className="flex flex-wrap gap-[5px]">
            {category && <span className="tag tagcat">{category}</span>}
            {form.tagNames.slice(0, 2).map((tag) => (
              <span key={tag} className="tag tag-accent">
                #{tag}
              </span>
            ))}
          </div>
        )}
        {(industries.length > 0 || certs.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {industries.map((industry) => (
              <span key={industry} className="ind">
                {industry}
              </span>
            ))}
            {certs.map((cert) => (
              <span key={cert} className="tag tag-neutral">
                {cert}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function findCategoryName(masters: RegisterMasters, id: number | undefined): string | null {
  if (id === undefined) return null;
  const stack = [...masters.categories];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.id === id) return node.categoryName;
    stack.push(...node.children);
  }
  return null;
}

/**
 * 통합 검색이 훑는 아홉 칸. 목록 화면 고급검색의 아홉 칸(companyName · introTitle · content · ceoName ·
 * address · detailAddress · reference · equipment · material)과 같은 목록이다 — 지어낸 점수가 아니라
 * 실제로 검색 도큐먼트에 들어가는 칸을 세는 것이다.
 */
export function SearchCoverage({ form, ceoName }: { form: RegisterForm; ceoName: string }) {
  const items: [string, boolean][] = [
    ["기업명", !!form.companyName.trim()],
    ["한 줄 소개", !!form.introTitle.trim()],
    ["상세 소개", !!form.content.trim()],
    ["대표자명", !!ceoName],
    ["주소", !!form.roadAddress.trim()],
    ["상세 주소", !!form.detailAddress.trim()],
    ["프로젝트 · 성과", hasReference(form.reference)],
    ["보유 장비", form.equipmentNames.length > 0],
    ["취급 소재", form.materialNames.length > 0],
  ];
  const done = items.filter(([, on]) => on).length;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line px-4 py-3.5">
      <div className="flex items-baseline gap-2">
        <span className="kick text-brand-700">검색 노출</span>
        <span className="ml-auto font-heading text-[15px] text-brand-700">
          {done} / {items.length}
        </span>
      </div>
      <p className="text-[13px] leading-normal text-muted">
        기업 정보를 자세히 입력할수록 검색 결과에 노출될 가능성이 높아집니다. 통합 검색은 아래 {items.length}개
        항목을 대상으로 이루어집니다.
      </p>
      <div className="bar h-[5px]">
        <i style={{ width: `${Math.round((done / items.length) * 100)}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-x-2">
        {items.map(([label, on]) => (
          <div key={label} className={`seorow ${on ? "on" : ""}`}>
            <span className="bx">
              <CheckIcon size={8} strokeWidth={4} />
            </span>
            {label}
          </div>
        ))}
      </div>
      <div className="border-t border-line-soft pt-2 text-xs text-faint">
        분류 · 업종 · 인증은 검색 목록의 필터로 쓰입니다.
      </div>
    </div>
  );
}
