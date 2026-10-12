/**
 * 기업정보 수정 화면의 모델. 폼 상태는 등록과 같은 `RegisterForm` 을 쓰고(섹션 컴포넌트를 그대로 재사용하려고),
 * 다른 것은 **저장 경로**뿐이다 — 등록은 한 번의 POST, 수정은 섹션마다 따로 저장한다.
 *
 * 왜 섹션별인가: 수정 API 는 본체 sparse PATCH 하나 + 컬렉션별 전체 교체 PUT 11개 + 공개 설정 PATCH 로 나뉘어 있고
 * 이를 한 트랜잭션으로 묶는 엔드포인트가 없다. 저장 버튼 하나로 열두 번을 보내면 중간에 실패했을 때 일부만
 * 저장된 상태가 화면에 드러나지 않는다. 섹션 단위로 저장하면 무엇이 저장됐고 무엇이 실패했는지가 그 섹션에 붙는다.
 *
 * 섹션 하나가 요청 여러 개일 수도 있다(분류 = 카테고리 · 산업군 · 태그). 요청마다 성공한 값은 바로 "저장됨"으로
 * 옮겨, 섹션 안에서 일부만 실패해도 이미 저장된 칸을 또 보내지 않는다.
 */

import { COLLECTION_FIELD, changeVisibility, replaceCollection, updateCompany, type CollectionName } from "@/lib/companies";
import {
  emptyForm,
  toPayload,
  type RegisterForm,
  type SectionKey,
} from "@/lib/register";
import type { CompanyDetailResponse, CompanyUpdateRequest } from "@/types/api";

/** 소유자 상세 → 폼. 레퍼런스 이미지와 우편번호는 profile 이 아니라 meta 에서 온다(공개 응답이 줄여 둔 값). */
export function fromDetail(detail: CompanyDetailResponse): RegisterForm {
  const { profile, meta } = detail;
  const text = (value: string | null | undefined) => value ?? "";
  const contact = profile.representativeContact;
  const reference = profile.representativeReference;
  // 기타(ETC) 인증은 이름이 링크에 있어 응답의 certificationName 이 곧 직접 입력한 이름이다.
  const customs = profile.certifications.filter((cert) => cert.type === "ETC");

  return {
    ...emptyForm(),
    companyName: profile.companyName,
    introTitle: text(profile.introTitle),
    content: text(profile.content),
    website: text(profile.website),
    postalCode: text(meta.postalCode),
    roadAddress: text(profile.roadAddress),
    jibunAddress: text(profile.jibunAddress),
    detailAddress: text(profile.detailAddress),
    logoUrl: profile.logoUrl,
    coverImageUrl: profile.coverImageUrl,
    brandColor: text(profile.brandColor),
    trlLevel: profile.trlLevel,
    pricingType: profile.pricingType,
    leadTime: text(profile.leadTime),
    asInfo: text(profile.asInfo),
    // 소유자 뷰는 등급과 무관하게 저장값을 받는다(공개 여부는 meta.videoVisibleToPublic).
    videoUrl: text(profile.videoUrl),
    categoryIds: profile.categories.map((category) => category.id),
    industryIds: profile.industries.map((industry) => industry.id),
    tagNames: profile.tagNames,
    materialNames: profile.materialNames,
    equipmentNames: profile.equipmentNames,
    certificationIds: profile.certifications.filter((cert) => cert.type !== "ETC").map((cert) => cert.id),
    customCertNames: customs.length ? customs.map((cert) => cert.certificationName) : null,
    domesticRegionIds: profile.regions.map((region) => region.id),
    countryIds: profile.countries.map((country) => country.id),
    images: [...profile.galleryImages].sort((a, b) => a.displayOrder - b.displayOrder).map((image) => image.imageUrl),
    contact: contact
      ? {
          contactName: contact.contactName,
          position: text(contact.position),
          phone: text(contact.phone),
          email: text(contact.email),
        }
      : emptyForm().contact,
    reference: reference
      ? {
          projectTitle: text(reference.projectTitle),
          achievements: text(reference.achievements),
          partners: text(reference.partners),
          period: text(reference.period),
          imageUrls: meta.representativeReferenceImages.map((image) => image.imageUrl),
        }
      : emptyForm().reference,
    visibility: meta.visibility,
  };
}

/** 섹션이 들고 있는 폼 칸. 이 칸들이 저장값과 다르면 그 섹션은 "저장 안 됨" 이다. */
export const SECTION_FIELDS: Record<SectionKey, (keyof RegisterForm)[]> = {
  A: ["companyName", "introTitle", "content", "website"],
  B: ["postalCode", "roadAddress", "jibunAddress", "detailAddress"],
  C: ["logoUrl", "coverImageUrl", "brandColor"],
  D: ["trlLevel", "pricingType", "leadTime", "asInfo", "videoUrl"],
  E: ["categoryIds", "industryIds", "tagNames"],
  F: ["materialNames", "equipmentNames", "certificationIds", "customCertNames"],
  G: ["domesticRegionIds", "countryIds"],
  H: ["images"],
  I: ["contact"],
  J: ["reference"],
  K: ["visibility"],
};

