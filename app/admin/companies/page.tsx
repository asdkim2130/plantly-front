import type { Metadata } from "next";
import { Suspense } from "react";
import AdminCompanies from "@/components/AdminCompanies";

export const metadata: Metadata = {
  title: "기업 관리 — 플랜틀리",
};

/**
 * 관리자 기업 목록. 틀만 있는 서버 컴포넌트이고 본문은 `components/AdminCompanies.tsx` 다.
 * 본문이 `useSearchParams()`(필터·검색어·페이지)를 써서 Suspense 경계가 필요하다 — 이유는 `app/companies/page.tsx` 주석.
 */
export default function AdminCompaniesPage() {
  return (
    <Suspense fallback={<div className="px-4 py-16 sm:px-[30px]" aria-busy />}>
      <AdminCompanies />
    </Suspense>
  );
}
