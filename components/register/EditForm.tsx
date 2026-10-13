"use client";

/**
 * 기업정보 수정. 등록 화면의 섹션 컴포넌트를 그대로 쓰고, 저장만 **섹션 단위**로 한다(lib/companyEdit.ts 머리말).
 *
 * - 섹션마다 "저장 안 된 변경"을 저장값과 견줘 판단하고, 바뀐 섹션 아래에만 저장 줄이 붙는다(SectionFooterContext).
 * - 오류는 그 섹션에 붙는다. 화면 검증은 그 섹션 저장을 한 번 눌렀을 때부터 입력마다 다시 돌고, 서버가 준
 *   위반은 "그때 그 칸의 값"을 들고 있다가 값이 바뀌면 지운다(등록 화면과 같은 방식).
 * - 등급 한도는 구독 조회의 `limits`(실제 유효 등급 기준)에서 온다. 숨겨진 항목(active=false)은 회색으로 그리고,
 *   그 컬렉션을 저장하면 서버가 전부 새로 만들어 다시 공개되므로 표시를 지운다.
 * - 대표자명·개업일자는 국세청 인증 회사면 일반 수정이 막혀 있어 남색 띠에 읽기 전용으로 두고 "재인증"으로만 바꾼다.
 *
 * ── 관리자 수정(`admin`) ──
 * 같은 폼을 `/admin/companies/[id]/edit` 가 쓴다. 본문은 같고 저장 경로만 `/admin/companies/…` 다(ADMIN_SAVE_API).
 *  - 등급 한도는 관리자에게도 똑같이 걸린다 — 한도는 행위자가 아니라 회사 구독이 정한다(관리자 구독 응답의 limits).
 *  - 재인증은 없다(소유자가 국세청에 다시 확인받는 길이다). 대신 **국세청 미인증 회사**는 대표자명·개업일자를
 *    기본 정보 섹션에서 직접 고친다 — 관리자 등록 회사가 전부 여기에 해당한다. 인증 회사는 관리자도 못 바꾼다
 *    (서버 가드 VERIFIED_FIELD_NOT_EDITABLE — 인증을 회수해야 열린다).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CheckIcon, ShieldCheckIcon, SpinnerIcon, WarningIcon } from "@/components/icons";
import {
  AddressSection,
  BasicInfoSection,
  BrandingSection,
  BusinessSection,
} from "@/components/register/BasicSections";
import CapabilitySection from "@/components/register/CapabilitySection";
import { PreviewCard, SearchCoverage } from "@/components/register/CardPreview";
import ClassifySection from "@/components/register/ClassifySection";
import CoverageSection from "@/components/register/CoverageSection";
import {
  ContactSection,
  GallerySection,
  ReferenceSection,
  VisibilitySection,
} from "@/components/register/OtherSections";
import { ErrorLine, FieldHead, SectionFooterContext } from "@/components/register/parts";
import { ApiError } from "@/lib/api";
import { ADMIN_SAVE_API } from "@/lib/admin";
import { buildSaveOps, changedFields, qualifyField, SECTION_FIELDS } from "@/lib/companyEdit";
import { reverifyCompany } from "@/lib/companies";
import { subscribeUploads, uploadsInFlight } from "@/lib/meta";
import {
  errorMap,
  findEtcCertificationId,
  formatBusinessNumber,
  formKeyOf,
  fromServerErrors,
  SECTIONS,
  sectionId,
  sortErrors,
  validate,
  type FormError,
  type HiddenItems,
  type RegisterForm as Form,
  type RegisterMasters,
  type SectionKey,
  type SectionProps,
} from "@/lib/register";
import type { CompanyDetailResponse, CompanySubscriptionResponse } from "@/types/api";

type Notice = { tone: "ok" | "err"; message: string };

type Props = {
  companyId: number;
  detail: CompanyDetailResponse;
  initialForm: Form;
  /** 소유자용·관리자용 구독 응답이 둘 다 이 세 값을 갖는다 */
  subscription: Pick<CompanySubscriptionResponse, "effectiveGrade" | "status" | "limits">;
  masters: RegisterMasters;
  /** 관리자 수정(파일 머리 주석) */
  admin?: boolean;
};