// 값 비교는 JSON 으로 한다 — 배열·객체 칸(태그, 연락처 묶음)도 순서까지 같아야 "같다"(순서가 곧 표시 순서다).
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function changedFields(form: RegisterForm, saved: RegisterForm, key: SectionKey) {
  return SECTION_FIELDS[key].filter((field) => !same(form[field], saved[field]));
}

/** 요청 하나. 성공하면 `fields` 를 저장값으로 옮긴다. `collection` 은 검증 오류 경로를 되짓는 데 쓴다 */
export type SaveOp = {
  fields: (keyof RegisterForm)[];
  collection?: CollectionName;
  run: () => Promise<void>;
};

// PATCH 로 가는 본체 스칼라(섹션 A~D). 폼 이름과 요청 이름이 같다.
const SCALARS = new Set<keyof RegisterForm>([
  ...SECTION_FIELDS.A,
  ...SECTION_FIELDS.B,
  ...SECTION_FIELDS.C,
  ...SECTION_FIELDS.D,
]);

/** 컬렉션 칸 → 교체 엔드포인트. 인증만 칸 두 개(마스터 id · 기타 이름)가 요청 하나로 간다 */
const COLLECTION_OF: Partial<Record<keyof RegisterForm, CollectionName>> = {
  categoryIds: "categories",
  industryIds: "industries",
  tagNames: "tags",
  materialNames: "materials",
  equipmentNames: "equipment",
  certificationIds: "certifications",
  customCertNames: "certifications",
  domesticRegionIds: "regions",
  countryIds: "countries",
  images: "images",
  contact: "contacts",
  reference: "references",
};

/**
 * 이 섹션을 저장하려면 보낼 요청들. 바뀐 칸만 보낸다.
 *
 * PATCH 본문은 바뀐 키만 싣는다(sparse — 안 실은 키는 미변경). 비운 칸은 `""` 로 보낸다(서버 규약상 비우기).
 * 등록 요청의 null 은 "없음"이지만 PATCH 의 null 은 "그대로"라, 같은 `toPayload` 결과를 쓰되 null 을 ""로 바꾼다.
 * enum 은 비울 수 없어 null 이면 싣지 않는다 — 수정 화면은 애초에 해제를 막는다(BusinessSection 의 allowClear).
 */
export function buildSaveOps(
  companyId: number,
  key: SectionKey,
  form: RegisterForm,
  saved: RegisterForm,
  etcId: number | null,
): SaveOp[] {
  const changed = changedFields(form, saved, key);
  if (changed.length === 0) return [];
  // 컬렉션 요청 본문은 등록 본문과 같은 모양이라 그대로 빌려 쓴다(verificationId 는 쓰지 않는다).
  const payload = toPayload(form, 0, etcId);

  if (key === "K") {
    return [{ fields: ["visibility"], run: () => changeVisibility(companyId, form.visibility) }];
  }

  const scalarFields = changed.filter((field) => SCALARS.has(field));
  const ops: SaveOp[] = [];
  if (scalarFields.length) {
    const patch: Record<string, unknown> = {};
    for (const field of scalarFields) {
      const value = payload[field as keyof typeof payload];
      if (field === "trlLevel" || field === "pricingType") {
        if (value !== null) patch[field] = value;
      } else {
        patch[field] = value ?? "";
      }
    }
    ops.push({ fields: scalarFields, run: () => updateCompany(companyId, patch as CompanyUpdateRequest) });
  }

  const collections = new Set(changed.map((field) => COLLECTION_OF[field]).filter((name) => name !== undefined));
  for (const name of collections) {
    const fields = (Object.keys(COLLECTION_OF) as (keyof RegisterForm)[]).filter(
      (field) => COLLECTION_OF[field] === name,
    );
    const body = payload[COLLECTION_FIELD[name]] ?? [];
    ops.push({ fields, collection: name, run: () => replaceCollection(companyId, name, body) });
  }
  return ops;
}

/**
 * 컬렉션 PUT 의 검증 오류 경로(`[0].phone`, `[3]`)에 컬렉션 이름을 붙여 등록 폼과 같은 모양
 * (`contacts[0].phone`, `tagNames[3]`)으로 만든다. 그러면 칸 키 매핑(fromServerErrors)을 그대로 쓴다.
 */
export function qualifyField(collection: CollectionName | undefined, field: string | undefined) {
  if (!collection) return field;
  const name = COLLECTION_FIELD[collection];
  if (!field) return name;
  return field.startsWith("[") ? `${name}${field}` : `${name}.${field}`;
}
