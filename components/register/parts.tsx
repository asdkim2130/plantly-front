"use client";

/**
 * 등록 폼 여러 섹션이 같이 쓰는 작은 조각들 — 칸 머리, 오류 한 줄, 칩 입력, 업로드.
 * 섹션 파일마다 같은 마크업을 되풀이하지 않으려고 모았다. 생김새는 globals.css 의 등록 화면 클래스가 준다.
 */

import { useCallback, useRef, useState } from "react";
import { AlertCircleIcon, CloseIcon } from "@/components/icons";
import { ApiError } from "@/lib/api";
import { formatBytes, uploadImage } from "@/lib/meta";
import type { UploadConstraintsResponse } from "@/types/api";

/** 칸 머리: 라벨 · 필수 별표 · 글자 수(또는 개수). max 를 모르면(제약 조회 전) 숫자를 빼고 그린다 */
export function FieldHead({
  label,
  required,
  count,
  max,
  aside,
  htmlFor,
}: {
  label: React.ReactNode;
  required?: boolean;
  count?: number;
  max?: number;
  /** 글자 수 자리에 대신 둘 말(예: "메인 카드 배경") */
  aside?: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <span className="flab">
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
      {required && (
        <span className="req" aria-label="필수">
          ★
        </span>
      )}
      {aside ? (
        <span className="cnt">{aside}</span>
      ) : count !== undefined ? (
        <span className={`cnt ${max !== undefined && count >= max ? "max" : ""}`}>
          {max !== undefined ? `${count} / ${max}` : count}
        </span>
      ) : null}
    </span>
  );
}

export function ErrorLine({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="emsg" role="alert">
      <AlertCircleIcon size={13} strokeWidth={1.8} className="shrink-0" />
      {message}
    </span>
  );
}

/**
 * 한 줄 입력 + 머리. 대부분의 글자 칸이 이 모양이다.
 * maxLength 는 제약 조회 응답에서 오고, 없으면 브라우저 제한 없이 둔다(서버가 최종 판정한다).
 */
export function TextField({
  id,
  label,
  value,
  onChange,
  max,
  required,
  placeholder,
  error,
  multiline,
  rows = 4,
  className = "",
  hint,
  inputClassName = "",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  required?: boolean;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  hint?: React.ReactNode;
  inputClassName?: string;
}) {
  const common = {
    id,
    value,
    placeholder,
    maxLength: max,
    "aria-invalid": error ? true : undefined,
    className: `field ${error ? "err" : ""} ${inputClassName}`,
  };
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <FieldHead label={label} required={required} count={value.length} max={max} htmlFor={id} />
      {multiline ? (
        <textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="fhint">{hint}</p>}
      <ErrorLine message={error} />
    </div>
  );
}

/** 고른 값 하나(× 로 뺀다). gone 은 선택지에서 사라진 항목 — 빼는 것만 할 수 있다 */
export function RemovableChip({
  children,
  prefix,
  onRemove,
  gone,
}: {
  children: React.ReactNode;
  prefix?: string;
  onRemove: () => void;
  gone?: boolean;
}) {
  return (
    <span className={`tchip ${gone ? "gone" : ""}`}>
      {prefix && <small>{prefix}</small>}
      {children}
      <button type="button" className="tx" onClick={onRemove} aria-label="빼기">
        <CloseIcon size={9} strokeWidth={3} />
      </button>
    </span>
  );
}

/**
 * 칩 + 입력이 한 상자에 사는 칸(태그 · 소재 · 장비). Enter 로 넣고, 비어 있을 때 Backspace 로 마지막을 뺀다.
 *
 * 한글 입력 중(IME 조합 중) Enter 는 무시한다 — 조합을 확정하는 Enter 가 keydown 으로 한 번 더 와서,
 * 그대로 받으면 마지막 글자가 빠진 채("금" 없이 "사출 금")로 칩이 하나 더 생긴다.
 */
