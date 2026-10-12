"use client";

/**
 * 등록 폼 G — 대응 가능 범위(국내 지역 · 해외 국가).
 *
 * 지역 링크의 뜻은 "그 범위 **전체**를 커버한다" 다. 그래서 상위를 고르면 하위는 고를 필요가 없어
 * 흐리게 잠근다(.rck.cov) — 전국을 고르면 나머지 전부, 시도를 고르면 그 시군구 전부.
 * 수도권(권역)이 어느 시도를 덮는지는 응답에 없어서(합성 행이라 자식이 없다) 잠그지 않는다 — 화면이 지어내지 않는다.
 *
 * 표기는 서버가 준 이름을 그대로 쓴다. 줄에는 짧은 이름(shortName), 고른 칩에는 완성형(displayName,
 * "경기 전역" · "경기 오산")을 쓴다 — 칩은 부모 줄 없이 홀로 보이기 때문이다.
 */

import { useMemo, useState } from "react";
import { CheckIcon, SearchIcon } from "@/components/icons";
import { ErrorLine, FieldHead, RemovableChip, Section } from "@/components/register/parts";
import { CONTINENT_LABEL } from "@/lib/labels";
import { ruleValue } from "@/lib/meta";
import { sectionId, type SectionProps } from "@/lib/register";
import type { Continent, DomesticRegionPublicResponse } from "@/types/api";

export default function CoverageSection(props: SectionProps) {
  return (
    <Section id={sectionId("G")} letter="G" title="대응 가능 범위" sub="선택">
      <RegionPicker {...props} />
      <CountryPicker {...props} />
    </Section>
  );
}