export default function EditForm({ companyId, detail, initialForm, subscription, masters, admin = false }: Props) {
  const router = useRouter();
  const etcId = findEtcCertificationId(masters.certifications);
  const limits = subscription.limits;
  const saveApi = admin ? ADMIN_SAVE_API : undefined;
  const editPath = admin ? `/admin/companies/${companyId}/edit` : `/companies/${companyId}/edit`;
  // 관리자가 국세청 미인증 회사의 대표자명·개업일자를 기본 정보 섹션에서 직접 고치는가
  const identityEditable = admin && !detail.meta.businessVerified;

  const [form, setForm] = useState<Form>(initialForm);
  /** 서버에 저장돼 있는 값. 섹션 저장이 성공할 때마다 그 칸만 옮겨 온다 */
  const [saved, setSaved] = useState<Form>(initialForm);

  // 숨겨진 항목(active=false). 그 컬렉션을 저장하면 서버가 전부 새로 만들어(active=true) 표시가 의미를 잃는다.
  const [hidden, setHidden] = useState<HiddenItems>(() => ({
    categoryIds: new Set(detail.profile.categories.filter((c) => !c.active).map((c) => c.id)),
    images: new Set(detail.profile.galleryImages.filter((image) => !image.active).map((image) => image.imageUrl)),
  }));

  // 재인증으로 바뀔 수 있는 신원 두 칸
  const [identity, setIdentity] = useState({
    ceoName: detail.profile.ceoName,
    startDate: detail.profile.establishmentDate,
    verifiedAt: detail.meta.businessVerifiedAt,
  });
  const [reverifyOpen, setReverifyOpen] = useState(false);

  const update: SectionProps["update"] = useCallback((patch) => {
    setForm((prev) => {
      const changes = typeof patch === "function" ? patch(prev) : patch;
      return Object.keys(changes).length === 0 ? prev : { ...prev, ...changes };
    });
  }, []);

  // ── 섹션 상태 ──
  const dirtySections = useMemo(
    () => SECTIONS.filter(({ key }) => changedFields(form, saved, key).length > 0).map(({ key }) => key),
    [form, saved],
  );
  const isDirty = (key: SectionKey) => dirtySections.includes(key);

  const [attempted, setAttempted] = useState<Set<SectionKey>>(new Set());
  const [serverErrors, setServerErrors] = useState<{ error: FormError; snapshot: unknown[] }[]>([]);
  const [notices, setNotices] = useState<Partial<Record<SectionKey, Notice>>>({});
  const [savingKey, setSavingKey] = useState<SectionKey | null>(null);
  const uploading = useSyncExternalStore(subscribeUploads, uploadsInFlight, () => 0);

  // 수정은 날짜 비우기를 지원하지 않는다 — 저장값이 있으면 비운 채 저장을 막는다.
  const requireDate = identityEditable && saved.establishmentDate !== "";
  const check = useCallback(
    (value: Form) => validate(value, identityEditable, requireDate),
    [identityEditable, requireDate],
  );

  const errors = useMemo(() => {
    const local = check(form).filter((error) => attempted.has(error.section));
    const extra = serverErrors
      .filter(({ error, snapshot }) => formKeyOf(error.key).every((key, i) => form[key] === snapshot[i]))
      .map(({ error }) => error)
      .filter((s) => !local.some((l) => l.key === s.key));
    return sortErrors([...local, ...extra]);
  }, [form, attempted, serverErrors, check]);
  const fieldErrors = useMemo(() => errorMap(errors), [errors]);

  // 저장 안 된 섹션이 있으면 창을 닫을 때 브라우저가 한 번 묻는다.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtySections.length) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtySections.length]);

  const setNotice = (key: SectionKey, notice: Notice | null) =>
    setNotices((all) => {
      const next = { ...all };
      if (notice) next[key] = notice;
      else delete next[key];
      return next;
    });

  async function saveSection(key: SectionKey) {
    if (savingKey) return;
    setAttempted((set) => new Set(set).add(key));
    const local = check(form).filter((error) => error.section === key);
    // 칸 오류는 꼬리 줄이 남은 개수를 세어 보여 준다(고치는 대로 줄어든다) — 따로 소식을 남기지 않는다.
    if (local.length) return;
    if (uploading > 0 && (key === "C" || key === "H" || key === "J")) {
      setNotice(key, { tone: "err", message: "이미지를 올리는 중입니다. 업로드가 끝난 뒤 저장해 주세요." });
      return;
    }

    // 누른 순간의 값으로 보낸다. 저장 중에 더 고친 칸은 저장값과 달라 그대로 "저장 안 됨"으로 남는다.
    const snapshot = form;
    const ops = buildSaveOps(companyId, key, snapshot, saved, etcId, saveApi);
    setSavingKey(key);
    setNotice(key, null);
    setServerErrors((list) => list.filter(({ error }) => error.section !== key));

    for (const op of ops) {
      try {
        await op.run();
        setSaved((prev) => ({ ...prev, ...Object.fromEntries(op.fields.map((field) => [field, snapshot[field]])) }));
        if (op.collection === "categories") setHidden((h) => ({ ...h, categoryIds: new Set() }));
        if (op.collection === "images") setHidden((h) => ({ ...h, images: new Set() }));
      } catch (e) {
        setSavingKey(null);
        if (e instanceof ApiError && e.isUnauthorized) {
          router.replace(`/login?next=${encodeURIComponent(editPath)}`);
          return;
        }
        if (e instanceof ApiError && e.errors.length) {
          const mapped = fromServerErrors(
            e.errors.map((error) => ({ ...error, field: qualifyField(op.collection, error.field) })),
          );
          setServerErrors((list) => [
            ...list,
            ...mapped.map((error) => ({ error, snapshot: formKeyOf(error.key).map((k) => snapshot[k]) })),
          ]);
          // 칸으로 옮기지 못한 위반(모르는 경로)만 남으면 문구라도 보여 준다.
          if (mapped.length === 0) setNotice(key, { tone: "err", message: e.message });
        } else {
          // 등급 한도(CATEGORY_LIMIT_EXCEEDED 등) · 사라진 선택지(*_NOT_FOUND) · 권한 — 서버 문구 그대로.
          setNotice(key, {
            tone: "err",
            message: e instanceof ApiError ? e.message : "저장 요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
          });
        }
        return;
      }
    }
    setSavingKey(null);
    setNotice(key, { tone: "ok", message: "저장했습니다." });
  }

  function revertSection(key: SectionKey) {
    setForm((prev) => ({ ...prev, ...Object.fromEntries(SECTION_FIELDS[key].map((field) => [field, saved[field]])) }));
    setNotice(key, null);
    setAttempted((set) => {
      const next = new Set(set);
      next.delete(key);
      return next;
    });
  }

  // 섹션 상자 아래 꼬리: 바뀌었으면 저장/되돌리기, 방금 저장했거나 실패했으면 그 소식.
  const renderFooter = (letter: string) => {
    const key = letter as SectionKey;
    const dirty = isDirty(key);
    const notice = notices[key];
    const saving = savingKey === key;
    const count = errors.filter((error) => error.section === key).length;
    if (!dirty && !notice && !saving && count === 0) return null;
    return (
      <div className="-mx-6 -mb-6 flex flex-wrap items-center gap-2.5 rounded-b-[12px] border-t border-line-soft bg-brand-100/50 px-6 py-3">
        <span
          className={`mr-auto inline-flex items-center gap-1.5 text-[13px] ${
            count > 0 || notice?.tone === "err"
              ? "text-danger"
              : notice?.tone === "ok" && !dirty
                ? "text-brand-700"
                : "text-muted"
          }`}
          role="status"
        >
          {count > 0 ? (
            <>
              <WarningIcon size={14} />
              저장하지 못했습니다. 고쳐야 할 항목이 {count}개 있습니다.
            </>
          ) : notice?.tone === "err" ? (
            <>
              <WarningIcon size={14} />
              {notice.message}
            </>
          ) : notice?.tone === "ok" && !dirty ? (
            <>
              <CheckIcon size={12} />
              {notice.message}
            </>
          ) : (
            "저장하지 않은 변경이 있습니다."
          )}
        </span>
        {dirty && (
          <>
            <button type="button" className="btn btn-ghost text-[13px]" disabled={saving} onClick={() => revertSection(key)}>
              되돌리기
            </button>
            <button
              type="button"
              className="btn btn-primary px-4 text-[13px]"
              disabled={savingKey !== null}
              onClick={() => saveSection(key)}
            >
              {saving && <SpinnerIcon size={13} className="animate-spin" />}
              {saving ? "저장 중…" : "이 섹션 저장"}
            </button>
          </>
        )}
      </div>
    );
  };

  // ── 목차 ──
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

  const sectionProps: SectionProps = {
    form,
    update,
    errors: fieldErrors,
    masters,
    limits,
    grade: subscription.effectiveGrade,
    removed: {},
    mode: "edit",
    hidden,
    identity: identityEditable ? "edit" : undefined,
  };
  const isPublic = saved.visibility === "PUBLIC";
  // 공개 상세는 공개이고 삭제되지 않았을 때만 있다(관리자는 삭제된 회사도 고칠 수 있다).
  const hasPublicPage = isPublic && !detail.meta.deleted;
  // 남색 띠에 보이는 신원 — 관리자가 고칠 수 있으면 저장값을, 아니면 재인증 결과까지 반영한 값을 보인다.
  const shownCeo = identityEditable ? saved.ceoName : identity.ceoName;
  const shownDate = identityEditable ? saved.establishmentDate || null : identity.startDate;

  return (
    <div>
      <div className="sticky top-0 z-20 bg-white shadow-[0_1px_0_var(--color-line)]">
        <div className="flex flex-wrap items-center gap-3.5 px-4 py-3 sm:px-[30px]">
          <div className="mr-auto flex min-w-0 flex-col gap-0.5">
            <div className="kick text-[11px] text-brand-700">
              {admin ? "Admin · Company Profile · Edit" : "Company Profile · Edit"}
            </div>
            <h1 className="truncate text-[22px] leading-[1.1]">
              {admin ? "기업정보 수정 (관리자)" : "기업정보 수정"} <span className="text-muted">· {saved.companyName}</span>
            </h1>
          </div>
          <span className="text-[13px] text-muted" role="status">
            {dirtySections.length
              ? `저장하지 않은 섹션 ${dirtySections.length}개`
              : "모든 변경이 저장되었습니다"}
          </span>
          {admin && (
            <Link href={`/admin/companies/${companyId}`} className="btn btn-ghost">
              관리자 상세
            </Link>
          )}
          {hasPublicPage ? (
            <Link href={`/companies/${companyId}`} className="btn btn-secondary">
              공개 페이지 보기
            </Link>
          ) : (
            <span className="text-xs text-faint">
              {detail.meta.deleted ? "삭제된 기업이라 공개 페이지가 없습니다" : "비공개 상태라 공개 페이지가 없습니다"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-[26px] gap-y-2 bg-brand-900 px-4 py-[11px] sm:px-[30px]">
          {detail.meta.businessNumber && (
            <div className="ro">
              <span className="k">사업자등록번호</span>
              <span className="v font-heading text-[15px] tracking-[0.05em]">
                {formatBusinessNumber(detail.meta.businessNumber)}
              </span>
            </div>
          )}
          <div className="ro">
            <span className="k">대표자</span>
            <span className="v">{shownCeo}</span>
          </div>
          {shownDate && (
            <div className="ro">
              <span className="k">개업일자</span>
              <span className="v font-heading text-[15px] tracking-[0.04em]">{shownDate.replaceAll("-", ".")}</span>
            </div>
          )}
          {detail.meta.businessVerified && (
            <>
              <span className="inline-flex items-center gap-[5px] rounded-full border border-white/30 py-1 pr-2.5 pl-2 text-xs text-white">
                <ShieldCheckIcon size={13} strokeWidth={1.8} className="text-brand-300" />
                국세청 인증 완료
              </span>
              {admin ? (
                <span className="text-xs text-white/60">대표자·개업일자는 인증을 회수해야 바꿀 수 있습니다</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost px-2 py-1 text-xs text-white"
                  onClick={() => setReverifyOpen(true)}
                >
                  대표자·개업일자 변경(재인증)
                </button>
              )}
            </>
          )}
          {identityEditable && <span className="text-xs text-white/60">국세청 미인증 · 신원은 기본 정보에서 고칩니다</span>}
          <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
            <span className="tag bg-brand font-heading text-xs tracking-[0.08em] text-white">
              {subscription.effectiveGrade}
              {subscription.status === "ADMIN_EXEMPT" && " · 한도 면제"}
            </span>
            <span className="text-xs text-white/70">
              카테고리 {limits.maxCategories} · 상세 이미지 {limits.maxDetailImages}장 · 레퍼런스 이미지{" "}
              {limits.maxReferenceImages}장 · 동영상 {limits.videoAllowed ? "허용" : "불가"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 px-4 pt-[22px] pb-10 sm:px-[30px] lg:grid-cols-[186px_minmax(0,1fr)_296px]">
        <nav aria-label="섹션" className="sticky top-[132px] hidden flex-col gap-0.5 lg:flex">
          <div className="kick px-2.5 pb-2">섹션</div>
          {SECTIONS.map(({ key, title }) => {
            const count = errors.filter((error) => error.section === key).length;
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
                {count > 0 && (
                  <span className="ec" aria-label={`오류 ${count}개`}>
                    {count}
                  </span>
                )}
                {isDirty(key) && (
                  <span
                    className={`${count > 0 ? "" : "ml-auto"} size-2 flex-none rounded-full bg-brand`}
                    aria-label="저장 안 됨"
                    title="저장하지 않은 변경"
                  />
                )}
              </button>
            );
          })}
          <div className="mt-3.5 flex items-center gap-[7px] border-t border-line px-2.5 pt-3 text-[11px] text-faint">
            <span className="size-2 rounded-full bg-brand" />
            저장하지 않은 변경
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-[13px] leading-[1.6] text-muted">
            섹션마다 따로 저장합니다. 바꾼 섹션 아래에 나타나는 <b className="font-medium text-ink">이 섹션 저장</b>을
            눌러야 반영됩니다.
          </p>
          <SectionFooterContext value={renderFooter}>
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
          </SectionFooterContext>
        </div>

        <aside className="flex flex-col gap-3.5 lg:sticky lg:top-[132px]">
          <div className="flex items-baseline gap-2">
            <span className="kick">카드 미리보기</span>
            <span className="text-[11px] text-faint">저장 전 내용 포함</span>
          </div>
          <PreviewCard form={form} masters={masters} />
          <SearchCoverage form={form} ceoName={identityEditable ? form.ceoName : identity.ceoName} />
        </aside>
      </div>

      {reverifyOpen && (
        <ReverifyDialog
          companyId={companyId}
          ceoName={identity.ceoName}
          startDate={identity.startDate ?? ""}
          onClose={() => setReverifyOpen(false)}
          onDone={(result) => {
            setIdentity({ ceoName: result.ceoName, startDate: result.businessStartDate, verifiedAt: result.verifiedAt });
            setReverifyOpen(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * 재인증. 국세청 인증 회사의 대표자명·개업일자는 일반 수정(PATCH)으로 바꿀 수 없어 이 창으로만 바꾼다.
 * 사업자번호는 묻지 않는다 — 서버가 저장된 값을 쓴다(번호를 받으면 남의 번호로 배지를 갈아끼울 수 있다).
 * 하루 인증 시도 횟수를 쓴다.
 */
function ReverifyDialog({
  companyId,
  ceoName: initialCeo,
  startDate: initialDate,
  onClose,
  onDone,
}: {
  companyId: number;
  ceoName: string;
  startDate: string;
  onClose: () => void;
  onDone: (result: { ceoName: string; businessStartDate: string; verifiedAt: string }) => void;
}) {
  const [ceoName, setCeoName] = useState(initialCeo);
  const [startDate, setStartDate] = useState(initialDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      onDone(await reverifyCompany(companyId, { ceoName: ceoName.trim(), businessStartDate: startDate }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "재인증 요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-brand-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reverify-title"
      onKeyDown={(e) => e.key === "Escape" && !busy && onClose()}
    >
      <form
        onSubmit={submit}
        className="blueprint flex w-[440px] max-w-full flex-col gap-3.5 bg-white px-[26px] py-6 shadow-[0_24px_60px_rgb(11_33_72/0.3)]"
      >
        <h2 id="reverify-title" className="text-[22px]">
          대표자·개업일자 변경
        </h2>
        <p className="text-[13px] leading-[1.65] text-muted">
          국세청에 새 정보를 다시 확인한 뒤 반영합니다. 사업자등록번호는 바뀌지 않습니다. 인증 시도는 하루 횟수가
          제한됩니다.
        </p>
        <div className="flex flex-col gap-1.5">
          <FieldHead label="대표자명" required htmlFor="r-ceo" />
          <input id="r-ceo" className="field" value={ceoName} autoFocus onChange={(e) => setCeoName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldHead label="개업일자" required htmlFor="r-date" />
          <input id="r-date" type="date" className="field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <ErrorLine message={error} />
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !ceoName.trim() || !startDate}>
            {busy && <SpinnerIcon size={13} className="animate-spin" />}
            국세청 확인 후 변경
          </button>
        </div>
      </form>
    </div>
  );
}
