import type { CompanySubscriptionResponse } from "@/types/api";

/** 등급 한 줄에 필요한 구독 사실. 소유자용·관리자용 구독 응답이 둘 다 이 모양을 갖는다. */
export type GradeFacts = Pick<CompanySubscriptionResponse, "grade" | "effectiveGrade" | "status" | "expiresAt">;

/**
 * 등급 한 줄. 화면의 등급은 계약 등급(grade)이 아니라 서버가 만료·체험을 반영해 파생한 effectiveGrade 다.
 * 둘이 다르면 체험이 끝나 강등된 상태라 계약 등급을 괄호로 남긴다.
 */
export default function GradeLabel({ subscription }: { subscription: GradeFacts }) {
  const { grade, effectiveGrade, status, expiresAt } = subscription;
  const suffix =
    grade !== effectiveGrade
      ? `${grade} 만료`
      : status === "TRIAL"
        ? expiresAt
          ? `체험 · ${expiresAt}까지`
          : "체험"
        : status === "ADMIN_EXEMPT"
          ? "한도 면제"
          : expiresAt
            ? `${expiresAt}까지`
            : null;
  return (
    <>
      <span className="font-heading tracking-[0.06em]">{effectiveGrade}</span>
      {suffix && <span className="text-muted"> ({suffix})</span>}
    </>
  );
}
