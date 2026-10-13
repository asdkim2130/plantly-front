"use client";

/**
 * 등록 폼 A~D — 기본 정보 · 주소 · 브랜딩 · 사업 정보. 대부분 글자 칸이라 한 파일에 둔다.
 */

import { useState } from "react";
import { ImageIcon, LockIcon, SearchIcon } from "@/components/icons";
import {
  ErrorLine,
  FieldHead,
  LocalPreview,
  ProgressBar,
  Section,
  TextField,
  uploadRuleLabel,
  useDropZone,
  useSingleUpload,
} from "@/components/register/parts";
import { ruleValue } from "@/lib/meta";
import { openPostcode, preloadPostcode } from "@/lib/postcode";
import {
  DEFAULT_BRAND_COLOR,
  isBrandColor,
  localToday,
  monogram,
  sectionId,
  type SectionProps,
} from "@/lib/register";
import { formatBytes } from "@/lib/meta";
import type { PricingType, TrlLevel } from "@/types/api";

export function BasicInfoSection({ form, update, errors, masters, identity }: SectionProps) {
  const max = (field: string) => ruleValue(masters.constraints, field, "maxLength");
  return (
    <Section id={sectionId("A")} letter="A" title="기본 정보" sub={identity ? "기업명 · 대표자명 필수" : "기업명 필수"}>
      <TextField
        id="f-companyName"
        label="기업명"
        required
        value={form.companyName}
        onChange={(companyName) => update({ companyName })}
        max={max("companyName")}
        placeholder="사업자등록증의 상호 또는 대외 브랜드명"
        error={errors.companyName}
      />
      {identity && (
        <IdentityFields form={form} update={update} errors={errors} max={max} withBusinessNumber={identity === "create"} />
      )}
      <TextField
        id="f-introTitle"
        label="한 줄 요약"
        value={form.introTitle}
        onChange={(introTitle) => update({ introTitle })}
        max={max("introTitle")}
        placeholder="예) 정밀 사출 금형 설계부터 양산까지"
        hint="카드에서 기업명 바로 아래에 보입니다. 오른쪽 미리보기에서 확인하세요."
        error={errors.introTitle}
      />
      <TextField
        id="f-content"
        label="소개글"
        multiline
        value={form.content}
        onChange={(content) => update({ content })}
        max={max("content")}
        placeholder="무엇을 만들고, 누구와 일하는지"
        error={errors.content}
      />
      <TextField
        id="f-website"
        label="홈페이지"
        value={form.website}
        onChange={(website) => update({ website })}
        max={max("website")}
        placeholder="https://"
        error={errors.website}
      />
    </Section>
  );
}

/**
 * 관리자 화면의 신원 칸. 자가등록·소유자 수정에서는 국세청 인증본이 채워 칸이 없다.
 * 국세청에 확인하지 않은 값이라 그 사실을 칸 아래에 적는다.
 *  - 등록: 사업자번호 · 대표자명 · 개업일자 — 이 회사는 "국세청 미인증"으로 만들어진다.
 *  - 수정(미인증 회사만): 대표자명 · 개업일자. 사업자번호는 수정 API 에 없다(등록 시점 값이 유일한 출처).
 */
function IdentityFields({
  form,
  update,
  errors,
  max,
  withBusinessNumber,
}: Pick<SectionProps, "form" | "update" | "errors"> & {
  max: (field: string) => number | undefined;
  withBusinessNumber: boolean;
}) {
  return (
    <>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {withBusinessNumber && (
          <TextField
            id="f-businessNumber"
            label="사업자등록번호"
            value={form.businessNumber}
            onChange={(businessNumber) => update({ businessNumber })}
            max={12}
            placeholder="123-45-67890 (모르면 비워 두기)"
            error={errors.businessNumber}
            inputClassName="font-heading tracking-[0.04em]"
          />
        )}
        <TextField
          id="f-ceoName"
          label="대표자명"
          required
          value={form.ceoName}
          onChange={(ceoName) => update({ ceoName })}
          max={max("ceoName")}
          error={errors.ceoName}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:w-1/2 sm:pr-[7px]">
        <FieldHead label="개업일자" htmlFor="f-establishmentDate" />
        <input
          id="f-establishmentDate"
          type="date"
          className={`field ${errors.establishmentDate ? "err" : ""}`}
          max={localToday()}
          value={form.establishmentDate}
          aria-invalid={errors.establishmentDate ? true : undefined}
          onChange={(e) => update({ establishmentDate: e.target.value })}
        />
        <ErrorLine message={errors.establishmentDate} />
      </div>
      <p className="fhint -mt-1">
        {withBusinessNumber
          ? "국세청 확인 없이 입력한 값 그대로 저장됩니다. 이 기업은 ‘국세청 미인증’으로 등록되며, 같은 사업자등록번호로 이미 등록된 기업이 있으면 발행이 막힙니다."
          : "국세청 미인증 기업이라 대표자명·개업일자를 직접 고칠 수 있습니다. 국세청 확인 없이 입력한 값 그대로 저장됩니다."}
      </p>
    </>
  );
}

