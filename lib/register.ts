/**
 * 기업정보 등록 폼의 상태 모델. 화면(components/register/*)은 이 파일의 타입과 함수만 보고 그린다.
 *
 * 폼 상태와 요청 본문(MyCompanyCreateRequest)을 따로 두는 이유는 모양이 다르기 때문이다.
 *  - 요청은 "없음"을 null 로, 폼은 빈 문자열로 든다 — 입력칸(`<input value>`)은 null 을 받지 못한다.
 *  - 연락처·레퍼런스는 요청에서 "최대 1건짜리 배열"이지만 폼에서는 칸 네 개짜리 한 묶음이다.
 *  - "기타" 인증은 요청에서 `{certificationId: 기타 id, customName}` 여러 건이지만, 폼에서는
 *    "기타를 골랐는가 + 이름 목록" 이다. 기타의 id 는 마스터 목록에서 찾는다(화면에 박지 않는다).
 * 그래서 오가는 길을 `toPayload` / `fromPayload` 두 함수로 한 곳에 모았다. 초안 자동저장과 발행이
 * 같은 `toPayload` 를 쓰므로 "저장된 초안은 발행 본문과 같은 모양" 이 저절로 지켜진다.
 */

import type { ConstraintIndex } from "@/lib/meta";
import type {
  CategoryPublicResponse,
  CertificationPublicResponse,
  CertificationRequest,
  CompanyGrade,
  CompanyVisibility,
  CountryPublicResponse,
  DomesticRegionPublicResponse,
  GradeLimits,
  IndustryPublicResponse,
  MyCompanyCreateRequest,
  OptionsResponse,
  UploadConstraintsResponse,
  PricingType,
  TrlLevel,
  ValidationError,
} from "@/types/api";

/**
 * 폼을 그리는 데 드는 서버 값 전부. 화면 진입 때 한 번 받아 섹션들에 나눠 준다.
 * 선택지가 바뀌어 발행이 `*_NOT_FOUND` 로 막히면 이걸 다시 받는다(사라진 항목을 짚어 주려고).
 */
export type RegisterMasters = {
  categories: CategoryPublicResponse[];
  industries: IndustryPublicResponse[];
  certifications: CertificationPublicResponse[];
  countries: CountryPublicResponse[];
  regions: DomesticRegionPublicResponse[];
  /** trlLevel · pricingType 값과 라벨. 서버가 라벨을 소유한다 */
  options: OptionsResponse;
  /** 길이·개수 상한. 받기 전에는 null 이고, 그동안 화면은 숫자 없이 그린다 */
  constraints: ConstraintIndex | null;
  upload: UploadConstraintsResponse | null;
};

/** 섹션 컴포넌트가 공통으로 받는 것 */
export type SectionProps = {
  form: RegisterForm;
  update: (patch: Partial<RegisterForm> | ((form: RegisterForm) => Partial<RegisterForm>)) => void;
  /** 칸 키 → 오류 문구(errorMap) */
  errors: Record<string, string>;
  masters: RegisterMasters;
  limits: GradeLimits;
  /** 이 인증으로 받을 등급(예고). 등급이 막은 칸의 안내 문구에 쓴다 */
  grade: CompanyGrade;
  /** 선택지 목록에서 사라져 발행을 막은 항목(칸 키 → id → 이름). 칩을 빨간 줄로 그린다 */
  removed: RemovedSelections;
  /**
   * 등록(create)인가 수정(edit)인가. 갈리는 건 둘뿐이다 —
   * 수정은 기술 성숙도·가격 정책을 "선택 안 함"으로 되돌릴 수 없고(PATCH 가 enum 비우기를 지원하지 않는다),
   * 공개 설정 안내 문구가 "발행하면"이 아니라 "저장하면"이다. 생략하면 create.
   */
  mode?: "create" | "edit";
  /** 수정 화면에서만: 저장돼 있지만 등급 한도를 넘겨 공개되지 않는 항목(회색으로 그린다) */
  hidden?: HiddenItems;
};

