"use client";

/**
 * 등록 폼 H~K — 상세 이미지 · 담당자 연락처 · 프로젝트 레퍼런스 · 공개 설정.
 */

import { ImageIcon, LockIcon } from "@/components/icons";
import ImageList from "@/components/register/ImageList";
import { ErrorLine, FieldHead, Section, TextField, uploadRuleLabel } from "@/components/register/parts";
import { ruleValue } from "@/lib/meta";
import { sectionId, type SectionProps } from "@/lib/register";

export function GallerySection({ form, update, errors, masters, limits, hidden }: SectionProps) {
  const hiddenCount = hidden ? form.images.filter((url) => hidden.images.has(url)).length : 0;
  return (
    <Section
      id={sectionId("H")}
      letter="H"
      title="상세 이미지"
      sub={
        <span className="font-heading text-sm text-brand-700">
          {form.images.length} / {limits.maxDetailImages}장
        </span>
      }
    >
      <p className="fhint -mt-2">
        등록한 순서대로 기업 상세 페이지에 표시됩니다. 이미지를 끌어서 표시 순서를 변경할 수 있습니다.
        <br />
        지원 형식: {uploadRuleLabel(masters.upload)}
      </p>
      <ImageList
        label="상세 이미지"
        urls={form.images}
        onChange={(next) => update((f) => ({ images: next(f.images) }))}
        max={limits.maxDetailImages}
        upload={masters.upload}
        inactive={hidden?.images}
        emptyHint={
          <>
            <ImageIcon size={20} />
            <span className="leading-normal">
              이미지를 끌어다 놓거나 클릭하여 파일을 선택해 주세요. 여러 장을 한 번에 고를 수 있습니다.
            </span>
          </>
        }
      />
      {hiddenCount > 0 && (
        <p className="fhint">
          “비공개” {hiddenCount}장은 저장돼 있지만 현재 등급 한도({limits.maxDetailImages}장)를 넘겨 공개되지 않습니다.
          한도 안으로 줄여 저장하면 남긴 장은 모두 다시 공개됩니다.
        </p>
      )}
      <ErrorLine message={errors.images ?? errors["images.imageUrl"]} />
    </Section>
  );
}

export function ContactSection({ form, update, errors, masters }: SectionProps) {
  const max = (field: string) => ruleValue(masters.constraints, `contacts[].${field}`, "maxLength");
  const set = (patch: Partial<typeof form.contact>) => update((f) => ({ contact: { ...f.contact, ...patch } }));
  const { contact } = form;

  return (
    <Section
      id={sectionId("I")}
      letter="I"
      title="담당자 연락처"
      sub="연락처를 등록하려면 담당자 이름을 반드시 입력해야 합니다."
    >
      <div className="grid gap-3.5 sm:grid-cols-2">
        <TextField
          id="f-contactName"
          label="담당자 이름"
          value={contact.contactName}
          onChange={(contactName) => set({ contactName })}
          max={max("contactName")}
          placeholder="예) 박현장"
          error={errors["contacts.contactName"]}
        />
        <TextField
          id="f-position"
          label="직위"
          value={contact.position}
          onChange={(position) => set({ position })}
          max={max("position")}
          placeholder="예) 영업팀 과장"
          error={errors["contacts.position"]}
        />
        <TextField
          id="f-phone"
          label="전화번호"
          value={contact.phone}
          onChange={(phone) => set({ phone })}
          max={max("phone")}
          placeholder="숫자와 하이픈만"
          inputClassName="font-heading text-[15px] tracking-[0.04em]"
          error={errors["contacts.phone"]}
        />
        <TextField
          id="f-email"
          label="이메일"
          value={contact.email}
          onChange={(email) => set({ email })}
          max={max("email")}
          placeholder="name@company.com"
          error={errors["contacts.email"]}
        />
      </div>
      <ErrorLine message={errors.contacts} />
    </Section>
  );
}