export function AddressSection({ form, update, errors, masters }: SectionProps) {
  const [searchError, setSearchError] = useState("");

  function search() {
    setSearchError("");
    openPostcode((result) => update(result)).catch((e: Error) => setSearchError(e.message));
  }

  return (
    <Section id={sectionId("B")} letter="B" title="주소" sub="3칸 필수 · 주소 검색으로 채웁니다">
      <div className="flex flex-col gap-1.5">
        <FieldHead label="우편번호" required htmlFor="f-postalCode" />
        <div className="flex gap-2">
          <input
            id="f-postalCode"
            className="field w-[120px] font-heading text-[15px] tracking-[0.06em]"
            value={form.postalCode}
            readOnly
            placeholder="00000"
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={search}
            onPointerEnter={preloadPostcode}
            onFocus={preloadPostcode}
          >
            <SearchIcon size={14} />
            주소 검색
          </button>
        </div>
        <ErrorLine message={searchError} />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldHead label="도로명 주소" required htmlFor="f-roadAddress" />
        {/* 손으로 고치지 않는다 — 형식이 제각각이 되면 검색·카드 주소가 흐트러진다(lib/postcode.ts) */}
        <input
          id="f-roadAddress"
          className={`field ${errors.roadAddress ? "err" : ""}`}
          value={form.roadAddress}
          readOnly
          placeholder="주소 검색을 눌러 주세요"
        />
        <ErrorLine message={errors.roadAddress ?? errors.postalCode} />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldHead label="지번 주소" htmlFor="f-jibunAddress" />
        <input id="f-jibunAddress" className="field" value={form.jibunAddress} readOnly />
      </div>
      <TextField
        id="f-detailAddress"
        label="상세주소"
        required
        value={form.detailAddress}
        onChange={(detailAddress) => update({ detailAddress })}
        max={ruleValue(masters.constraints, "detailAddress", "maxLength")}
        placeholder="동 · 호 · 층 · 단지명"
        error={errors.detailAddress}
      />
    </Section>
  );
}

