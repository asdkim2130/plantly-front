/**
 * enum 값의 한국어 표기. 백엔드 enum 이 정본이고 **여기는 사본**이다(types/api.ts 와 같은 규약).
 *
 * 응답에는 이름만 실려 온다(`"PROTOTYPE"`) — 백엔드 enum 에 `label` 필드가 있지만
 * DTO 가 enum 을 그대로 담아 Jackson 이 이름을 쓴다. 그래서 표기는 화면 몫이다.
 * 백엔드에서 값이 늘면 여기도 같이 늘려야 한다(Record 라 빠뜨리면 타입 검사에서 걸린다).
 *
 * 대응: domain/company/enums/{TrlLevel,PricingType}.java, company/certification/CertificationType.java
 */

import type { CertificationType, PricingType, TrlLevel } from "@/types/api";

export const TRL_LEVEL_LABEL: Record<TrlLevel, string> = {
  PROTOTYPE: "프로토타입",
  MASS_PRODUCTION: "양산 적용 가능",
  GLOBAL_STANDARD: "글로벌 표준",
};

export const PRICING_TYPE_LABEL: Record<PricingType, string> = {
  FIXED: "고정 단가제",
  CONSULTATION: "상담 후 결정",
  PROJECT_BASED: "프로젝트별 상이",
};

export const CERTIFICATION_TYPE_LABEL: Record<CertificationType, string> = {
  MANAGEMENT_SYSTEM: "경영시스템",
  INDUSTRY_SPECIFIC: "산업특화",
  MARKET_ACCESS: "시장진입",
};

/**
 * 인증을 그룹지어 보여줄 때의 순서. 응답은 평면 리스트라 순서를 화면이 정한다.
 *
 * 검색 패싯이 type 안에서는 OR, type 끼리는 AND 로 동작하므로 사용자에게도 이 세 묶음이
 * 서로 다른 축으로 읽혀야 한다 — 상세에서 한 줄로 뭉뚱그리지 않고 그룹을 유지하는 이유다.
 */
export const CERTIFICATION_TYPE_ORDER: CertificationType[] = [
  "MANAGEMENT_SYSTEM",
  "INDUSTRY_SPECIFIC",
  "MARKET_ACCESS",
];
