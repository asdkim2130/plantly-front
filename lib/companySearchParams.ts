/**
 * 목록/검색 화면(`/companies`)의 조건을 주소창과 주고받는다.
 *
 * **정본은 URL 이다.** 화면은 조건을 state 로 들고 있지 않고 `useSearchParams()` 로 읽어 그리며,
 * 조건이 바뀌면 state 를 고치는 대신 새 주소로 이동한다. 그래야 새로고침·뒤로가기·링크 공유가
 * 따로 만들지 않아도 따라온다(메인 화면은 아직 state 라 새로고침하면 조건이 사라진다 —
 * 그 차이가 이 파일이 있는 이유다).
 *
 * URL 파라미터 이름은 백엔드 쿼리 파라미터 이름과 **같게 유지한다**(`CompanySearchQuery`).
 * 이름을 따로 두면 화면 ↔ URL ↔ API 사이에서 세 번 옮겨 적어야 하고, 계약이 바뀔 때 조용히 어긋난다.
 */

import type { CompanySearchQuery } from "@/types/api";

/**
 * 고급검색 필드. 통합 `keyword` 가 도큐먼트 전체를 훑는 것과 달리 **지정한 필드에만** 부분일치한다.
 * 백엔드 `CompanySearchCriteria.AdvancedText` 와 1:1 이다(순서도 그쪽 정의 순서를 따른다).
 */
export const ADVANCED_FIELDS = [
  "companyName",
  "introTitle",
  "content",
  "ceoName",
  "address",
  "detailAddress",
  "reference",
  "equipment",
  "material",
] as const;

export type AdvancedField = (typeof ADVANCED_FIELDS)[number];

/**
 * 고급검색 칸의 라벨. 필드 이름이 곧 컬럼 이름이라 그대로 보여주면 무엇을 찾는지 알 수 없다.
 * `reference` 는 한 필드가 세 컬럼(프로젝트명·성과·협력사)을 함께 훑으므로 라벨도 셋을 적는다.
 */
export const ADVANCED_FIELD_LABEL: Record<AdvancedField, string> = {
  companyName: "기업명",
  introTitle: "한 줄 소개",
  content: "상세 소개",
  ceoName: "대표자명",
  address: "주소",
  detailAddress: "상세 주소",
  reference: "프로젝트 · 성과 · 협력사",
  equipment: "보유 장비",
  material: "취급 소재",
};

/** 패싯(ID 로 거르는 조건). 차원 안에서는 OR 이고 차원끼리는 AND 다. */
export const FACET_KEYS = ["categoryIds", "industryIds", "certificationIds"] as const;

export type FacetKey = (typeof FACET_KEYS)[number];

export type CompanySearchState = {
  keyword: string;
  advanced: Record<AdvancedField, string>;
  categoryIds: number[];
  industryIds: number[];
  certificationIds: number[];
  /** 1-based. 백엔드도 `?page=1` 이 첫 페이지다(one-indexed-parameters=true). */
  page: number;
};

export const EMPTY_ADVANCED: Record<AdvancedField, string> = Object.fromEntries(
  ADVANCED_FIELDS.map((field) => [field, ""]),
) as Record<AdvancedField, string>;

/** 주소에서 조건을 읽어 낸다. 주소창에는 아무 문자열이나 들어올 수 있으므로 전부 걸러 받는다. */
export function parseCompanySearch(params: URLSearchParams): CompanySearchState {
  const advanced = Object.fromEntries(
    ADVANCED_FIELDS.map((field) => [field, (params.get(field) ?? "").trim()]),
  ) as Record<AdvancedField, string>;

  return {
    keyword: (params.get("keyword") ?? "").trim(),
    advanced,
    categoryIds: parseIds(params, "categoryIds"),
    industryIds: parseIds(params, "industryIds"),
    certificationIds: parseIds(params, "certificationIds"),
    page: parsePage(params.get("page")),
  };
}

/** 같은 이름이 여러 번 실려 오는 형태(`?categoryIds=1&categoryIds=2`). 양의 정수만 남기고 중복은 없앤다. */
function parseIds(params: URLSearchParams, key: FacetKey): number[] {
  const ids = new Set<number>();
  for (const raw of params.getAll(key)) {
    const id = Number(raw);
    if (Number.isInteger(id) && id > 0) ids.add(id);
  }
  return [...ids];
}

function parsePage(raw: string | null): number {
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/**
 * 조건을 다시 주소로 만든다(`?keyword=…&categoryIds=1&categoryIds=2`).
 *
 * 빈 값과 `page=1` 은 싣지 않는다 — 아무 조건 없는 상태의 주소가 그냥 `/companies` 라야
 * 링크를 복사했을 때 군더더기가 붙지 않는다.
 */
export function toQueryString(state: CompanySearchState): string {
  const params = new URLSearchParams();

  if (state.keyword) params.set("keyword", state.keyword);
  for (const field of ADVANCED_FIELDS) {
    if (state.advanced[field]) params.set(field, state.advanced[field]);
  }
  for (const key of FACET_KEYS) {
    for (const id of state[key]) params.append(key, String(id));
  }
  if (state.page > 1) params.set("page", String(state.page));

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * API 호출용 쿼리로 옮긴다. 빈 문자열·빈 배열을 따로 걷어내지 않는 건 `lib/api.ts` 의
 * `buildQuery` 가 이미 그렇게 하기 때문이다(빈 값은 파라미터 자체가 빠진다).
 */
export function toSearchQuery(state: CompanySearchState, size: number): CompanySearchQuery {
  return {
    keyword: state.keyword,
    ...state.advanced,
    categoryIds: state.categoryIds,
    industryIds: state.industryIds,
    certificationIds: state.certificationIds,
    page: state.page,
    size,
  };
}

/** 조건이 하나라도 걸려 있는지. 빈 상태 안내 문구와 "조건 지우기" 노출을 가른다. */
export function hasCondition(state: CompanySearchState): boolean {
  return Boolean(
    state.keyword ||
      ADVANCED_FIELDS.some((field) => state.advanced[field]) ||
      FACET_KEYS.some((key) => state[key].length > 0),
  );
}

/** 패싯 체크박스 하나를 켜고 끈다. 원본을 건드리지 않고 새 배열을 돌려준다. */
export function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id];
}
