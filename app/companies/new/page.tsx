"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import DoneStep from "@/components/register/DoneStep";
import RegisterForm from "@/components/register/RegisterForm";
import VerifyStep from "@/components/register/VerifyStep";
import { loadRegisterMasters } from "@/lib/registerMasters";
import {
  emptyForm,
  findEtcCertificationId,
  fromPayload,
  SECTIONS,
  sectionStates,
  type RegisterForm as Form,
  type RegisterMasters,
} from "@/lib/register";
import type { CompanyDraftResponse, CompanyVerificationResponse } from "@/types/api";

/**
 * 기업정보 등록(자가등록). 정본은 Claude Design 의 **"플랜틀리 기업정보 등록"**.
 *
 * 한 주소 안에서 세 단계를 갈아 끼운다 — 사업자 인증 → 작성 → 완료. 단계를 주소로 나누지 않은 이유는
 * 작성 단계가 **인증 결과(verificationId·등급 한도) 없이는 그릴 수 없는 화면**이라서다. `/companies/new/form`
 * 같은 주소로 바로 들어오면 보여 줄 것이 없고, 새로고침 뒤의 복귀는 주소가 아니라 서버 초안이 맡는다
 * (VerifyStep 이 마지막 사업자번호로 초안과 인증을 되찾는다).
 *
 * 로그인이 필요하다. 업로드·초안·인증이 전부 로그인 사용자 기준이다.
 */
export default function CompanyCreatePage() {
  const { user, loading } = useSession();
  const router = useRouter();

  const [masters, setMasters] = useState<RegisterMasters | null>(null);
  const [mastersError, setMastersError] = useState(false);
  const [step, setStep] = useState<
    | { kind: "verify" }
    | { kind: "form"; verification: CompanyVerificationResponse; form: Form; savedAt: string | null }
    | { kind: "done"; companyId: number; form: Form }
  >({ kind: "verify" });

  // 비로그인이면 로그인 화면으로 보냈다가 여기로 돌아오게 한다.
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent("/companies/new")}`);
  }, [loading, user, router]);

  const loadMasters = useCallback(
    (signal?: AbortSignal) => loadRegisterMasters(["my-company-create"], signal),
    [],
  );

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    loadMasters(controller.signal).then(
      (value) => setMasters(value),
      () => !controller.signal.aborted && setMastersError(true),
    );
    return () => controller.abort();
  }, [user, loadMasters]);

  const reloadMasters = useCallback(async () => {
    const fresh = await loadMasters();
    setMasters(fresh);
    return fresh;
  }, [loadMasters]);

  if (loading || !user) {
    return <div className="px-4 py-16 sm:px-[30px]" aria-busy />;
  }

  if (mastersError) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-20 text-center sm:px-[30px]">
        <p className="text-sm text-muted">등록 화면에 필요한 선택지를 불러오지 못했습니다.</p>
        <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
          다시 불러오기
        </button>
        <Link href="/" className="text-[13px] text-muted">
          메인으로
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

  const etcId = findEtcCertificationId(masters.certifications);

  if (step.kind === "done") {
    return <DoneStep companyId={step.companyId} form={step.form} masters={masters} />;
  }

  if (step.kind === "form") {
    return (
      <RegisterForm
        key={step.verification.verificationId}
        verification={step.verification}
        initialForm={step.form}
        initialSavedAt={step.savedAt}
        masters={masters}
        reloadMasters={reloadMasters}
        onPublished={(companyId, form) => {
          setStep({ kind: "done", companyId, form });
          window.scrollTo({ top: 0 });
        }}
        onReverify={() => {
          setStep({ kind: "verify" });
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  return (
    <VerifyStep
      sectionTotal={SECTIONS.length}
      countFilledSections={(draft: CompanyDraftResponse) =>
        Object.values(
          sectionStates(fromPayload(draft.payload, etcId), draft.verification?.limits.videoAllowed ?? true),
        ).filter((state) => state !== "empty").length
      }
      onStart={(verification, draft) => {
        setStep({
          kind: "form",
          verification,
          form: draft ? fromPayload(draft.payload, etcId) : emptyForm(),
          savedAt: draft?.updatedAt ?? null,
        });
        window.scrollTo({ top: 0 });
      }}
    />
  );
}
