"use client";

/**
 * 3단계 — 발행 완료.
 *
 * 디자인의 "회사 상세 보기 / 내 회사 관리" 중 내 회사 관리는 아직 화면이 없어 뺐다. 상세 보기는 **공개로
 * 발행했을 때만** 둔다 — 비공개 회사는 공개 상세가 404 라(소유자 전용 화면은 아직 없다) 눌러도 빈 화면이다.
 */

import Link from "next/link";
import { PreviewCard } from "@/components/register/CardPreview";
import { Steps } from "@/components/register/VerifyStep";
import { CheckIcon } from "@/components/icons";
import type { RegisterForm, RegisterMasters } from "@/lib/register";

export default function DoneStep({
  companyId,
  form,
  masters,
}: {
  companyId: number;
  form: RegisterForm;
  masters: RegisterMasters;
}) {
  const name = form.companyName.trim() || "회사";
  const isPublic = form.visibility === "PUBLIC";

  return (
    <div className="grid items-center gap-12 px-4 pt-[46px] pb-14 sm:px-[30px] lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex max-w-[520px] flex-col gap-4">
        <Steps current={3} />
        <span className="mt-3 grid size-[46px] place-items-center rounded-full bg-brand text-white">
          <CheckIcon size={22} strokeWidth={2.2} />
        </span>
        <h1 className="text-[34px] leading-[1.15]">등록이 완료되었습니다</h1>
        <p className="text-sm leading-[1.7] text-muted">
          {isPublic
            ? `${name}의 기업 정보가 공개되었습니다. 검색 결과와 메인 화면에서 확인할 수 있습니다.`
            : `${name} 정보가 비공개로 등록되었습니다. 검색 · 메인에는 보이지 않습니다.`}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {isPublic && (
            <Link href={`/companies/${companyId}`} className="btn btn-primary px-5">
              회사 상세 보기
            </Link>
          )}
          <Link href="/" className={`btn ${isPublic ? "btn-secondary" : "btn-primary px-5"}`}>
            메인으로
          </Link>
        </div>
      </div>
      <PreviewCard form={form} masters={masters} />
    </div>
  );
}
