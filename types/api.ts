/**
 * 백엔드 DTO 대응 타입. 백엔드가 정본이고 이 파일은 사본이다 —
 * 응답이 예상과 다르면 여기를 고치기 전에 ../plantly 의 record 를 먼저 확인한다.
 */

// ===== 공통 봉투 =====

/** 모든 API 응답의 겉포장. null 필드는 JSON 에서 아예 빠진다(@JsonInclude NON_NULL). */
export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  /**
   * 실패 응답의 분기용 식별자. 백엔드 `ErrorCode` enum 의 **상수 이름 그대로**다
   * (`VERIFICATION_EXPIRED`, `BUSINESS_NUMBER_TAKEN` …). 사람이 읽는 문구는 `error` 이고,
   * 화면은 문구가 아니라 이 값으로 갈래를 나눈다 — 문구는 다듬어질 수 있다.
   */
  code?: string;
  error?: string;
  /** Bean Validation 실패에만 실린다. 폼 순서(DTO 선언 순서)로 정렬돼 있어 첫 원소가 곧 스크롤 대상이다 */
  errors?: ValidationError[];
};

/** 검증 위반 1건. field 는 요청 본문의 경로 그대로다(`detailAddress`, `contacts[0].phone`) */
export type ValidationError = {
  field?: string;
  message: string;
};

/** page 는 1-based. 요청도 ?page=1 이 첫 페이지다. */
export type PageInfo = {
  pageNumber: number;
  size: number;
  totalElement: number;
  totalPage: number;
};

export type PageResponse<T> = {
  content: T[];
  pageInfo: PageInfo;
};

export type IdResponse = { id: number };

// ===== enum (백엔드 enum 이름 그대로 문자열로 내려온다) =====

export type CompanyGrade = "FREE" | "BASIC" | "STANDARD" | "PREMIUM" | "ENTERPRISE";
export type SubscriptionStatus = "ACTIVE" | "TRIAL" | "ADMIN_EXEMPT";
export type CompanyVisibility = "PUBLIC" | "PRIVATE";
export type RegistrationSource = "USER" | "ADMIN";
export type TrlLevel = "PROTOTYPE" | "MASS_PRODUCTION" | "GLOBAL_STANDARD";
export type PricingType = "FIXED" | "CONSULTATION" | "PROJECT_BASED";
export type ImageType = "DETAIL" | "PROJECT";
/** ETC 는 "기타" 앵커 한 건뿐이다 — 고르면 인증명을 직접 적어 보낸다(customName) */
export type CertificationType = "MANAGEMENT_SYSTEM" | "INDUSTRY_SPECIFIC" | "MARKET_ACCESS" | "ETC";
/** NATION(전국)·REGION_GROUP(수도권 같은 권역)은 법정동에 대응 행이 없는 합성 단계다 */
export type RegionLevel = "NATION" | "REGION_GROUP" | "SIDO" | "SIGUNGU";
export type Continent =
  | "ASIA" | "EUROPE" | "AFRICA" | "NORTH_AMERICA" | "SOUTH_AMERICA" | "OCEANIA" | "ANTARCTICA";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "WITHDRAWN";
export type UserRole = "ADMIN" | "MEMBER";

// ===== 인증 =====

export type LoginRequest = {
  email: string;
  /** 최소 10자, 특수문자 1개 이상 (백엔드 @Pattern) */
  password: string;
  /** true 면 30일 remember-me 쿠키 발급 */
  remember: boolean;
};

export type LoginResponse = {
  id: number;
  email: string;
  name: string;
  userStatus: UserStatus;
};

export type ProfileResponse = {
  email: string;
  name: string;
  nickname: string;
  phone: string;
  userStatus: UserStatus;
  createdAt: string; // ISO-8601 LocalDateTime
};

// ===== 회사 카드(목록/검색 결과 1건) =====

