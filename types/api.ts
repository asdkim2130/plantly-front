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
  error?: string;
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
export type CertificationType = "MANAGEMENT_SYSTEM" | "INDUSTRY_SPECIFIC" | "MARKET_ACCESS";
export type RegionLevel = "NATION" | "SIDO" | "SIGUNGU";
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
  /** 로그인 뷰어 기준. 익명이면 항상 false */
  likedByMe: boolean;
  favoritedByMe: boolean;
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
  establishmentDate: string; // yyyy-MM-dd
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