function RegionPicker({ form, update, errors, masters, removed }: SectionProps) {
  const roots = masters.regions;
  const max = ruleValue(masters.constraints, "domesticRegionIds", "maxItems");
  const selected = form.domesticRegionIds;
  const full = max !== undefined && selected.length >= max;

  // id → 노드(+부모). 칩 이름과 덮임 판정에 쓴다.
  const index = useMemo(() => {
    const map = new Map<number, { node: DomesticRegionPublicResponse; parent: DomesticRegionPublicResponse | null }>();
    roots.forEach((root) => {
      map.set(root.id, { node: root, parent: null });
      root.children.forEach((child) => map.set(child.id, { node: child, parent: root }));
    });
    return map;
  }, [roots]);

  // 오른쪽에 펼쳐 둔 시도. 처음에는 하위가 있는 첫 시도를 펼친다(전국·수도권은 하위가 없다).
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = roots.find((node) => node.id === activeId) ?? roots.find((node) => node.children.length > 0);

  const nation = roots.some((node) => node.level === "NATION" && selected.includes(node.id));
  const activeOn = active ? selected.includes(active.id) : false;

  function toggle(id: number) {
    update((f) =>
      f.domesticRegionIds.includes(id)
        ? { domesticRegionIds: f.domesticRegionIds.filter((x) => x !== id) }
        : full
          ? {}
          : { domesticRegionIds: [...f.domesticRegionIds, id] },
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <FieldHead label="국내 지역" count={selected.length} max={max} />
      <p className="fhint">
        상위 지역을 선택하면 해당 지역에 속한 모든 하위 지역이 포함됩니다. 예를 들어 경상남도를 선택하면 시·군을
        개별적으로 선택하지 않아도 됩니다.
      </p>
      <div className="flex min-h-[26px] flex-wrap gap-1.5">
        {selected.map((id) => {
          const entry = index.get(id);
          return (
            <RemovableChip
              key={id}
              gone={!entry}
              onRemove={() => update((f) => ({ domesticRegionIds: f.domesticRegionIds.filter((x) => x !== id) }))}
            >
              {entry ? entry.node.displayName : `${removed.domesticRegionIds?.get(id) ?? `#${id}`} · 삭제됨`}
            </RemovableChip>
          );
        })}
      </div>
      <div className="rtree sm:grid-cols-[190px_minmax(0,1fr)]">
        <div className="rcol max-h-[250px] overflow-auto">
          <div className="rcolh">광역</div>
          {roots.map((node) => {
            const on = selected.includes(node.id);
            const cov = !on && nation && node.level !== "NATION";
            const dis = !on && !cov && full;
            return (
              <div
                key={node.id}
                className={`rck ${on ? "on" : cov ? "cov" : dis ? "dis" : ""} ${node.id === active?.id ? "act" : ""}`}
              >
                <button
                  type="button"
                  className="bx"
                  role="checkbox"
                  aria-checked={on || cov}
                  aria-label={`${node.displayName} 선택`}
                  disabled={cov || dis}
                  onClick={() => toggle(node.id)}
                >
                  <CheckIcon size={9} />
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  aria-expanded={node.id === active?.id}
                  onClick={() => setActiveId(node.id)}
                >
                  {node.shortName}
                </button>
                {cov && <span className="tw">전국</span>}
              </div>
            );
          })}
        </div>
        <div className="rcol max-h-[250px] overflow-auto">
          <div className="rcolh">{active ? `${active.shortName} · 시 · 군 · 구` : "시 · 군 · 구"}</div>
          {active && active.children.length > 0 && (activeOn || nation) && (
            <span className="fhint px-2 pb-1.5 text-brand-700">
              {activeOn
                ? `${active.shortName} 전체를 골랐습니다 — 아래는 모두 포함됩니다`
                : "전국에 포함되어 따로 고를 필요가 없습니다"}
            </span>
          )}
          {active && active.children.length === 0 && (
            <span className="fhint px-2 py-1.5">시 · 군 · 구로 나뉘지 않는 지역입니다</span>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3">
            {active?.children.map((node) => {
              const on = selected.includes(node.id);
              const cov = !on && (activeOn || nation);
              const dis = !on && !cov && full;
              return (
                <button
                  key={node.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on || cov}
                  disabled={cov || dis}
                  className={`rck ${on ? "on" : cov ? "cov" : dis ? "dis" : ""}`}
                  onClick={() => toggle(node.id)}
                >
                  <span className="bx">
                    <CheckIcon size={9} />
                  </span>
                  {node.shortName}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <ErrorLine message={errors.domesticRegionIds} />
    </div>
  );
}

const CONTINENTS = Object.keys(CONTINENT_LABEL) as Continent[];

function CountryPicker({ form, update, errors, masters, removed }: SectionProps) {
  const max = ruleValue(masters.constraints, "countryIds", "maxItems");
  const selected = form.countryIds;
  const full = max !== undefined && selected.length >= max;

  const [continent, setContinent] = useState<Continent>("ASIA");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // 검색어가 있으면 대륙 탭을 무시하고 전체에서 찾는다(어느 대륙인지 모르고 찾는 경우가 많다).
  const rows = q
    ? masters.countries.filter((c) => c.nameKo.includes(q) || c.nameEn.toLowerCase().includes(q))
    : masters.countries.filter((c) => c.continent === continent);
  const byId = useMemo(() => new Map(masters.countries.map((c) => [c.id, c])), [masters.countries]);

  return (
    <div className="flex flex-col gap-1.5">
      <FieldHead label="해외 국가" count={selected.length} max={max} />
      <div className="flex min-h-[26px] flex-wrap gap-1.5">
        {selected.map((id) => {
          const country = byId.get(id);
          return (
            <RemovableChip
              key={id}
              gone={!country}
              onRemove={() => update((f) => ({ countryIds: f.countryIds.filter((x) => x !== id) }))}
            >
              {country ? country.nameKo : `${removed.countryIds?.get(id) ?? `#${id}`} · 삭제됨`}
            </RemovableChip>
          );
        })}
      </div>
      <div className="overflow-hidden rounded-[10px] border border-line">
        <div className="flex items-center gap-2 border-b border-line-soft px-3 py-2.5">
          <SearchIcon size={15} className="text-brand" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="국가명 검색"
            placeholder="국가명 검색 — 한글 또는 영문 (예: 베트남, Mexico)"
            className="flex-1 border-0 bg-transparent text-sm outline-0"
          />
        </div>
        {!q && (
          <div className="flex gap-0.5 overflow-x-auto border-b border-line-soft px-1.5" role="tablist">
            {CONTINENTS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={continent === key}
                className={`ctab whitespace-nowrap ${continent === key ? "on" : ""}`}
                onClick={() => setContinent(key)}
              >
                {CONTINENT_LABEL[key]}
              </button>
            ))}
          </div>
        )}
        <div className="grid max-h-[170px] grid-cols-2 overflow-auto px-1.5 py-2 sm:grid-cols-3">
          {rows.map((country) => {
            const on = selected.includes(country.id);
            const dis = !on && full;
            return (
              <button
                key={country.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={dis}
                className={`rck ${on ? "on" : dis ? "dis" : ""}`}
                onClick={() =>
                  update((f) => ({
                    countryIds: f.countryIds.includes(country.id)
                      ? f.countryIds.filter((x) => x !== country.id)
                      : [...f.countryIds, country.id],
                  }))
                }
              >
                <span className="bx">
                  <CheckIcon size={9} />
                </span>
                <span className="min-w-0 truncate">{country.nameKo}</span>
                <span className="tw truncate">{country.nameEn}</span>
              </button>
            );
          })}
        </div>
        {q && rows.length === 0 && <p className="fhint px-3.5 pb-3">‘{query.trim()}’와 맞는 국가가 없습니다</p>}
      </div>
      <ErrorLine message={errors.countryIds} />
    </div>
  );
}
