"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { ApiError } from "@/lib/api";
import { login } from "@/lib/auth";

/**
 * 로그인 화면.
 *
 * 인증은 세션 쿠키(JSESSIONID)라 로그인의 결과물은 화면이 들고 있는 토큰이 아니라 **쿠키**다.
 * 그래서 여기서 저장하는 건 아무것도 없고, 성공 뒤에 할 일은 두 가지뿐이다 —
 * 세션 컨텍스트를 다시 읽게 하고(헤더가 바뀐다), 원래 보던 화면으로 돌려보낸다.
 *
 * `searchParams` 를 `use()` 로 푸는 이유는 상세 화면과 같다(클라이언트에서는 await 를 못 쓴다).
 * `useSearchParams()` 훅을 쓰면 정적 프리렌더 때문에 Suspense 경계를 따로 둬야 해서 이쪽이 짧다.
 */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = use(searchParams);
  const target = safeNext(typeof next === "string" ? next : null);

  const router = useRouter();
  const session = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);
    try {
      await login({ email, password, remember });
      // 헤더가 곧바로 이름을 보여주도록 세션을 다시 읽는다. 이동보다 먼저 해야 새 화면이 옛 상태로 그려지지 않는다.
      await session.refresh();
      // replace 라서 뒤로 가기를 눌러도 로그인 화면으로 돌아오지 않는다.
      router.replace(target);
    } catch (e) {
      /*
       * 서버가 상태 코드마다 다른 한국어 문장을 준다 —
       * 401 자격증명 불일치 / 403 정지·탈퇴 계정 / 400 형식 위반(길이·특수문자).
       * 여기서 401 을 "로그인 필요"로 해석해 로그인 화면으로 보내면 제자리를 맴돈다.
       */
      setError(e instanceof ApiError ? e.message : "로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSubmitting(false);
      // 성공했을 때는 submitting 을 되돌리지 않는다 — 화면이 곧 바뀌는데 버튼만 잠깐 되살아난다.
    }
  }

  if (session.user) {
    return (
      <div className="px-4 py-16 text-center sm:px-[30px]">
        <p className="text-sm text-muted">
          이미 <span className="text-ink">{session.user.name}</span> 님으로 로그인되어 있습니다.
        </p>
        <Link href={target} className="btn btn-secondary mt-4">
          돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-12 sm:px-[30px]">
      <div className="mx-auto w-full max-w-[380px]">
        <h1 className="text-[26px] leading-tight">로그인</h1>
        <p className="mt-2 text-[12.5px] text-muted">
          좋아요·즐겨찾기와 기업정보 등록은 로그인 후 사용할 수 있습니다.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="font-heading text-[11px] tracking-[0.08em] text-faint">
              이메일
            </label>
            <input
              id="email"
              type="email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
              // 자동 채움이 끝나기 전에 커서를 옮기지 않도록 첫 칸에만 준다.
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="font-heading text-[11px] tracking-[0.08em] text-faint"
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {/*
            remember=true 면 서버가 30일 remember-me 쿠키를 하나 더 발급한다(세션 쿠키와 별개).
            기본값은 꺼짐 — 공용 PC 에서 무심코 켜지는 쪽보다 안전하다.
          */}
          <label className="flex w-fit items-center gap-2 text-[12.5px] text-muted">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="accent-brand"
            />
            로그인 상태 유지 (30일)
          </label>

          {/* 서버가 준 문장을 그대로 보여준다. role="alert" 라 스크린리더가 바뀐 순간 읽는다. */}
          {error && (
            <p role="alert" className="text-[12.5px] text-red-600">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary mt-1 h-[38px]" disabled={submitting}>
            {submitting ? "로그인 중…" : "로그인"}
          </button>
        </form>

        {/* 회원가입 화면은 아직 없다. 백엔드(POST /users/sign-up)는 이미 있으므로 라우트만 생기면 링크로 바꾼다. */}
        <p className="mt-6 border-t border-line pt-4 text-[12.5px] text-faint">
          계정이 없으신가요? 회원가입 화면은 준비 중입니다.
        </p>
      </div>
    </div>
  );
}

/**
 * 로그인 뒤 돌아갈 곳. **반드시 우리 사이트 안의 경로여야 한다.**
 *
 * `?next=` 는 주소창으로 들어오는 값이라, 그대로 믿고 이동하면 로그인 링크를 미끼로 남의 사이트에
 * 떨어뜨릴 수 있다(오픈 리다이렉트). 그래서 `/` 로 시작하는 상대경로만 통과시키고,
 * `//evil.com` 이나 `/\evil.com` 처럼 브라우저가 다른 호스트로 해석하는 형태는 막는다.
 */
function safeNext(value: string | null): string {
  return value && /^\/(?![/\\])/.test(value) ? value : "/";
}
