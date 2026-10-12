"use client";

/**
 * 1단계 — 국세청 사업자 인증. 통과하면 이 번호로 쓰던 초안이 있는지 보고 이어쓰기를 제안한다.
 *
 * 초안의 열쇠는 인증 id 가 아니라 **사업자번호**다(인증은 만료·재발급되지만 쓴 글은 그럴 이유가 없다).
 * 그래서 마지막으로 인증한 번호만 이 기기에 적어 두면, 다시 들어왔을 때 국세청을 또 부르지 않고
 * (하루 시도 횟수를 쓰지 않고) 초안과 그 초안에 쓸 인증을 한 번에 되찾는다 — 서버가 초안 조회 응답에
 * `verification` 을 실어 주는 이유가 이것이다. 다른 기기에서는 이 기록이 없으니 인증부터 다시 받는다.
 */

import { useEffect, useState } from "react";
import {
  AlertCircleIcon,
  BanIcon,
  BuildingIcon,
  CheckCircleIcon,
  ClockIcon,
  SpinnerIcon,
} from "@/components/icons";
import { ErrorLine, FieldHead } from "@/components/register/parts";
import { ApiError } from "@/lib/api";
import { deleteDraft, getDraft, verifyBusiness } from "@/lib/companies";
import { formatBusinessNumber, formatDateTime, relativeTime } from "@/lib/register";
import type { CompanyDraftResponse, CompanyVerificationResponse } from "@/types/api";

/** 마지막으로 인증한 사업자번호. 브라우저에 남기는 건 이 숫자 하나뿐이다(초안 본문은 서버에 있다) */
export const LAST_BUSINESS_NUMBER_KEY = "plantly:register:businessNumber";

export function rememberBusinessNumber(value: string | null) {
  try {
    if (value) localStorage.setItem(LAST_BUSINESS_NUMBER_KEY, value);
    else localStorage.removeItem(LAST_BUSINESS_NUMBER_KEY);
  } catch {
    // 사생활 보호 모드 등에서 저장소가 막혀 있어도 등록은 된다 — 이어쓰기 제안만 빠진다.
  }
}

function readBusinessNumber() {
  try {
    return localStorage.getItem(LAST_BUSINESS_NUMBER_KEY);
  } catch {
    return null;
  }
}

type Props = {
  /** 작성 화면으로 넘어간다. draft 가 있으면 이어쓰기, null 이면 새로 쓰기 */
  onStart: (verification: CompanyVerificationResponse, draft: CompanyDraftResponse | null) => void;
  /** 초안이 있는 경우의 "n개 섹션 작성" 을 세는 함수(폼 모델을 아는 쪽이 준다) */
  countFilledSections: (draft: CompanyDraftResponse) => number;
  sectionTotal: number;
};

type Failure = { code: string | null; message: string };

/** 국세청이 "등록할 수 없는 사업자"라고 답한 갈래. 사용자가 고칠 입력이 없다 */
const BLOCKED: Record<string, { title: string; body: string }> = {
  VERIFICATION_NOT_REGISTERED: {
    title: "국세청에서 확인되지 않는 사업자등록번호입니다.",
    body: "사업자등록증에 기재된 번호를 정확하게 입력했는지 확인해 주세요.",
  },
  VERIFICATION_SUSPENDED: {
    title: "휴업 중인 사업자는 등록할 수 없습니다.",
    body: "국세청 조회 결과 현재 휴업 상태로 확인되었습니다. 영업을 재개한 후 다시 인증해 주세요.",
  },
  VERIFICATION_CLOSED: {
    title: "폐업한 사업자는 등록할 수 없습니다.",
    body: "국세청 조회 결과 폐업 상태로 확인되었습니다. 폐업한 사업자등록번호로는 기업을 등록할 수 없습니다.",
  },
};

const HOMETAX_URL = "https://www.hometax.go.kr";

