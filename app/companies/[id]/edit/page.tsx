"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import EditForm from "@/components/register/EditForm";
import { ApiError } from "@/lib/api";
import { fromDetail } from "@/lib/companyEdit";
import { getMyCompany, getSubscription } from "@/lib/companies";
import { loadRegisterMasters } from "@/lib/registerMasters";
import type { RegisterMasters } from "@/lib/register";
import type { CompanyDetailResponse, CompanySubscriptionResponse } from "@/types/api";

/**
 * 기업정보 수정(소유자). 등록 화면의 섹션을 그대로 쓰고 저장만 섹션별로 한다 — `components/register/EditForm.tsx`.
 *
 * 세 가지를 함께 받는다: 소유자 상세(`/private`, 숨겨진 항목·우편번호·레퍼런스 이미지 전부 포함),
 * 구독(실제 유효 등급의 한도), 폼 재료(선택지·제약). 소유자가 아니면 서버가 403 을 준다.
 */
export default function CompanyEditPage({ params }: PageProps<"/companies/[id]/edit">) {
  const { id } = use(params);
  const companyId = Number(id);
  const valid = Number.isInteger(companyId) && companyId > 0;

  const { user, loading } = useSession();
  const router = useRouter();

  const [data, setData] = useState<{
    detail: CompanyDetailResponse;
    subscription: CompanySubscriptionResponse;
    masters: RegisterMasters;
  } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const next = `/companies/${id}/edit`;
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [loading, user, router, next]);

  useEffect(() => {
    if (!user || !valid) return;
    const controller = new AbortController();
    Promise.all([
      getMyCompany(companyId, controller.signal),
      getSubscription(companyId, controller.signal),
      // 컬렉션 개수는 등록 폼 제약, 본체 칸은 수정 폼 제약으로 덮는다(registerMasters 주석).
      loadRegisterMasters(["my-company-create", "company-update"], controller.signal),
    ]).then(
      ([detail, subscription, masters]) => setData({ detail, subscription, masters }),
      (e) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.isForbidden) setFailure("이 회사를 수정할 권한이 없습니다.");
        else if (e instanceof ApiError && e.isNotFound) setFailure("존재하지 않거나 삭제된 회사입니다.");
        else setFailure(e instanceof ApiError ? e.message : "수정 화면을 불러오지 못했습니다.");
      },
    );
    return () => controller.abort();
  }, [user, valid, companyId]);

  if (loading || !user) return <div className="px-4 py-16 sm:px-[30px]" aria-busy />;

  if (!valid || failure) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-20 text-center sm:px-[30px]">
        <p className="text-sm text-muted">{failure ?? "존재하지 않는 회사입니다."}</p>
        <Link href="/" className="btn btn-secondary">
          메인으로
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4 px-4 py-10 sm:px-[30px]" aria-busy>
        <span className="skel h-8 w-48" />
        <span className="skel h-64 w-full" />
      </div>
    );
  }

  return (
    <EditForm
      companyId={companyId}
      detail={data.detail}
      initialForm={fromDetail(data.detail)}
      subscription={data.subscription}
      masters={data.masters}
    />
  );
}
