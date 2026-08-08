import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

/*
 * 디자인 원본의 두 폰트. 한글 글리프가 없어서 한글은 globals.css 의 폴백(시스템 한글 폰트)으로
 * 떨어지는데, 원본도 같은 구조라 결과가 어긋나지 않는다.
 * 한글 웹폰트(Noto Sans KR 등)는 수 MB라 지금 넣지 않는다 — 필요해지면 그때 subset 을 잡는다.
 */
const barlow = Barlow({
  variable: "--font-barlow",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  weight: ["400", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "플랜틀리 — 제조의 모든 연결",
  description: "프로젝트를 맡길 기업과 해결할 기업이 한 곳에서 만나는 제조 플랫폼.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}>
      <body>
        {/*
          디자인은 회색 바탕 위에 1180px 흰 판이 떠 있는 구조다.
          좁은 화면에서는 판이 화면 폭을 그대로 쓰고 테두리만 남는다.
        */}
        <div className="mx-auto flex min-h-screen w-full max-w-[1180px] flex-col border-line bg-white sm:border-x">
          <header className="flex items-center gap-6 border-b border-line px-4 py-3.5 sm:px-[30px]">
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

            {/* 좁은 화면에서는 메뉴를 접는다 — 모바일 내비게이션은 화면이 더 생기면 만든다. */}
            <Link
              href="/"
              className="hidden text-sm whitespace-nowrap text-ink no-underline md:inline"
            >
              기업 찾기
            </Link>
            {/* 아직 없는 화면들. 라우트가 생기면 Link 로 바꾼다. */}
            <span className="hidden cursor-not-allowed text-sm whitespace-nowrap text-muted md:inline">
              카테고리
            </span>
            <span className="hidden cursor-not-allowed text-sm whitespace-nowrap text-muted md:inline">
              기업정보 등록
            </span>
            <button
              type="button"
              className="btn btn-primary whitespace-nowrap"
              disabled
              title="로그인 화면 준비 중"
            >
              로그인
            </button>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-line px-4 py-5 sm:px-[30px] text-[12.5px] text-faint">
            플랜틀리 · 개발용 로컬 환경
          </footer>
        </div>
      </body>
    </html>
  );
}
