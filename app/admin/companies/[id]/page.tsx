"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import CompanyDetailView, { DetailSkeleton, externalHref } from "@/components/CompanyDetailView";
import DetailLink from "@/components/DetailLink";
import GradeLabel from "@/components/GradeLabel";
import { useSession } from "@/components/SessionProvider";
import { EyeOffIcon, PencilIcon, StarIcon, TrashIcon } from "@/components/icons";
import { ApiError } from "@/lib/api";
import { getAdminCompany, getAdminSubscription } from "@/lib/admin";
import { formatBusinessNumber, formatDate, relativeTime } from "@/lib/register";
import type { AdminCompanySubscriptionResponse, CompanyDetailResponse } from "@/types/api";

type Loaded = {
  id: number;
  detail: CompanyDetailResponse;
  subscription: AdminCompanySubscriptionResponse;
};

/**
 * 기업 상세(관리자) — `GET /admin/companies/{id}` + `GET /admin/companies/{id}/subscription`.
 *
 * 소유자 상세(`/companies/[id]/manage`)와 같은 몸통(`CompanyDetailView`)에 같은 응답 모양(profile + meta)을 넘긴다.
 * 소유자 상세를 관리자에게 열지 않은 이유: 그 화면은 소유자 API(`/private`)를 써서 멤버가 아니면 403 이다.
 * 관리자 상세는 소유 무관이고 **삭제된 회사도 열린다**.
 *
 * 소유자 상세와 다른 자리:
 *  - 히어로 위 띠: 삭제됨 · 공개 상태 · 등록 출처 · 소유자 연동 · 등록일 · 최근 수정
 *  - 히어로 버튼: 기업정보 수정(관리자 수정 화면) · 공개 페이지 보기(공개이고 삭제되지 않았을 때만) · 웹사이트 · 목록으로.
 *  - 사이드바 "운영 정보": 사업자번호 · 국세청 인증 · 등급(구독). 관리자 구독 응답에는 한도(limits)가 없어 한도 줄은 없다.
 *
 * 추천·스팟라이트 켜고 끄기는 목록 카드에서 한다(클라이언트 요구가 "목록에서 바로").
 */
export default function AdminCompanyDetailPage({ params }: PageProps<"/admin/companies/[id]">) {
  const { id } = use(params);
  const companyId = Number(id);
  const valid = Number.isInteger(companyId) && companyId > 0;

  const { user, loading } = useSession();
  const router = useRouter();
  const isAdmin = user?.userRole === "ADMIN";

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const next = `/admin/companies/${id}`;
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [loading, user, router, next]);

  useEffect(() => {
    if (!isAdmin || !valid) return;
    const controller = new AbortController();
    Promise.all([getAdminCompany(companyId, controller.signal), getAdminSubscription(companyId, controller.signal)]).then(
      ([detail, subscription]) => setLoaded({ id: companyId, detail, subscription }),
      (e) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.isNotFound) setFailure("존재하지 않는 회사입니다.");
        else setFailure(e instanceof ApiError ? e.message : "기업 정보를 불러오지 못했습니다.");
      },
    );
    return () => controller.abort();
  }, [isAdmin, valid, companyId]);

  const current = loaded?.id === companyId ? loaded : null;
  const companyName = current?.detail.profile.companyName;
  useEffect(() => {
    if (companyName) document.title = `${companyName} (관리) — 플랜틀리`;
  }, [companyName]);

  if (loading || !user) return <DetailSkeleton />;

  if (!isAdmin || !valid || failure) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-20 text-center sm:px-[30px]">
        <p className="text-sm text-muted">
          {!isAdmin ? "관리자만 볼 수 있는 화면입니다." : (failure ?? "잘못된 주소입니다.")}
        </p>
        <Link href={isAdmin ? "/admin/companies" : "/"} className="btn btn-secondary">
          {isAdmin ? "기업 관리로 돌아가기" : "메인으로"}
        </Link>
      </div>
    );
  }

  if (!current) return <DetailSkeleton />;

  const { detail, subscription } = current;
  const { profile: company, meta } = detail;
  const isPublic = meta.visibility !== "PRIVATE";
  const hasPublicPage = isPublic && !meta.deleted;

  const hiddenCategories = company.categories.filter((category) => !category.active).length;
  const hiddenImages = company.galleryImages.filter((image) => !image.active).length;
  const hiddenParts = [
    hiddenCategories > 0 && `분류 ${hiddenCategories}개`,
    hiddenImages > 0 && `상세 이미지 ${hiddenImages}장`,
  ].filter((part): part is string => !!part);

  // 에디터 선정(verified)·사업자 확인은 몸통이 이미 그린다. 운영이 정한 노출 둘만 더 보여준다.
  const exposure = [meta.featured && "추천 노출", meta.spotlight && "스팟라이트 고정"].filter(
    (label): label is string => !!label,
  );

  return (
    <CompanyDetailView
      company={company}
      crumbs={[{ href: "/admin/companies", label: "기업 관리" }]}
      banner={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line bg-field px-4 py-2.5 text-[13px] sm:px-[30px]">
          {meta.deleted && (
            <span className="inline-flex items-center gap-[5px] rounded-md bg-danger px-[9px] py-[3px] text-xs font-medium whitespace-nowrap text-white">
              <TrashIcon size={12} />
              삭제됨
            </span>
          )}
          {isPublic ? (
            <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-ink">
              <span aria-hidden className="size-[7px] rounded-full bg-brand" />
              공개
            </span>
          ) : (
            <span className="inline-flex items-center gap-[5px] rounded-md bg-ink px-[9px] py-[3px] text-xs font-medium whitespace-nowrap text-white">
              <EyeOffIcon size={13} />
              비공개
            </span>
          )}
          <span className="text-xs whitespace-nowrap text-muted">
            {meta.registrationSource === "ADMIN" ? "관리자 등록" : "회원 등록"} ·{" "}
            {meta.claimed ? `소유자 #${meta.ownerUserId}` : "소유자 미연동"}
          </span>
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
          <Link href={`/admin/companies/${companyId}/edit`} className="btn btn-primary w-full py-[11px] text-[15px]">
            <PencilIcon size={15} />
            기업정보 수정
          </Link>

          <div className="flex gap-2">
            {hasPublicPage ? (
              <DetailLink
                companyId={companyId}
                className="btn flex-1 border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                공개 페이지
              </DetailLink>
            ) : (
              <button type="button" disabled className="btn flex-1 border-white/20 bg-white/5 text-white/50">
                공개 페이지 없음
              </button>
            )}
            <Link
              href="/admin/companies"
              className="btn flex-1 border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              목록으로
            </Link>
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
          </div>

          <p className="mt-0.5 text-[12px] leading-[1.5] text-white/45">
            {meta.deleted
              ? "삭제된 기업입니다. 기업 관리 목록의 \"삭제됨\" 에서 복구할 수 있습니다."
              : !isPublic
                ? "비공개 상태라 검색·메인에 나오지 않고 공개 페이지도 열리지 않습니다."
                : "추천 노출·스팟라이트 고정은 기업 관리 목록에서 켜고 끕니다."}
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
            <h2 className="text-[18px]">운영 정보</h2>
            <span className="kick">Admin only</span>
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
              <span className="skey">구독 시작</span>
              <span className="sval">{subscription.startedAt}</span>
            </div>
          </div>
        </div>
      }
    />
  );
}