export function ChipInput({
  values,
  onChange,
  max,
  maxLength,
  placeholder,
  prefix = "",
  label,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  max?: number;
  maxLength?: number;
  placeholder: string;
  /** 칩 앞에 붙여 그릴 글자(태그의 #). 값에는 들어가지 않는다 */
  prefix?: string;
  label: string;
}) {
  const [draft, setDraft] = useState("");
  const full = max !== undefined && values.length >= max;

  function commit() {
    const value = draft.replace(/^#/, "").trim();
    if (!value || full) return;
    // 같은 값을 두 번 넣지 않는다(서버도 중복을 하나로 합치지만, 화면에 칩이 두 개 보이면 헷갈린다).
    if (!values.includes(value)) onChange([...values, value]);
    setDraft("");
  }

  return (
    <div className="chipbox">
      {values.map((value) => (
        <RemovableChip key={value} onRemove={() => onChange(values.filter((v) => v !== value))}>
          {prefix}
          {value}
        </RemovableChip>
      ))}
      <input
        value={draft}
        aria-label={label}
        maxLength={maxLength}
        disabled={full}
        placeholder={full ? `최대 ${max}개까지 넣을 수 있습니다` : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
      />
    </div>
  );
}

// ===== 업로드 =====

/** "JPG · PNG · WEBP" — 서버가 준 MIME 목록에서 만든다. 형식이 늘면 저절로 따라온다 */
export function formatsLabel(upload: UploadConstraintsResponse | null) {
  if (!upload) return "";
  const names = upload.allowedContentTypes.map((type) => {
    const sub = type.split("/")[1] ?? type;
    return sub === "jpeg" ? "JPG" : sub.toUpperCase();
  });
  return [...new Set(names)].join(" · ");
}

/** "JPG · PNG · WEBP · 장당 10MB 이하" */
export function uploadRuleLabel(upload: UploadConstraintsResponse | null) {
  if (!upload) return "";
  return `${formatsLabel(upload)} · 장당 ${formatBytes(upload.maxFileSizeBytes)} 이하`;
}

/** `<input type="file" accept>` 값. MIME 과 확장자를 함께 준다(운영체제마다 고르는 기준이 달라서) */
export function acceptAttr(upload: UploadConstraintsResponse | null) {
  if (!upload) return "image/*";
  return [...upload.allowedContentTypes, ...upload.allowedExtensions.map((ext) => `.${ext}`)].join(",");
}

/**
 * 고르는 순간 막을 것. 서버는 파일명이 아니라 바이트로 최종 판정하므로 여기 기준은
 * "서버가 받을 파일을 거부하지 않는다" 다 — MIME 이나 확장자 중 하나만 맞아도 통과시킨다.
 */
export function checkFile(file: File, upload: UploadConstraintsResponse | null): string | null {
  if (!upload) return null;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!upload.allowedContentTypes.includes(file.type) && !upload.allowedExtensions.includes(ext)) {
    return `지원하지 않는 파일 형식입니다. (${formatsLabel(upload)}만 가능)`;
  }
  if (file.size > upload.maxFileSizeBytes) {
    return `파일 크기가 ${formatBytes(upload.maxFileSizeBytes)}를 초과했습니다. (현재 ${formatBytes(file.size)})`;
  }
  return null;
}

export function uploadErrorMessage(e: unknown) {
  return e instanceof ApiError ? e.message : "업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export type SingleUpload =
  | { status: "idle" }
  | { status: "up"; file: File; progress: number }
  | { status: "fail"; file: File; message: string };

/**
 * 한 장짜리 자리(로고 · 커버)의 업로드 상태. 끝나면 onDone(url) 로 폼에 넘기고 자기는 idle 로 돌아간다 —
 * 올라간 사진은 폼 값(url)이 그리므로 여기서 따로 들고 있지 않는다.
 */
export function useSingleUpload(upload: UploadConstraintsResponse | null, onDone: (url: string) => void) {
  const [state, setState] = useState<SingleUpload>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function start(file: File) {
    const problem = checkFile(file, upload);
    if (problem) {
      setState({ status: "fail", file, message: problem });
      return;
    }
    setState({ status: "up", file, progress: 0 });
    try {
      const result = await uploadImage(file, (progress) => setState({ status: "up", file, progress }));
      onDone(result.url);
      setState({ status: "idle" });
    } catch (e) {
      setState({ status: "fail", file, message: uploadErrorMessage(e) });
    }
  }

  const pick = () => inputRef.current?.click();
  const input = (
    <input
      ref={inputRef}
      type="file"
      hidden
      accept={acceptAttr(upload)}
      onChange={(e) => {
        const file = e.target.files?.[0];
        // 같은 파일을 다시 골라도 change 가 오게 비운다.
        e.target.value = "";
        if (file) void start(file);
      }}
    />
  );
  return { state, start, pick, input, reset: () => setState({ status: "idle" }) };
}

/** 끌어다 놓기 받는 자리. 놓인 파일 목록을 넘겨준다 */
export function useDropZone(onFiles: (files: File[]) => void, disabled = false) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        // 파일을 끌고 왔을 때만 받는다 — 갤러리 칸끼리 순서를 바꾸는 끌기와 섞이지 않게.
        if (disabled || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        if (disabled || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      },
    },
  };
}

/** 진행 막대 */
export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${percent}%` }} />
    </div>
  );
}

/** 섹션 상자 + 머리(A · 기본 정보 · 오른쪽 부제). 목차가 id 로 찾아 스크롤한다 */
export function Section({
  id,
  letter,
  title,
  sub,
  children,
}: {
  id: string;
  letter: string;
  title: string;
  sub?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rsec blueprint" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-heading text-xs tracking-[0.14em] text-brand-700">{letter}</span>
        <h2 id={`${id}-title`} className="text-[21px]">
          {title}
        </h2>
        {sub && <span className="ml-auto text-xs text-faint">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * 고른 파일을 업로드가 끝나기 전에 미리 보여 준다. 브라우저 안의 임시 주소(blob:)라
 * 화면에서 사라질 때 돌려줘야(revoke) 메모리에 남지 않는다.
 *
 * state + effect 대신 ref 콜백으로 한다 — React 19 의 ref 콜백은 정리 함수를 돌려줄 수 있어서
 * "붙을 때 만들고 떨어질 때 돌려준다"가 한 자리에 모인다. 파일이 같으면 콜백도 같아 진행률이 오를 때마다
 * 주소를 다시 만들지 않는다.
 */
export function LocalPreview({ file, className, alt = "" }: { file: File; className?: string; alt?: string }) {
  const attach = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img) return;
      const url = URL.createObjectURL(file);
      img.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [file],
  );
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={attach} alt={alt} className={className} />;
}
