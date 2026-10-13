"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import EditForm from "@/components/register/EditForm";
import { ApiError } from "@/lib/api";
import { getAdminCompany, getAdminSubscription } from "@/lib/admin";
import { fromDetail } from "@/lib/companyEdit";
import { loadRegisterMasters } from "@/lib/registerMasters";
import type { RegisterMasters } from "@/lib/register";
import type { AdminCompanySubscriptionResponse, CompanyDetailResponse } from "@/types/api";

/**
 * 기업정보 수정(관리자). 소유자 수정(`/companies/[id]/edit`)과 같은 `EditForm` 을 `admin` 으로 쓴다 — 다른 점은 그 파일 머리 주석.
 *
 * 소유자 수정 화면을 관리자에게 열지 않은 이유: 그 화면은 소유자 API(`/private`, `PATCH /companies/{id}` …)를 써서
 * 멤버가 아니면 403 이다. 여기서는 관리자 상세 · 관리자 구독(한도 포함) · 폼 재료를 받는다. 삭제된 회사도 열린다.
 *
 * 폼 제약은 소유자 수정과 같은 방식이다 — 컬렉션 개수 상한은 등록 폼에만 있어 등록 폼으로 받고, 본체 칸은 수정 폼
 * (`company-update`)으로 덮는다(registerMasters 주석). 등록 폼은 관리자 경로에 맞춰 `company-create` 를 쓴다.
 */
export default function AdminCompanyEditPage({ params }: PageProps<"/admin/companies/[id]/edit">) {
  const { id } = use(params);
  const companyId = Number(id);
  const valid = Number.isInteger(companyId) && companyId > 0;

  const { user, loading } = useSession();
  const router = useRouter();
  const isAdmin = user?.userRole === "ADMIN";

  const [data, setData] = useState<{
    detail: CompanyDetailResponse;
    subscription: AdminCompanySubscriptionResponse;
    masters: RegisterMasters;
  } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const next = `/admin/companies/${id}/edit`;
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [loading, user, router, next]);

  useEffect(() => {
    if (!isAdmin || !valid) return;
    const controller = new AbortController();
    Promise.all([
      getAdminCompany(companyId, controller.signal),
      getAdminSubscription(companyId, controller.signal),
      loadRegisterMasters(["company-create", "company-update"], controller.signal),
    ]).then(
      ([detail, subscription, masters]) => setData({ detail, subscription, masters }),
      (e) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.isNotFound) setFailure("존재하지 않는 회사입니다.");
        else setFailure(e instanceof ApiError ? e.message : "수정 화면을 불러오지 못했습니다.");
      },
    );
    return () => controller.abort();
  }, [isAdmin, valid, companyId]);

  if (loading || !user) return <div className="px-4 py-16 sm:px-[30px]" aria-busy />;

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
      admin
      companyId={companyId}
      detail={data.detail}
      initialForm={fromDetail(data.detail)}
      subscription={data.subscription}
      masters={data.masters}
    />
  );
}
