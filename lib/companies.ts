/**
 * 회사 API 호출. 화면은 이 함수들만 부르고 경로·쿼리 조립은 여기서 끝낸다.
 * 새 엔드포인트를 붙일 때도 같은 모양(타입 명시 + 한 줄 주석)으로 늘린다.
 */

import { api } from "@/lib/api";
import type {
  CompanyDraftResponse,
  CompanyPublicResponse,
  CompanySearchQuery,
  CompanyShowcaseResponse,
  CompanyStatsResponse,
  CompanySubscriptionResponse,
  CompanySummary,
  CompanyVerificationRequest,
  CompanyVerificationResponse,
  IdResponse,
  MyCompanyCreateRequest,
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

// ===== 회사 등록(자가등록) =====
// 순서: 사업자 인증 → (초안 이어쓰기) → 작성(자동저장) → 발행. 신원 3종은 인증본에서만 온다.

/**
 * 국세청 사업자 확인. 통과하면 verificationId 와 이 회사가 받을 등급·한도가 온다.
 *
 * 실패는 `ApiError.code` 로 가른다 — 같은 400 이라도 사용자가 고칠 것이 다르다.
 * `VERIFICATION_MISMATCH`(입력 불일치) · `VERIFICATION_NOT_REGISTERED` · `VERIFICATION_SUSPENDED` ·
 * `VERIFICATION_CLOSED` · `BUSINESS_NUMBER_TAKEN`(409, 이미 등록됨) · `VERIFICATION_LIMIT_EXCEEDED`(429) ·
 * `VERIFICATION_UNAVAILABLE`(503, 국세청 지연 — 입력 문제가 아니다) · `BUSINESS_NUMBER_INVALID_FORMAT`.
 */
export function verifyBusiness(request: CompanyVerificationRequest) {
  return api.post<CompanyVerificationResponse>("/companies/verification", request);
}

/**
 * 이 사업자번호로 작성 중인 초안. 없으면 404(`DRAFT_NOT_FOUND`) — 오류가 아니라 "새로 쓴다"는 답이다.
 * 이 번호로 인증받은 이력이 없으면 400(`VERIFICATION_NOT_FOUND`).
 */
export function getDraft(businessNumber: string, signal?: AbortSignal) {
  return api.get<CompanyDraftResponse>(`/companies/drafts/${businessNumber}`, undefined, signal);
}

/**
 * 자동저장(upsert). 서버가 내용을 검증하지 않아 반쯤 쓴 값도 저장된다.
 * 그래도 실패하는 두 경우는 조용히 삼키면 안 된다 — `VERIFICATION_ALREADY_USED`(이미 등록된 번호)와
 * `VERIFICATION_NOT_FOUND`(인증 이력 없음).
 */
export function saveDraft(businessNumber: string, payload: MyCompanyCreateRequest) {
  return api.put<void>(`/companies/drafts/${businessNumber}`, payload);
}

/** 초안 폐기. 없어도 성공(멱등). 발행이 성공하면 서버가 알아서 지우므로 "작성 포기"에서만 부른다. */
export function deleteDraft(businessNumber: string) {
  return api.delete<void>(`/companies/drafts/${businessNumber}`);
}

/**
 * 발행. 본문은 초안 payload 와 같은 모양이고, verificationId 는 **지금 유효한 값**으로 덮어써 보낸다.
 * 인증이 시간으로 만료됐어도 서버가 발행 직전에 국세청에 다시 물어 되살린다(사용자에게 다시 받을 값이 없다).
 * 검증 실패는 `errors[]` 에 전부 담겨 온다(폼 순서).
 */
export function createCompany(payload: MyCompanyCreateRequest) {
  return api.post<IdResponse>("/companies", payload);
}
