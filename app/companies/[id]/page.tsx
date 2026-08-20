"use client";

import Link from "next/link";
import { Fragment, use, useEffect, useState } from "react";
import Cover from "@/components/Cover";
import DetailTabs, { type DetailTab, TAB_BAR_HEIGHT } from "@/components/DetailTabs";
import LikeFavorite from "@/components/LikeFavorite";
import Logo from "@/components/Logo";
import { FactoryIcon, PinIcon, PlayIcon, ShareIcon, VerifiedIcon } from "@/components/icons";
import { ApiError } from "@/lib/api";
import { getCompany } from "@/lib/companies";
import {
  CERTIFICATION_TYPE_LABEL,
  CERTIFICATION_TYPE_ORDER,
  PRICING_TYPE_LABEL,
  TRL_LEVEL_LABEL,
} from "@/lib/labels";
import type { CompanyPublicResponse } from "@/types/api";

/**
 * 소개 영상 카드를 그릴지. 지금은 끈다.
 *
 * 백엔드는 `videoUrl` 을 내려주지만 화면에서 일단 감추기로 했다. 값이 사라진 게 아니라 노출을
 * 미룬 것이라 마크업을 지우지 않고 이 스위치만 둔다 — 다시 켤 때 이 한 줄을 true 로 바꾼다.
 */
const SHOW_INTRO_VIDEO = false;

/**
 * 끝난 조회 1건의 결과. 성공이면 company, 실패면 error 가 찬다.
 * `id` 를 함께 들고 있어야 "다른 회사의 결과"와 "아직 안 온 결과"를 구분할 수 있다.
 */
type Loaded = { id: number; company: CompanyPublicResponse | null; error: string };

/**
 * 기업 상세(공개) — `GET /api/v1/companies/{id}`.
 *
 * 디자인 정본은 Claude Design 의 **"플랜틀리 기업 상세페이지 v2"** 다(메인은 "확정 4a").
 * 구조는 남색 히어로 → 따라다니는 섹션 탭 → 본문 2단(왼쪽 서술, 오른쪽 사양 사이드바)이고,
 * 원본에 있는 모서리 등록 마크·방안지 격자는 메인에서 뺀 것과 같은 이유로 여기서도 쓰지 않는다.
 *
 * 원본이 그린 값 중 백엔드에 없는 것(플랫폼 중개 문의, 평균 납기 숫자, 최종 검수일)은
 * **지어내지 않고** 실제로 셀 수 있는 축으로 바꾸거나 뺐다 — 어디를 어떻게 바꿨는지는 CLAUDE.md 의
 * "디자인과 API가 어긋나는 곳" 표에 적어 둔다.
 *
 * 인증이 세션 쿠키 기반이라 데이터를 읽는 컴포넌트는 클라이언트다(CLAUDE.md 페칭 규칙).
 * 그래서 `params` 는 `use()` 로 푼다 — 클라이언트 페이지에서는 await 를 쓸 수 없다.
 */
