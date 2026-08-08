type Props = {
  /** null 이면 아직 로딩 중 — 숫자 자리를 스켈레톤으로 둔다. */
  companyCount: number | null;
  categoryCount: number | null;
  industryCount: number | null;
  certificationCount: number | null;
};

/**
 * 히어로 오른쪽의 "플랜틀리 현황" 패널.
 *
 * 네 숫자는 전부 실제 API 에서 온다(전체 회사 수 + 마스터 데이터 개수).
 * 디자인 원본의 "이번 주 신규 / 검수 완료율"은 백엔드에 대응하는 값이 없어서
 * 지어내는 대신 지금 셀 수 있는 축(업종·인증)으로 바꿨다.
 */
export default function StatsPanel({
  companyCount,
  categoryCount,
  industryCount,
  certificationCount,
}: Props) {
  return (
    <aside className="blueprint flex w-full flex-col gap-4 bg-white px-[22px] pt-[22px] pb-5 lg:w-[300px] lg:shrink-0">
      <h2 className="font-heading text-[11px] tracking-[0.14em] text-faint uppercase">
        플랜틀리 현황
      </h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        <Stat value={companyCount} label="등록 기업" />
        <Stat value={categoryCount} label="솔루션 분류" />
        <Stat value={industryCount} label="업종" />
        <Stat value={certificationCount} label="인증 항목" />
      </div>
      <div className="flex flex-col gap-[7px] border-t border-line-soft pt-[13px]">
        <h3 className="font-heading text-[11px] tracking-[0.14em] text-faint uppercase">
          최근 등록
        </h3>
        {/* 목록 응답에 등록일이 없어 "최근"을 고를 수 없다. 백엔드에 정렬·등록일이 생기면 채운다. */}
        <div className="skel h-2.5 w-[78%]" />
        <div className="skel h-2.5 w-[62%]" />
        <div className="skel h-2.5 w-[70%]" />
        <p className="font-heading text-[11px] tracking-[0.08em] text-faint">데이터 준비 중</p>
      </div>
    </aside>
  );
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <div>
      {value === null ? (
        <div className="skel h-8 w-14" />
      ) : (
        <div className="font-heading text-brand-700 text-[32px] leading-none">
          {value.toLocaleString()}
        </div>
      )}
      <div className="mt-[3px] text-[11.5px] text-muted">{label}</div>
    </div>
  );
}
