import type { Metadata } from "next";
import { Suspense } from "react";
import CompanyList from "@/components/CompanyList";
import { CompanyPlaceholder } from "@/components/Placeholders";

export const metadata: Metadata = {
  title: "기업 찾기 — 플랜틀리",
  description: "공개 등록된 제조 기업을 검색어·분류·업종·인증으로 좁혀 찾습니다.",
};

/**
 * 공개 기업 목록/검색 화면.
 *
 * 이 파일은 **틀만 있는 서버 컴포넌트**다(레이아웃·정적 페이지에만 서버 컴포넌트를 쓴다는 규칙 그대로).
 * 데이터를 읽는 본문은 `components/CompanyList.tsx` 로 나가 있고 여기서는 Suspense 로 감싸기만 한다 —
 * 본문이 `useSearchParams()` 를 쓰는데, 프리렌더 중에는 주소를 알 수 없어 Suspense 경계가 없으면
 * 프로덕션 빌드가 "Missing Suspense boundary with useSearchParams" 로 실패한다.
 * (개발 모드는 요청마다 그리므로 경계가 없어도 되는 것처럼 보인다 — 빌드에서야 드러난다.)
 */
export default function CompaniesPage() {
  return (
    <Suspense fallback={<ListFallback />}>
      <CompanyList />
    </Suspense>
  );
}

/** 주소를 읽기 전까지 그려지는 자리. 조건에 따라 달라지지 않는 부분만 남긴다. */
function ListFallback() {
  return (
    <div className="flex flex-col gap-5 px-4 pt-8 pb-10 sm:px-[30px]">
      <p className="kick">Company Directory</p>
      <h1 className="text-[30px] leading-tight">기업 찾기</h1>
      <div className="skel h-[52px] w-full rounded-xl" />
      <div className="grid items-start gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <CompanyPlaceholder key={i} />
        ))}
      </div>
    </div>
  );
}
