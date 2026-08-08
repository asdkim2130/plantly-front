/**
 * 검색 패싯·분류 선택지(마스터 데이터) 호출. 전부 비로그인도 부를 수 있다.
 * 회사 API 와 같은 모양으로 도메인마다 파일을 나눈다(lib/companies.ts 참고).
 */

import { api } from "@/lib/api";
import type {
  CategoryPublicResponse,
  CertificationPublicResponse,
  CountryPublicResponse,
  DomesticRegionPublicResponse,
  IndustryPublicResponse,
} from "@/types/api";

/** 카테고리 트리(children 재귀, depth 1~3). */
export function getCategories(signal?: AbortSignal) {
  return api.get<CategoryPublicResponse[]>("/categories", undefined, signal);
}

export function getIndustries(signal?: AbortSignal) {
  return api.get<IndustryPublicResponse[]>("/industries", undefined, signal);
}

export function getCertifications(signal?: AbortSignal) {
  return api.get<CertificationPublicResponse[]>("/certifications", undefined, signal);
}

/** 250건 평면. 대륙 그룹핑이 필요하면 화면에서 continent 로 묶는다. */
export function getCountries(signal?: AbortSignal) {
  return api.get<CountryPublicResponse[]>("/countries", undefined, signal);
}

/** 전국/시도/시군구 트리. 표기는 displayName 을 그대로 쓴다(부모명을 조합하지 않는다). */
export function getDomesticRegions(signal?: AbortSignal) {
  return api.get<DomesticRegionPublicResponse[]>("/domestic-regions", undefined, signal);
}

/** 트리 전체를 깊이 우선으로 펴서 센다 — "솔루션 분류 N개" 같은 집계에 쓴다. */
export function flattenCategories(nodes: CategoryPublicResponse[]): CategoryPublicResponse[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}