export default function VerifyStep({ onStart, countFilledSections, sectionTotal }: Props) {
  const [businessNumber, setBusinessNumber] = useState("");
  const [ceoName, setCeoName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [numberError, setNumberError] = useState("");
  // 인증(또는 저장된 번호)으로 찾은 초안 — 이어쓸지 새로 쓸지 고르는 카드를 띄운다.
  const [resume, setResume] = useState<{ verification: CompanyVerificationResponse; draft: CompanyDraftResponse } | null>(
    null,
  );
  // 저장된 번호에 초안은 있는데 쓸 인증이 없을 때(전부 회수됨) — 인증을 다시 받으면 이어 쓸 수 있다고 알린다.
  const [orphanDraft, setOrphanDraft] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [now] = useState(() => Date.now());

  // 이 기기에서 마지막으로 인증한 번호가 있으면 국세청을 부르지 않고 초안부터 찾아본다.
  useEffect(() => {
    const stored = readBusinessNumber();
    if (!stored) return;
    const controller = new AbortController();
    getDraft(stored, controller.signal).then(
      (draft) => {
        setBusinessNumber(formatBusinessNumber(stored));
        if (draft.verification) {
          setCeoName(draft.verification.ceoName);
          setStartDate(draft.verification.businessStartDate);
          setResume({ verification: draft.verification, draft });
        } else {
          setOrphanDraft(true);
        }
      },
      (e) => {
        if (controller.signal.aborted) return;
        // 초안이 없거나(발행·폐기됨) 인증 이력이 없다 — 더 기억할 이유가 없다.
        if (e instanceof ApiError && (e.isNotFound || e.code === "VERIFICATION_NOT_FOUND")) rememberBusinessNumber(null);
      },
    );
    return () => controller.abort();
  }, []);

  const digits = businessNumber.replace(/\D/g, "");
  const locked = checking || resume !== null;
  const blocked = failure?.code ? BLOCKED[failure.code] : undefined;
  const mismatch = failure?.code === "VERIFICATION_MISMATCH";
  const limitHit = failure?.code === "VERIFICATION_LIMIT_EXCEEDED";
  const duplicate = failure?.code === "BUSINESS_NUMBER_TAKEN";
  const delayed = failure?.code === "VERIFICATION_UNAVAILABLE";
  const terminal = !!blocked || duplicate;

  async function verify() {
    if (checking) return;
    setFailure(null);
    setNumberError("");
    if (digits.length !== 10) {
      setNumberError("사업자등록번호는 숫자 10자리여야 합니다.");
      return;
    }
    setChecking(true);
    try {
      const verification = await verifyBusiness({ businessNumber: digits, ceoName: ceoName.trim(), businessStartDate: startDate });
      rememberBusinessNumber(verification.businessNumber);
      setOrphanDraft(false);
      try {
        const draft = await getDraft(verification.businessNumber);
        // 방금 받은 인증이 가장 새것이다 — 초안 응답의 verification 보다 이걸 쓴다.
        setResume({ verification, draft: { ...draft, verification } });
      } catch {
        // 404(초안 없음)는 "새로 쓴다"는 답이다. 초안 조회가 다른 이유로 실패해도 작성은 막지 않는다.
        onStart(verification, null);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "BUSINESS_NUMBER_INVALID_FORMAT") setNumberError(e.message);
        else setFailure({ code: e.code, message: e.message });
      } else {
        setFailure({ code: null, message: "인증 요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." });
      }
    } finally {
      setChecking(false);
    }
  }

  function startOver() {
    setFailure(null);
    setResume(null);
    setBusinessNumber("");
    setCeoName("");
    setStartDate("");
  }

  async function discardAndStart() {
    if (!resume || discarding) return;
    setDiscarding(true);
    try {
      await deleteDraft(resume.verification.businessNumber);
      onStart(resume.verification, null);
    } catch (e) {
      setFailure({ code: null, message: e instanceof ApiError ? e.message : "초안을 지우지 못했습니다." });
      setDiscarding(false);
    }
  }

  const draftName = resume?.draft.payload.companyName?.trim();

  return (
    <div>
      <div className="border-b border-line-soft px-4 pt-[26px] pb-[22px] sm:px-[30px]">
        <div className="kick mb-[7px] text-brand-700">Company Registration</div>
        <div className="flex flex-wrap items-end gap-3.5">
          <h1 className="text-[30px] leading-[1.1]">기업정보 등록</h1>
          <p className="mb-[3px] text-[13px] text-muted">사업자 인증 후 기업 정보를 작성합니다.</p>
        </div>
        <Steps current={1} />
      </div>

      <div className="grid items-start gap-[26px] px-4 pt-7 pb-10 sm:px-[30px] lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="blueprint flex flex-col gap-5 bg-white px-[30px] pt-7 pb-[30px]">
          <div>
            <div className="kick text-brand-700">Step 01</div>
            <h2 className="mt-1 text-2xl">국세청을 통해 사업자 정보를 확인합니다.</h2>
            <p className="fhint mt-1.5 text-[13px]">사업자등록증에 기재된 정보를 정확하게 입력해 주세요.</p>
          </div>

          <form
            className="flex flex-col gap-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <FieldHead label="사업자등록번호" required htmlFor="v-number" />
              <input
                id="v-number"
                className={`field font-heading text-base tracking-[0.04em] ${numberError ? "err" : ""}`}
                value={businessNumber}
                inputMode="numeric"
                autoComplete="off"
                placeholder="숫자 10자리 · 하이픈은 있어도 됩니다"
                disabled={locked}
                onChange={(e) => setBusinessNumber(e.target.value)}
                onBlur={() => digits.length === 10 && setBusinessNumber(formatBusinessNumber(digits))}
              />
              <ErrorLine message={numberError} />
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <FieldHead label="대표자명" required htmlFor="v-ceo" />
                <input
                  id="v-ceo"
                  className={`field ${mismatch ? "err" : ""}`}
                  value={ceoName}
                  placeholder="공동대표는 1명만"
                  disabled={locked}
                  onChange={(e) => setCeoName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldHead label="개업일자" required htmlFor="v-date" />
                <input
                  id="v-date"
                  type="date"
                  className={`field ${mismatch ? "err" : ""}`}
                  value={startDate}
                  max={today()}
                  disabled={locked}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            {orphanDraft && !resume && (
              <div className="bnr info">
                <AlertCircleIcon size={18} />
                <div className="flex-1">
                  <div className="bnt">이 사업자번호로 작성 중인 내용이 있습니다.</div>
                  <div className="bnb">사업자 인증을 다시 받으면 이어서 작성할 수 있습니다.</div>
                </div>
              </div>
            )}

            {mismatch && (
              <div className="bnr err">
                <AlertCircleIcon size={18} />
                <div className="flex-1">
                  <div className="bnt">입력한 정보가 국세청 등록 정보와 일치하지 않습니다.</div>
                  <div className="bnb">
                    사업자등록증에 기재된 대표자명과 개업일자를 다시 확인해 주세요. 공동대표인 경우 첫 번째로 기재된
                    대표자명을 입력해 주세요.
                  </div>
                </div>
              </div>
            )}

            {blocked && (
              <div className="bnr err flex-col gap-3">
                <div className="flex items-start gap-3">
                  <BanIcon size={18} className="mt-px shrink-0 text-danger" />
                  <div className="flex-1">
                    <div className="bnt">{blocked.title}</div>
                    <div className="bnb">{blocked.body}</div>
                  </div>
                </div>
                <BlockedActions onRetry={startOver} />
              </div>
            )}

            {duplicate && (
              <div className="bnr err flex-col gap-3">
                <div className="flex items-start gap-3">
                  <BuildingIcon size={18} className="mt-px shrink-0 text-danger" />
                  <div className="flex-1">
                    <div className="bnt">이미 플랜틀리에 등록된 사업자등록번호입니다.</div>
                    <div className="bnb">
                      해당 사업자등록번호로 등록된 기업이 있습니다. 동일한 기업은 중복 등록할 수 없습니다. 직접 등록한
                      적이 없다면 플랜틀리로 문의해 주세요.
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary" onClick={startOver}>
                    다른 사업자번호로 인증
                  </button>
                </div>
              </div>
            )}

            {limitHit && (
              <div className="bnr err">
                <ClockIcon size={18} />
                <div className="flex-1">
                  <div className="bnt">오늘의 사업자 인증 횟수를 모두 사용했습니다.</div>
                  <div className="bnb">{failure?.message} 입력한 정보는 이 화면에 그대로 남아 있습니다.</div>
                </div>
              </div>
            )}

            {delayed && (
              <div className="bnr info">
                <ClockIcon size={18} />
                <div className="flex-1">
                  <div className="bnt">국세청 시스템의 응답이 지연되고 있습니다.</div>
                  <div className="bnb">
                    일시적인 시스템 지연으로 인증을 완료하지 못했습니다. 입력한 정보를 변경하지 않고 잠시 후 다시
                    시도해 주세요.
                  </div>
                </div>
              </div>
            )}

            {/* 위 갈래에 없는 실패(네트워크·초안 폐기 실패 등)는 서버 문구를 그대로 보여 준다 */}
            {failure && !mismatch && !blocked && !duplicate && !limitHit && !delayed && (
              <div className="bnr err">
                <AlertCircleIcon size={18} />
                <div className="bnt flex-1">{failure.message}</div>
              </div>
            )}

            {resume && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[13px] font-medium text-brand-800">
                  <CheckCircleIcon size={16} className="text-brand" />
                  국세청 인증 완료
                </div>
                <div className="blueprint flex flex-col gap-3 border-brand-400 bg-brand-100 px-5 py-[18px]">
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <span className="kick text-brand-700">Draft found</span>
                    <span className="ml-auto text-xs text-muted">
                      {relativeTime(resume.draft.updatedAt, now)} 저장됨 · {formatDateTime(resume.draft.updatedAt)}
                    </span>
                  </div>
                  <h3 className="text-xl text-brand-900">이 사업자번호로 작성 중인 내용이 있습니다.</h3>
                  <div className="flex flex-wrap gap-x-[18px] gap-y-1 text-[13px] text-muted">
                    {draftName && (
                      <span>
                        기업명 <b className="font-medium text-ink">{draftName}</b>
                      </span>
                    )}
                    <span>
                      {sectionTotal}개 섹션 중 <b className="font-medium text-ink">{countFilledSections(resume.draft)}개</b>{" "}
                      작성
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onStart(resume.verification, resume.draft)}
                    >
                      이어서 작성하기
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={discarding} onClick={discardAndStart}>
                      새로 작성
                    </button>
                    <span className="fhint">새로 작성하면 기존에 작성한 내용은 삭제되며 복구할 수 없습니다.</span>
                  </div>
                </div>
                <button type="button" className="btn btn-ghost self-start text-[13px] text-muted" onClick={startOver}>
                  다른 사업자번호로 인증
                </button>
              </div>
            )}

            {!resume && !terminal && (
              <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-[18px]">
                <button
                  type="submit"
                  className="btn btn-primary px-[22px]"
                  disabled={checking || limitHit || !digits || !ceoName.trim() || !startDate}
                >
                  {checking && <SpinnerIcon size={14} className="animate-spin" />}
                  {checking ? "국세청 확인 중…" : delayed ? "다시 확인" : "국세청 확인"}
                </button>
                <span className="fhint">인증 시도는 하루 횟수가 제한됩니다.</span>
              </div>
            )}
          </form>
        </div>

        <aside className="flex flex-col gap-3.5">
          <div className="blueprint flex flex-col gap-4 border-brand-900 bg-brand-900 px-[22px] pt-[22px] pb-6 text-white">
            <div className="kick text-brand-300">Why first</div>
            <h2 className="text-[21px] leading-[1.25]">
              기업 정보를 작성하기 전에
              <br />
              사업자 등록 가능 여부를 확인합니다.
            </h2>
            <ol className="flex flex-col gap-3 text-[13px] leading-[1.55] text-white/80">
              {[
                "국세청을 통해 정상적으로 영업 중인 사업자인지 확인합니다.",
                "플랜틀리에 이미 등록된 사업자번호인지 확인합니다.",
                "작성 중인 내용이 있다면 기기에 관계없이 이어서 작성할 수 있습니다.",
              ].map((text, index) => (
                <li key={index} className="flex gap-2.5">
                  <span className="font-heading text-brand-400">{String(index + 1).padStart(2, "0")}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-line px-[18px] py-4">
            <div className="kick">인증 후 정해지는 것</div>
            <p className="fhint">
              등급에 따라 등록 가능한 카테고리 · 이미지 수가 정해집니다. 인증 후 폼 상단에서 확인할 수 있습니다.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** 오늘(사용자 시간대) yyyy-MM-dd. toISOString 은 UTC 라 한국 아침 9시 전에는 어제가 된다 */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function BlockedActions({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        다른 사업자번호로 인증
      </button>
      <a href={HOMETAX_URL} target="_blank" rel="noreferrer" className="btn btn-ghost text-ink">
        홈택스에서 사업자 상태 확인 ↗
      </a>
    </div>
  );
}

/** 01 사업자 인증 — 02 기업 정보 작성 — 03 발행 */
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["사업자 인증", "기업 정보 작성", "발행"];
  return (
    <div className="mt-[18px] flex flex-wrap items-center gap-3.5">
      {steps.map((label, index) => {
        const n = index + 1;
        return (
          <span key={label} className="flex items-center gap-3.5">
            {index > 0 && <span aria-hidden className="h-px w-10 bg-line" />}
            <span
              className={`vstep ${n === current ? "on" : n < current ? "ok" : ""}`}
              aria-current={n === current ? "step" : undefined}
            >
              <b>{String(n).padStart(2, "0")}</b>
              {label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