export function ReferenceSection({ form, update, errors, masters, limits, grade }: SectionProps) {
  const max = (field: string) => ruleValue(masters.constraints, `references[].${field}`, "maxLength");
  const set = (patch: Partial<typeof form.reference>) =>
    update((f) => ({ reference: { ...f.reference, ...patch } }));
  const { reference } = form;
  const imageMax = limits.maxReferenceImages;

  return (
    <Section
      id={sectionId("J")}
      letter="J"
      title="프로젝트 레퍼런스"
      sub="입력한 성과와 참여 기관 정보는 통합 검색에 반영됩니다."
    >
      <TextField
        id="f-projectTitle"
        label="프로젝트명"
        value={reference.projectTitle}
        onChange={(projectTitle) => set({ projectTitle })}
        max={max("projectTitle")}
        placeholder="예) 전기차 배터리 하우징 금형 개발"
        error={errors["references.projectTitle"]}
      />
      <TextField
        id="f-achievements"
        label="주요 성과"
        multiline
        rows={3}
        value={reference.achievements}
        onChange={(achievements) => set({ achievements })}
        max={max("achievements")}
        placeholder="수치로 말할 수 있는 결과 — 불량률, 사이클타임, 납기 등"
        error={errors["references.achievements"]}
      />
      <div className="grid gap-3.5 sm:grid-cols-2">
        <TextField
          id="f-partners"
          label="참여 기관"
          value={reference.partners}
          onChange={(partners) => set({ partners })}
          max={max("partners")}
          placeholder="예) ○○자동차, 한국생산기술연구원"
          error={errors["references.partners"]}
        />
        <TextField
          id="f-period"
          label="수행 기간"
          value={reference.period}
          onChange={(period) => set({ period })}
          max={max("period")}
          placeholder="예) 2023.03 ~ 2024.01"
          error={errors["references.period"]}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldHead label="레퍼런스 이미지" count={reference.imageUrls.length} max={imageMax} />
        {imageMax > 0 ? (
          <ImageList
            label="레퍼런스 이미지"
            urls={reference.imageUrls}
            onChange={(next) => update((f) => ({ reference: { ...f.reference, imageUrls: next(f.reference.imageUrls) } }))}
            max={imageMax}
            upload={masters.upload}
            emptyHint={
              <>
                <ImageIcon size={20} />
                <span className="leading-normal">
                  이미지를 끌어다 놓거나 클릭하여 파일을 선택해 주세요.
                  <br />
                  지원 형식: {uploadRuleLabel(masters.upload)}
                </span>
              </>
            }
          />
        ) : (
          <div className="upl dis h-24 flex-row gap-2.5">
            <LockIcon size={18} strokeWidth={1.6} />
            <span>현재 등급({grade})은 레퍼런스 이미지를 올릴 수 없습니다</span>
          </div>
        )}
        <ErrorLine message={errors["references.imageUrls"] ?? errors.references} />
      </div>
    </Section>
  );
}

export function VisibilitySection({ form, update, mode }: SectionProps) {
  const isPublic = form.visibility === "PUBLIC";
  return (
    <Section id={sectionId("K")} letter="K" title="공개 설정">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          aria-label="공개 여부"
          className={`tgl ${isPublic ? "on" : ""}`}
          onClick={() => update({ visibility: isPublic ? "PRIVATE" : "PUBLIC" })}
        >
          <span />
        </button>
        <div>
          <div className="text-sm font-medium">{isPublic ? "공개" : "비공개"}</div>
          <p className="fhint mt-0.5">
            {isPublic
              ? mode === "edit"
                ? "검색 목록과 메인 화면에 노출됩니다."
                : "발행하면 검색 목록과 메인 화면에 노출됩니다."
              : "검색 · 메인에 노출되지 않고 나만 볼 수 있습니다. 언제든 공개로 바꿀 수 있습니다."}
          </p>
        </div>
      </div>
    </Section>
  );
}
