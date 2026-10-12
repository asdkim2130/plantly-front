"use client";

/**
 * 2단계 — 기업 정보 작성. 이 컴포넌트가 폼 상태를 들고 자동저장·발행·오류 표시를 맡는다.
 * 섹션 컴포넌트들은 값을 그리고 `update` 로 고칠 뿐, 서버를 부르지 않는다(업로드만 예외).
 *
 * ── 자동저장 ──
 * 마지막 입력 뒤 1.2초 조용하면 초안을 통째로 저장한다(`PUT /drafts/{사업자번호}`). 서버는 내용을 검증하지
 * 않으므로 반쯤 쓴 값도 저장된다. 저장은 **차례로** 보낸다 — 앞 요청이 늦게 끝나 뒤 내용을 덮어쓰지 않게.
 * 실패해도 조용히 넘어가면 안 되는 두 갈래가 있다(`VERIFICATION_ALREADY_USED` · `VERIFICATION_NOT_FOUND`) —
 * 그때는 배너로 알리고 자동저장을 멈춘다(계속 보내 봐야 같은 답이다).
 *
 * ── 발행 ──
 * 화면 검증을 먼저 돌려 전부 모아 보여 주고, 통과하면 `POST /companies`. 서버가 돌려준 위반(errors[])도 같은
 * 자리(칸 아래 문구 + 배너 목록)에 붙인다. 오류 표시는 **고치는 대로 사라진다** — 화면 검증은 매 입력마다
 * 다시 돌고, 서버가 준 오류는 그 칸의 값이 바뀌면 지운다.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  CheckIcon,
  CloudAlertIcon,
  CloudCheckIcon,
  ShieldCheckIcon,
  SpinnerIcon,
  WarningIcon,
} from "@/components/icons";
import { PreviewCard, SearchCoverage } from "@/components/register/CardPreview";
import CapabilitySection from "@/components/register/CapabilitySection";
import ClassifySection from "@/components/register/ClassifySection";
import CoverageSection from "@/components/register/CoverageSection";
import {
  AddressSection,
  BasicInfoSection,
  BrandingSection,
  BusinessSection,
} from "@/components/register/BasicSections";
import {
  ContactSection,
  GallerySection,
  ReferenceSection,
  VisibilitySection,
} from "@/components/register/OtherSections";
import { rememberBusinessNumber } from "@/components/register/VerifyStep";
import { ApiError } from "@/lib/api";
import { createCompany, deleteDraft, saveDraft } from "@/lib/companies";
import { subscribeUploads, uploadsInFlight } from "@/lib/meta";
import {
  errorMap,
  errorWhere,
  findEtcCertificationId,
  findRemoved,
  formatBusinessNumber,
  formKeyOf,
  fromServerErrors,
  relativeTime,
  REQUIRED_TOTAL,
  requiredDone,
  SECTIONS,
  sectionId,
  sectionStates,
  sortErrors,
  toPayload,
  validate,
  type FormError,
  type RegisterForm as Form,
  type RegisterMasters,
  type RemovedSelections,
  type SectionKey,
  type SectionProps,
} from "@/lib/register";
import type { CompanyVerificationResponse } from "@/types/api";

const AUTOSAVE_DELAY_MS = 1200;

type SaveState = "idle" | "pending" | "saving" | "saved" | "fail";

/** 폼 위 알림. errors 는 남은 오류 수를 그때그때 세므로 내용을 들고 있지 않다 */
type Banner =
  | { kind: "errors" }
  | { kind: "conflict" }
  | { kind: "bizclosed"; message: string }
  | { kind: "ntsdelay" }
  | { kind: "removed"; items: FormError[] }
  | { kind: "savedup" }
  | { kind: "noauth" }
  | { kind: "uploading" }
  | { kind: "generic"; message: string };

const MASTER_GONE = new Set([
  "CATEGORY_NOT_FOUND",
  "CERTIFICATION_NOT_FOUND",
  "COUNTRY_NOT_FOUND",
  "DOMESTIC_REGION_NOT_FOUND",
  "INDUSTRY_NOT_FOUND",
]);
const BUSINESS_BLOCKED = new Set([
  "VERIFICATION_MISMATCH",
  "VERIFICATION_NOT_REGISTERED",
  "VERIFICATION_SUSPENDED",
  "VERIFICATION_CLOSED",
]);

