/**
 * 상세 팝업 창에 대한 약속. 창을 여는 쪽(`components/DetailLink.tsx`), 창 안에서 상단바를 감추는
 * 쪽(`app/layout.tsx` 의 인라인 스크립트 + `components/PopupChrome.tsx`)이 이 값을 함께 쓴다.
 */

/**
 * 팝업 창의 이름. 같은 이름으로 열면 창이 늘지 않고 먼저 뜬 창이 재사용된다.
 *
 * "지금 이 문서가 팝업 안인가"를 판정하는 표식이기도 하다. 주소에 `?popup=1` 같은 표시를 남기지
 * 않는 이유는 (1) 상세 화면의 "공유하기"가 현재 주소를 그대로 복사하는데 거기에 화면 모양을 바꾸는
 * 파라미터가 섞이면 받는 사람에게도 상단바 없는 화면이 열리고, (2) 팝업이 차단돼 같은 탭으로
 * 떨어졌을 때 그 파라미터가 본 탭 주소에 남기 때문이다. 창 이름은 그 창에만 붙고 주소에는 안 남는다.
 */
export const POPUP_WINDOW_NAME = "plantly-company-detail";

/**
 * 이 경로에서만 팝업 전용 모양(상단바 감춤)을 쓴다.
 *
 * 창 이름만 보고 판정하면, 팝업 안에서 다른 화면으로 넘어갔을 때도 상단바가 사라져 빠져나갈 길이
 * 없어진다. 팝업이 존재하는 이유가 상세 화면 하나라서 그 경로에 있을 때만 적용한다.
 */
export function isPopupPath(pathname: string): boolean {
  return pathname.startsWith("/companies/");
}
