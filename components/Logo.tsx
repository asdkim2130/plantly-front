/**
 * 회사 로고. 없으면 이름 앞 두 글자로 대체한다.
 * 크기·테두리·모서리는 쓰는 쪽에서 className 으로 준다(카드마다 다르다).
 * 이미지는 상자를 꽉 채운다(object-cover) — 여백 없이 대신 넘치는 가장자리가 잘린다.
 *
 * next/image 를 쓰지 않는 이유: logoUrl 호스트가 백엔드 업로드 정책에 따라 달라져
 * remotePatterns 로 고정하기 어렵다. 이미지 저장 위치가 정해지면 그때 바꾼다.
 */
export default function Logo({
  url,
  name,
  className = "",
}: {
  url: string | null;
  name: string;
  className?: string;
}) {
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden bg-white ${className}`}>
      {url ? (
        /*
         * object-cover: 상자 비율에 맞춰 이미지를 채우고 넘치는 쪽을 잘라낸다.
         * (object-contain 은 비율을 지키느라 상자에 흰 여백을 남긴다.)
         * 상자에 둥근 모서리가 있으면 overflow-hidden 이 이미지 모서리도 같이 깎는다.
         */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <span className="font-heading text-brand-700 text-sm">{name.slice(0, 2)}</span>
      )}
    </div>
  );
}
