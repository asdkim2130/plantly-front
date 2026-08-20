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
 */
export default function DetailTabs({ tabs }: { tabs: DetailTab[] }) {
  const [active, setActive] = useState("");

  /*
   * 배열은 렌더마다 새로 만들어져 의존성으로 쓰면 관찰자가 매번 다시 붙는다.
   * 실제로 달라지는 건 "어떤 섹션이 있는가"뿐이라 id 목록을 문자열로 눌러 비교한다.
   */
  const ids = tabs.map((tab) => tab.id).join(",");

  useEffect(() => {
    const sections = ids
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    /*
     * 위아래를 잘라낸 띠(화면 상단 56px ~ 40% 지점)에 걸린 섹션 중 가장 위를 현재 섹션으로 본다.
     * 띠를 좁게 잡아야 긴 섹션 하나가 화면을 다 채워도 판정이 흔들리지 않는다.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: `-${TAB_BAR_HEIGHT}px 0px -60% 0px` },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [ids]);

  if (tabs.length === 0) return null;

  /*
   * 아직 관찰자가 답을 주기 전(맨 위에서 막 들어왔을 때)에는 첫 탭이 켜져 있다.
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
