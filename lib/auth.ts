/**
 * 인증 API 호출. 회사 API(lib/companies.ts)와 같은 모양으로 도메인마다 파일을 나눈다.
 *
 * 로그인/로그아웃은 **세션이 바뀌는 요청**이라 다른 호출과 다르게 뒤처리가 하나 붙는다 —
 * `resetCsrf()`. 서버가 세션 고정 공격을 막으려고 인증 직후 세션 ID를 교체하므로,
 * 그 전에 받아 캐시해 둔 CSRF 토큰은 새 세션의 것이 아니다. 버리지 않으면 로그인 직후의
 * 첫 쓰기 요청이 403 으로 한 번 튕기고 재시도된다(lib/api.ts 가 복구는 해 주지만 왕복이 두 번이다).
 */

import { api, request, resetCsrf } from "@/lib/api";
import type { LoginRequest, LoginResponse, ProfileResponse } from "@/types/api";

/**
 * 로그인. 성공하면 세션 쿠키(JSESSIONID)가 심기고, `remember` 면 30일 쿠키가 하나 더 붙는다.
 *
 * 실패는 상태 코드로 갈린다 — 401 은 이메일/비밀번호 불일치, 403 은 정지·탈퇴 계정,
 * 400 은 형식 위반(비밀번호 길이·특수문자). **셋 다 `ApiError.message` 에 서버가 쓴
 * 한국어 문장이 들어 있으므로 화면은 그걸 그대로 보여주면 된다.**
 *
 * 여기서 401 을 "로그인 필요"로 해석하면 안 된다. 다른 화면에서는 그 뜻이 맞지만
 * 로그인 요청의 401 은 "방금 입력한 자격증명이 틀렸다"는 뜻이다 — 로그인 페이지로 되돌리면 무한 루프다.
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  // api.post 대신 request 를 직접 부르는 건 retryOnForbidden 을 끄기 위해서다 —
  // 이 엔드포인트의 403 은 "CSRF 가 낡았다"가 아니라 "정지된 계정이다"라는 답이라,
  // 재시도하면 실패한 로그인이 서버에 두 번 도달할 뿐 결과는 같다.
  const response = await request<LoginResponse>("/auth/login", {
    method: "POST",
    body: credentials,
    retryOnForbidden: false,
  });
  resetCsrf();
  return response;
}

/**
 * 로그아웃. 컨트롤러가 아니라 Spring Security 의 LogoutFilter 가 받는다(그래서 백엔드에 메서드가 없다).
 * 세션 무효화 + JSESSIONID·remember-me 쿠키 제거까지 서버가 하고, 본문 없는 200 을 준다.
 */
export async function logout(): Promise<void> {
  await api.post<void>("/auth/logout");
  resetCsrf();
}

/**
 * 현재 로그인한 사용자. **비로그인이면 401 을 던진다** — 이 호출에서는 그게 오류가 아니라
 * "로그인 안 됨"이라는 정상적인 답이다. 부르는 쪽(SessionProvider)이 그렇게 해석한다.
 */
export function getMe(signal?: AbortSignal): Promise<ProfileResponse> {
  return api.get<ProfileResponse>("/users/me", undefined, signal);
}
