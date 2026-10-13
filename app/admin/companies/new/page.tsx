"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import DoneStep from "@/components/register/DoneStep";
import RegisterForm from "@/components/register/RegisterForm";
import { ruleValue } from "@/lib/meta";
import { loadRegisterMasters } from "@/lib/registerMasters";
import { emptyForm, type RegisterForm as Form, type RegisterMasters } from "@/lib/register";
import type { GradeLimits } from "@/types/api";

/**
 * 기업 등록(관리자) — `POST /admin/companies`. 화면은 자가등록(`/companies/new`)의 작성 단계와 같은 폼이다
 * (`RegisterForm kind="admin"`, 다른 점은 그 파일 머리 주석).
 *
 * 국세청 인증이 없어 **인증 단계 없이 바로 작성 화면이 뜬다.** 단계는 작성 → 완료 둘이다.
 * 임시저장이 없어 새로고침하면 처음부터다(초안은 국세청 인증을 받은 번호에만 저장된다).
 *
 * 등급 한도는 인증 결과가 아니라 등록 폼 제약(`company-create`)의 천장값이다 — 관리자 등록 회사는 구독이
 * ADMIN_EXEMPT 로 만들어져 등급 한도 정책을 건너뛰고, 남는 상한이 DTO 의 천장(카테고리 10 · 상세 이미지 30 ·
 * 레퍼런스 이미지 10)이다. 숫자를 화면에 박지 않고 제약 응답에서 읽는다. 제약을 못 받으면 한도를 알 수 없어
 * 폼을 열지 않는다.
 */
export default function AdminCompanyCreatePage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const isAdmin = user?.userRole === "ADMIN";

  const [masters, setMasters] = useState<RegisterMasters | null>(null);
  const [mastersError, setMastersError] = useState(false);
  const [step, setStep] = useState<{ kind: "form"; round: number } | { kind: "done"; companyId: number; form: Form }>({
    kind: "form",
    round: 0,
  });

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent("/admin/companies/new")}`);
  }, [loading, user, router]);

  const loadMasters = useCallback(
    (signal?: AbortSignal) => loadRegisterMasters(["company-create"], signal),
    [],
  );

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    loadMasters(controller.signal).then(
      (value) => setMasters(value),
      () => !controller.signal.aborted && setMastersError(true),
    );
    return () => controller.abort();
  }, [isAdmin, loadMasters]);

  const reloadMasters = useCallback(async () => {
    const fresh = await loadMasters();
    setMasters(fresh);
    return fresh;
  }, [loadMasters]);

  if (loading || !user) return <div className="px-4 py-16 sm:px-[30px]" aria-busy />;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-20 text-center sm:px-[30px]">
        <p className="text-sm text-muted">관리자만 볼 수 있는 화면입니다.</p>
        <Link href="/" className="btn btn-secondary">
          메인으로
        </Link>
      </div>
    );
  }

  const limits = masters && exemptLimits(masters);

  if (mastersError || (masters && !limits)) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-20 text-center sm:px-[30px]">
        <p className="text-sm text-muted">등록 화면에 필요한 선택지·제약을 불러오지 못했습니다.</p>
        <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
          다시 불러오기
        </button>
        <Link href="/admin/companies" className="text-[13px] text-muted">
          기업 관리로
        </Link>
      </div>
    );
  }

  if (!masters || !limits) {
    return (
      <div className="flex flex-col gap-4 px-4 py-10 sm:px-[30px]" aria-busy>
        <span className="skel h-8 w-48" />
        <span className="skel h-64 w-full" />
      </div>
    );
  }

  if (step.kind === "done") {
    return (
      <DoneStep
        admin
        companyId={step.companyId}
        form={step.form}
        masters={masters}
        onRegisterAnother={() => {
          setStep({ kind: "form", round: Date.now() });
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  return (
    <RegisterForm
      // "다른 기업 등록" 으로 돌아오면 폼 상태를 통째로 새로 만든다.
      key={step.round}
      kind="admin"
      limits={limits}
      initialForm={emptyForm()}
      masters={masters}
      reloadMasters={reloadMasters}
      onPublished={(companyId, form) => {
        setStep({ kind: "done", companyId, form });
        window.scrollTo({ top: 0 });
      }}
    />
  );
}

/** 한도 면제 회사의 상한 = 등록 폼 제약의 천장값. 하나라도 없으면 null(폼을 열지 않는다) */
function exemptLimits(masters: RegisterMasters): GradeLimits | null {
  const c = masters.constraints;
  const maxCategories = ruleValue(c, "categoryIds", "maxItems");
  const maxDetailImages = ruleValue(c, "images", "maxItems");
  const maxReferenceImages = ruleValue(c, "references[].imageUrls", "maxItems");
  if (maxCategories === undefined || maxDetailImages === undefined || maxReferenceImages === undefined) return null;
  // 동영상은 저장이 등급과 무관하고, 면제 회사는 공개 노출도 막히지 않는다.
  return { maxCategories, maxDetailImages, maxReferenceImages, videoAllowed: true };
}