export type CompanySummary = {
  id: number;
  companyName: string;
  introTitle: string | null;
  logoUrl: string | null;
  /**
   * 카드 커버 사진. 로고와 다른 자리다 — 로고는 정사각 배지, 커버는 카드 배경에 깔리는 와이드 사진.
   * 스포트라이트(거의 정사각)와 추천 카드(가로로 긴 띠)가 같은 이미지를 다른 비율로 자른다(object-cover).
   */
  coverImageUrl: string | null;
  /** 스포트라이트 카드 배경색 (#RRGGBB). 없으면 기본 남색으로 떨어진다 */
  brandColor: string | null;
  /** 카드에는 도로명 주소만 내려온다(상세 주소·지번 제외) */
  address: string | null;
  /** 관리자 검수 배지 */
  verified: boolean;
  featured: boolean;
  spotlight: boolean;
  categoryNames: string[];
  tagNames: string[];
  industryNames: string[];
  /** 로그인 뷰어 기준. 익명이면 항상 false. 내 기업 목록에서는 채워지지 않으므로(항상 false) 쓰지 않는다 */
  likedByMe: boolean;
  favoritedByMe: boolean;
  /*
   * 아래 넷은 **내 기업 목록(`/companies/my`)에만** 실린다. 다른 경로에서는 키 자체가 없다.
   */
  visibility?: CompanyVisibility;
  /** 국세청 사업자 확인. 위의 verified(에디터 선정 배지)와 다른 축이다 */
  businessVerified?: boolean;
  createdAt?: string;
  /** 회사 기본 정보의 마지막 수정. 컬렉션(태그·이미지 등)만 바꾼 수정은 반영되지 않는다 */
  updatedAt?: string;
};

/**
 * GET /api/v1/companies/drafts — 내 임시저장 초안 한 줄(최근 저장순, 페이징 없음).
 * 고르는 화면용이라 폼 전체는 없다. 이어 쓸 때는 businessNumber 로 단건 조회한다.
 */
export type CompanyDraftSummary = {
  /** 하이픈 없는 숫자 10자리 */
  businessNumber: string;
  /** 초안에 적어 둔 회사명. 아직 안 썼으면 null */
  companyName: string | null;
  updatedAt: string;
};

/**
 * GET /api/v1/companies/showcase — 메인 화면 노출 영역.
 *
 * 페이지가 아니라 **자리 수만큼의 고정 리스트**라 `pageInfo` 가 없다. 몇 칸인지는 서버 설정이므로
 * 프론트가 개수를 가정하지 않는다 — 받은 만큼 그린다.
 *
 * 레일끼리 같은 회사가 함께 나올 수 있다(관리자 고정 + 추천, 또는 유료 기업이 최근 등록에도).
 * 각 영역이 독립적으로 의미를 갖는 노출이라 의도된 동작이고, **프론트에서 중복을 제거하지 않는다.**
 */
export type CompanyShowcaseResponse = {
  spotlight: CompanySummary[];
  featured: CompanySummary[];
  /**
   * 최근 등록 기업. 메인 기본 상태의 기업 격자가 이걸 쓴다.
   *
   * 목록 API(`GET /companies`)로 대신하면 안 된다. 그쪽 기본 정렬은 `spotlight → featured → 최신`인데,
   * 이건 편의를 위한 기본값이 아니라 **"어떤 검색어·패싯에도 유료 기업을 상위로"라는 요금제 계약**이다.
   * 메인 상단은 이미 스포트라이트·추천 레일이 그 노출을 끝낸 자리라, 같은 정렬을 바로 아래에 한 번 더
   * 적용하면 방금 배너로 본 기업이 격자 첫 줄에 같은 순서로 다시 나온다. 그래서 지면을 나눴다.
   *
   * 뒤집어 말하면 **검색어나 패싯이 걸린 순간에는 목록 API 를 써야 한다** — 그때는 유료 상위 노출이
   * 다시 적용되는 게 맞다. 정렬 규칙이 두 지면에서 다른 건 실수가 아니라 설계다.
   *
   * 자리 밖에 기업이 더 있는지는 내려오지 않는다(공개 기업 전체를 세야 하는 값이라 뺐다).
   */
  latest: CompanySummary[];
};

