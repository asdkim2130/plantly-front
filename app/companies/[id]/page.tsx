"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import CompanyDetailView, {
  DetailSkeleton,
  copyLink,
  externalHref,
  inquiryOf,
} from "@/components/CompanyDetailView";
import LikeFavorite from "@/components/LikeFavorite";
import { ShareIcon } from "@/components/icons";
import { ApiError } from "@/lib/api";
import { getCompany } from "@/lib/companies";
import type { CompanyPublicResponse } from "@/types/api";

/**
 * 끝난 조회 1건의 결과. 성공이면 company, 실패면 error 가 찬다.
 * `id` 를 함께 들고 있어야 "다른 회사의 결과"와 "아직 안 온 결과"를 구분할 수 있다.
 */
type Loaded = { id: number; company: CompanyPublicResponse | null; error: string };

/**
 * 기업 상세(공개) — `GET /api/v1/companies/{id}`.
 *
 * 화면 몸통은 소유자 상세와 함께 쓰는 `components/CompanyDetailView.tsx` 이고(디자인 설명도 그쪽),
 * 이 파일은 데이터를 불러오고 공개 상세에만 있는 자리 — 문의하기 · 좋아요·즐겨찾기 · 공유 — 를 채운다.
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
        <Link href="/companies" className="btn btn-secondary mt-4">
          기업 찾기로 돌아가기
        </Link>
      </div>
    );
  }

  if (!company) {
    return <DetailSkeleton />;
  }

  const inquiry = inquiryOf(company);

  return (
    <CompanyDetailView
      company={company}
      // 좋아요·즐겨찾기 실패(주로 비로그인)가 뜨는 자리. 링크 복사 결과는 확인 창으로 알린다.
      notice={notice}
      heroActions={
        <>
          {inquiry ? (
            <a href={inquiry.href} className="btn btn-primary w-full py-[11px] text-[15px]">
              문의하기
            </a>
          ) : (
            <button type="button" disabled className="btn btn-primary w-full py-[11px] text-[15px]">
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
              onClick={() => void copyLink(window.location.href)}
            >
              <ShareIcon size={17} />
            </button>
          </div>

          <p className="mt-0.5 text-[12px] leading-[1.5] text-white/45">
            {inquiry?.note ?? "등록된 담당자 연락처가 없어 문의를 보낼 수 없습니다."}
          </p>
        </>
      }
      contactAction={
        inquiry && (
          <a href={inquiry.href} className="btn btn-primary w-full py-2.5">
            문의하기
          </a>
        )
      }
    />
  );
}
