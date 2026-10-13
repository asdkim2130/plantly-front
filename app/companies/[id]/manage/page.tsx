"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import CompanyDetailView, {
  DetailSkeleton,
  copyLink,
  externalHref,
} from "@/components/CompanyDetailView";
import DetailLink from "@/components/DetailLink";
import { useSession } from "@/components/SessionProvider";
import { EyeOffIcon, PencilIcon, ShareIcon, StarIcon } from "@/components/icons";
import { ApiError } from "@/lib/api";
import { getMyCompany, getSubscription } from "@/lib/companies";
import { formatBusinessNumber, formatDate, relativeTime } from "@/lib/register";
import type { CompanyDetailResponse, CompanySubscriptionResponse } from "@/types/api";

type Loaded = {
  id: number;
  detail: CompanyDetailResponse;
  subscription: CompanySubscriptionResponse;
};

/**
 * 기업 상세(소유자) — `GET /companies/{id}/private` + `GET /companies/{id}/subscription`.
 *
 * 화면 몸통은 공개 상세와 같은 `CompanyDetailView` 다. 소유자 응답의 profile 이 공개 응답과 같은 타입이라
 * 그대로 넘기고, 소유자에게만 있는 값(meta·구독)은 자리(slot)에 요소로 덧붙인다:
 *  - 히어로 위 띠: 공개 상태 · 등록일 · 최근 수정
 *  - 히어로 배지: 추천 노출 · 스팟라이트 고정(운영이 정한 노출 — 공개 상세는 그리지 않는다)
 *  - 히어로 버튼: 문의하기·좋아요·즐겨찾기 대신 수정 · 공개 페이지 보기 · 공개 주소 공유
 *  - 사이드바 맨 위: 사업자등록번호 · 국세청 인증 · 등급과 한도
 *  - 탭 아래: 등급 한도를 넘어 공개되지 않는 항목이 있다는 안내(항목 자체의 회색 표시는 몸통이 한다)
 *
 * 공개 상세(`/companies/[id]`)를 소유자 모드로 바꿔 쓰지 않은 이유: 그 주소는 공유되는 주소라 보는 사람에
 * 따라 화면이 달라지면 안 되고, 비공개 회사는 거기서 404 여야 한다. 내 기업 목록에서는 팝업이 아니라
 * 같은 탭으로 온다 — 수정·공개 전환으로 이어지는 관리 화면이라 사이트 상단바가 있어야 한다.
 */