/**
 * GET /api/v1/companies/stats — 메인 현황 지표.
 *
 * 개수만 필요한 화면이 목록 API 를 빌려 쓰지 않게 하려고 만든 전용 엔드포인트다. 예전에는 회사 수를
 * 목록 API 에 `size=1` 로 물어 `pageInfo.totalElement` 만 빼 썼고(카드 1건을 만들어 버렸다),
 * 인증 수는 선택지 목록 전체를 받아 길이만 셌다.
 *
 * 각 숫자는 대응하는 공개 목록과 **같은 기준**으로 서버가 센다 — 현황이 "업종 24"인데 드롭다운에
 * 20개만 있으면 안 되기 때문이다. 그러니 이 값을 화면에서 다시 계산하지 않는다.
 */
export type CompanyStatsResponse = {
  /** 공개 노출 중인 기업 수(비공개·삭제 제외) */
  companyCount: number;
  /** 공개 카테고리 트리의 **전체 노드 수**(대+중+소). 대분류 개수가 아니다 */
  categoryCount: number;
  industryCount: number;
  certificationCount: number;
};

/** GET /api/v1/companies 쿼리. 전부 선택 — 없으면 그 조건이 빠진다(전체 브라우즈). */
export type CompanySearchQuery = {
  /** 통합 검색어. 회사명·소개·태그·장비명 등 도큐먼트 전체를 훑는다 */
  keyword?: string;
  // 고급검색: 지정한 필드에만 부분일치
  companyName?: string;
  introTitle?: string;
  content?: string;
  ceoName?: string;
  address?: string;
  detailAddress?: string;
  reference?: string;
  equipment?: string;
  material?: string;
  // 패싯: 차원 안에서는 OR. 카테고리는 후손 서브트리까지 잡힌다.
  // 인증만 예외 — type(경영시스템/산업특화/시장진입) 안에서는 OR, type 끼리는 AND.
  certificationIds?: number[];
  industryIds?: number[];
  categoryIds?: number[];
  /** 1-based. 기본 20, 최대 100 */
  page?: number;
  size?: number;
};

// ===== 회사 상세(공개) =====

export type ContactResponse = {
  contactName: string;
  position: string | null;
  phone: string | null;
  email: string | null;
};

export type GalleryImageResponse = {
  imageUrl: string;
  imageType: ImageType;
  displayOrder: number;
  /**
   * 공개 노출 여부. 저장은 살아 있지만 등급 한도를 넘겨 가려진 상태를 뜻한다(삭제가 아니다).
   *
   * **공개 조회에서는 항상 true 다** — 꺼진 이미지는 응답에서 아예 빠지기 때문이다.
   * `false` 가 나타나는 건 소유자/관리자 조회뿐이고, 그쪽 화면은 "저장돼 있지만 지금은 공개되지 않는
   * 항목"을 회색으로 구분하는 근거로 쓴다. 여기서 지워버리면 소유자가 데이터가 날아갔다고 오해한다.
   */
  active: boolean;
};

export type ProjectReferenceResponse = {
  projectTitle: string;
  achievements: string | null;
  partners: string | null;
  period: string | null;
  thumbnailUrl: string | null;
};

export type CategoryRef = {
  id: number;
  categoryName: string;
  slug: string;
  depth: number;
  iconUrl: string | null;
  /** `GalleryImageResponse.active` 와 같은 규약 — 공개 조회에서는 항상 true, 소유자/관리자 조회에서만 false */
  active: boolean;
};

export type CertificationRef = {
  id: number;
  certificationName: string;
  type: CertificationType;
};

export type CountryRef = {
  id: number;
  /** ISO alpha-2. 국기 아이콘 렌더에 쓴다 */
  code: string;
  nameKo: string;
  nameEn: string;
  continent: Continent;
};

export type RegionRef = {
  id: number;
  code: string;
  name: string;
  /** 화면에 그대로 쓰는 완성형 표기("경기 전역" / "경기 오산") */
  displayName: string;
  level: RegionLevel;
};

export type IndustryRef = {
  id: number;
  industryName: string;
  slug: string;
  iconUrl: string | null;
};

