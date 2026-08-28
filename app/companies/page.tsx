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

/**
 * 주소를 읽기 전까지 그려지는 자리. 조건에 따라 달라지지 않는 부분만 남긴다.
 *
 * 머리띠는 본문과 **같은 치수로** 그린다 — 자리만 잡아 두면 조건이 읽히는 순간 제목이 위아래로
 * 튄다. 조건에 따라 달라지는 것(조건 띠·패싯·개수)만 자리표시자로 둔다.
 */
function ListFallback() {
  return (
    <div className="flex flex-col">
      <div className="border-b border-line-soft px-4 pt-[26px] pb-[22px] sm:px-[30px]">
        <p className="kick text-brand-700 mb-[7px]">Company Directory</p>
        <div className="flex flex-wrap items-end gap-3.5">
          <h1 className="text-[30px] leading-[1.1]">기업 찾기</h1>
          <p className="mb-[3px] text-[13px] text-muted">
            공개 등록된 기업을 검색어와 필터로 찾습니다. 비공개로 돌렸거나 삭제된 기업은 나오지
            않습니다.
          </p>
        </div>
        <div className="skel mt-[18px] h-[52px] w-full rounded-xl" />
      </div>

      <div className="flex flex-col gap-7 px-4 pt-5 pb-[34px] sm:px-[30px] lg:flex-row lg:items-start lg:gap-[26px]">
        <div className="flex flex-col gap-4 lg:w-[240px] lg:flex-none">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <span className="skel h-3.5 w-[46%]" />
              <span className="skel h-2.5 w-[80%]" />
              <span className="skel h-2.5 w-[64%]" />
            </div>
          ))}
        </div>
        <div className="grid min-w-0 flex-1 items-start gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <CompanyPlaceholder key={i} label="불러오는 중" />
          ))}
        </div>
      </div>
    </div>
  );
}
