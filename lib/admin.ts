// 관리자 전용 회사 API. 전부 서버가 @PreAuthorize("hasRole('ADMIN')") 로 막는다 — MEMBER 가 부르면 403.
// 소유자 경로(lib/companies.ts)와 이름이 겹치는 동작도 경로가 달라(/admin/...) 소유 여부와 무관하게 모든 회사에 쓴다.

import { api } from "@/lib/api";
import type { SaveApi } from "@/lib/companyEdit";
import type {
  AdminCompanyFlagsRequest,
  AdminCompanyQuery,
  AdminCompanySubscriptionResponse,
  AdminCompanySummary,
  CompanyCreateRequest,
  CompanyDetailResponse,
  CompanyUpdateRequest,
  CompanyVisibility,
  IdResponse,
  PageResponse,
} from "@/types/api";

/**
 * 관리자 등록. 국세청 인증 없이 바로 만들어지고, 소유자 미연동 · 등급 한도 면제(ADMIN_EXEMPT)로 시작한다.
 * 검증 실패는 자가등록과 같은 모양(`errors[]`)으로 온다.
 */
export function createAdminCompany(payload: CompanyCreateRequest) {
  return api.post<IdResponse>("/admin/companies", payload);
}

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

/** 본체 부분 수정 — 소유자 PATCH 와 같은 본문(sparse, "" = 비우기). 국세청 인증 회사의 대표자명·개업일자는 관리자도 못 바꾼다. */
export function updateAdminCompany(id: number, patch: CompanyUpdateRequest) {
  return api.patch<void>(`/admin/companies/${id}`, patch);
}

/** 컬렉션 전체 교체 — 경로 끝 이름은 소유자 경로와 같다(lib/companies 의 COLLECTION_FIELD). */
export function replaceAdminCollection(id: number, name: string, items: unknown[]) {
  return api.put<void>(`/admin/companies/${id}/${name}`, items);
}

/** 관리자 수정 화면의 저장 경로 */
export const ADMIN_SAVE_API: SaveApi = {
  update: updateAdminCompany,
  replace: replaceAdminCollection,
  visibility: changeAdminVisibility,
};

/** 소프트 삭제. 복구(restoreAdminCompany)로 되살린다. */
export function deleteAdminCompany(id: number) {
  return api.delete<void>(`/admin/companies/${id}`);
}

export function restoreAdminCompany(id: number) {
  return api.post<void>(`/admin/companies/${id}/restore`);
}