/**
 * 등급 초과로 숨겨진(active=false) 항목. 지운 게 아니라 저장은 살아 있다 — 회색으로 구분해야
 * 소유자가 "데이터가 날아갔다"고 오해하지 않는다. 레퍼런스 이미지는 서버가 개별 on/off 를 아직 주지 않는다.
 */
export type HiddenItems = { categoryIds: Set<number>; images: Set<string> };

export type RemovedSelections = Partial<Record<"categoryIds" | "industryIds" | "certificationIds" | "countryIds" | "domesticRegionIds", Map<number, string>>>;

export type ContactForm = { contactName: string; position: string; phone: string; email: string };

export type ReferenceForm = {
  projectTitle: string;
  achievements: string;
  partners: string;
  period: string;
  imageUrls: string[];
};

export type RegisterForm = {
  // A 기본 정보
  companyName: string;
  introTitle: string;
  content: string;
  website: string;
  // B 주소 — 우편번호·도로명·지번은 주소 검색이 채우고 손으로 고치지 않는다
  postalCode: string;
  roadAddress: string;
  jibunAddress: string;
  detailAddress: string;
  // C 브랜딩
  logoUrl: string | null;
  coverImageUrl: string | null;
  /** "" = 지정 안 함. 작성 중에는 "#1F4" 처럼 반쯤 친 값도 그대로 든다(초안 저장은 막지 않는다) */
  brandColor: string;
  // D 사업 정보
  trlLevel: TrlLevel | null;
  pricingType: PricingType | null;
  leadTime: string;
  asInfo: string;
  videoUrl: string;
  // E 분류
  categoryIds: number[];
  industryIds: number[];
  tagNames: string[];
  // F 역량
  materialNames: string[];
  equipmentNames: string[];
  /** 마스터에서 고른 인증(기타 제외) */
  certificationIds: number[];
  /** 기타 인증명. null 이면 "기타"를 고르지 않은 것이다 — 빈 배열과 다르다(고르면 한 칸이 생긴다) */
  customCertNames: string[] | null;
  // G 대응 가능 범위
  domesticRegionIds: number[];
  countryIds: number[];
  // H 상세 이미지(업로드가 끝난 url 만. 진행 중인 장은 화면 상태다)
  images: string[];
  // I · J
  contact: ContactForm;
  reference: ReferenceForm;
  // K
  visibility: CompanyVisibility;
};

export function emptyForm(): RegisterForm {
  return {
    companyName: "",
    introTitle: "",
    content: "",
    website: "",
    postalCode: "",
    roadAddress: "",
    jibunAddress: "",
    detailAddress: "",
    logoUrl: null,
    coverImageUrl: null,
    brandColor: "",
    trlLevel: null,
    pricingType: null,
    leadTime: "",
    asInfo: "",
    videoUrl: "",
    categoryIds: [],
    industryIds: [],
    tagNames: [],
    materialNames: [],
    equipmentNames: [],
    certificationIds: [],
    customCertNames: null,
    domesticRegionIds: [],
    countryIds: [],
    images: [],
    contact: { contactName: "", position: "", phone: "", email: "" },
    reference: { projectTitle: "", achievements: "", partners: "", period: "", imageUrls: [] },
    // 서버 기본값과 같다(null 이면 PUBLIC). 화면이 스위치를 그리려면 값이 있어야 해서 명시한다.
    visibility: "PUBLIC",
  };
}

/** 마스터 인증 목록에서 "기타" 앵커의 id. 목록을 아직 못 받았으면 null */
export function findEtcCertificationId(certifications: CertificationPublicResponse[]): number | null {
  return certifications.find((cert) => cert.type === "ETC")?.id ?? null;
}

const blankToNull = (value: string) => (value.trim() === "" ? null : value.trim());

export function hasContact(contact: ContactForm) {
  return Object.values(contact).some((value) => value.trim() !== "");
}

export function hasReference(reference: ReferenceForm) {
  return (
    [reference.projectTitle, reference.achievements, reference.partners, reference.period].some(
      (value) => value.trim() !== "",
    ) || reference.imageUrls.length > 0
  );
}

