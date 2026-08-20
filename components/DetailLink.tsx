"use client";

import Link from "next/link";

/**
 * 기업 상세로 가는 링크. 같은 탭에서 넘어가지 않고 **가운데에 띄운 팝업 창**으로 연다.
 *
 * ## 팝업 차단을 통과하는 조건
 *
 * 브라우저의 기본 팝업 차단은 "팝업을 막는" 게 아니라 **사용자 조작 없이 열리는 창을 막는다**.
 * 클릭 핸들러 안에서 `await` 같은 것 없이 곧바로 `window.open` 을 부르면(= 사용자 활성화가 살아
 * 있는 동안) 차단되지 않는다. 그래서 이 함수는 비동기 작업을 하나도 끼우지 않는다.
 *
 * 그래도 막히는 경우는 남는다 — 사용자가 이 사이트를 차단 목록에 넣었거나, 회사 정책·확장 프로그램이
 * 막거나, 모바일 브라우저처럼 창 크기 지정을 무시하는 환경이다. 그때 `window.open` 은 `null` 을
 * 돌려준다. **그 경우에는 `preventDefault` 를 하지 않는다** — 평범한 `<a>` 클릭으로 남아 지금처럼
 * 같은 탭에서 상세로 넘어간다. 눌러도 아무 일이 없는 상태는 만들지 않는다.
 *
 * ## 그대로 두는 조작
 *
 * 가운데 클릭·Ctrl/⌘·Shift·Alt 조합은 "새 탭/새 창으로 열겠다"는 사용자의 의사표시라 가로채지 않는다.
 * 좁은 화면에서도 팝업을 띄우지 않는다 — 판이 1180px 이라 작은 창에 담으면 어차피 잘려 보인다.
 */

/** 창 이름. 같은 이름을 주면 새 창이 계속 늘지 않고 먼저 뜬 창이 재사용된다. */
const WINDOW_NAME = "plantly-company-detail";

/** 상세 화면의 판이 1180px 이라, 가로 스크롤 없이 담기려면 스크롤바 자리까지 여유가 필요하다. */
const POPUP_WIDTH = 1200;
const POPUP_HEIGHT = 940;

/** 이보다 좁은 화면에서는 팝업을 띄우지 않고 그냥 넘어간다(창을 띄워 봐야 잘린다). */
const MIN_SCREEN_WIDTH = 1280;

type Props = {
  companyId: number;
  className?: string;
  children: React.ReactNode;
};

export default function DetailLink({ companyId, className, children }: Props) {
  return (
    <Link href={`/companies/${companyId}`} className={className} onClick={openAsPopup}>
      {children}
    </Link>
  );
}

function openAsPopup(event: React.MouseEvent<HTMLAnchorElement>) {
  // 새 탭·새 창으로 열려는 조작은 사용자의 뜻이므로 건드리지 않는다.
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (window.screen.availWidth < MIN_SCREEN_WIDTH) return;

  const width = Math.min(POPUP_WIDTH, window.screen.availWidth);
  const height = Math.min(POPUP_HEIGHT, window.screen.availHeight);

  /*
   * 위치는 화면이 아니라 **지금 브라우저 창**을 기준으로 잡는다. 모니터가 여러 대일 때
   * screen 값만 쓰면 다른 모니터에 뜨는데, screenX/screenY 는 지금 창이 있는 모니터를 따라간다.
   * 음수로 밀려 화면 밖으로 나가지 않게 0 에서 자른다.
   */
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

  /*
   * `noopener` 는 넣지 않는다 — 넣으면 반환값이 항상 null 이라 "차단됐는지"를 구분할 수 없다.
   * 여는 대상이 같은 오리진의 우리 화면이라 opener 를 넘겨도 위험하지 않다.
   */
  const popup = window.open(
    event.currentTarget.href,
    WINDOW_NAME,
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  );
  if (!popup) return; // 차단됨 — 기본 동작(같은 탭 이동)에 맡긴다.

  event.preventDefault();
  // 이미 떠 있는 창을 재사용한 경우 뒤에 가려져 있을 수 있어 앞으로 끌어온다.
  popup.focus();
}