/** GET /api/v1/companies/{id} — 누구에게 보여도 안전한 필드만. 사업자번호·소유정보는 없다. */
export type CompanyPublicResponse = {
  id: number;
  companyName: string;
  ceoName: string;
  /**
   * yyyy-MM-dd. **null 이 될 수 있다** — Company 엔티티에서 이 컬럼만 NOT NULL 이 아니다
   * (companyName·ceoName 은 필수). 개업일자는 국세청 인증본에서 채워지는 값이라 등록 경로에
   * 따라 비어 있을 수 있고, 시드 C20 이 그 표본이다.
   */
  establishmentDate: string | null;
  // postalCode 는 없다 — 백엔드가 공개 응답에서 의도적으로 뺐다(화면에 안 쓰이고 도로명·지번으로 충분).
  roadAddress: string | null;
  jibunAddress: string | null;
  detailAddress: string | null;
  website: string | null;
  logoUrl: string | null;
  /** 상세에서는 히어로 배경. 갤러리(galleryImages)와는 별개의 값이다 */
  coverImageUrl: string | null;
  introTitle: string | null;
  content: string | null;
  trlLevel: TrlLevel | null;
  videoUrl: string | null;
  leadTime: string | null;
  asInfo: string | null;
  pricingType: PricingType | null;
  brandColor: string | null;

  /** 에디터 선정 큐레이션 배지 */
  verified: boolean;
  /** 국세청 사업자 확인 배지 — verified 와 다른 축이라 따로 그린다 */
  businessVerified: boolean;
  featured: boolean;
  spotlight: boolean;

  likedByMe: boolean;
  favoritedByMe: boolean;

  /** 대표 1건만. 없으면 null */
  representativeContact: ContactResponse | null;
  galleryImages: GalleryImageResponse[];
  representativeReference: ProjectReferenceResponse | null;
  materialNames: string[];
  equipmentNames: string[];
  tagNames: string[];
  categories: CategoryRef[];
  certifications: CertificationRef[];
  countries: CountryRef[];
  regions: RegionRef[];
  industries: IndustryRef[];
};

/**
 * GET /api/v1/companies/{id}/private — 소유자 전용 상세. 공개 응답(profile)에 운영 정보(meta)를 덧붙인 합성이다.
 * profile 은 공개 응답 그대로라, 공개에서 일부러 줄인 값(우편번호 · 레퍼런스 이미지 전체)은 meta 로 따로 온다.
 * 꺼진(등급 초과로 숨겨진) 카테고리·갤러리 이미지도 `active: false` 로 함께 온다.
 */
export type CompanyDetailResponse = {
  profile: CompanyPublicResponse;
  meta: CompanyManagementMeta;
};

export type CompanyManagementMeta = {
  businessNumber: string | null;
  /** 공개 profile 에는 없다 — 수정 화면용 */
  postalCode: string;
  registrationSource: RegistrationSource;
  registeredBy: number | null;
  ownerUserId: number | null;
  claimed: boolean;
  spotlightOrder: number;
  verified: boolean;
  /** true 면 대표자명·개업일자는 일반 수정으로 못 바꾼다(재인증으로만) */
  businessVerified: boolean;
  businessVerifiedAt: string | null;
  featured: boolean;
  spotlight: boolean;
  deleted: boolean;
  visibility: CompanyVisibility;
  /** false = 동영상이 저장돼 있지만 등급이 낮아 공개 화면에서 가려진 상태 */
  videoVisibleToPublic: boolean;
  /**
   * 대표 레퍼런스의 이미지 전부(꺼진 것 포함, 표시 순서). profile.representativeReference 는 표지 한 장뿐이라,
   * 레퍼런스 전체 교체(PUT) 전에 수정 화면은 이 목록으로 채워야 나머지 장이 지워지지 않는다.
   */
  representativeReferenceImages: GalleryImageResponse[];
  createdAt: string;
  updatedAt: string;
};

/**
 * PATCH /api/v1/companies/{id} — 본체 부분 수정. **키 생략(=null)은 미변경, "" 는 비우기.**
 * 기업명·도로명·상세주소는 비울 수 없고, enum·날짜는 비우기를 지원하지 않는다(값이 오면 교체만).
 * 우편번호는 5자리 숫자만(빈 값 불가).
 */
