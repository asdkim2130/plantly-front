"use client";

/**
 * 3단계 — 발행 완료.
 *
 * 디자인의 "회사 상세 보기 / 내 회사 관리" 중 내 회사 관리는 아직 화면이 없어 그 자리에 "정보 수정"
 * (`/companies/{id}/edit`)을 둔다. 상세 보기는 **공개로 발행했을 때만** 둔다 — 비공개 회사는 공개 상세가 404 다.
 *
 * 관리자 등록(`admin`)은 인증 단계가 없어 단계 표시를 빼고, 갈 곳을 관리자 화면으로 바꾼다 — 관리자 상세 ·
 * 기업 관리 목록 · 하나 더 등록. 소유자 수정 화면(`/edit`)은 관리자에게 403 이라 걸지 않는다.
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
  admin = false,
  onRegisterAnother,
}: {
  companyId: number;
  form: RegisterForm;
  masters: RegisterMasters;
  admin?: boolean;
  /** 관리자 등록에서 "다른 기업 등록" — 같은 주소라 링크가 아니라 폼을 비우는 동작이다 */
  onRegisterAnother?: () => void;
}) {
  const name = form.companyName.trim() || "회사";
  const isPublic = form.visibility === "PUBLIC";

  return (
    <div className="grid items-center gap-12 px-4 pt-[46px] pb-14 sm:px-[30px] lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex max-w-[520px] flex-col gap-4">
        {!admin && <Steps current={3} />}
        <span className="mt-3 grid size-[46px] place-items-center rounded-full bg-brand text-white">
          <CheckIcon size={22} strokeWidth={2.2} />
        </span>
        <h1 className="text-[34px] leading-[1.15]">등록이 완료되었습니다</h1>
        <p className="text-sm leading-[1.7] text-muted">
          {isPublic
            ? `${name}의 기업 정보가 공개되었습니다. 검색 결과와 메인 화면에서 확인할 수 있습니다.`
            : `${name} 정보가 비공개로 등록되었습니다. 검색 · 메인에는 보이지 않습니다.`}
        </p>
        {admin ? (
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Link href={`/admin/companies/${companyId}`} className="btn btn-primary px-5">
              관리자 상세 보기
            </Link>
            <Link href="/admin/companies" className="btn btn-secondary">
              기업 관리 목록
            </Link>
            <button type="button" className="btn btn-ghost" onClick={onRegisterAnother}>
              다른 기업 등록
            </button>
          </div>
        ) : (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {isPublic && (
            <Link href={`/companies/${companyId}`} className="btn btn-primary px-5">
              회사 상세 보기
            </Link>
          )}
          <Link href={`/companies/${companyId}/edit`} className={`btn ${isPublic ? "btn-secondary" : "btn-primary px-5"}`}>
            정보 수정
          </Link>
          <Link href="/companies/my" className="btn btn-ghost">
            내 기업 목록
          </Link>
          <Link href="/" className="btn btn-ghost">
            메인으로
          </Link>
        </div>
        )}
      </div>
      <PreviewCard form={form} masters={masters} />
    </div>
  );
}
