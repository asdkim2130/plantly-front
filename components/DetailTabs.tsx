"use client";

import { useEffect, useState } from "react";

export type DetailTab = { id: string; label: string };

/** 탭 막대가 가리는 높이. 섹션으로 스크롤할 때 이만큼 위를 비워 둔다. */
export const TAB_BAR_HEIGHT = 56;

/**
 * 기업 상세 상단의 섹션 탭. 화면 맨 위에 붙어 따라다니고, 스크롤 위치에 따라 현재 섹션이 켜진다.
 *
 * 탭은 라우팅이 아니라 **같은 문서 안의 이동**이다 — 상세 응답 하나로 모든 섹션이 이미 그려져 있어서
 * 탭마다 다시 부를 데이터가 없다. 그래서 링크(`#id`)가 아니라 버튼 + 부드러운 스크롤로 둔다
 * (해시가 주소창에 남으면 새로고침·공유 때 화면 중간에서 시작한다).
 *
 * 비어 있는 섹션은 호출부가 아예 그리지 않으므로 탭 목록도 짧아진다 — 등록된 게 거의 없는 회사(C20)에
 * 눌러도 아무 데도 가지 않는 탭을 남기지 않기 위해서다.
 *
 * **탭이 가리키는 곳은 본문 왼쪽 단의 섹션뿐이다.** 오른쪽 사이드바(기본 정보·연락처)는 `sticky` 라
 * 스크롤과 무관하게 화면 위쪽에 머무는데, 그런 요소를 탭 대상에 넣으면 "지금 보고 있는 섹션" 판정이
 * 영영 그쪽으로 붙는다 — 어디를 보고 있든 화면 상단 기준선에 걸려 있기 때문이다.
 */
export default function DetailTabs({ tabs }: { tabs: DetailTab[] }) {
  const [active, setActive] = useState("");

  /*
   * 배열은 렌더마다 새로 만들어져 의존성으로 쓰면 효과가 매번 다시 붙는다.
   * 실제로 달라지는 건 "어떤 섹션이 있는가"뿐이라 id 목록을 문자열로 눌러 비교한다.
   */
  const ids = tabs.map((tab) => tab.id).join(",");

  useEffect(() => {
    /*
     * IntersectionObserver 대신 스크롤 위치로 직접 고른다. 관찰자는 "띠에 걸린 섹션"만 알려 주는데,
     * 섹션 길이가 제각각이라(소개 두 줄 / 갤러리 30장) 띠에 아무것도 안 걸리는 구간과 여럿이 걸리는
     * 구간이 같이 생긴다. 기준선(탭 막대 바로 아래) 위로 올라간 마지막 섹션을 고르면 그 틈이 없다.
     */
    const list = ids.split(",");

    const pick = () => {
      const sections = list
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el !== null);
      if (sections.length === 0) return;

      /*
       * 문서 끝에 닿으면 무조건 마지막 섹션이다. 마지막 섹션이 짧으면(사이드바가 더 길 때가 흔하다)
       * 더 스크롤할 여지가 없어 기준선까지 못 올라오고, 그러면 눌러도 탭이 안 켜지는 것처럼 보인다.
       */
      const scrollBottom = window.scrollY + window.innerHeight;
      if (scrollBottom >= document.documentElement.scrollHeight - 2) {
        setActive(sections[sections.length - 1].id);
        return;
      }

      // 기준선을 지난 마지막 섹션. 아직 하나도 안 지났으면 첫 섹션이다.
      const line = TAB_BAR_HEIGHT + 1;
      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top > line) break;
        current = section.id;
      }
      setActive(current);
    };

    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, [ids]);

  if (tabs.length === 0) return null;

  /*
   * 아직 판정 전(맨 위에서 막 들어왔을 때)에는 첫 탭이 켜져 있다.
   * 초기값을 상태에 넣지 않고 여기서 고르는 이유는, 섹션 목록이 회사마다 달라
   * "첫 탭"이 바뀔 때 상태가 남아 있는 탭을 가리키는 일을 만들지 않기 위해서다.
   */
  const activeId = active || tabs[0].id;

  return (
    <nav
      aria-label="기업 정보 섹션"
      className="sticky top-0 z-20 flex overflow-x-auto border-b border-line bg-white px-4 sm:px-[30px]"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-current={activeId === tab.id ? "true" : undefined}
          className={`tabbtn shrink-0 ${activeId === tab.id ? "on" : ""}`}
          onClick={() => {
            const section = document.getElementById(tab.id);
            if (!section) return;
            window.scrollTo({
              top: section.getBoundingClientRect().top + window.scrollY - TAB_BAR_HEIGHT,
              behavior: "smooth",
            });
          }}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
