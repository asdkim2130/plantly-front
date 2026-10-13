// 관리자 전용 회사 API. 전부 서버가 @PreAuthorize("hasRole('ADMIN')") 로 막는다 — MEMBER 가 부르면 403.
// 소유자 경로(lib/companies.ts)와 이름이 겹치는 동작도 경로가 달라(/admin/...) 소유 여부와 무관하게 모든 회사에 쓴다.

import { api } from "@/lib/api";
import type {
  AdminCompanyFlagsRequest,
  AdminCompanyQuery,
  AdminCompanySubscriptionResponse,
  AdminCompanySummary,
  CompanyDetailResponse,
  CompanyVisibility,
  PageResponse,
} from "@/types/api";

/** 관리자 목록. 필터가 없으면 삭제·비공개까지 전부, 최신 등록순. */
export function listAdminCompanies(query: AdminCompanyQuery = {}, signal?: AbortSignal) {
  return api.get<PageResponse<AdminCompanySummary>>("/admin/companies", { ...query }, signal);
}

/** 관리자 상세. 소유자 상세와 같은 응답(profile + meta)이고, 삭제된 회사도 열린다. */
export function getAdminCompany(id: number, signal?: AbortSignal) {
  return api.get<CompanyDetailResponse>(`/admin/companies/${id}`, undefined, signal);
}

/** 관리자 구독 조회. 소유자용과 달리 한도(limits)는 없다. */
export function getAdminSubscription(id: number, signal?: AbortSignal) {
  return api.get<AdminCompanySubscriptionResponse>(`/admin/companies/${id}/subscription`, undefined, signal);
}

/** 운영 플래그(에디터 선정·추천·스팟라이트 고정). 보낸 키만 목표값으로 바뀐다(멱등). */
export function changeAdminFlags(id: number, flags: AdminCompanyFlagsRequest) {
  return api.patch<void>(`/admin/companies/${id}/flags`, flags);
}

/** 공개/비공개 — 목표 상태 지정(멱등) */
export function changeAdminVisibility(id: number, visibility: CompanyVisibility) {
  return api.patch<void>(`/admin/companies/${id}/visibility`, { visibility });
}

/** 소프트 삭제. 복구(restoreAdminCompany)로 되살린다. */
export function deleteAdminCompany(id: number) {
  return api.delete<void>(`/admin/companies/${id}`);
}

export function restoreAdminCompany(id: number) {
  return api.post<void>(`/admin/companies/${id}/restore`);
}