export type CompanyUpdateRequest = Partial<{
  companyName: string;
  ceoName: string;
  establishmentDate: string;
  postalCode: string;
  roadAddress: string;
  jibunAddress: string;
  detailAddress: string;
  website: string;
  logoUrl: string;
  coverImageUrl: string;
  introTitle: string;
  content: string;
  trlLevel: TrlLevel;
  videoUrl: string;
  leadTime: string;
  asInfo: string;
  pricingType: PricingType;
  brandColor: string;
}>;

/** POST /api/v1/companies/{id}/verification — 국세청 인증 회사의 대표자명·개업일자 변경 창구 */
export type CompanyReverificationRequest = { ceoName: string; businessStartDate: string };
export type CompanyReverificationResponse = {
  businessNumber: string;
  ceoName: string;
  businessStartDate: string;
  verifiedAt: string;
};

/** GET /api/v1/companies/{id}/subscription — 소유자 전용 */
export type CompanySubscriptionResponse = {
  companyId: number;
  companyName: string;
  /** 계약(저장)된 등급 */
  grade: CompanyGrade;
  /** 만료·체험을 반영해 서버가 파생한 실제 유효 등급. 화면의 등급 표시·한도 안내는 이 값을 쓴다 */
  effectiveGrade: CompanyGrade;
  status: SubscriptionStatus;
  startedAt: string; // yyyy-MM-dd
  /** null = 무기한(만료 없음) */
  expiresAt: string | null;
  /** effectiveGrade 가 허용하는 입력 한도. 수정 폼의 개수 제어 근거 */
  limits: GradeLimits;
};

// ===== 옵션(마스터) =====

/** GET /api/v1/categories — 트리(children 재귀, depth 1~3) */
export type CategoryPublicResponse = {
  id: number;
  categoryName: string;
  slug: string;
  depth: number;
  iconUrl: string | null;
  children: CategoryPublicResponse[];
};

/** GET /api/v1/industries */
export type IndustryPublicResponse = {
  id: number;
  industryName: string;
  slug: string;
  iconUrl: string | null;
};

/** GET /api/v1/certifications — type 별로 프론트가 드롭다운을 나눈다 */
export type CertificationPublicResponse = {
  id: number;
  certificationName: string;
  slug: string;
  type: CertificationType;
};

/** GET /api/v1/countries — 250건 평면. 대륙 그룹핑은 프론트가 continent 로 묶는다 */
export type CountryPublicResponse = {
  id: number;
  code: string;
  nameKo: string;
  nameEn: string;
  continent: Continent;
};

/** GET /api/v1/domestic-regions — 전국/시도/시군구 트리. 자식은 가나다순으로 이미 정렬돼 있다 */
export type DomesticRegionPublicResponse = {
  id: number;
  shortName: string;
  displayName: string;
  level: RegionLevel;
  children: DomesticRegionPublicResponse[];
};
// ===== 회사 등록(자가등록) =====

/** POST /api/v1/companies/verification — 국세청 사업자 확인. 하이픈은 있어도 없어도 된다 */
export type CompanyVerificationRequest = {
  businessNumber: string;
  ceoName: string;
  /** yyyy-MM-dd. 설립일이 아니라 사업자등록증의 개업연월일이다 */
  businessStartDate: string;
};

/**
 * 등급이 허용하는 입력 한도. 폼이 개수를 막는 근거다 — **프론트가 등급→한도 표를 들고 있지 않는다.**
 * videoAllowed=false 여도 서버는 videoUrl 을 거절하지 않는다(공개 조회에서만 가린다). 자물쇠는 화면 몫이다.
 */
export type GradeLimits = {
  maxCategories: number;
  maxDetailImages: number;
  maxReferenceImages: number;
  videoAllowed: boolean;
};

