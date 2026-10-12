/**
 * 백엔드 호출 진입점. 화면 코드는 fetch 를 직접 쓰지 말고 이 파일을 통한다.
 *
 * 여기서 세 가지를 대신 처리한다.
 *  1. 세션 쿠키 — 모든 요청에 credentials: "include".
 *  2. CSRF — POST/PUT/PATCH/DELETE 는 X-XSRF-TOKEN 헤더가 없으면 서버가 403 을 준다.
 *     토큰은 GET /api/v1/auth/csrf 로 받아 캐시하고, 403 이 나면 한 번 다시 받아 재시도한다
 *     (로그인/로그아웃으로 세션이 바뀌면 토큰도 바뀐다).
 *  3. 봉투 벗기기 — {success, message, data, error} 에서 data 만 돌려주고, 실패는 ApiError 로 던진다.
 */

import type { ApiResponse, ValidationError } from "@/types/api";

const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /**
     * 백엔드 `ErrorCode` 상수 이름(`VERIFICATION_EXPIRED` …). 분기는 문구가 아니라 이 값으로 한다.
     * 봉투가 없는 실패(프록시 오류·네트워크)에서는 비어 있다.
     */
    readonly code: string | null = null,
    /** 검증 실패(INVALID_INPUT)일 때만 차 있다. 폼 순서로 정렬돼 온다 */
    readonly errors: ValidationError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** 로그인이 필요한 상태(비로그인·세션 만료). 화면에서 로그인 페이지로 보낼 때 쓴다. */
  get isUnauthorized() {
    return this.status === 401;
  }

  /** 로그인은 됐지만 권한이 없음(남의 회사 수정 등). */
  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }
}

type Csrf = { headerName: string; token: string };
let csrfCache: Csrf | null = null;

async function loadCsrf(): Promise<Csrf> {
  const res = await fetch(`${BASE}/auth/csrf`, { credentials: "include" });
  if (!res.ok) {
    throw new ApiError(res.status, "CSRF 토큰을 받지 못했습니다.");
  }
  // 이 엔드포인트만 ApiResponse 봉투 없이 CsrfToken 을 그대로 내려준다.
  const body = (await res.json()) as { headerName: string; token: string };
  csrfCache = { headerName: body.headerName, token: body.token };
  return csrfCache;
}

/** 로그인·로그아웃 직후처럼 세션이 바뀌었을 때 캐시를 버린다. */
export function resetCsrf() {
  csrfCache = null;
}

export type QueryValue = string | number | boolean | undefined | null | (string | number)[];

function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    // 리스트 파라미터(categoryIds 등)는 같은 이름을 반복해 보낸다 — Spring 이 List<Long> 으로 바인딩한다.
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, String(v)));
    } else {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /**
   * 403 을 받았을 때 새 CSRF 토큰으로 한 번 재시도할지. 기본 true.
   *
   * **403 이 그 자체로 업무상 답인 호출은 꺼야 한다** — 로그인의 "정지 계정"이 그렇다.
   * 켜 두면 실패한 로그인이 매번 두 번씩 서버에 도달한다(자세한 이유는 아래 재시도 블록).
   */
  retryOnForbidden?: boolean;
};