/**
 * 폼 → 요청 본문. 초안 저장과 발행이 함께 쓴다.
 *
 * 연락처·레퍼런스는 한 칸이라도 채웠을 때만 1건짜리 배열로 싣는다. 빈 묶음을 보내면 발행에서
 * "담당자 이름은 필수입니다" 로 막힌다 — 연락처를 아예 안 쓴 사람에게 이름을 요구하게 된다.
 */
export function toPayload(form: RegisterForm, verificationId: number, etcId: number | null): MyCompanyCreateRequest {
  const certifications: CertificationRequest[] = form.certificationIds.map((certificationId) => ({
    certificationId,
    customName: null,
  }));
  if (form.customCertNames && etcId !== null) {
    // 이름이 빈 칸도 그대로 싣는다 — 발행 때 서버가 "기타 인증은 인증명을 직접 입력해야 합니다" 로 가리킨다.
    // 화면 검증(validate)이 먼저 막으므로 실제로 나가는 일은 거의 없지만, 초안에는 빈 칸까지 보존돼야 한다.
    form.customCertNames.forEach((name) => certifications.push({ certificationId: etcId, customName: name }));
  }

  return {
    verificationId,
    companyName: blankToNull(form.companyName),
    postalCode: blankToNull(form.postalCode),
    roadAddress: blankToNull(form.roadAddress),
    jibunAddress: blankToNull(form.jibunAddress),
    detailAddress: blankToNull(form.detailAddress),
    website: blankToNull(form.website),
    logoUrl: form.logoUrl,
    coverImageUrl: form.coverImageUrl,
    introTitle: blankToNull(form.introTitle),
    content: blankToNull(form.content),
    trlLevel: form.trlLevel,
    videoUrl: blankToNull(form.videoUrl),
    leadTime: blankToNull(form.leadTime),
    asInfo: blankToNull(form.asInfo),
    pricingType: form.pricingType,
    brandColor: blankToNull(form.brandColor),
    visibility: form.visibility,
    contacts: hasContact(form.contact)
      ? [
          {
            contactName: form.contact.contactName.trim(),
            position: blankToNull(form.contact.position),
            phone: blankToNull(form.contact.phone),
            email: blankToNull(form.contact.email),
          },
        ]
      : [],
    images: form.images.map((imageUrl) => ({ imageUrl, imageType: "DETAIL" as const })),
    references: hasReference(form.reference)
      ? [
          {
            projectTitle: blankToNull(form.reference.projectTitle),
            achievements: blankToNull(form.reference.achievements),
            partners: blankToNull(form.reference.partners),
            period: blankToNull(form.reference.period),
            imageUrls: form.reference.imageUrls,
          },
        ]
      : [],
    materialNames: form.materialNames,
    equipmentNames: form.equipmentNames,
    tagNames: form.tagNames,
    categoryIds: form.categoryIds,
    certifications,
    countryIds: form.countryIds,
    domesticRegionIds: form.domesticRegionIds,
    industryIds: form.industryIds,
  };
}

