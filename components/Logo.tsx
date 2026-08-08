/**
 * 회사 로고. 없으면 이름 앞 두 글자로 대체한다.
 * 크기·테두리·모서리는 쓰는 쪽에서 className 으로 준다(카드마다 다르다).
 *
 * next/image 를 쓰지 않는 이유: logoUrl 호스트가 백엔드 업로드 정책에 따라 달라져
 * remotePatterns 로 고정하기 어렵다. 이미지 저장 위치가 정해지면 그때 바꾼다.
 */
export default function Logo({
  url,
  name,
  className = "",
  padding = 5,
}: {
  url: string | null;
  name: string;
  className?: string;
  /** 로고가 상자에 꽉 차지 않도록 주는 안쪽 여백(px) */
  padding?: number;
}) {
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden bg-white ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          className="size-full object-contain"
          style={{ padding }}
        />
      ) : (
        <span className="font-heading text-brand-700 text-sm">{name.slice(0, 2)}</span>
      )}
    </div>
  );
}