async function send(path: string, options: RequestOptions, csrf: Csrf | null): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (csrf) headers[csrf.headerName] = csrf.token;

  return fetch(`${BASE}${path}${buildQuery(options.query)}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
    cache: "no-store",
  });
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const needsCsrf = method !== "GET";

  // 캐시에 있던 토큰을 재사용했는지. 아래 재시도 판단의 근거라 미리 기억해 둔다.
  const reusedToken = needsCsrf && csrfCache !== null;
  let csrf = needsCsrf ? (csrfCache ?? (await loadCsrf())) : null;
  let res = await send(path, options, csrf);

  /*
   * 403 은 "권한 없음"일 수도 "CSRF 토큰이 낡음"일 수도 있다. **백엔드가 둘을 같은 본문으로 주므로
   * 화면에서는 구분할 수 없다**(CSRF 실패도 AccessDeniedException 이라 같은 핸들러를 탄다).
   * 그래서 낡은 토큰일 수 있을 때만 새 토큰으로 한 번 재시도한다.
   *
   *  - 이 요청에서 막 받아온 토큰이면 세션과 어긋날 수가 없다 — 다시 받아 봐야 같은 답이라 그냥 낭비다.
   *  - retryOnForbidden=false 는 403 자체가 업무상 의미인 호출이 끄는 스위치다(로그인의 '정지 계정').
   */
  if (res.status === 403 && reusedToken && options.retryOnForbidden !== false) {
    csrf = await loadCsrf();
    res = await send(path, options, csrf);
  }

  if (!res.ok) {
    throw await readError(res);
  }

  // 204(좋아요·즐겨찾기)와 본문 없는 성공 응답.
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;

  const envelope = JSON.parse(text) as ApiResponse<T>;
  return envelope.data as T;
}

async function readError(res: Response): Promise<ApiError> {
  return parseError(res.status, await res.text().catch(() => ""));
}

/** 실패 본문(문자열)을 ApiError 로. fetch 경로와 업로드(XHR) 경로가 같이 쓴다. */
function parseError(status: number, text: string): ApiError {
  try {
    const body = JSON.parse(text) as ApiResponse<never>;
    // 백엔드는 실패를 {success:false, code, error:"...", errors?} 로 통일해 내려준다.
    if (body.error) return new ApiError(status, body.error, body.code ?? null, body.errors ?? []);
  } catch {
    // 본문이 비었거나 JSON 이 아닌 경우(프록시 오류 등)는 아래 기본 문구로 떨어진다.
  }
  return new ApiError(
    status,
    status === 401 ? "로그인이 필요합니다." : `요청이 실패했습니다. (HTTP ${status})`,
  );
}

/**
 * 파일 한 장 업로드(multipart). 진행률이 필요해서 fetch 가 아니라 XMLHttpRequest 를 쓴다 —
 * fetch 에는 **보내는 쪽** 진행률을 받을 방법이 없다(응답 스트림만 읽을 수 있다).
 *
 * JSON 요청과 다른 점 두 가지:
 *  - `Content-Type` 을 직접 넣지 않는다. FormData 를 넘기면 브라우저가 경계 문자열(boundary)을 붙인
 *    `multipart/form-data; boundary=…` 를 스스로 만든다. 손으로 넣으면 boundary 가 빠져 서버가 못 읽는다.
 *  - 그래도 CSRF 헤더는 필요하다(POST 다). 403 재시도 규칙은 `request` 와 같다.
 *
 * 여러 장을 한 요청에 묶지 않는다 — 백엔드가 한 장씩만 받는다(한 장 실패로 전부 날아가지 않게, 진행률도 장당).
 */
export async function uploadFile(
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<unknown> {
  const reusedToken = csrfCache !== null;
  let csrf = csrfCache ?? (await loadCsrf());
  let result = await sendMultipart(path, file, csrf, onProgress, signal);
  if (result.status === 403 && reusedToken) {
    csrf = await loadCsrf();
    result = await sendMultipart(path, file, csrf, onProgress, signal);
  }
  if (result.status < 200 || result.status >= 300) {
    throw parseError(result.status, result.text);
  }
  return (JSON.parse(result.text) as ApiResponse<unknown>).data;
}

function sendMultipart(
  path: string,
  file: File,
  csrf: Csrf,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader(csrf.headerName, csrf.token);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    // 연결 자체가 끊긴 경우(서버 다운, 용량 초과로 서버가 연결을 닫은 경우)에는 상태 코드가 없다.
    xhr.onerror = () => reject(new ApiError(0, "업로드 중 연결이 끊겼습니다. 잠시 후 다시 시도해 주세요."));
    xhr.onabort = () => reject(new DOMException("업로드를 취소했습니다.", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export const api = {
  get: <T>(path: string, query?: Record<string, QueryValue>, signal?: AbortSignal) =>
    request<T>(path, { method: "GET", query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