/** 초안 payload → 폼. 저장할 때 null 로 바꾼 자리를 빈 문자열로 되돌린다. */
export function fromPayload(payload: MyCompanyCreateRequest, etcId: number | null): RegisterForm {
  const base = emptyForm();
  const text = (value: string | null | undefined) => value ?? "";
  const contact = payload.contacts?.[0];
  const reference = payload.references?.[0];
  const certifications = payload.certifications ?? [];
  const customs = certifications.filter((cert) => cert.customName !== null && cert.certificationId === etcId);

  return {
    ...base,
    companyName: text(payload.companyName),
    introTitle: text(payload.introTitle),
    content: text(payload.content),
    website: text(payload.website),
    postalCode: text(payload.postalCode),
    roadAddress: text(payload.roadAddress),
    jibunAddress: text(payload.jibunAddress),
    detailAddress: text(payload.detailAddress),
    logoUrl: payload.logoUrl ?? null,
    coverImageUrl: payload.coverImageUrl ?? null,
    brandColor: text(payload.brandColor),
    trlLevel: payload.trlLevel ?? null,
    pricingType: payload.pricingType ?? null,
    leadTime: text(payload.leadTime),
    asInfo: text(payload.asInfo),
    videoUrl: text(payload.videoUrl),
    categoryIds: payload.categoryIds ?? [],
    industryIds: payload.industryIds ?? [],
    tagNames: payload.tagNames ?? [],
    materialNames: payload.materialNames ?? [],
    equipmentNames: payload.equipmentNames ?? [],
    certificationIds: certifications.filter((cert) => !customs.includes(cert)).map((cert) => cert.certificationId),
    customCertNames: customs.length ? customs.map((cert) => cert.customName ?? "") : null,
    domesticRegionIds: payload.domesticRegionIds ?? [],
    countryIds: payload.countryIds ?? [],
    images: (payload.images ?? []).map((image) => image.imageUrl),
    contact: contact
      ? {
          contactName: text(contact.contactName),
          position: text(contact.position),
          phone: text(contact.phone),
          email: text(contact.email),
        }
      : base.contact,
    reference: reference
      ? {
          projectTitle: text(reference.projectTitle),
          achievements: text(reference.achievements),
          partners: text(reference.partners),
          period: text(reference.period),
          imageUrls: reference.imageUrls ?? [],
        }
      : base.reference,
    visibility: payload.visibility ?? "PUBLIC",
  };
}

// ===== 섹션 =====

export type SectionKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K";

export const SECTIONS: { key: SectionKey; title: string; required?: boolean }[] = [
  { key: "A", title: "기본 정보", required: true },
  { key: "B", title: "주소", required: true },
  { key: "C", title: "브랜딩" },
  { key: "D", title: "사업 정보" },
  { key: "E", title: "분류" },
  { key: "F", title: "역량" },
  { key: "G", title: "대응 가능 범위" },
  { key: "H", title: "상세 이미지" },
  { key: "I", title: "담당자 연락처" },
  { key: "J", title: "프로젝트 레퍼런스" },
  { key: "K", title: "공개 설정" },
];

export const sectionId = (key: SectionKey) => `sec-${key}`;

export type FillState = "done" | "part" | "empty";

/** 칸 몇 개가 찼는지로 섹션의 채움 상태를 낸다(목차의 동그라미, 이어쓰기 카드의 "n개 섹션 작성"). */
export function sectionStates(form: RegisterForm, videoAllowed: boolean): Record<SectionKey, FillState> {
  const of = (...filled: boolean[]): FillState => {
    const count = filled.filter(Boolean).length;
    return count === 0 ? "empty" : count === filled.length ? "done" : "part";
  };
  const has = (value: string) => value.trim() !== "";
  const { contact, reference } = form;

  return {
    A: of(has(form.companyName), has(form.introTitle), has(form.content), has(form.website)),
    B: of(has(form.postalCode), has(form.roadAddress), has(form.detailAddress)),
    C: of(form.logoUrl !== null, form.coverImageUrl !== null, has(form.brandColor)),
    D: of(
      form.trlLevel !== null,
      form.pricingType !== null,
      has(form.leadTime),
      has(form.asInfo),
      // 등급이 막은 칸은 "비었다"로 세지 않는다 — 채울 수 없는 칸 때문에 영영 '일부 입력'이 된다.
      ...(videoAllowed ? [has(form.videoUrl)] : []),
    ),
    E: of(form.categoryIds.length > 0, form.industryIds.length > 0, form.tagNames.length > 0),
    F: of(
      form.materialNames.length > 0,
      form.equipmentNames.length > 0,
      form.certificationIds.length > 0 || (form.customCertNames?.length ?? 0) > 0,
    ),
    G: of(form.domesticRegionIds.length > 0, form.countryIds.length > 0),
    H: of(form.images.length > 0),
    I: of(has(contact.contactName), has(contact.phone) || has(contact.email)),
    J: of(has(reference.projectTitle), has(reference.achievements)),
    // 공개 설정은 늘 값이 있다(기본 공개).
    K: "done",
  };
}