type Props = {
  verification: CompanyVerificationResponse;
  initialForm: Form;
  /** 이어쓰기면 초안의 마지막 저장 시각 */
  initialSavedAt: string | null;
  masters: RegisterMasters;
  /** 선택지를 다시 받아 화면에 반영하고, 받은 값을 돌려준다 */
  reloadMasters: () => Promise<RegisterMasters>;
  onPublished: (companyId: number, form: Form) => void;
  /** 인증을 다시 받으러 1단계로 */
  onReverify: () => void;
};

export default function RegisterForm({
  verification,
  initialForm,
  initialSavedAt,
  masters,
  reloadMasters,
  onPublished,
  onReverify,
}: Props) {
  const router = useRouter();
  const businessNumber = verification.businessNumber;
  const etcId = findEtcCertificationId(masters.certifications);

  const [form, setForm] = useState<Form>(initialForm);
  // 예약된 자동저장이 "보낼 때의" 최신 값을 읽는 통로. 렌더 중에 고치지 않고 커밋 뒤에 맞춘다.
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  // ── 오류 ──
  const [showErrors, setShowErrors] = useState(false);
  /*
   * 서버가 준 위반과, 그때 그 칸의 값. 값이 바뀌면(=사용자가 고쳤으면) 표시하지 않는다 — 고쳤는지는 다시
   * 발행해야 알 수 있지만, 그대로 두면 고친 칸에 옛 문구가 남아 "아직 틀렸다"로 읽힌다.
   */
  const [serverErrors, setServerErrors] = useState<{ error: FormError; snapshot: unknown[] }[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [removed, setRemoved] = useState<RemovedSelections>({});

  const errors = useMemo(() => {
    const local = showErrors ? validate(form) : [];
    // 같은 칸에 화면 검증과 서버 오류가 겹치면 화면 쪽을 남긴다(고치는 대로 사라진다).
    const extra = serverErrors
      .filter(({ error, snapshot }) => formKeyOf(error.key).every((key, i) => form[key] === snapshot[i]))
      .map(({ error }) => error)
      .filter((s) => !local.some((l) => l.key === s.key));
    return sortErrors([...local, ...extra]);
  }, [form, showErrors, serverErrors]);
  const fieldErrors = useMemo(() => errorMap(errors), [errors]);

  // ── 자동저장 ──
  const [saveState, setSaveState] = useState<SaveState>(initialSavedAt ? "saved" : "idle");
  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  // 자동저장을 멈춰야 하는 상태(이미 등록됨·인증 없음). ref 로도 들어 예약된 저장이 확인한다.
  const stopped = useRef(false);

  const runSave = useCallback((): Promise<void> => {
    chain.current = chain.current.then(async () => {
      if (stopped.current) return;
      setSaveState("saving");
      try {
        await saveDraft(businessNumber, toPayload(formRef.current, verification.verificationId, etcId));
        setSavedAt(new Date().toISOString());
        setSaveState((state) => (state === "saving" ? "saved" : state));
      } catch (e) {
        setSaveState("fail");
        if (!(e instanceof ApiError)) return;
        if (e.isUnauthorized) {
          router.replace(`/login?next=${encodeURIComponent("/companies/new")}`);
        } else if (e.code === "VERIFICATION_ALREADY_USED") {
          stopped.current = true;
          setBanner({ kind: "savedup" });
        } else if (e.code === "VERIFICATION_NOT_FOUND") {
          stopped.current = true;
          setBanner({ kind: "noauth" });
        }
      }
    });
    return chain.current;
  }, [businessNumber, verification.verificationId, etcId, router]);

  useEffect(() => {
    if (!dirty.current || stopped.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void runSave(), AUTOSAVE_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [form, runSave]);

  /** 예약된 저장을 지금 보낸다(나가기 전) */
  const flushSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    return dirty.current ? runSave() : Promise.resolve();
  }, [runSave]);

  /**
   * "임시저장" 버튼. 자동저장과 같은 호출(같은 줄에 선다)이라 둘이 겹쳐도 내용이 꼬이지 않는다.
   * 고친 게 없어도 보낸다 — 누른 사람은 "지금 저장됐다"는 확인을 원하고, 손대지 않은 새 폼이라도
   * 초안을 만들어 두면 나중에 같은 사업자번호로 이어 쓸 자리가 생긴다(서버 저장은 덮어쓰기라 멱등이다).
   */
  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    return runSave();
  }, [runSave]);

  // 저장 안 된 변경이 있으면 창을 닫을 때 브라우저가 한 번 묻게 한다.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === "pending" || saveState === "saving" || saveState === "fail") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  // "3분 전 저장됨" 이 흘러가게 30초마다 다시 그린다.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const update: SectionProps["update"] = useCallback((patch) => {
    const resolve = (base: Form) => (typeof patch === "function" ? patch(base) : patch);
    // 한도에 막혀 아무것도 바꾸지 않는 갱신({})은 여기서 끝낸다 — "저장 중…" 이 뜬 채 저장이 예약되지 않는 일이 없게.
    // (판단은 마지막으로 그린 값 기준이다. 갱신 함수는 순수해서 아래에서 한 번 더 불려도 같은 답을 낸다.)
    if (Object.keys(resolve(formRef.current)).length === 0) return;
    dirty.current = true;
    if (!stopped.current) setSaveState("pending");
    setForm((prev) => ({ ...prev, ...resolve(prev) }));
  }, []);

  // ── 목차: 지금 보고 있는 섹션 ──
  const [active, setActive] = useState<SectionKey>("A");
  useEffect(() => {
    const onScroll = () => {
      let current: SectionKey = "A";
      for (const { key } of SECTIONS) {
        const el = document.getElementById(sectionId(key));
        if (el && el.getBoundingClientRect().top < 180) current = key;
      }
      setActive(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goTo = (key: SectionKey) =>
    document.getElementById(sectionId(key))?.scrollIntoView({ behavior: "smooth", block: "start" });

  // ── 발행 ──
  const [publishing, setPublishing] = useState(false);
  const uploading = useSyncExternalStore(subscribeUploads, uploadsInFlight, () => 0);

  async function publish() {
    if (publishing) return;
    setShowErrors(true);
    setServerErrors([]);
    const local = validate(form);
    if (local.length) {
      setBanner({ kind: "errors" });
      goTo(local[0].section);
      return;
    }
    if (uploading > 0) {
      setBanner({ kind: "uploading" });
      return;
    }

    setPublishing(true);
    // 예약된 자동저장은 버린다 — 발행이 성공하면 서버가 초안을 지우고, 실패하면 아래에서 다시 저장된다.
    if (timer.current) clearTimeout(timer.current);
    try {
      const { id } = await createCompany(toPayload(form, verification.verificationId, etcId));
      stopped.current = true;
      dirty.current = false;
      rememberBusinessNumber(null);
      onPublished(id, form);
    } catch (e) {
      await handlePublishError(e);
      setPublishing(false);
    }
  }

  async function handlePublishError(e: unknown) {
    if (!(e instanceof ApiError)) {
      setBanner({ kind: "generic", message: "발행 요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." });
      return;
    }
    const code = e.code ?? "";
    if (e.isUnauthorized) {
      await flushSave();
      router.replace(`/login?next=${encodeURIComponent("/companies/new")}`);
    } else if (e.errors.length) {
      const mapped = fromServerErrors(e.errors);
      setServerErrors(
        mapped.map((error) => ({ error, snapshot: formKeyOf(error.key).map((key) => form[key]) })),
      );
      setBanner({ kind: "errors" });
      if (mapped[0]) goTo(sortErrors(mapped)[0].section);
    } else if (code === "BUSINESS_NUMBER_TAKEN" || code === "VERIFICATION_ALREADY_USED") {
      setBanner({ kind: "conflict" });
    } else if (BUSINESS_BLOCKED.has(code)) {
      setBanner({ kind: "bizclosed", message: e.message });
    } else if (code === "VERIFICATION_UNAVAILABLE") {
      setBanner({ kind: "ntsdelay" });
    } else if (code === "VERIFICATION_NOT_FOUND" || code === "VERIFICATION_EXPIRED") {
      setBanner({ kind: "noauth" });
    } else if (MASTER_GONE.has(code)) {
      // 작성하는 사이 관리자가 선택지를 지웠다. 다시 받아 어느 항목인지 짚어 준다.
      try {
        const fresh = await reloadMasters();
        const result = findRemoved(form, masters, fresh);
        setRemoved(result.removed);
        setBanner(result.items.length ? { kind: "removed", items: result.items } : { kind: "generic", message: e.message });
      } catch {
        setBanner({ kind: "generic", message: e.message });
      }
    } else {
      // 등급 한도(CATEGORY_LIMIT_EXCEEDED 등)처럼 화면이 미리 막는 것이 새어 나온 경우 — 서버 문구 그대로.
      setBanner({ kind: "generic", message: e.message });
    }
    if (!e.isUnauthorized) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 오류 배너는 다 고치면 "다시 발행" 으로 바뀐다. 사라진 선택지 배너는 그 칩을 다 빼면 저절로 닫힌다.
  const removedLeft = banner?.kind === "removed" ? banner.items.filter((item) => stillSelected(form, removed, item)) : [];
  const shownBanner = banner?.kind === "removed" && removedLeft.length === 0 ? null : banner;

  // ── 나가기 ──
  const [cancelOpen, setCancelOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function saveAndLeave() {
    setLeaving(true);
    await flushSave();
    router.push("/");
  }

  async function discardAndLeave() {
    setLeaving(true);
    stopped.current = true;
    if (timer.current) clearTimeout(timer.current);
    try {
      await deleteDraft(businessNumber);
      rememberBusinessNumber(null);
      router.push("/");
    } catch (e) {
      stopped.current = false;
      setLeaving(false);
      setCancelOpen(false);
      setBanner({ kind: "generic", message: e instanceof ApiError ? e.message : "초안을 지우지 못했습니다." });
    }
  }

  // 이미 등록된 번호·인증 없음으로 저장이 막힌 상태 — 눌러 봐야 같은 답이라 버튼을 잠근다.
  const saveHalted = banner?.kind === "savedup" || banner?.kind === "noauth";

  // ── 그리기 ──
  const states = sectionStates(form, verification.limits.videoAllowed);
  const done = requiredDone(form);
  const sectionProps: SectionProps = {
    form,
    update,
    errors: fieldErrors,
    masters,
    limits: verification.limits,
    grade: verification.initialGrade,
    removed,
  };
  const removedBySection = (key: SectionKey) => removedLeft.filter((item) => item.section === key).length;

  return (
    <div>
      {/* 따라다니는 머리: 저장 상태 · 필수 n/4 · 발행 / 인증된 신원과 등급 */}
      <div className="sticky top-0 z-20 bg-white shadow-[0_1px_0_var(--color-line)]">
        <div className="flex flex-wrap items-center gap-3.5 px-4 py-3 sm:px-[30px]">
          <div className="mr-auto flex flex-col gap-0.5">
            <div className="kick text-[11px] text-brand-700">Step 02 · Company Registration</div>
            <h1 className="text-[22px] leading-[1.1]">기업정보 등록</h1>
          </div>
          <SaveStatus state={saveState} savedAt={savedAt} now={now} />
          <span className="border-l border-line pl-3.5 text-xs text-muted">
            필수{" "}
            <b className={`font-heading text-sm ${done === REQUIRED_TOTAL ? "text-brand-700" : "text-ink"}`}>
              {done} / {REQUIRED_TOTAL}
            </b>
          </span>
          <button type="button" className="btn btn-ghost" onClick={() => setCancelOpen(true)}>
            작성 취소
          </button>
          <SaveButton state={saveState} halted={saveHalted} uploading={uploading} onClick={saveNow} />
          <PublishButton publishing={publishing} uploading={uploading} onClick={publish} />
        </div>
        <div className="flex flex-wrap items-center gap-x-[26px] gap-y-2 bg-brand-900 px-4 py-[11px] sm:px-[30px]">
          <div className="ro">
            <span className="k">사업자등록번호</span>
            <span className="v font-heading text-[15px] tracking-[0.05em]">{formatBusinessNumber(businessNumber)}</span>
          </div>
          <div className="ro">
            <span className="k">대표자</span>
            <span className="v">{verification.ceoName}</span>
          </div>
          <div className="ro">
            <span className="k">개업일자</span>
            <span className="v font-heading text-[15px] tracking-[0.04em]">
              {verification.businessStartDate.replaceAll("-", ".")}
            </span>
          </div>
          <span className="inline-flex items-center gap-[5px] rounded-full border border-white/30 py-1 pr-2.5 pl-2 text-xs text-white">
            <ShieldCheckIcon size={13} strokeWidth={1.8} className="text-brand-300" />
            국세청 인증 완료
          </span>
          <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
            <span className="tag bg-brand font-heading text-xs tracking-[0.08em] text-white">
              {verification.initialGrade}
            </span>
            <span className="text-xs text-white/70">
              카테고리 {verification.limits.maxCategories} · 상세 이미지 {verification.limits.maxDetailImages}장 ·
              레퍼런스 이미지 {verification.limits.maxReferenceImages}장 · 동영상{" "}
              {verification.limits.videoAllowed ? "허용" : "불가"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 px-4 pt-[22px] pb-10 sm:px-[30px] lg:grid-cols-[186px_minmax(0,1fr)_296px]">
        {/* 섹션 목차 */}
        <nav aria-label="섹션" className="sticky top-[132px] hidden flex-col gap-0.5 lg:flex">
          <div className="kick px-2.5 pb-2">섹션</div>
          {SECTIONS.map(({ key, title, required }) => {
            const count = errors.filter((error) => error.section === key).length + removedBySection(key);
            const state = states[key];
            return (
              <button
                key={key}
                type="button"
                className={`navi ${active === key ? "on" : ""}`}
                aria-current={active === key ? "true" : undefined}
                onClick={() => goTo(key)}
              >
                <span className="nk">{key}</span>
                {title}
                {required && <span className="req">★</span>}
                {count > 0 && <span className="ec" aria-label={`오류 ${count}개`}>{count}</span>}
                <span className={`st ${state}`} aria-label={STATE_LABEL[state]}>
                  {state === "done" && <CheckIcon size={9} />}
                </span>
              </button>
            );
          })}
          <div className="mt-3.5 flex flex-col gap-1.5 border-t border-line px-2.5 pt-3 text-[11px] text-faint">
            {(["done", "part", "empty"] as const).map((state) => (
              <span key={state} className="flex items-center gap-[7px]">
                <span className={`st ${state} m-0`} />
                {STATE_LABEL[state]}
              </span>
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-baseline gap-2 py-0.5">
            <span className="req text-xs">★</span>
            <p className="text-[13px] leading-[1.6] text-muted">
              <b className="font-semibold text-ink">필수 정보 4가지만 입력하면 기업 페이지를 발행할 수 있습니다.</b>
              <br />
              기업명 · 우편번호 · 도로명 주소 · 상세주소
              <br />그 외 정보는 발행 후에도 언제든 추가할 수 있습니다.
            </p>
          </div>
          <div className="-mt-2 flex items-center gap-2 text-[13px] text-muted">
            <CloudCheckIcon size={14} className="shrink-0 text-brand-700" />
            작성 중인 내용은 자동으로 임시저장 됩니다. 같은 사업자번호로 인증하면 이어서 작성할 수 있습니다.
          </div>

          {shownBanner && (
            <FormBanner
              banner={shownBanner}
              errors={errors}
              removedLeft={removedLeft}
              goTo={goTo}
              publish={publish}
              onReverify={async () => {
                await flushSave();
                onReverify();
              }}
            />
          )}

          <BasicInfoSection {...sectionProps} />
          <AddressSection {...sectionProps} />
          <BrandingSection {...sectionProps} />
          <BusinessSection {...sectionProps} />
          <ClassifySection {...sectionProps} />
          <CapabilitySection {...sectionProps} />
          <CoverageSection {...sectionProps} />
          <GallerySection {...sectionProps} />
          <ContactSection {...sectionProps} />
          <ReferenceSection {...sectionProps} />
          <VisibilitySection {...sectionProps} />

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-brand-100/40 px-[18px] py-4">
            <div className="flex-1">
              <div className="font-heading text-lg">
                {done === REQUIRED_TOTAL
                  ? "필수 항목을 모두 채웠습니다"
                  : `필수 항목 ${REQUIRED_TOTAL - done}개가 남았습니다.`}
              </div>
              <p className="fhint mt-0.5">기업 페이지를 발행할 때 입력한 모든 정보를 최종 확인합니다.</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => setCancelOpen(true)}>
              작성 취소
            </button>
            <SaveButton state={saveState} halted={saveHalted} uploading={uploading} onClick={saveNow} />
            <PublishButton publishing={publishing} uploading={uploading} onClick={publish} />
          </div>
        </div>

        <aside className="flex flex-col gap-3.5 lg:sticky lg:top-[132px]">
          <div className="flex items-baseline gap-2">
            <span className="kick">카드 미리보기</span>
            <span className="text-[11px] text-faint">메인 · 검색 목록</span>
          </div>
          <PreviewCard form={form} masters={masters} />
          <p className="fhint -mt-1">
            {form.coverImageUrl
              ? "로고를 등록하지 않으면 기업명의 앞 두 글자가 기본 로고로 표시됩니다."
              : "커버가 없으면 브랜드 컬러로 대체 디자인을 그립니다. 로고는 앞 두 글자 배지로 대신합니다."}
          </p>
          <SearchCoverage form={form} ceoName={verification.ceoName} />
        </aside>
      </div>

      {cancelOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-brand-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
          onKeyDown={(e) => e.key === "Escape" && !leaving && setCancelOpen(false)}
        >
          <div className="blueprint flex w-[440px] max-w-full flex-col gap-3.5 bg-white px-[26px] py-6 shadow-[0_24px_60px_rgb(11_33_72/0.3)]">
            <h2 id="cancel-title" className="text-[22px]">
              기업 정보 작성을 취소하시겠습니까?
            </h2>
            <p className="text-[13px] leading-[1.65] text-muted">
              작성 중인 내용을 저장하면 동일한 사업자등록번호로 언제든 이어서 작성할 수 있습니다. 저장하지 않고
              삭제하면 지금까지 작성한 내용은 복구할 수 없습니다.
            </p>
            <div className="mt-1 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-primary"
                autoFocus
                disabled={leaving}
                onClick={() => setCancelOpen(false)}
              >
                계속 작성
              </button>
              <button type="button" className="btn btn-secondary" disabled={leaving} onClick={saveAndLeave}>
                저장하고 나가기
              </button>
              <button
                type="button"
                className="btn border-danger bg-white text-danger hover:bg-danger-soft"
                disabled={leaving}
                onClick={discardAndLeave}
              >
                삭제하고 나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STATE_LABEL = { done: "모두 입력", part: "일부 입력", empty: "비어 있음" } as const;

function stillSelected(form: Form, removed: RemovedSelections, item: FormError) {
  const lists: [keyof RemovedSelections, number[]][] = [
    ["categoryIds", form.categoryIds],
    ["industryIds", form.industryIds],
    ["certificationIds", form.certificationIds],
    ["domesticRegionIds", form.domesticRegionIds],
    ["countryIds", form.countryIds],
  ];
  return lists.some(([key, ids]) => {
    const map = removed[key];
    if (!map) return false;
    return ids.some((id) => map.get(id) === item.message);
  });
}

function SaveStatus({ state, savedAt, now }: { state: SaveState; savedAt: string | null; now: number }) {
  if (state === "fail") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-danger" role="status">
        <CloudAlertIcon size={14} />
        저장 실패
      </span>
    );
  }
  if (state === "pending" || state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-brand-700" role="status">
        <SpinnerIcon size={13} className="animate-spin" />
        저장 중…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted" role="status">
      <CloudCheckIcon size={14} />
      {savedAt ? `${relativeTime(savedAt, now)} 저장됨` : "입력하면 자동 저장됩니다"}
    </span>
  );
}

function SaveButton({
  state,
  halted,
  uploading,
  onClick,
}: {
  state: SaveState;
  halted: boolean;
  uploading: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="btn btn-secondary bg-white"
      disabled={halted || state === "saving"}
      onClick={onClick}
      // 올라가는 중인 사진은 아직 url 이 없어 폼에 없다 — 지금 저장하면 그 장은 빠진다.
      title={uploading > 0 ? "올리는 중인 이미지는 업로드가 끝난 뒤 저장됩니다" : undefined}
    >
      임시저장
    </button>
  );
}

function PublishButton({
  publishing,
  uploading,
  onClick,
}: {
  publishing: boolean;
  uploading: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="btn btn-primary px-5"
      disabled={publishing}
      onClick={onClick}
      title={uploading > 0 ? "이미지 업로드가 끝나면 발행할 수 있습니다" : undefined}
    >
      {publishing && <SpinnerIcon size={14} className="animate-spin" />}
      {publishing ? "발행 중…" : "발행하기"}
    </button>
  );
}

function FormBanner({
  banner,
  errors,
  removedLeft,
  goTo,
  publish,
  onReverify,
}: {
  banner: Banner;
  errors: FormError[];
  removedLeft: FormError[];
  goTo: (key: SectionKey) => void;
  publish: () => void;
  onReverify: () => void;
}) {
  let tone: "err" | "info" = "err";
  let title: string;
  let body: string | null = null;
  let list: { where: string; msg: string; go: () => void }[] = [];
  let action: React.ReactNode = null;

  switch (banner.kind) {
    case "errors":
      if (errors.length) {
        title = `기업 페이지를 발행하지 못했습니다. 수정이 필요한 항목이 ${errors.length}개 있습니다.`;
        body =
          "확인이 필요한 항목을 아래에 모두 표시했습니다. 각 항목을 클릭하면 해당 입력란으로 이동하며, 문제를 해결하면 오류 표시가 사라집니다.";
        list = errors.map((error) => ({ where: errorWhere(error), msg: error.message, go: () => goTo(error.section) }));
      } else {
        tone = "info";
        title = "모든 항목을 고쳤습니다";
        body = "다시 발행해 주세요.";
        action = (
          <button type="button" className="btn btn-primary px-3.5 py-1.5 text-[13px]" onClick={publish}>
            다시 발행
          </button>
        );
      }
      break;
    case "conflict":
      title = "동일한 사업자등록번호로 다른 계정에서 기업 등록을 완료했습니다.";
      body =
        "기업 정보를 작성하는 동안 다른 계정에서 먼저 등록했습니다. 작성한 내용은 초안으로 보관됩니다. 직접 등록한 적이 없다면 플랜틀리로 문의해 주세요.";
      break;
    case "bizclosed":
      title = banner.message;
      body =
        "최종 확인 결과, 인증 당시와 국세청 등록 정보가 달라졌습니다. 작성한 내용은 그대로 보관되며, 사업자 상태가 바뀌면 다시 발행할 수 있습니다.";
      action = (
        <a href="https://www.hometax.go.kr" target="_blank" rel="noreferrer" className="btn btn-ghost px-3.5 py-1.5 text-[13px]">
          홈택스에서 사업자 상태 확인 ↗
        </a>
      );
      break;
    case "ntsdelay":
      tone = "info";
      title = "국세청 확인이 지연되어 기업 페이지를 발행하지 못했습니다.";
      body = "일시적인 시스템 지연으로 최종 확인을 완료하지 못했습니다. 작성한 내용은 저장되어 있으니 잠시 후 다시 시도해 주세요.";
      action = (
        <button type="button" className="btn btn-primary px-3.5 py-1.5 text-[13px]" onClick={publish}>
          다시 발행
        </button>
      );
      break;
    case "removed":
      title = `선택한 항목 중 ${removedLeft.length}개가 더 이상 제공되지 않습니다.`;
      body =
        "작성 중 선택 가능한 항목 목록이 변경되었습니다. 아래에 표시된 항목을 삭제하고 현재 선택 가능한 항목으로 다시 지정해 주세요.";
      list = removedLeft.map((item) => ({ where: errorWhere(item), msg: item.message, go: () => goTo(item.section) }));
      break;
    case "savedup":
      title = "자동 저장에 실패했습니다. 이미 등록된 사업자등록번호입니다.";
      body = "해당 사업자등록번호로 등록된 기업이 있어 초안을 저장할 수 없습니다.";
      break;
    case "noauth":
      title = "사업자 인증 정보를 확인할 수 없습니다.";
      body =
        "유효한 인증 기록을 찾을 수 없어 저장하거나 발행하지 못했습니다. 사업자 인증을 다시 진행하면 동일한 사업자등록번호로 작성을 이어갈 수 있습니다.";
      action = (
        <button type="button" className="btn btn-primary px-3.5 py-1.5 text-[13px]" onClick={onReverify}>
          사업자 인증 다시 하기
        </button>
      );
      break;
    case "uploading":
      tone = "info";
      title = "이미지를 올리는 중입니다.";
      body = "업로드가 끝나면 다시 발행해 주세요. 올라가는 중인 이미지는 아직 기업 정보에 포함되지 않았습니다.";
      break;
    case "generic":
      title = banner.message;
      break;
  }

  return (
    <div className={`bnr ${tone}`} role="alert">
      <WarningIcon size={18} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <div className="bnt">{title}</div>
          {body && <div className="bnb">{body}</div>}
        </div>
        {list.length > 0 && (
          <div className="flex flex-col gap-0.5 rounded-lg border border-danger/20 bg-white px-2.5 py-2">
            {list.map((item, index) => (
              <button key={index} type="button" className="elink" onClick={item.go}>
                <b>{item.where}</b>
                {item.msg}
              </button>
            ))}
          </div>
        )}
        {action && <div className="flex gap-2">{action}</div>}
      </div>
    </div>
  );
}
