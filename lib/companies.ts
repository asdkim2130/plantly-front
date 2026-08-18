/**
 * 회사 API 호출. 화면은 이 함수들만 부르고 경로·쿼리 조립은 여기서 끝낸다.
 * 새 엔드포인트를 붙일 때도 같은 모양(타입 명시 + 한 줄 주석)으로 늘린다.
 */

import { api } from "@/lib/api";
import type {
  CompanyPublicResponse,
  CompanySearchQuery,
  CompanyShowcaseResponse,
  CompanyStatsResponse,
  CompanySubscriptionResponse,
  CompanySummary,
  PageResponse,
} from "@/types/api";

/** 공개 목록/검색. 익명도 호출 가능(로그인 상태면 카드에 likedByMe/favoritedByMe 가 채워진다). */
export function searchCompanies(query: CompanySearchQuery = {}, signal?: AbortSignal) {
  return api.get<PageResponse<CompanySummary>>("/companies", { ...query }, signal);
}

/**
 * 메인 화면 노출 영역(스포트라이트·추천·최근 등록). 익명도 호출 가능.
 *
 * 목록을 받아 spotlight/featured 플래그로 걸러내면 안 된다 — 노출 자격은 저장된 플래그가 아니라
 * 서버가 구독을 보고 조회 시점에 파생하고(요금제 자격분은 플래그가 false 다), 후보가 자리보다
 * 많아지면 누가 잘리는지도 서버가 정한다.
 *
 * 메인의 기업 데이터는 이 호출 하나로 끝난다. 기본 상태의 격자까지 `latest` 가 담당하므로
 * 목록 API 는 **검색어·패싯이 걸렸거나 전체 브라우즈로 넘어갔을 때만** 부른다
 * (그때는 정렬 규칙이 달라지는 게 맞다 — 이유는 `CompanyShowcaseResponse.latest` 주석).
 */
export function getShowcase(signal?: AbortSignal) {
  return api.get<CompanyShowcaseResponse>("/companies/showcase", undefined, signal);
}

/**
 * 메인 현황 지표(등록 기업·분류·업종·인증 수). 익명도 호출 가능.
 *
 * 이 숫자들을 목록 API 나 선택지 목록에서 세지 않는다 — 개수를 알려고 목록을 만들면 데이터가 늘수록
 * 화면과 무관한 비용이 커지고, 세는 기준이 공개 목록과 갈릴 여지도 생긴다.
 */
export function getCompanyStats(signal?: AbortSignal) {
  return api.get<CompanyStatsResponse>("/companies/stats", undefined, signal);
}

/** 공개 상세. 비공개·삭제된 회사는 404. */
export function getCompany(id: number, signal?: AbortSignal) {
  return api.get<CompanyPublicResponse>(`/companies/${id}`, undefined, signal);
}

/** 내가 등록한 회사(최신순). 로그인 필요. */
export function getMyCompanies(page = 1, size = 20, signal?: AbortSignal) {
  return api.get<PageResponse<CompanySummary>>("/companies/my", { page, size }, signal);
}

/** 내 즐겨찾기(담은 최신순). 로그인 필요. */
export function getMyFavorites(page = 1, size = 20, signal?: AbortSignal) {
  return api.get<PageResponse<CompanySummary>>("/companies/favorites", { page, size }, signal);
}

/** 소유자 전용 구독 조회. 등급 표시는 grade 가 아니라 effectiveGrade 를 쓴다. */
export function getSubscription(companyId: number, signal?: AbortSignal) {
  return api.get<CompanySubscriptionResponse>(`/companies/${companyId}/subscription`, undefined, signal);
}

// 좋아요·즐겨찾기는 토글이 아니라 등록(PUT)/해제(DELETE)로 나뉜 멱등 API 다.
// 응답은 항상 204 — 이미 그 상태여도 성공이므로 중복 클릭을 따로 막을 필요가 없다.
export const like = (companyId: number) => api.put<void>(`/companies/${companyId}/like`);
export const unlike = (companyId: number) => api.delete<void>(`/companies/${companyId}/like`);
export const favorite = (companyId: number) => api.put<void>(`/companies/${companyId}/favorite`);
export const unfavorite = (companyId: number) => api.delete<void>(`/companies/${companyId}/favorite`);