/** 발행에 꼭 필요한 네 칸. 서버 DTO 의 @NotBlank 와 같은 목록이다(신원 3종은 인증본이 채운다). */
export function requiredDone(form: RegisterForm): number {
  return [form.companyName, form.postalCode, form.roadAddress, form.detailAddress].filter((v) => v.trim() !== "")
    .length;
}
export const REQUIRED_TOTAL = 4;

// ===== 검증 =====

/** 위반 1건. `key` 는 입력칸 식별자(아래 FIELD_LABEL 의 키)라 칸 아래 문구와 배너 목록이 같은 키로 만난다. */
export type FormError = { section: SectionKey; key: string; message: string };

/**
 * 입력칸 식별자 → 어느 섹션의 무슨 칸인가. 서버 검증 응답의 field(`contacts[0].phone`)에서
 * 인덱스를 뺀 모양(`contacts.phone`)을 키로 쓴다 — 화면 검증과 서버 검증이 같은 키에서 만난다.
 */
const FIELD_LABEL: Record<string, [SectionKey, string]> = {
  companyName: ["A", "기업명"],
  introTitle: ["A", "한 줄 요약"],
  content: ["A", "소개글"],
  website: ["A", "홈페이지"],
  postalCode: ["B", "우편번호"],
  roadAddress: ["B", "도로명 주소"],
  jibunAddress: ["B", "지번 주소"],
  detailAddress: ["B", "상세주소"],
  logoUrl: ["C", "로고 이미지"],
  coverImageUrl: ["C", "커버 이미지"],
  brandColor: ["C", "브랜드 컬러"],
  trlLevel: ["D", "기술 성숙도"],
  pricingType: ["D", "가격 정책"],
  leadTime: ["D", "예상 리드타임"],
  asInfo: ["D", "유지보수 정보"],
  videoUrl: ["D", "소개 동영상"],
  categoryIds: ["E", "카테고리"],
  industryIds: ["E", "산업군"],
  tagNames: ["E", "태그"],
  materialNames: ["F", "취급 소재"],
  equipmentNames: ["F", "보유 장비"],
  certifications: ["F", "보유 인증"],
  "certifications.customName": ["F", "기타 인증명"],
  domesticRegionIds: ["G", "국내 지역"],
  countryIds: ["G", "해외 국가"],
  images: ["H", "상세 이미지"],
  "images.imageUrl": ["H", "상세 이미지"],
  contacts: ["I", "담당자 연락처"],
  "contacts.contactName": ["I", "담당자 이름"],
  "contacts.position": ["I", "직위"],
  "contacts.phone": ["I", "전화번호"],
  "contacts.email": ["I", "이메일"],
  references: ["J", "프로젝트 레퍼런스"],
  "references.projectTitle": ["J", "프로젝트명"],
  "references.achievements": ["J", "주요 성과"],
  "references.partners": ["J", "참여 기관"],
  "references.period": ["J", "수행 기간"],
  "references.imageUrls": ["J", "레퍼런스 이미지"],
  visibility: ["K", "공개 설정"],
};

export function sectionTitle(key: SectionKey) {
  return SECTIONS.find((section) => section.key === key)?.title ?? "";
}

/** 배너 목록의 "기본 정보 · 홈페이지" */
export function errorWhere(error: FormError) {
  const label = FIELD_LABEL[error.key]?.[1];
  return label ? `${sectionTitle(error.section)} · ${label}` : sectionTitle(error.section);
}

const URL_SCHEME = /^https?:\/\//i;
const BRAND_COLOR = /^#[0-9a-fA-F]{6}$/;
const PHONE = /^[0-9-]+$/;
// 서버(@Email)보다 느슨하게 잡는다. 화면 검증은 "서버가 받을 값을 막지 않는다"가 기준이고,
// 최종 판정은 서버가 한다(그때는 서버 문구가 그 칸 아래에 붙는다).
const EMAIL = /^[^\s@]+@[^\s@]+$/;

