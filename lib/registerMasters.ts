/**
 * 등록·수정 폼을 그리는 데 드는 서버 값(선택지 · 라벨 · 제약)을 한 번에 받는다.
 *
 * 선택지 다섯(카테고리·업종·인증·국가·지역)은 없으면 폼을 그릴 수 없어 하나라도 실패하면 전체 실패다.
 * 메타 셋(라벨·제약·업로드)은 실패해도 폼은 열린다 — 숫자 없이 그리고, 최종 판정은 서버가 한다.
 */

import { getFormConstraints, getOptions, getUploadConstraints, indexConstraints, type ConstraintIndex } from "@/lib/meta";
import { getCategories, getCertifications, getCountries, getDomesticRegions, getIndustries } from "@/lib/options";
import type { RegisterMasters } from "@/lib/register";

/**
 * @param constraintForms 제약을 읽을 폼 슬러그들. **뒤의 것이 앞의 것을 덮는다.**
 *   수정 화면은 `["my-company-create", "company-update"]` 를 넘긴다 — 수정 폼 제약(company-update)에는 본체 칸만
 *   있고 컬렉션 개수 한도가 없어서(컬렉션은 각자의 PUT 에 제약이 있다), 컬렉션은 등록 폼 값을 쓰고 본체 칸은
 *   수정 폼 값으로 덮는다. 지금은 두 폼이 같은 상수를 쓰지만 계약이 그걸 약속하지는 않는다.
 */
export async function loadRegisterMasters(constraintForms: string[], signal?: AbortSignal): Promise<RegisterMasters> {
  const [categories, industries, certifications, countries, regions] = await Promise.all([
    getCategories(signal),
    getIndustries(signal),
    getCertifications(signal),
    getCountries(signal),
    getDomesticRegions(signal),
  ]);
  const [[options, upload], constraints] = await Promise.all([
    Promise.allSettled([getOptions(signal), getUploadConstraints(signal)] as const),
    Promise.allSettled(constraintForms.map((form) => getFormConstraints(form, signal))),
  ]);

  let index: ConstraintIndex | null = null;
  for (const result of constraints) {
    if (result.status !== "fulfilled") continue;
    index = new Map([...(index ?? []), ...indexConstraints(result.value)]);
  }

  return {
    categories,
    industries,
    certifications,
    countries,
    regions,
    options: options.status === "fulfilled" ? options.value : {},
    constraints: index,
    upload: upload.status === "fulfilled" ? upload.value : null,
  };
}