export default function CompanyDetailPage({ params }: PageProps<"/companies/[id]">) {
  const { id } = use(params);

  // 주소창에는 아무 문자열이나 들어올 수 있다. 서버에 물어보기 전에 여기서 거른다.
  // 렌더 중에 답이 나오는 값이라 상태로 들고 있지 않는다.
  const companyId = Number(id);
  const validId = Number.isInteger(companyId) && companyId > 0;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  /** 좋아요·즐겨찾기 실패(주로 비로그인). 본문은 그대로 두고 탭 아래에 한 줄로 띄운다. */
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!validId) return;

    const controller = new AbortController();
    getCompany(companyId, controller.signal)
      .then((data) => setLoaded({ id: companyId, company: data, error: "" }))
      .catch((e) => {
        // 취소도 여기로 떨어진다(AbortError). 화면을 떠난 요청이라 아무것도 하지 않는다.
        if (controller.signal.aborted) return;
        setLoaded({
          id: companyId,
          company: null,
          error:
            e instanceof ApiError && e.isNotFound
              ? // 비공개·삭제된 회사도 공개 경로에서는 404 다 — "숨겨져 있다"를 알려주지 않는 게 규약이다.
                "존재하지 않거나 공개되지 않은 기업입니다."
              : e instanceof ApiError
                ? e.message
                : "기업 정보를 불러오지 못했습니다.",
        });
      });
    return () => controller.abort();
  }, [companyId, validId]);

  // 담긴 결과가 지금 보고 있는 회사의 것일 때만 쓴다. 다르면 아직 로딩 중이라는 뜻이라,
  // 회사를 옮겨 다닐 때 이전 회사의 내용이 잠깐 비치지 않는다(메인의 Listing.key 와 같은 규약).
  const current = loaded?.id === companyId ? loaded : null;
  const company = current?.company ?? null;
  const error = validId ? (current?.error ?? "") : "잘못된 주소입니다.";

  // 클라이언트 페이지라 metadata 를 export 할 수 없다. 탭 제목만 직접 맞춰 준다.
  useEffect(() => {
    if (company) document.title = `${company.companyName} — 플랜틀리`;
  }, [company]);

  if (error) {
    return (
      <div className="px-4 py-16 text-center sm:px-[30px]">
        <p className="text-sm text-muted">{error}</p>
        <Link href="/" className="btn btn-secondary mt-4">
          기업 찾기로 돌아가기
        </Link>
      </div>
    );
  }

  if (!company) {
    return <DetailSkeleton />;
  }

  const address = [company.roadAddress, company.detailAddress].filter(Boolean).join(" ");

  // 인증은 평면 리스트로 오고 묶는 건 화면 몫이다. 빈 그룹은 라벨만 남으므로 미리 걷어낸다.
  const certificationGroups = CERTIFICATION_TYPE_ORDER.map((type) => ({
    type,
    items: company.certifications.filter((c) => c.type === type),
  })).filter((group) => group.items.length > 0);

  // 어떤 섹션을 그리는지가 곧 탭 목록이다 — 빈 섹션은 제목만 남기지 않고 통째로 뺀다(C20).
  const hasOverview = Boolean(
    company.content || company.tagNames.length || (SHOW_INTRO_VIDEO && company.videoUrl),
  );
  // 분류(categories)는 히어로로 올라갔으므로 이 조건에 넣지 않는다 — 넣으면 분류만 있는 회사에
  // 아무것도 없는 "제공 분야" 섹션과 그 탭이 남는다.
  const hasCapability =
    company.materialNames.length > 0 ||
    company.equipmentNames.length > 0 ||
    certificationGroups.length > 0 ||
    company.regions.length > 0 ||
    company.countries.length > 0;
  const hasProject = Boolean(company.representativeReference);
  const hasGallery = company.galleryImages.length > 0;
  const contact = company.representativeContact;

  // 빵부스러기에 쓸 상위 분류. 정렬이 보장되지 않으므로 depth 로 직접 고른다.
  const topCategory = company.categories.reduce<(typeof company.categories)[number] | null>(
    (top, category) => (top === null || category.depth < top.depth ? category : top),
    null,
  );

  const tabs: DetailTab[] = [];
  if (hasOverview) tabs.push({ id: "overview", label: "기업 소개" });
  if (hasCapability) tabs.push({ id: "capability", label: "제공 분야" });
  if (hasProject) tabs.push({ id: "project", label: "프로젝트" });
  if (hasGallery) tabs.push({ id: "gallery", label: "상세 이미지" });
  if (contact) tabs.push({ id: "contact", label: "연락처" });

  /*
   * 원본 디자인의 "문의하기"는 플랜틀리가 중개하는 문의(영업일 1일 내 회신)인데 그런 API 가 없다.
   * 버튼을 지우는 대신 등록된 담당자 연락처로 바로 연결한다 — 메일이 있으면 메일, 없으면 전화다.
   */
  const inquiry = contact?.email
    ? {
        href: `mailto:${contact.email}?subject=${encodeURIComponent(`[플랜틀리] ${company.companyName} 문의`)}`,
        // 어디로 가는지 주소까지 보여준다 — 누르기 전에 목적지가 보이는 편이 미덥다.
        note: `담당자 이메일(${contact.email})로 메일 창이 열립니다.`,
      }
    : contact?.phone
      ? { href: `tel:${contact.phone}`, note: `담당자 전화(${contact.phone})로 연결됩니다.` }
      : null;

  const specs: { key: string; value: string }[] = [{ key: "대표자", value: company.ceoName }];
  if (company.establishmentDate)
    specs.push({ key: "설립일", value: formatDate(company.establishmentDate) });
  if (company.trlLevel)
    specs.push({ key: "기술 성숙도", value: TRL_LEVEL_LABEL[company.trlLevel] });
  if (company.leadTime) specs.push({ key: "납기", value: company.leadTime });
  if (company.pricingType)
    specs.push({ key: "가격 정책", value: PRICING_TYPE_LABEL[company.pricingType] });

  return (
    <div className="flex flex-col">
      {/* ── 히어로 ────────────────────────────────────────────────────
          디자인 원본의 남색 판. 커버 사진은 오른쪽에서 흐릿하게 깔리고 왼쪽으로 갈수록 남색에 묻는다. */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        {company.coverImageUrl && (
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 hidden w-[430px] opacity-[0.34] lg:block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={company.coverImageUrl}
              alt=""
              className="size-full object-cover grayscale contrast-[1.05]"
            />
            <div className="absolute inset-0 bg-linear-to-r from-brand-900 via-45% via-brand-900/50 to-brand-900/75" />
          </div>
        )}

        {/* 현재 위치 표시라 한 줄을 넘기지 않는다 — 긴 회사명은 여기서 자른다(제목에 온전히 있다). */}
        <nav className="relative flex items-center gap-1.5 px-4 pt-4 text-xs text-white/50 sm:px-[30px]">
          <Link href="/" className="shrink-0 text-white/60 no-underline hover:text-white">
            기업 찾기
          </Link>
          {/*
            가장 상위 분류 하나. 대분류가 연결돼 있으리라는 보장이 없어(C01 은 소분류만 달려 있다)
            depth 가 가장 작은 것을 고른다. 목록 화면이 아직 없어 링크가 아니라 글자로 둔다.
          */}
          {topCategory && (
            <>
              <span className="shrink-0 text-white/30">/</span>
              <span className="shrink-0">{topCategory.categoryName}</span>
            </>
          )}
          <span className="shrink-0 text-white/30">/</span>
          <span className="truncate text-white">{company.companyName}</span>
        </nav>

        <div className="relative flex flex-col gap-8 px-4 pt-[22px] pb-[30px] sm:px-[30px] lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-[15px]">
            <div className="flex items-start gap-[18px]">
              {/* 테두리 없이 사진만 놓는다 — 둥근 모서리에 맞춰 사진 귀퉁이가 깎이는 건 감수한다. */}
              <Logo
                url={company.logoUrl}
                name={company.companyName}
                className="size-[78px] rounded-xl"
              />
              <div className="flex min-w-0 flex-col gap-[9px]">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/*
                    한글 줄바꿈 두 겹.
                    break-keep 은 평범한 문장에서 어절이 중간에 끊기지 않게 하고, wrap-anywhere 는 그것만으로는
                    한 줄에 못 담는 덩어리(C22 는 공백 없는 60여 자가 한 덩이다)를 강제로 자른다.
                    wrap-anywhere 여야 하는 이유는 flex 자식의 min-content 폭까지 줄여 주기 때문이다 —
                    break-words 로는 폭 계산이 그대로라 판을 뚫고 오른쪽으로 흘러나간다.
                  */}
                  <h1 className="min-w-0 text-[32px] leading-[1.06] break-keep wrap-anywhere sm:text-[42px]">
                    {company.companyName}
                  </h1>
                  {/* verified(에디터 선정)와 businessVerified(국세청 확인)는 다른 축이라 한 배지로 합치지 않는다. */}
                  {company.verified && (
                    <span className="ind ind-dark gap-1.5">
                      <VerifiedIcon size={13} />
                      플랜틀리 검수
                    </span>
                  )}
                  {company.businessVerified && (
                    <span className="ind border-white/25 text-white/65">사업자 확인</span>
                  )}
                </div>

                <div className="flex items-start gap-1.5 text-[13px] leading-[1.5] text-white/70">
                  <PinIcon size={14} className="mt-0.5 shrink-0 text-brand-300" />
                  <span>
                    {address || "주소 미등록"}
                    {/* 지번은 같은 곳을 다르게 적은 것뿐이라 줄을 늘리지 않고 괄호로 붙인다. */}
                    {company.jibunAddress && (
                      <span className="text-white/45"> (지번 {company.jibunAddress})</span>
                    )}
                  </span>
                </div>

                {company.introTitle && (
                  <p className="text-base leading-[1.5] text-white/85 text-pretty">
                    {company.introTitle}
                  </p>
                )}

                {company.industries.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-[7px]">
                    {company.industries.map((industry) => (
                      <span key={industry.id} className="ind ind-dark">
                        <FactoryIcon size={12} />
                        {industry.industryName}
                      </span>
                    ))}
                  </div>
                )}

                {/*
                  정식 분류. 업종(어떤 산업인가)과 분류(무엇을 다루는가)는 다른 축이라 줄을 나눈다.
                  남색 배경 위라 아웃라인 칩도 밝은 파랑 계열(tagcat-dark)로 뒤집는다.
                */}
                {company.categories.length > 0 && (
                  <div className="flex flex-wrap items-center gap-[7px]">
                    {company.categories.map((category) => (
                      <span key={category.id} className="tag tag-lg tagcat-dark">
                        {category.categoryName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <HeroStats company={company} />
          </div>

          <div className="flex w-full flex-col gap-2 lg:w-[262px] lg:flex-none">
            {inquiry ? (
              <a href={inquiry.href} className="btn btn-primary w-full py-[11px] text-[15px]">
                문의하기
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="btn btn-primary w-full py-[11px] text-[15px]"
              >
                문의하기
              </button>
            )}

            <div className="flex gap-2">
              {company.website && (
                <a
                  href={externalHref(company.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn flex-1 border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                  웹사이트
                </a>
              )}
              <LikeFavorite
                company={company}
                onError={setNotice}
                iconSize={17}
                buttonClassName="icbtn-dark size-[38px]"
              />
              <button
                type="button"
                aria-label="공유하기"
                className="icbtn icbtn-dark size-[38px]"
                onClick={() => void copyLink()}
              >
                <ShareIcon size={17} />
              </button>
            </div>

            <p className="mt-0.5 text-[12px] leading-[1.5] text-white/45">
              {inquiry?.note ?? "등록된 담당자 연락처가 없어 문의를 보낼 수 없습니다."}
            </p>
          </div>
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {/* 좋아요·즐겨찾기 실패(주로 비로그인)가 뜨는 자리. 링크 복사 결과는 확인 창으로 알린다. */}
      {notice && (
        <p className="border-b border-line-soft px-4 py-2.5 text-[13px] text-brand-700 sm:px-[30px]">
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-[30px] px-4 pt-[34px] pb-10 sm:px-[30px] lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-[38px]">
          {hasOverview && (
            <Section id="overview" title="기업 소개" kicker="Overview">
              {company.content && (
                // 줄바꿈만 살린다 — 서버가 내려주는 건 서식 없는 평문이라 HTML 로 해석하지 않는다.
                <p className="text-[15px] leading-[1.8] whitespace-pre-line text-ink/80 text-pretty">
                  {company.content}
                </p>
              )}

              {company.tagNames.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {company.tagNames.map((name) => (
                    <span key={name} className="tag tag-lg tag-neutral">
                      #{name}
                    </span>
                  ))}
                </div>
              )}

              {/*
                videoUrl 은 회사 등급이 허용하지 않으면 저장돼 있어도 응답에서 null 로 온다(서버가 가린다).
                호스트가 유튜브인지 무엇인지는 계약에 없어 embed 하지 않고 링크로만 연다.
              */}
              {SHOW_INTRO_VIDEO && company.videoUrl && (
                <a
                  href={externalHref(company.videoUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="blueprint flex items-center gap-3.5 bg-white px-4 py-3.5 no-underline hover:border-brand"
                >
                  <span className="grid size-[42px] shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                    <PlayIcon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[17px] text-ink">기업 소개 영상</h3>
                    <p className="mt-0.5 text-[13px] text-muted">
                      회사가 등록한 영상이 새 탭에서 열립니다
                    </p>
                  </div>
                  <span className="btn btn-secondary">영상 보기</span>
                </a>
              )}
            </Section>
          )}

          {hasCapability && (
            <Section id="capability" title="제공 분야" kicker="Capability">
              {(company.materialNames.length > 0 || company.equipmentNames.length > 0) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {company.materialNames.length > 0 && (
                    <ChipCard kicker="Materials" title="취급 소재" items={company.materialNames} />
                  )}
                  {company.equipmentNames.length > 0 && (
                    <ChipCard kicker="Equipment" title="보유 장비" items={company.equipmentNames} />
                  )}
                </div>
              )}

              {certificationGroups.length > 0 && (
                <LabeledCard title="보유 인증" kicker={`${company.certifications.length}건`}>
                  {certificationGroups.map((group) => (
                    <Fragment key={group.type}>
                      <span className="skey pt-1">{CERTIFICATION_TYPE_LABEL[group.type]}</span>
                      <div className="flex flex-wrap gap-[7px]">
                        {group.items.map((certification) => (
                          <span key={certification.id} className="tag tag-lg tag-neutral">
                            {certification.certificationName}
                          </span>
                        ))}
                      </div>
                    </Fragment>
                  ))}
                </LabeledCard>
              )}

              {(company.regions.length > 0 || company.countries.length > 0) && (
                <LabeledCard
                  title="공급 가능 지역"
                  kicker={[
                    company.regions.length > 0 ? `국내 ${company.regions.length}` : null,
                    company.countries.length > 0 ? `해외 ${company.countries.length}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                >
                  {company.regions.length > 0 && (
                    <>
                      <span className="skey pt-1">국내</span>
                      <div className="flex flex-wrap gap-[7px]">
                        {/* displayName 이 완성형 표기다 — 부모 이름을 화면에서 조합하지 않는다. */}
                        {company.regions.map((region) => (
                          <span key={region.id} className="tag tag-lg tag-neutral">
                            {region.displayName}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {company.countries.length > 0 && (
                    <>
                      <span className="skey pt-1">해외</span>
                      <div className="flex flex-wrap gap-[7px]">
                        {company.countries.map((country) => (
                          <span key={country.id} className="tag tag-lg tag-neutral">
                            {country.nameKo}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </LabeledCard>
              )}
            </Section>
          )}

          {company.representativeReference && (
            <Section id="project" title="대표 프로젝트" kicker="Project">
              <article className="blueprint flex flex-col gap-5 bg-white p-5 sm:flex-row">
                {company.representativeReference.thumbnailUrl && (
                  <Cover
                    url={company.representativeReference.thumbnailUrl}
                    placeholderClassName="hatch"
                    className="h-[170px] w-full shrink-0 rounded-lg border border-line sm:w-[248px]"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div>
                    {company.representativeReference.period && (
                      <div className="kick mb-1.5">{company.representativeReference.period}</div>
                    )}
                    <h3 className="text-[21px] break-keep wrap-anywhere">
                      {company.representativeReference.projectTitle}
                    </h3>
                  </div>
                  {(company.representativeReference.achievements ||
                    company.representativeReference.partners) && (
                    <div className="flex flex-col gap-3 border-t border-line-soft pt-3 sm:flex-row sm:gap-0">
                      {company.representativeReference.achievements && (
                        <div className="min-w-0 flex-[1.6] sm:border-r sm:border-line-soft sm:pr-4">
                          <div className="skey mb-1.5">성과</div>
                          <p className="text-[14px] leading-[1.6] text-ink/80">
                            {company.representativeReference.achievements}
                          </p>
                        </div>
                      )}
                      {company.representativeReference.partners && (
                        <div className="min-w-0 flex-1 sm:pl-4">
                          <div className="skey mb-1.5">참여사</div>
                          <p className="text-[14px] leading-[1.6] text-ink/80">
                            {company.representativeReference.partners}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            </Section>
          )}

          {hasGallery && (
            <section
              id="gallery"
              className="flex flex-col gap-3.5"
              style={{ scrollMarginTop: TAB_BAR_HEIGHT }}
            >
              <div className="flex items-baseline gap-2.5">
                <h2 className="text-[23px]">상세 이미지</h2>
                <span className="kick">{company.galleryImages.length}장</span>
              </div>

              {/*
                격자가 아니라 본문 폭을 채우는 세로 띠다. 사진 비율이 제각각인데 상자를 못 박으면
                설비 사진이 잘리는데, 그게 이 섹션이 보여주려는 내용이라 원본 비율을 그대로 둔다.
                접지 않고 받은 만큼 전부 그린다(C21 은 30장이다) — 사진을 보러 온 자리라 한 번 더
                누르게 하지 않는다. 화면 밖 사진은 loading="lazy" 라 스크롤이 닿을 때 받아 온다.

                간격 없이 붙여 한 장의 띠처럼 보이게 한다(모서리도 깎지 않는다). 맞닿는 테두리를
                한 겹으로 합치는 건 .gshot + .gshot 쪽이다.
              */}
              <div className="flex flex-col">
                {company.galleryImages.map((image) => (
                  <figure key={image.imageUrl} className="gshot">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.imageUrl} alt="" loading="lazy" />
                  </figure>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── 사이드바 ──────────────────────────────────────────────
            사양·연락처처럼 "훑어보는 값"만 모은다. 서술은 왼쪽, 표는 오른쪽이 원본의 구분이다. */}
        <aside
          className="flex w-full flex-col gap-4 lg:sticky lg:w-[296px] lg:flex-none"
          style={{ top: TAB_BAR_HEIGHT + 4 }}
        >
          <div className="blueprint flex flex-col gap-3 bg-white p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[18px]">기본 정보</h2>
              <span className="kick">Spec</span>
            </div>
            <div>
              {specs.map((spec) => (
                <div key={spec.key} className="srow">
                  <span className="skey">{spec.key}</span>
                  <span className="sval">{spec.value}</span>
                </div>
              ))}
            </div>
          </div>

          {contact && (
            <div
              id="contact"
              className="blueprint flex flex-col gap-3 bg-white p-5"
              style={{ scrollMarginTop: TAB_BAR_HEIGHT }}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-[18px]">대표 연락처</h2>
                <span className="kick">Contact</span>
              </div>
              <div>
                <div className="srow">
                  <span className="skey">담당자</span>
                  <span className="sval">{contact.contactName}</span>
                </div>
                {contact.position && (
                  <div className="srow">
                    <span className="skey">직함</span>
                    <span className="sval">{contact.position}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="srow">
                    <span className="skey">전화</span>
                    <a href={`tel:${contact.phone}`} className="sval text-ink no-underline">
                      {contact.phone}
                    </a>
                  </div>
                )}
                {contact.email && (
                  <div className="srow">
                    <span className="skey">이메일</span>
                    <a href={`mailto:${contact.email}`} className="sval text-ink no-underline">
                      {contact.email}
                    </a>
                  </div>
                )}
              </div>
              {inquiry && (
                <a href={inquiry.href} className="btn btn-primary w-full py-2.5">
                  문의하기
                </a>
              )}
            </div>
          )}

          {company.asInfo && (
            <div className="blueprint flex flex-col gap-2 bg-white p-[18px]">
              <span className="kick">After service</span>
              <h2 className="text-[17px]">A/S 안내</h2>
              <p className="text-[14px] leading-[1.6] text-ink/75 whitespace-pre-line">
                {company.asInfo}
              </p>
            </div>
          )}

          {company.verified && (
            <div className="blueprint flex flex-col gap-3 bg-brand-900 p-[18px] text-white">
              <span className="kick text-brand-300">Verified by Plantly</span>
              <p className="text-[14px] leading-[1.6] text-white/80">
                플랜틀리 에디터가 직접 확인하고 소개하는 기업입니다.
              </p>
              {/*
                원본에는 "최종 검수 2026.07.18" 이 있지만 검수 일자는 응답에 없다.
                날짜를 지어내는 대신, 함께 확인된 축(사업자 확인)이 있을 때만 한 줄 덧붙인다.
              */}
              {company.businessVerified && (
                <span className="border-t border-white/15 pt-2.5 text-xs text-white/55">
                  국세청 사업자 확인 완료
                </span>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * 히어로 아래쪽 숫자 줄.
 *
 * 원본은 업력·평균 납기·보유 인증·공급 지역 넷을 큰 숫자로 세우는데, 평균 납기는 서버에 숫자가 없다
 * (`leadTime` 은 "4주 내외" 같은 자유 문자열이라 사이드바의 사양 표로 보낸다).
 * 대신 실제로 셀 수 있는 축(보유 장비)을 넣고, 값이 없는 칸은 0 을 세우지 않고 뺀다.
 */
function HeroStats({ company }: { company: CompanyPublicResponse }) {
  const years = yearsSince(company.establishmentDate);
  const supplyAreas = company.regions.length + company.countries.length;

  const stats = [
    years !== null ? { label: "업력", value: years, unit: "년" } : null,
    company.certifications.length > 0
      ? { label: "보유 인증", value: company.certifications.length, unit: "" }
      : null,
    supplyAreas > 0 ? { label: "공급 지역", value: supplyAreas, unit: "" } : null,
    company.equipmentNames.length > 0
      ? { label: "보유 장비", value: company.equipmentNames.length, unit: "" }
      : null,
  ].filter((stat) => stat !== null);

  if (stats.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-[26px] gap-y-3 border-t border-white/15 pt-4">
      {stats.map((stat) => (
        <div key={stat.label}>
          <div className="font-heading text-[30px] leading-[1.1]">
            {stat.value}
            {stat.unit && <span className="text-[15px] text-brand-300">{stat.unit}</span>}
          </div>
          <div className="mt-0.5 text-[12px] text-white/50">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * 본문 섹션 한 덩이. 제목 + 대문자 라벨(kicker)이 원본의 머리 모양이다.
 *
 * 비어 있는 섹션은 호출부에서 아예 그리지 않으므로 여기서 빈 상태를 다루지 않는다 —
 * 등록된 게 거의 없는 회사(C20)에 "등록된 항목이 없습니다" 를 열 줄 늘어놓지 않기 위해서다.
 * 탭 목록도 같은 조건으로 만들어져 둘이 어긋나지 않는다.
 */
function Section({
  id,
  title,
  kicker,
  children,
}: {
  id: string;
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-3.5" style={{ scrollMarginTop: TAB_BAR_HEIGHT }}>
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-[23px]">{title}</h2>
        <span className="kick">{kicker}</span>
      </div>
      {children}
    </section>
  );
}

/**
 * 소재·장비처럼 "이름 목록" 하나만 담는 카드.
 *
 * 제목은 `font-heading` 유틸리티를 붙인 div 가 아니라 진짜 heading 요소여야 한다 — 글꼴만 따라오고
 * 굵기(600)·자간은 base 레이어의 h1~h4 규칙에서 오기 때문에, div 로 두면 옆 카드(보유 인증·공급
 * 가능 지역)의 제목만 굵어 보인다.
 */
function ChipCard({ kicker, title, items }: { kicker: string; title: string; items: string[] }) {
  return (
    <div className="blueprint bg-white p-[18px]">
      <div className="kick mb-2.5">{kicker}</div>
      <h3 className="mb-3 text-[18px]">{title}</h3>
      <div className="flex flex-wrap gap-[7px]">
        {items.map((item) => (
          <span key={item} className="tag tag-lg tag-neutral">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * 축을 한 번 더 나눠 담는 카드(인증 type, 국내/해외).
 * children 은 `라벨 + 칩 묶음`이 번갈아 오는 격자 칸이라 호출부가 짝으로 넣는다.
 */
function LabeledCard({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <div className="blueprint flex flex-col gap-3.5 bg-white px-5 py-[18px]">
      <div className="flex items-baseline gap-2.5">
        <h3 className="text-[18px]">{title}</h3>
        <span className="kick">{kicker}</span>
      </div>
      <div className="grid grid-cols-[76px_1fr] items-start gap-x-4 gap-y-3">{children}</div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-6 bg-brand-900 px-4 pt-[22px] pb-[30px] sm:px-[30px]">
        <div className="flex items-start gap-[18px]">
          <div className="size-[78px] shrink-0 rounded-xl border border-white/20" />
          <div className="flex flex-1 flex-col gap-3 pt-1">
            <div className="h-[30px] w-[42%] rounded bg-white/15" />
            <div className="h-3 w-[58%] rounded bg-white/10" />
            <div className="h-3 w-[34%] rounded bg-white/10" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-6 px-4 py-8 sm:px-[30px]">
        <div className="skel h-[22px] w-[24%]" />
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skel h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** `yyyy-MM-dd` → `yyyy.MM.dd`. 서버가 이 형식만 내려주므로 Date 로 파싱하지 않는다(시간대 밀림 방지). */
function formatDate(value: string): string {
  return value.replaceAll("-", ".");
}

/**
 * 설립일로부터 지난 햇수(업력). 오늘이 기준이라 서버가 담아 줄 수 없는 값이고,
 * 문자열을 그대로 쪼개 센다 — `new Date("2005-10-08")` 은 UTC 로 읽혀 시간대에 따라 하루가 밀린다.
 */
function yearsSince(date: string | null): number | null {
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;

  const today = new Date();
  const passed =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  const years = today.getFullYear() - year - (passed ? 0 : 1);
  return years >= 0 ? years : null;
}

/**
 * 사용자가 입력한 주소라 스킴이 빠져 있을 수 있다("plantly.co.kr").
 * 그대로 href 에 넣으면 상대경로로 해석돼 우리 사이트 안에서 길을 잃는다.
 */
function externalHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * 현재 주소를 클립보드에 복사하고 결과를 확인 창으로 알린다.
 *
 * 화면 한쪽에 조용히 뜨는 줄이 아니라 눌러서 닫는 창인 이유는, 복사는 **누른 그 순간에만** 확인하면
 * 되는 일이라서다 — 히어로 아래 한 줄로 띄우면 팝업 창에서는 스크롤 밖이라 보이지도 않는다.
 *
 * `navigator.clipboard` 는 보안 컨텍스트(https·localhost)에서만 있다. 없으면 조용히 실패하지 않고
 * 직접 복사하라고 알린다.
 */
async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    window.alert("링크가 복사되었습니다.");
  } catch {
    window.alert("링크를 복사하지 못했습니다. 주소창에서 직접 복사해 주세요.");
  }
}