export default function OwnerCompanyDetailPage({ params }: PageProps<"/companies/[id]/manage">) {
  const { id } = use(params);
  const companyId = Number(id);
  const valid = Number.isInteger(companyId) && companyId > 0;

  const { user, loading } = useSession();
  const router = useRouter();

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // 상대 시각("3주 전 수정")의 기준. 렌더마다 Date.now() 를 부르지 않도록 한 번만 정한다(내 기업 목록과 같다).
  const [now] = useState(() => Date.now());

  const next = `/companies/${id}/manage`;
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [loading, user, router, next]);

  useEffect(() => {
    if (!user || !valid) return;
    const controller = new AbortController();
    Promise.all([getMyCompany(companyId, controller.signal), getSubscription(companyId, controller.signal)]).then(
      ([detail, subscription]) => setLoaded({ id: companyId, detail, subscription }),
      (e) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.isForbidden) setFailure("이 회사를 관리할 권한이 없습니다.");
        else if (e instanceof ApiError && e.isNotFound) setFailure("존재하지 않거나 삭제된 회사입니다.");
        else setFailure(e instanceof ApiError ? e.message : "기업 정보를 불러오지 못했습니다.");
      },
    );
    return () => controller.abort();
  }, [user, valid, companyId]);

  const current = loaded?.id === companyId ? loaded : null;
  const companyName = current?.detail.profile.companyName;
  useEffect(() => {
    if (companyName) document.title = `${companyName} (내 기업) — 플랜틀리`;
  }, [companyName]);

  if (loading || !user) return <DetailSkeleton />;

  if (!valid || failure) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-20 text-center sm:px-[30px]">
        <p className="text-sm text-muted">{failure ?? "잘못된 주소입니다."}</p>
        <Link href="/companies/my" className="btn btn-secondary">
          내 기업으로 돌아가기
        </Link>
      </div>
    );
  }

  if (!current) return <DetailSkeleton />;

  const { detail, subscription } = current;
  const { profile: company, meta } = detail;
  const isPublic = meta.visibility !== "PRIVATE";
  const publicUrl = `/companies/${companyId}`;

  const hiddenCategories = company.categories.filter((category) => !category.active).length;
  const hiddenImages = company.galleryImages.filter((image) => !image.active).length;
  const hiddenParts = [
    hiddenCategories > 0 && `분류 ${hiddenCategories}개`,
    hiddenImages > 0 && `상세 이미지 ${hiddenImages}장`,
  ].filter((part): part is string => !!part);

  // 에디터 선정(verified)·사업자 확인은 몸통이 이미 그린다. 운영이 정한 노출 둘만 소유자에게 더 보여준다.
  const exposure = [meta.featured && "추천 노출", meta.spotlight && "스팟라이트 고정"].filter(
    (label): label is string => !!label,
  );

  return (
    <CompanyDetailView
      company={company}
      crumbs={[{ href: "/companies/my", label: "내 기업" }]}
      banner={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line bg-field px-4 py-2.5 text-[13px] sm:px-[30px]">
          {isPublic ? (
            <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-ink">
              <span aria-hidden className="size-[7px] rounded-full bg-brand" />
              공개 중
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <span className="inline-flex items-center gap-[5px] rounded-md bg-ink px-[9px] py-[3px] text-xs font-medium text-white">
                <EyeOffIcon size={13} />
                비공개
              </span>
              <span className="text-xs text-muted">검색·메인에 나오지 않고 공개 페이지도 열리지 않습니다</span>
            </span>
          )}
          <span className="text-xs whitespace-nowrap text-muted sm:ml-auto">
            등록 {formatDate(meta.createdAt)} · {relativeTime(meta.updatedAt, now)} 수정
          </span>
        </div>
      }
      heroBadges={exposure.map((label) => (
        <span key={label} className="ind ind-dark gap-1.5">
          <StarIcon size={11} />
          {label}
        </span>
      ))}
      heroActions={
        <>
          <Link href={`/companies/${companyId}/edit`} className="btn btn-primary w-full py-[11px] text-[15px]">
            <PencilIcon size={15} />
            기업정보 수정
          </Link>

          <div className="flex gap-2">
            {isPublic ? (
              <DetailLink
                companyId={companyId}
                className="btn flex-1 border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                공개 페이지 보기
              </DetailLink>
            ) : (
              <button
                type="button"
                disabled
                className="btn flex-1 border-white/20 bg-white/5 text-white/50"
              >
                공개 페이지 없음
              </button>
            )}
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
            {/* 공유는 공개 상세 주소를 복사한다 — 이 화면 주소는 남에게 보내 봐야 403 이다. 비공개면 보낼 주소가 없다. */}
            {isPublic && (
              <button
                type="button"
                aria-label="공개 페이지 주소 복사"
                className="icbtn icbtn-dark size-[38px]"
                onClick={() => void copyLink(new URL(publicUrl, window.location.origin).href)}
              >
                <ShareIcon size={17} />
              </button>
            )}
          </div>

          <p className="mt-0.5 text-[12px] leading-[1.5] text-white/45">
            {isPublic
              ? "방문자에게는 이 자리에 문의하기 · 좋아요 · 즐겨찾기가 보입니다."
              : "공개로 전환하면 검색과 메인에 다시 나옵니다(내 기업 목록의 ⋯ 메뉴)."}
          </p>
        </>
      }
      notice={
        hiddenParts.length > 0 && (
          <>
            공개되지 않는 항목이 있습니다 — {hiddenParts.join(" · ")}. 현재 등급({subscription.effectiveGrade}) 한도를
            넘어 저장만 돼 있고 방문자에게는 보이지 않습니다(아래 회색 표시).
          </>
        )
      }
      sidebarTop={
        <div className="blueprint flex flex-col gap-3 bg-white p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px]">관리 정보</h2>
            <span className="kick">Owner only</span>
          </div>
          <div>
            {meta.businessNumber && (
              <div className="srow">
                <span className="skey">사업자번호</span>
                <span className="sval">{formatBusinessNumber(meta.businessNumber)}</span>
              </div>
            )}
            <div className="srow">
              <span className="skey">국세청 인증</span>
              <span className="sval">
                {meta.businessVerified
                  ? meta.businessVerifiedAt
                    ? `인증 완료 (${formatDate(meta.businessVerifiedAt)})`
                    : "인증 완료"
                  : "미인증"}
              </span>
            </div>
            <div className="srow">
              <span className="skey">등급</span>
              <span className="sval">
                <GradeLabel subscription={subscription} />
              </span>
            </div>
            <div className="srow">
              <span className="skey">등급 한도</span>
              <span className="sval">
                분류 {subscription.limits.maxCategories} · 상세 이미지 {subscription.limits.maxDetailImages}장 ·
                레퍼런스 이미지 {subscription.limits.maxReferenceImages}장 · 동영상{" "}
                {subscription.limits.videoAllowed ? "허용" : "불가"}
              </span>
            </div>
          </div>
        </div>
      }
    />
  );
}

/**
 * 등급 한 줄. 화면의 등급은 계약 등급(grade)이 아니라 서버가 만료·체험을 반영해 파생한 effectiveGrade 다.
 * 둘이 다르면 체험이 끝나 강등된 상태라 계약 등급을 괄호로 남긴다.
 */
function GradeLabel({ subscription }: { subscription: CompanySubscriptionResponse }) {
  const { grade, effectiveGrade, status, expiresAt } = subscription;
  const suffix =
    grade !== effectiveGrade
      ? `${grade} 만료`
      : status === "TRIAL"
        ? expiresAt
          ? `체험 · ${expiresAt}까지`
          : "체험"
        : status === "ADMIN_EXEMPT"
          ? "한도 면제"
          : expiresAt
            ? `${expiresAt}까지`
            : null;
  return (
    <>
      <span className="font-heading tracking-[0.06em]">{effectiveGrade}</span>
      {suffix && <span className="text-muted"> ({suffix})</span>}
    </>
  );
}
