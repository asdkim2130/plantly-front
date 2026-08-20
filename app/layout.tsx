import type { Metadata } from "next";
import { Barlow_Condensed, Noto_Sans_KR } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";
import PopupChrome from "@/components/PopupChrome";
import SessionProvider from "@/components/SessionProvider";
import { POPUP_WINDOW_NAME } from "@/lib/popup";
import "./globals.css";

/*
 * 디자인 원본과 같은 두 벌 — 제목·라벨·숫자는 Barlow Condensed, 본문은 Noto Sans KR.
 *
 * 한글까지 웹폰트로 그린다. 시스템 한글 폰트(윈도우의 맑은 고딕)로 떨어지면 작은 크기에서 획이
 * 뭉개져 "흐릿하다"는 인상이 남는다. Noto Sans KR 은 한글이 유니코드 범위별로 쪼개져 있어서
 * 브라우저는 **그 페이지에 실제로 쓰인 조각만** 받는다(전체를 통째로 받지 않는다).
 * next/font 가 빌드 때 조각을 전부 내려받아 자체 호스팅하므로 런타임에 구글로 나가는 요청은 없다.
 *
 * `subsets` 는 "미리 preload 할 조각"을 고르는 값이지 "내려받을 조각"이 아니다 — 한글은 이름 붙은
 * subset 이 없어서 지정할 수 없고, 대신 필요할 때 따라온다(그 사이는 display:swap 으로 폴백이 버틴다).
 *
 * 가변 폰트로 받는다. 굵기별로 따로 받으면 조각 수가 굵기만큼 배로 늘어난다.
 */
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  weight: ["400", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "플랜틀리 — 제조의 모든 연결",
  description: "프로젝트를 맡길 기업과 해결할 기업이 한 곳에서 만나는 제조 플랫폼.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  /*
   * 글자 렌더링은 브라우저 기본(서브픽셀 안티에일리어싱)에 맡긴다.
   * `antialiased`(-webkit-font-smoothing: antialiased)는 서브픽셀을 끄고 회색조로 그리게 해서
   * 글자가 한 겹 얇아지고 가장자리가 흐릿해 보인다 — 윈도우의 ClearType 이 그만큼 죽는다.
   * 브라우저 기본값과 같은 값이지만, 앞서 antialiased 로 켜 뒀던 자리라 의도를 남겨 명시한다.
   */
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${barlowCondensed.variable} subpixel-antialiased`}
      /*
       * 아래 인라인 스크립트가 하이드레이션 **전에** 이 태그에 data-popup 을 붙인다. 서버가 그린
       * HTML 에는 없는 속성이라 React 가 "attributes didn't match" 로 경고하는데, 여기서는 어긋나는
       * 게 정상이다 — 팝업인지 아닌지는 서버가 알 수 없고(창 이름은 브라우저에만 있다), 그래서
       * 첫 페인트 전에 브라우저가 세우는 값이다.
       *
       * 이 속성은 **이 태그 한 겹에만** 적용된다(자식의 불일치는 그대로 경고한다).
       */
      suppressHydrationWarning
    >
      <body>
        {/*
          팝업 창이면 첫 페인트 전에 표식을 세운다 — 상단바가 잠깐 보였다 사라지는 걸 막으려면
          헤더 마크업보다 먼저 실행돼야 해서 body 의 첫 자식에 인라인으로 둔다.
          창 이름은 주소에 남지 않아 "공유하기"로 복사한 링크가 깨끗하다(lib/popup.ts 주석 참고).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(window.name===${JSON.stringify(POPUP_WINDOW_NAME)}&&location.pathname.startsWith("/companies/"))document.documentElement.setAttribute("data-popup","1")}catch(e){}`,
          }}
        />
        {/*
          디자인 원본은 회색 바탕 위에 1180px 흰 판이 떠 있는 구조지만,
          바깥 바탕(--color-page)을 판과 같은 흰색으로 맞추고 좌우 테두리도 뺐다.
          폭 제한(max-w)만 남아서 내용이 가운데 정렬되고, 양옆은 이어진 흰 바탕이다.
        */}
        {/*
          로그인 상태는 헤더와 화면들이 함께 쓰는 값이라 여기서 한 번만 읽는다.
          서버 컴포넌트인 이 레이아웃이 클라이언트 컴포넌트를 렌더하는 건 정상적인 방향이다.
        */}
        {/* 화면 안에서 경로가 바뀔 때 표식을 다시 맞춘다(문서를 새로 읽지 않아 위 스크립트가 안 돈다). */}
        <PopupChrome />

        <SessionProvider>
          <div className="mx-auto flex min-h-screen w-full max-w-[1180px] flex-col bg-white">
            {/* .site-header 는 팝업 창에서 이 줄을 통째로 감추는 표식이다(globals.css). */}
            <header className="site-header flex items-center gap-6 border-b border-line px-4 py-3.5 sm:px-[30px]">
              <Link href="/" className="mr-auto flex items-center" aria-label="플랜틀리 홈">
                <Image
                  src="/plantly-logo.png"
                  alt="플랜틀리"
                  width={3103}
                  height={951}
                  priority
                  className="h-[26px] w-auto object-contain"
                />
              </Link>

              {/* 메뉴와 로그인 상태는 세션에 따라 바뀌어서 클라이언트 컴포넌트로 떼어 놨다. */}
              <HeaderNav />
            </header>

            <main className="flex-1">{children}</main>

            <footer className="border-t border-line px-4 py-5 sm:px-[30px] text-[13px] text-faint">
              플랜틀리 · 개발용 로컬 환경
            </footer>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
