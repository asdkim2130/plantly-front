"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import DoneStep from "@/components/register/DoneStep";
import RegisterForm from "@/components/register/RegisterForm";
import { loadRegisterMasters } from "@/lib/registerMasters";
import { emptyForm, type RegisterForm as Form, type RegisterMasters } from "@/lib/register";

/**
 * 기업 등록(관리자) — `POST /admin/companies`. 화면은 자가등록(`/companies/new`)의 작성 단계와 같은 폼이다
 * (`RegisterForm kind="admin"`, 다른 점은 그 파일 머리 주석).
 *
 * 국세청 인증이 없어 **인증 단계 없이 바로 작성 화면이 뜬다.** 단계는 작성 → 완료 둘이다.
 * 임시저장이 없어 새로고침하면 처음부터다(초안은 국세청 인증을 받은 번호에만 저장된다).
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

  if (mastersError) {
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

  if (!masters) {
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
