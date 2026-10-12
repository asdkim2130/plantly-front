"use client";

/**
 * 여러 장짜리 이미지 칸 — 상세 이미지(갤러리)와 레퍼런스 이미지가 같이 쓴다.
 *
 * 폼에는 **업로드가 끝난 url 만** 들어간다. 올라가는 중이거나 실패한 장은 이 컴포넌트의 상태로만 살고,
 * 끝나는 순간 폼 배열 뒤에 붙는다. 그래서 초안 자동저장에는 반쯤 올라간 장이 섞이지 않는다.
 *
 * 한 장씩 따로 올린다(백엔드가 한 요청에 한 장만 받는다). 덕분에 장마다 진행률·실패·재시도가 따로 생긴다.
 * 순서는 끌어서 바꾼다 — 배열 순서가 곧 상세 화면의 표시 순서다(displayOrder 는 서버가 배열에서 매긴다).
 */

import { useRef, useState } from "react";
import { AlertCircleIcon, CloseIcon, PlusIcon } from "@/components/icons";
import {
  acceptAttr,
  checkFile,
  LocalPreview,
  ProgressBar,
  uploadErrorMessage,
  useDropZone,
} from "@/components/register/parts";
import { uploadImage } from "@/lib/meta";
import type { UploadConstraintsResponse } from "@/types/api";

type Pending = { id: number; file: File; progress: number; failed: string | null };
type Rejected = { name: string; reason: string };

let nextId = 1;

export default function ImageList({
  urls,
  onChange,
  max,
  upload,
  label,
  emptyHint,
  inactive,
}: {
  urls: string[];
  /** 최신 배열을 받아 다음 배열을 돌려주는 함수형 갱신 — 여러 장이 동시에 끝나도 서로 덮어쓰지 않는다 */
  onChange: (next: (urls: string[]) => string[]) => void;
  max: number;
  upload: UploadConstraintsResponse | null;
  label: string;
  /** 한 장도 없을 때 넓은 자리에 띄울 안내 */
  emptyHint: React.ReactNode;
  /** 저장돼 있지만 등급 한도를 넘겨 공개되지 않는 장(수정 화면). 회색 + "비공개" 표시 */
  inactive?: Set<string>;
}) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // 끌어서 순서 바꾸기
  const dragFrom = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState(-1);

  const room = max - urls.length - pending.length;

  async function send(tile: Pending) {
    const patch = (next: Partial<Pending>) =>
      setPending((list) => list.map((p) => (p.id === tile.id ? { ...p, ...next } : p)));
    try {
      const result = await uploadImage(tile.file, (progress) => patch({ progress }));
      setPending((list) => list.filter((p) => p.id !== tile.id));
      onChange((list) => [...list, result.url]);
    } catch (e) {
      patch({ failed: uploadErrorMessage(e) });
    }
  }

  function addFiles(files: File[]) {
    const rejects: Rejected[] = [];
    const accepted: Pending[] = [];
    let left = room;
    for (const file of files) {
      const problem = checkFile(file, upload);
      if (problem) rejects.push({ name: file.name, reason: problem });
      else if (left <= 0) rejects.push({ name: file.name, reason: `최대 ${max}장까지 올릴 수 있습니다.` });
      else {
        accepted.push({ id: nextId++, file, progress: 0, failed: null });
        left -= 1;
      }
    }
    setRejected(rejects);
    if (!accepted.length) return;
    setPending((list) => [...list, ...accepted]);
    accepted.forEach((tile) => void send(tile));
  }

  const drop = useDropZone(addFiles, room <= 0);

  const picker = (
    <input
      ref={inputRef}
      type="file"
      hidden
      multiple
      accept={acceptAttr(upload)}
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        addFiles(files);
      }}
    />
  );

  const empty = urls.length === 0 && pending.length === 0;

  return (
    <div className="flex flex-col gap-2" aria-label={label}>
      {picker}
      {empty ? (
        <button
          type="button"
          className={`upl h-24 flex-row gap-2.5 ${drop.over ? "over" : ""}`}
          onClick={() => inputRef.current?.click()}
          {...drop.props}
        >
          {emptyHint}
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" {...drop.props}>
          {urls.map((url, index) => (
            <div
              key={url}
              className={`thumb ${overIndex === index ? "drop" : ""}`}
              draggable
              onDragStart={(e) => {
                dragFrom.current = index;
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (dragFrom.current === null) return;
                e.preventDefault();
                setOverIndex(index);
              }}
              onDragLeave={() => setOverIndex(-1)}
              onDrop={(e) => {
                const from = dragFrom.current;
                if (from === null) return;
                e.preventDefault();
                e.stopPropagation();
                dragFrom.current = null;
                setOverIndex(-1);
                onChange((list) => {
                  const next = [...list];
                  const [moved] = next.splice(from, 1);
                  next.splice(index, 0, moved);
                  return next;
                });
              }}
              onDragEnd={() => {
                dragFrom.current = null;
                setOverIndex(-1);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${label} ${index + 1}`}
                draggable={false}
                className={inactive?.has(url) ? "opacity-45 grayscale" : undefined}
              />
              <span className="no">{index + 1}</span>
              {inactive?.has(url) && (
                <span className="absolute inset-x-1 bottom-1 rounded bg-ink/75 py-0.5 text-center text-[11px] text-white">
                  비공개
                </span>
              )}
              <button
                type="button"
                className="dl"
                aria-label={`${index + 1}번 이미지 삭제`}
                onClick={() => onChange((list) => list.filter((u) => u !== url))}
              >
                <CloseIcon size={9} strokeWidth={3} />
              </button>
            </div>
          ))}
          {pending.map((tile) => (
            <div key={tile.id} className="thumb">
              {tile.failed ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-danger-soft p-1.5 text-center ring-1 ring-danger/40 ring-inset">
                  <span className="text-[11px] text-danger">업로드 실패</span>
                  <span className="sr-only">{tile.failed}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-0.5 text-xs text-danger"
                      title={tile.failed}
                      onClick={() => {
                        const retry = { ...tile, failed: null, progress: 0 };
                        setPending((list) => list.map((p) => (p.id === tile.id ? retry : p)));
                        void send(retry);
                      }}
                    >
                      재시도
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost px-1.5 py-0.5 text-xs text-muted"
                      aria-label="이 파일 빼기"
                      onClick={() => setPending((list) => list.filter((p) => p.id !== tile.id))}
                    >
                      <CloseIcon size={9} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <LocalPreview file={tile.file} className="size-full object-cover opacity-35 grayscale" />
                  <div className="absolute inset-0 flex flex-col justify-end gap-[5px] p-2">
                    <span className="font-heading text-xs text-brand-700">업로드 {tile.progress}%</span>
                    <ProgressBar percent={tile.progress} />
                  </div>
                </>
              )}
            </div>
          ))}
          {room > 0 && (
            <button
              type="button"
              className={`upl aspect-square p-1.5 ${drop.over ? "over" : ""}`}
              onClick={() => inputRef.current?.click()}
            >
              <PlusIcon size={18} />
              <span className="text-[11px]">추가</span>
            </button>
          )}
        </div>
      )}

      {rejected.length > 0 && (
        <div className="emsg items-start text-muted" role="alert">
          <AlertCircleIcon size={13} strokeWidth={1.8} className="mt-0.5 shrink-0 text-danger" />
          <span className="flex flex-col gap-0.5">
            <b className="font-bold text-ink">다음 이미지는 업로드되지 않았습니다.</b>
            {rejected.map((item, index) => (
              <span key={index}>
                - <b className="font-medium">{item.name}</b>: {item.reason}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
