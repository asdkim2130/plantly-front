import type { Metadata } from "next";
import { Suspense } from "react";
import MyCompanies from "@/components/MyCompanies";

export const metadata: Metadata = {
  title: "내 기업 — 플랜틀리",
};

/**
 * 내 기업 목록(소유자). 틀만 있는 서버 컴포넌트이고 본문은 `components/MyCompanies.tsx` 다.
 * 본문이 `useSearchParams()`(페이지 번호)를 써서 Suspense 경계가 필요하다 — 이유는 `app/companies/page.tsx` 주석.
 *
 * `/companies/[id]` 보다 정적 세그먼트 `my` 가 먼저 매칭된다.
 */
export default function MyCompaniesPage() {
  return (
    <Suspense fallback={<div className="px-4 py-16 sm:px-[30px]" aria-busy />}>
      <MyCompanies />
    </Suspense>
  );
}