export function BrandingSection({ form, update, errors, masters }: SectionProps) {
  const color = isBrandColor(form.brandColor) ? form.brandColor : DEFAULT_BRAND_COLOR;
  const mono = monogram(form.companyName);

  const logo = useSingleUpload(masters.upload, (logoUrl) => update({ logoUrl }));
  const cover = useSingleUpload(masters.upload, (coverImageUrl) => update({ coverImageUrl }));
  const logoDrop = useDropZone((files) => files[0] && void logo.start(files[0]));
  const coverDrop = useDropZone((files) => files[0] && void cover.start(files[0]));

  return (
    <Section id={sectionId("C")} letter="C" title="브랜딩" sub={uploadRuleLabel(masters.upload)}>
      <div className="grid gap-3.5 sm:grid-cols-[150px_minmax(0,1fr)]">
        {/* 로고 */}
        <div className="flex flex-col gap-1.5">
          <FieldHead label="로고 이미지" />
          {logo.input}
          {form.logoUrl && logo.state.status === "idle" ? (
            <div className="relative h-[150px] overflow-hidden rounded-[10px] border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.logoUrl} alt="로고 미리보기" className="size-full object-cover" />
              <ImageActions onReplace={logo.pick} onRemove={() => update({ logoUrl: null })} />
            </div>
          ) : logo.state.status === "up" ? (
            <div className="relative h-[150px] overflow-hidden rounded-[10px] border border-line">
              <LocalPreview file={logo.state.file} className="size-full object-cover opacity-35 grayscale" />
              <div className="absolute inset-x-3 bottom-3 flex flex-col gap-1.5">
                <span className="font-heading text-[13px]">{logo.state.progress}%</span>
                <ProgressBar percent={logo.state.progress} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={`upl h-[150px] ${logoDrop.over ? "over" : ""}`}
              onClick={logo.pick}
              {...logoDrop.props}
            >
              <span
                className="grid size-[52px] place-items-center rounded-lg text-lg font-bold text-white"
                style={{ background: color }}
              >
                {mono}
              </span>
              <span className="text-[11px] leading-[1.4] text-muted">
                로고가 없으면 기업명의
                <br />앞 두 글자가 표시됩니다.
              </span>
              <span className="text-xs font-medium text-brand-700">+ 로고 올리기</span>
            </button>
          )}
          {logo.state.status === "fail" && <ErrorLine message={logo.state.message} />}
        </div>

        {/* 커버 */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <FieldHead label="커버 이미지" aside="메인 카드 배경" />
          {cover.input}
          {form.coverImageUrl && cover.state.status === "idle" ? (
            <div className="relative h-[150px] overflow-hidden rounded-[10px] border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.coverImageUrl} alt="커버 미리보기" className="size-full object-cover" />
              <ImageActions onReplace={cover.pick} onRemove={() => update({ coverImageUrl: null })} />
            </div>
          ) : cover.state.status === "up" ? (
            <div className="relative h-[150px] overflow-hidden rounded-[10px] border border-line">
              <LocalPreview file={cover.state.file} className="size-full object-cover opacity-35 grayscale" />
              <div className="absolute inset-x-3 bottom-3 flex flex-col gap-1.5">
                <div className="flex text-xs text-ink">
                  <span className="truncate">
                    {cover.state.file.name} · {formatBytes(cover.state.file.size)}
                  </span>
                  <span className="ml-auto font-heading text-[13px]">{cover.state.progress}%</span>
                </div>
                <ProgressBar percent={cover.state.progress} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={`upl h-[150px] ${coverDrop.over ? "over" : ""}`}
              onClick={cover.pick}
              {...coverDrop.props}
            >
              <ImageIcon size={22} />
              <span>끌어다 놓거나 눌러서 고르기</span>
              <span className="text-[11px] text-faint">없으면 브랜드 컬러로 대체 디자인을 그립니다</span>
            </button>
          )}
          {cover.state.status === "fail" && <ErrorLine message={cover.state.message} />}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldHead label="브랜드 컬러" htmlFor="f-brandColor" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            aria-label="브랜드 컬러 고르기"
            value={color}
            onChange={(e) => update({ brandColor: e.target.value.toUpperCase() })}
            className="size-10 flex-none cursor-pointer rounded-lg border border-line bg-white p-[3px]"
          />
          <input
            id="f-brandColor"
            className={`field w-[130px] font-heading text-[15px] tracking-[0.06em] uppercase ${
              errors.brandColor ? "err" : ""
            }`}
            value={form.brandColor}
            maxLength={7}
            placeholder="#RRGGBB"
            onChange={(e) => {
              let value = e.target.value.trim();
              if (value && !value.startsWith("#")) value = `#${value}`;
              update({ brandColor: value.toUpperCase() });
            }}
          />
          {form.brandColor && (
            <button type="button" className="btn btn-ghost text-[13px] text-muted" onClick={() => update({ brandColor: "" })}>
              지우기
            </button>
          )}
          {errors.brandColor ? (
            <ErrorLine message={errors.brandColor} />
          ) : form.brandColor && !isBrandColor(form.brandColor) ? (
            <span className="emsg">#RRGGBB 형식으로 입력해 주세요</span>
          ) : (
            <span className="fhint">로고와 커버 이미지가 없을 때 표시되는 기본 디자인에 적용됩니다.</span>
          )}
        </div>
      </div>
    </Section>
  );
}

/** 올라간 사진 위 오른쪽 위 버튼 둘 */
function ImageActions({ onReplace, onRemove }: { onReplace: () => void; onRemove: () => void }) {
  return (
    <div className="absolute top-2 right-2 flex gap-1.5">
      <button type="button" className="btn btn-secondary bg-white/95 px-2.5 py-1 text-xs" onClick={onReplace}>
        바꾸기
      </button>
      <button type="button" className="btn btn-secondary bg-white/95 px-2.5 py-1 text-xs" onClick={onRemove}>
        삭제
      </button>
    </div>
  );
}

export function BusinessSection({ form, update, errors, masters, limits, grade, mode }: SectionProps) {
  // 수정에서는 고른 걸 다시 눌러도 풀리지 않는다 — PATCH 가 enum 을 비우지 못해 저장해도 아무 일이 없다.
  const allowClear = mode !== "edit";
  const max = (field: string) => ruleValue(masters.constraints, field, "maxLength");
  const trlOptions = masters.options.trlLevel ?? [];
  const priceOptions = masters.options.pricingType ?? [];

  return (
    <Section id={sectionId("D")} letter="D" title="사업 정보" sub="선택">
      <OptionGroup
        label="기술 성숙도 (TRL)"
        options={trlOptions}
        value={form.trlLevel}
        allowClear={allowClear}
        onChange={(value) => update({ trlLevel: value as TrlLevel | null })}
      />
      <OptionGroup
        label="가격 정책"
        options={priceOptions}
        value={form.pricingType}
        allowClear={allowClear}
        onChange={(value) => update({ pricingType: value as PricingType | null })}
      />
      <TextField
        id="f-leadTime"
        label="예상 리드타임"
        className="max-w-[260px]"
        value={form.leadTime}
        onChange={(leadTime) => update({ leadTime })}
        max={max("leadTime")}
        placeholder="예) 2주"
        error={errors.leadTime}
      />
      <TextField
        id="f-asInfo"
        label="유지보수 정보"
        multiline
        rows={3}
        value={form.asInfo}
        onChange={(asInfo) => update({ asInfo })}
        max={max("asInfo")}
        placeholder="보증 기간, A/S 방식, 대응 시간"
        error={errors.asInfo}
      />
      {/*
        동영상은 등급이 막아도 서버가 저장은 받는다(공개 조회에서만 가린다). 그래도 입력란을 열어 두면
        "넣었는데 안 보인다"가 되므로 등급이 허용할 때만 칸을 준다.
      */}
      {limits.videoAllowed ? (
        <TextField
          id="f-videoUrl"
          label="소개 동영상"
          value={form.videoUrl}
          onChange={(videoUrl) => update({ videoUrl })}
          max={max("videoUrl")}
          placeholder="YouTube · Vimeo 링크"
          error={errors.videoUrl}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="flab text-faint">
            <LockIcon size={13} strokeWidth={1.6} />
            소개 동영상
          </span>
          <div className="rounded-lg border border-dashed border-line bg-field px-3.5 py-3 text-[13px] leading-normal text-muted">
            현재 등급(<b className="font-medium">{grade}</b>)에서는 소개 동영상을 넣을 수 없습니다.
            {form.videoUrl && (
              <>
                {" "}
                저장된 링크(<span className="break-all">{form.videoUrl}</span>)는 지금 공개되지 않으며, 등급이 오르면
                다시 보입니다.
              </>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

/**
 * 하나만 고르는 버튼 묶음. 등록에서는 고른 걸 다시 누르면 풀린다(선택 항목이라 "안 고름"으로 돌아갈 길이 필요하다).
 * 수정에서는 allowClear=false 라 풀리지 않는다.
 */
function OptionGroup({
  label,
  options,
  value,
  onChange,
  allowClear,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
  allowClear: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={label}>
      <FieldHead label={label} />
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const on = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              className={`opt ${on ? "on" : ""}`}
              onClick={() => {
                if (!on) onChange(option.value);
                else if (allowClear) onChange(null);
              }}
            >
              <span className="rd" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
