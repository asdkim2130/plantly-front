"use client";

/**
 * 등록 폼 F — 역량(취급 소재 · 보유 장비 · 보유 인증).
 *
 * 인증 목록에는 "기타"(type ETC) 앵커가 한 건 있다. 그걸 고르면 인증명을 직접 적는 칸이 생기고,
 * 요청에는 `{certificationId: 기타 id, customName}` 으로 여러 건이 실린다. 기타 칸 하나하나도 인증 1건으로
 * 세므로 개수 한도(10)는 "고른 인증 + 기타 칸 수" 다. 같은 이름을 두 번 적으면 서버 유니크 인덱스에 걸린다.
 */

import { ChipInput, ErrorLine, FieldHead, RemovableChip, Section } from "@/components/register/parts";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { ruleValue } from "@/lib/meta";
import { CERTIFICATION_TYPE_LABEL, CERTIFICATION_TYPE_ORDER } from "@/lib/labels";
import { sectionId, type SectionProps } from "@/lib/register";
import type { CertificationType } from "@/types/api";

// 기타는 맨 뒤 자기 상자에 둔다. 검색 패싯(CERTIFICATION_TYPE_ORDER)에는 없는 묶음이다 — 자유 입력이라 필터로 쓸 수 없다.
const GROUP_ORDER: CertificationType[] = [...CERTIFICATION_TYPE_ORDER, "ETC"];

export default function CapabilitySection({ form, update, errors, masters, removed }: SectionProps) {
  const c = masters.constraints;
  const certMax = ruleValue(c, "certifications", "maxItems");
  const customMax = ruleValue(c, "certifications[].customName", "maxLength");
  const certCount = form.certificationIds.length + (form.customCertNames?.length ?? 0);
  const certFull = certMax !== undefined && certCount >= certMax;
  const customError = errors["certifications.customName"];

  const groups = GROUP_ORDER.map((type) => ({
    type,
    items: masters.certifications.filter((cert) => cert.type === type),
  })).filter((group) => group.items.length > 0);

  const goneIds = form.certificationIds.filter((id) => !masters.certifications.some((cert) => cert.id === id));

  function toggleCert(id: number, isEtc: boolean) {
    update((f) => {
      if (isEtc) {
        // 기타를 켜면 이름 칸 하나가 생긴다. 끄면 적은 이름도 함께 버린다(기타 없이 이름만 남을 수 없다).
        if (f.customCertNames) return { customCertNames: null };
        return certFull ? {} : { customCertNames: [""] };
      }
      if (f.certificationIds.includes(id)) return { certificationIds: f.certificationIds.filter((x) => x !== id) };
      return certFull ? {} : { certificationIds: [...f.certificationIds, id] };
    });
  }

  function setCustom(index: number, value: string) {
    update((f) => ({ customCertNames: (f.customCertNames ?? []).map((name, i) => (i === index ? value : name)) }));
  }

  function removeCustom(index: number) {
    update((f) => {
      const next = (f.customCertNames ?? []).filter((_, i) => i !== index);
      // 마지막 칸을 지우면 기타 선택도 풀린다 — 이름 없는 기타는 발행할 수 없다.
      return { customCertNames: next.length ? next : null };
    });
  }

  return (
    <Section
      id={sectionId("F")}
      letter="F"
      title="역량"
      sub="입력한 보유 장비와 취급 소재는 통합 검색에 반영됩니다."
    >
      <div className="grid gap-3.5 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <FieldHead label="취급 소재" count={form.materialNames.length} max={ruleValue(c, "materialNames", "maxItems")} />
          <ChipInput
            label="취급 소재 추가"
            values={form.materialNames}
            onChange={(materialNames) => update({ materialNames })}
            max={ruleValue(c, "materialNames", "maxItems")}
            maxLength={ruleValue(c, "materialNames[]", "maxLength")}
            placeholder="Enter로 추가"
          />
          <ErrorLine message={errors.materialNames} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <FieldHead label="보유 장비" count={form.equipmentNames.length} max={ruleValue(c, "equipmentNames", "maxItems")} />
          <ChipInput
            label="보유 장비 추가"
            values={form.equipmentNames}
            onChange={(equipmentNames) => update({ equipmentNames })}
            max={ruleValue(c, "equipmentNames", "maxItems")}
            maxLength={ruleValue(c, "equipmentNames[]", "maxLength")}
            placeholder="Enter로 추가"
          />
          <ErrorLine message={errors.equipmentNames} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldHead label="보유 인증" count={certCount} max={certMax} />
        {goneIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {goneIds.map((id) => (
              <RemovableChip
                key={id}
                gone
                onRemove={() => update((f) => ({ certificationIds: f.certificationIds.filter((x) => x !== id) }))}
              >
                {removed.certificationIds?.get(id) ?? `#${id}`} · 목록에서 삭제됨
              </RemovableChip>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          {groups.map((group) => (
            <div key={group.type} className="certbox">
              <p className="certhd">
                {CERTIFICATION_TYPE_LABEL[group.type]}
                <span className="ml-1.5 text-[11px] text-faint">{group.items.length}개</span>
              </p>
              <div className="grid gap-x-1 sm:grid-cols-3">
                {group.items.map((cert) => {
                  const isEtc = cert.type === "ETC";
                  const on = isEtc ? form.customCertNames !== null : form.certificationIds.includes(cert.id);
                  const dis = !on && certFull;
                  return (
                    <button
                      key={cert.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      disabled={dis}
                      className={`rck break-keep ${on ? "on" : dis ? "dis" : ""}`}
                      onClick={() => toggleCert(cert.id, isEtc)}
                    >
                      <span className="bx">
                        <CheckIcon size={9} />
                      </span>
                      {cert.certificationName}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {form.customCertNames && (
          <div className="flex flex-col gap-2 rounded-lg border border-brand-300 bg-white px-3.5 py-3">
            <FieldHead label="기타 인증명" required aside="각 항목에 서로 다른 이름을 입력해 주세요." />
            {form.customCertNames.map((name, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  className={`field ${customError && !name.trim() ? "err" : ""}`}
                  value={name}
                  maxLength={customMax}
                  aria-label={`기타 인증명 ${index + 1}`}
                  placeholder="예) 이노비즈 인증"
                  onChange={(e) => setCustom(index, e.target.value)}
                />
                <button
                  type="button"
                  className="tx size-[26px]"
                  aria-label="이 인증명 빼기"
                  onClick={() => removeCustom(index)}
                >
                  <CloseIcon size={11} />
                </button>
              </div>
            ))}
            <ErrorLine message={customError} />
            <button
              type="button"
              className="btn btn-ghost self-start px-2 py-1 text-[13px] text-brand-700"
              disabled={certFull}
              onClick={() => update((f) => ({ customCertNames: [...(f.customCertNames ?? []), ""] }))}
            >
              + 인증명 추가
            </button>
          </div>
        )}
        <ErrorLine message={errors.certifications} />
      </div>
    </Section>
  );
}
