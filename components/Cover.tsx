/**
 * 카드 커버 사진. 로고와 다른 자리다 — 로고는 정사각 배지(Logo), 커버는 카드 배경에 깔리는 와이드 사진이다.
 *
 * 크기·모서리·배치는 쓰는 쪽이 className 으로 준다. 카드마다 비율이 달라서
 * (스포트라이트는 거의 정사각, 추천 카드는 가로로 긴 띠) 한 장을 서로 다르게 자른다 — object-cover 고정.
 *
 * 사진이 없으면 디자인의 사선 해칭 자리표시자로 떨어진다. 서버가 대체 이미지를 만들어 주지 않으므로
 * "없을 때 무엇을 그리는가"는 화면 몫이다.
 *
 * next/image 를 쓰지 않는 이유는 Logo 와 같다 — 이미지 호스트가 백엔드 업로드 정책에 따라 달라져
 * remotePatterns 로 고정하기 어렵다.
 */
export default function Cover({
  url,
  className = "",
  placeholderClassName,
}: {
  url: string | null;
  className?: string;
  /** 사진이 없을 때 깔 무늬 클래스. 밝은 카드는 `hatch`, 스포트라이트는 `hatch-tint` */
  placeholderClassName: string;
}) {
  if (!url) {
    return <div aria-hidden className={`${placeholderClassName} ${className}`} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" className={`object-cover ${className}`} />
  );
}