export type CompanyVerificationResponse = {
  verificationId: number;
  /** 정규화된 숫자 10자리(하이픈 없음) */
  businessNumber: string;
  ceoName: string;
  businessStartDate: string; // yyyy-MM-dd
  expiresAt: string; // ISO LocalDateTime
  /** 이 인증으로 회사를 만들면 받을 등급(예고) */
  initialGrade: CompanyGrade;
  limits: GradeLimits;
};

export type ContactRequest = {
  contactName: string;
  position: string | null;
  phone: string | null;
  email: string | null;
};

export type ImageRequest = { imageUrl: string; imageType: ImageType };

export type ReferenceRequest = {
  projectTitle: string | null;
  achievements: string | null;
  partners: string | null;
  period: string | null;
  imageUrls: string[];
};

/** 마스터에서 고른 인증은 id 만, "기타"(ETC)를 골랐을 때만 customName 을 함께 보낸다 */
export type CertificationRequest = { certificationId: number; customName: string | null };

/**
 * POST /api/v1/companies 본문이자 초안(PUT /drafts/{businessNumber}) payload.
 * 신원 3종(사업자번호·대표자명·개업일자)은 자리 자체가 없다 — 서버가 인증본에서 채운다.
 * 표시 순서(displayOrder)는 보내지 않는다. 배열 순서가 곧 순서다.
 */
export type MyCompanyCreateRequest = {
  verificationId: number | null;
  companyName: string | null;
  postalCode: string | null;
  roadAddress: string | null;
  jibunAddress: string | null;
  detailAddress: string | null;
  website: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  introTitle: string | null;
  content: string | null;
  trlLevel: TrlLevel | null;
  videoUrl: string | null;
  leadTime: string | null;
  asInfo: string | null;
  pricingType: PricingType | null;
  brandColor: string | null;
  visibility: CompanyVisibility | null;
  contacts: ContactRequest[] | null;
  images: ImageRequest[] | null;
  references: ReferenceRequest[] | null;
  materialNames: string[] | null;
  equipmentNames: string[] | null;
  tagNames: string[] | null;
  categoryIds: number[] | null;
  certifications: CertificationRequest[] | null;
  countryIds: number[] | null;
  domesticRegionIds: number[] | null;
  industryIds: number[] | null;
};

/**
 * GET /api/v1/companies/drafts/{businessNumber}.
 * `verification` 은 **지금 이 번호로 발행에 쓸 인증**이다(payload.verificationId 는 저장 당시 값이라 낡을 수 있다).
 * 이어쓸 인증이 없으면 null — 사업자 인증부터 다시 받아야 한다.
 */
export type CompanyDraftResponse = {
  payload: MyCompanyCreateRequest;
  updatedAt: string; // ISO LocalDateTime
  verification: CompanyVerificationResponse | null;
};

// ===== 메타(폼을 그리는 근거) =====

/** GET /api/v1/meta/options — 서버가 라벨을 소유하는 선택지(trlLevel·pricingType) */
export type EnumOption = { value: string; label: string };
export type OptionsResponse = Record<string, EnumOption[]>;

/** 규칙 1건. type 은 required · maxLength · minLength · maxItems 등 */
export type ConstraintRule = { type: string; value?: number; message: string };

/** 규칙도 하위 필드도 없는 키는 빠져서 온다(빈 배열을 내려보내지 않는다) */
export type FieldConstraints = {
  field?: string;
  rules?: ConstraintRule[];
  fields?: FieldConstraints[];
  items?: FieldConstraints;
};

/** GET /api/v1/meta/constraints/{form} — fields 는 폼 순서 */
export type FormConstraintsResponse = {
  form: string;
  rules?: ConstraintRule[];
  fields?: FieldConstraints[];
};

/** GET /api/v1/meta/upload — 한 장당 제약. 배포마다 달라질 수 있어 화면에 박지 않는다 */
export type UploadConstraintsResponse = {
  maxFileSizeBytes: number;
  allowedContentTypes: string[];
  allowedExtensions: string[];
};

/** POST /api/v1/uploads. url 은 상대경로(/api/v1/files/…)라 그대로 <img src> 와 요청 본문에 쓴다 */
export type UploadResponse = { url: string; contentType: string; size: number };
