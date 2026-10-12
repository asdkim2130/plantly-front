/**
 * 폼을 그리는 근거(메타) 조회와 이미지 업로드.
 *
 * 등록 폼의 숫자·문구를 화면에 박지 않으려고 서버에 묻는다. 셋으로 나뉜 이유는 출처가 달라서다.
 *  - 제약(`/meta/constraints/{form}`) — 필수·길이·개수. 요청 DTO 의 검증 애너테이션에서 서버가 뽑는다.
 *  - 선택지(`/meta/options`) — 서버가 라벨을 소유하는 enum(trlLevel·pricingType). 비로그인 허용.
 *  - 업로드(`/meta/upload`) — 한 장당 용량·형식. 배포마다 환경변수로 바뀐다.
 * 등급별 **개수** 한도는 여기 없다. 회사마다 다른 값이라 인증 응답의 `limits` 가 준다.
 */

import { api, uploadFile } from "@/lib/api";
import type {
  ConstraintRule,
  FieldConstraints,
  FormConstraintsResponse,
  OptionsResponse,
  UploadConstraintsResponse,
  UploadResponse,
} from "@/types/api";

export function getFormConstraints(form: string, signal?: AbortSignal) {
  return api.get<FormConstraintsResponse>(`/meta/constraints/${form}`, undefined, signal);
}

export function getOptions(signal?: AbortSignal) {
  return api.get<OptionsResponse>("/meta/options", undefined, signal);
}

export function getUploadConstraints(signal?: AbortSignal) {
  return api.get<UploadConstraintsResponse>("/meta/upload", undefined, signal);
}

/** 이미지 한 장. 고르는 즉시 부르고, 응답의 url 을 폼 상태에 담는다(그 문자열이 그대로 요청 본문에 간다). */
export async function uploadImage(file: File, onProgress?: (percent: number) => void, signal?: AbortSignal) {
  setInFlight(inFlight + 1);
  try {
    return (await uploadFile("/uploads", file, onProgress, signal)) as UploadResponse;
  } finally {
    setInFlight(inFlight - 1);
  }
}

/*
 * 지금 올라가는 중인 장 수. 발행 버튼이 본다 — 올라가는 중인 사진은 아직 url 이 없어 폼에 들어 있지 않으므로,
 * 그 사이에 발행하면 사진이 조용히 빠진 채 등록된다. 어느 섹션에서 올리든 한 숫자로 모이게 모듈 단위로 센다.
 * React 는 useSyncExternalStore(subscribeUploads, uploadsInFlight) 로 구독한다.
 */
let inFlight = 0;
const listeners = new Set<() => void>();

function setInFlight(next: number) {
  inFlight = next;
  listeners.forEach((listener) => listener());
}

export function subscribeUploads(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const uploadsInFlight = () => inFlight;

/**
 * 제약 응답을 경로 문자열로 찾는 표. `"companyName"`, `"tagNames[]"`(원소), `"contacts[].phone"` 처럼 쓴다 —
 * 검증 실패 응답의 field(`contacts[0].phone`)에서 인덱스만 뺀 모양이다.
 */
export type ConstraintIndex = Map<string, ConstraintRule[]>;

export function indexConstraints(response: FormConstraintsResponse): ConstraintIndex {
  const index: ConstraintIndex = new Map();
  const walk = (node: FieldConstraints, path: string) => {
    if (node.rules?.length) index.set(path, node.rules);
    node.fields?.forEach((child) => walk(child, path ? `${path}.${child.field}` : (child.field ?? "")));
    if (node.items) walk(node.items, `${path}[]`);
  };
  response.fields?.forEach((field) => walk(field, field.field ?? ""));
  return index;
}

/** 그 칸의 규칙 값(maxLength·maxItems 등). 제약을 아직 못 받았거나 규칙이 없으면 undefined. */
export function ruleValue(index: ConstraintIndex | null, path: string, type: string): number | undefined {
  return index?.get(path)?.find((rule) => rule.type === type)?.value;
}

/** "10MB" 같은 표기는 화면이 만든다(서버는 바이트만 준다). */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}
