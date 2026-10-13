"use client";

import { useEffect, useState } from "react";
import { CheckIcon, WarningIcon } from "@/components/icons";
import { ApiError } from "@/lib/api";

// 관리 목록(내 기업 · 관리자 기업)이 함께 쓰는 조각 — 확인 창, 카드 자리표시, 잠깐 뜨는 알림, 실패 문구.
// 두 화면은 같은 디자인("플랜틀리 내 기업 목록")이라 여기서 고치면 둘이 같이 바뀐다.

export type ConfirmText = { title: string; body: string; ok: string; danger: boolean };

export function ConfirmDialog({
  text,
  onCancel,
  onConfirm,
}: {
  text: ConfirmText;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-brand-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={onCancel}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div
        className="blueprint flex w-[420px] max-w-full flex-col gap-2.5 bg-white px-6 pt-6 pb-5 shadow-[0_24px_60px_rgb(11_33_72/0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="font-heading text-[22px] leading-[1.25]">
          {text.title}
        </h2>
        <p className="text-sm leading-[1.6] text-muted">{text.body}</p>
        <div className="mt-2.5 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            autoFocus
            className={`btn ${text.danger ? "border-danger bg-danger text-white hover:bg-danger-ink" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {text.ok}
          </button>
        </div>
      </div>
    </div>
  );
}

export type Toast = { message: string; ok: boolean };

/** 잠깐 떴다 사라지는 결과 알림. 값을 넣으면 2.8초 뒤 스스로 비운다. */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);
  return [toast, setToast] as const;
}

export function ToastView({ toast }: { toast: Toast | null }) {
  if (!toast) return null;
  return (
    <div role="status" className="toast">
      {toast.ok ? (
        <CheckIcon size={16} strokeWidth={2} className="text-brand-300" />
      ) : (
        <WarningIcon size={16} className="text-[#ffb4a8]" />
      )}
      <span>{toast.message}</span>
    </div>
  );
}

export function failMessage(e: unknown, fallback: string) {
  // 권한·존재 오류는 서버 문구가 더 정확하다(다른 탭에서 지웠다 등). 그 밖에는 화면 문구로 통일한다.
  return e instanceof ApiError && (e.isForbidden || e.isNotFound) ? e.message : fallback;
}

/** 불러오는 동안 카드 세 장 자리. 카드와 같은 치수(커버 150 · 로고 54)로 그려 내용이 들어올 때 튀지 않게 한다. */
export function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <span className="skel h-4 w-[140px]" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="blueprint flex flex-col border-dashed bg-white">
            <div className="relative h-[150px] rounded-t-xl border-b border-dashed border-line bg-ink/[0.035]">
              <span className="absolute bottom-[-24px] left-4 size-[54px] rounded-lg border border-dashed border-line bg-white" />
            </div>
            <div className="flex flex-col gap-[9px] px-4 pt-[34px] pb-4">
              <span className="skel h-[15px] w-[46%]" />
              <span className="skel h-2.5 w-[78%]" />
              <span className="skel h-2.5 w-[40%]" />
              <div className="flex gap-[5px]">
                <span className="skel h-5 w-16" />
                <span className="skel h-5 w-[52px]" />
              </div>
            </div>
            <div className="kick border-t border-dashed border-line px-4 py-3">불러오는 중</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 목록을 받지 못했을 때 화면 가운데에 놓는 상자 */
export function ListError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="blueprint flex flex-col items-center gap-3 px-6 py-12 text-center">
      <WarningIcon size={28} className="text-brand-700" />
      <p className="font-heading text-[22px]">{title}</p>
      <p className="max-w-[420px] text-[13px] leading-[1.6] text-muted">
        일시적인 문제일 수 있습니다. 잠시 후 다시 시도해 주세요.
      </p>
      <button type="button" className="btn btn-primary mt-1" onClick={onRetry}>
        다시 시도
      </button>
    </div>
  );
}