/**
 * 발행 전에 화면에서 막는 것. 서버가 같은 규칙으로 다시 보지만, 30종짜리 폼에서 서버 왕복으로
 * 하나씩 알게 하지 않으려고 여기서 먼저 전부 모은다. 순서는 폼 순서(섹션 A → K).
 *
 * 개수 상한은 여기서 보지 않는다 — 화면이 애초에 넘게 고르지 못하게 막는다.
 *
 * 홈페이지 형식은 서버에 없는 규칙이다. 상세 화면이 이 값을 링크로 걸기 때문에 `www.…` 만 저장되면
 * 사이트 안의 상대경로로 깨진다 — 디자인이 정한 화면 규칙으로 둔다.
 */
export function validate(form: RegisterForm): FormError[] {
  const errors: FormError[] = [];
  const push = (key: string, message: string) => errors.push({ section: FIELD_LABEL[key][0], key, message });

  if (!form.companyName.trim()) push("companyName", "기업명은 필수입니다.");
  if (form.website.trim() && !URL_SCHEME.test(form.website.trim()))
    push("website", "http:// 또는 https:// 로 시작하는 주소를 입력해 주세요.");
  if (!form.postalCode.trim() || !form.roadAddress.trim())
    push("roadAddress", "주소 검색으로 우편번호와 도로명 주소를 채워 주세요.");
  if (!form.detailAddress.trim()) push("detailAddress", "상세주소는 필수입니다.");
  if (form.brandColor.trim() && !BRAND_COLOR.test(form.brandColor.trim()))
    push("brandColor", "브랜드 컬러는 #RRGGBB 형식이어야 합니다.");

  if (form.customCertNames) {
    const names = form.customCertNames.map((name) => name.trim());
    if (names.some((name) => !name)) push("certifications.customName", "기타 인증을 골랐다면 인증명이 필요합니다.");
    else if (new Set(names).size !== names.length)
      push("certifications.customName", "같은 인증명이 두 번 들어 있습니다. 각 항목에 서로 다른 이름을 입력해 주세요.");
  }

  const { contact } = form;
  if (hasContact(contact)) {
    if (!contact.contactName.trim()) push("contacts.contactName", "연락처를 입력했다면 담당자 이름이 필요합니다.");
    if (contact.phone.trim() && !PHONE.test(contact.phone.trim()))
      push("contacts.phone", "연락처는 숫자와 하이픈만 입력할 수 있습니다.");
    if (contact.email.trim() && !EMAIL.test(contact.email.trim()))
      push("contacts.email", "올바른 이메일 형식이 아닙니다.");
  }

  return errors;
}

/**
 * 서버 검증 위반 → 화면 오류. field 의 인덱스를 지워(`contacts[0].phone` → `contacts.phone`) 칸 키로 쓴다.
 * 모르는 field 는 섹션 머리 글자로 섹션만 찾아 붙인다(새 필드가 생겨도 배너에서는 빠지지 않게).
 */
export function fromServerErrors(errors: ValidationError[]): FormError[] {
  return errors.flatMap((error) => {
    if (!error.field) return [];
    const key = error.field.replace(/\[\d+\]/g, "");
    const known = FIELD_LABEL[key] ?? FIELD_LABEL[key.split(".")[0]];
    if (!known) return [];
    return [{ section: known[0], key: FIELD_LABEL[key] ? key : key.split(".")[0], message: error.message }];
  });
}

/** 칸 키 → 그 칸의 첫 오류 문구. 칸 아래 한 줄로 쓴다 */
export function errorMap(errors: FormError[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const error of errors) map[error.key] ??= error.message;
  return map;
}

// ===== 표시 보조 =====

/** 로고가 없을 때 대신 그리는 두 글자. 법인 표기를 떼야 "주식"·"(주" 가 찍히지 않는다 */
export function monogram(name: string) {
  const clean = name.replace(/\(주\)|주식회사|㈜/g, "").trim();
  return clean.slice(0, 2) || "기업";
}

