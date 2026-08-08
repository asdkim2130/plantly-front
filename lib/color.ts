/**
 * 회사가 지정한 색 위에 글자를 얹어야 할 때 쓰는 판정.
 *
 * 색 자체는 여기서 정하지 않는다 — 이 파일은 "밝은가/어두운가" 만 답하고,
 * 실제 글자색은 `app/globals.css` 의 `.spotlight[data-tone]` 이 토큰으로 고른다.
 * (디자인 규칙: 색 값은 globals.css 의 @theme·@layer 안에만 둔다)
 */

/** `#RRGGBB` → [r, g, b]. 백엔드가 이 표기만 저장하므로(등록·수정 DTO 의 패턴 검증) 다른 표기는 안 받는다. */
function parseHex(value: string): [number, number, number] | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return null;
  return [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
  ];
}

/**
 * WCAG 상대 휘도(0=검정 ~ 1=흰색).
 *
 * 채널 평균이 아니라 감마를 되돌린 뒤 사람 눈의 민감도로 가중합한다 — 그냥 평균을 내면
 * 노랑(#FFD400)처럼 눈에는 아주 밝은 색이 "중간"으로 잡혀 흰 글씨가 얹힌다.
 */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const linear = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/**
 * 이 배경 위에는 어두운 글자가 더 잘 읽히는가.
 *
 * 기준값 0.179 는 흰 글자와 검은 글자의 대비비가 뒤집히는 지점이다
 * (흰색 대비 = 1.05/(L+0.05), 검은색 대비 = (L+0.05)/0.05 가 같아지는 L).
 * 값이 없거나 형식이 어긋나면 false — 호출부가 기본 남색 배경으로 떨어지고 흰 글씨가 맞다.
 */
export function prefersDarkText(color: string | null): boolean {
  if (!color) return false;
  const rgb = parseHex(color);
  if (!rgb) return false;
  return relativeLuminance(rgb) > 0.179;
}
