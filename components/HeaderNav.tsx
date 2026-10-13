"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { OfficeIcon } from "@/components/icons";
import { logout } from "@/lib/auth";

/**
 * 헤더 오른쪽 메뉴 + 로그인 상태 표시.
 *
 * 로그인 여부에 따라 바뀌는 부분이라 클라이언트 컴포넌트로 떼어 냈다. 나머지 헤더
 * (로고·폭 제한)는 `app/layout.tsx` 의 서버 컴포넌트로 남아 있다.
 */
export default function HeaderNav() {
  const { user, loading } = useSession();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
      /*
       * 세션 상태만 비우지 않고 통째로 다시 읽는다.
       *
       * 로그아웃은 헤더 밖에도 영향을 준다 — 이미 그려진 카드의 좋아요·즐겨찾기는 로그인 뷰어
       * 기준으로 받은 값(likedByMe)이고, LikeFavorite 는 그걸 자기 state 로 복사해 들고 있다.
       * 컨텍스트만 비우면 하트가 켜진 채로 남아 "로그아웃했는데 내 좋아요가 남아 있다"가 된다.
       * 로그아웃은 드물게 일어나고 페이지를 떠나는 동작이라, 여기서는 다시 읽는 쪽이 정직하다.
       */
      window.location.assign("/");
    } catch {
      setBusy(false);
    }
  }

  return (
    <>
      {/* 좁은 화면에서는 메뉴를 접는다 — 모바일 내비게이션은 화면이 더 생기면 만든다. */}
      {/* 홈(큐레이션)은 왼쪽 로고가 맡는다. 이 자리는 검색·필터가 있는 목록 화면으로 보낸다. */}
      <Link
        href="/companies"
        className="hidden text-sm whitespace-nowrap text-ink no-underline md:inline"
      >
        기업 찾기
      </Link>
      {/* 아직 없는 화면. 라우트가 생기면 Link 로 바꾼다. */}
      <span className="hidden cursor-not-allowed text-sm whitespace-nowrap text-muted md:inline">
        카테고리
      </span>
      {/* 비로그인이면 등록 화면이 로그인으로 보냈다가 돌려보낸다(여기서 갈라 두지 않는다). */}
      <Link
        href="/companies/new"
        aria-current={pathname === "/companies/new" ? "page" : undefined}
        className={`hidden text-sm whitespace-nowrap no-underline md:inline ${
          pathname === "/companies/new" ? "font-medium text-brand" : "text-ink"
        }`}
      >
        기업정보 등록
      </Link>

      {/*
        첫 확인이 끝나기 전에는 자리만 잡아 둔다. "로그인"을 먼저 그렸다가 이름으로 바꾸면
        로그인한 사용자가 새로고침할 때마다 자기 헤더가 깜빡이는 걸 본다.
      */}
      {loading ? (
        <span aria-hidden className="skel h-[31px] w-[68px] rounded-lg" />
      ) : user ? (
        <div className="flex items-center gap-2.5">
          {/* 관리자에게만 보인다. 숨기는 건 화면 편의이고, 막는 건 서버다(관리자 API 는 MEMBER 에게 403). */}
          {user.userRole === "ADMIN" && (
            <Link
              href="/admin/companies"
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              className={`hidden rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap no-underline sm:inline-flex ${
                pathname.startsWith("/admin") ? "bg-brand-100 font-medium text-brand" : "text-ink hover:text-brand"
              }`}
            >
              기업 관리
            </Link>
          )}
          {/* 좁은 화면에서도 남긴다(아이콘만) — 소유자가 자기 기업으로 돌아오는 유일한 길이다. */}
          <Link
            href="/companies/my"
            aria-label="내 기업"
            aria-current={pathname === "/companies/my" ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap no-underline ${
              pathname === "/companies/my" ? "bg-brand-100 font-medium text-brand" : "text-ink hover:text-brand"
            }`}
          >
            <OfficeIcon size={15} />
            <span className="hidden sm:inline">내 기업</span>
          </Link>
          <span className="hidden max-w-[140px] truncate text-sm text-ink sm:inline">
            {user.name}
          </span>
          <button type="button" className="btn btn-secondary" onClick={onLogout} disabled={busy}>
            로그아웃
          </button>
        </div>
      ) : (
        /*
          로그인 뒤 원래 보던 화면으로 돌려보내려고 지금 위치를 실어 보낸다.
          로그인 화면 자체에서 누른 경우(=이미 /login)는 제외한다 — 자기 자신으로 돌아오게 된다.
        */
        <Link
          href={pathname === "/login" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`}
          className="btn btn-primary whitespace-nowrap"
        >
          로그인
        </Link>
      )}
    </>
  );
}