/** 카드 미리보기의 위치 한 줄("경남 김해시"). 서버 카드도 도로명 주소의 앞부분만 보여 준다 */
export function shortAddress(roadAddress: string) {
  return roadAddress.trim().split(/\s+/).slice(0, 2).join(" ");
}

export const DEFAULT_BRAND_COLOR = "#0B2148";

export function isBrandColor(value: string) {
  return BRAND_COLOR.test(value.trim());
}

/** 123-45-67890 */
export function formatBusinessNumber(digits: string) {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 10) return digits;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** "3분 전 저장됨" · "3주 전 수정" 의 앞부분 */
export function relativeTime(iso: string, now: number) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return "방금";
  if (seconds < 60) return `${seconds}초 전`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

/** "2026-03-02" — 날짜만. 서버의 LocalDateTime 문자열에서 앞 10자리를 쓴다(시간대 변환 없이) */
export function formatDate(iso: string) {
  return iso.slice(0, 10);
}

/** "10월 7일 14:22" */
export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/**
 * 선택지가 바뀌어 발행이 `*_NOT_FOUND` 로 막혔을 때, 다시 받은 목록과 견줘 **사라진 고른 항목**을 찾는다.
 * 이름은 옛 목록에서 가져온다 — 새 목록에는 이미 없어서다. 배너 목록과 빨간 칩이 이 결과를 쓴다.
 */
export function findRemoved(form: RegisterForm, before: RegisterMasters, after: RegisterMasters) {
  const removed: RemovedSelections = {};
  const items: FormError[] = [];

  const diff = <T,>(
    key: keyof RemovedSelections,
    errorKey: string,
    selected: number[],
    oldList: T[],
    newList: T[],
    id: (item: T) => number,
    name: (item: T) => string,
  ) => {
    const alive = new Set(newList.map(id));
    const map = new Map<number, string>();
    for (const selectedId of selected) {
      if (alive.has(selectedId)) continue;
      const old = oldList.find((item) => id(item) === selectedId);
      const label = old ? name(old) : `#${selectedId}`;
      map.set(selectedId, label);
      items.push({ section: FIELD_LABEL[errorKey][0], key: errorKey, message: label });
    }
    if (map.size) removed[key] = map;
  };

  const flatCategories = (roots: CategoryPublicResponse[]): CategoryPublicResponse[] =>
    roots.flatMap((node) => [node, ...flatCategories(node.children)]);
  const flatRegions = (roots: DomesticRegionPublicResponse[]) => roots.flatMap((node) => [node, ...node.children]);

  diff("categoryIds", "categoryIds", form.categoryIds, flatCategories(before.categories), flatCategories(after.categories),
    (n) => n.id, (n) => n.categoryName);
  diff("industryIds", "industryIds", form.industryIds, before.industries, after.industries,
    (n) => n.id, (n) => n.industryName);
  diff("certificationIds", "certifications", form.certificationIds, before.certifications, after.certifications,
    (n) => n.id, (n) => n.certificationName);
  diff("domesticRegionIds", "domesticRegionIds", form.domesticRegionIds, flatRegions(before.regions),
    flatRegions(after.regions), (n) => n.id, (n) => n.displayName);
  diff("countryIds", "countryIds", form.countryIds, before.countries, after.countries,
    (n) => n.id, (n) => n.nameKo);

  return { removed, items };
}

/** 오류 키가 폼의 어느 값에 묶여 있는가 — 그 값을 고치면 서버가 준 오류를 지운다 */
export function formKeyOf(errorKey: string): (keyof RegisterForm)[] {
  const head = errorKey.split(".")[0];
  if (head === "contacts") return ["contact"];
  if (head === "references") return ["reference"];
  if (head === "certifications") return ["certificationIds", "customCertNames"];
  return [head as keyof RegisterForm];
}

/** 섹션 순서로 정렬(배너 목록·첫 스크롤 대상이 폼 순서를 따르게) */
export function sortErrors(errors: FormError[]) {
  const order = (key: SectionKey) => SECTIONS.findIndex((section) => section.key === key);
  return [...errors].sort((a, b) => order(a.section) - order(b.section));
}
