"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMe } from "@/lib/auth";
import type { ProfileResponse } from "@/types/api";

type Session = {
  /** 로그인한 사용자. 비로그인이면 null */
  user: ProfileResponse | null;
  /**
   * 첫 확인이 아직 안 끝났다. 이 동안에는 로그인/로그아웃 어느 쪽으로도 단정하지 않는다 —
   * 헤더가 "로그인" 버튼을 먼저 그렸다가 사용자 이름으로 바뀌면 새로고침마다 깜빡인다.
   */
  loading: boolean;
  /** 로그인 직후처럼 서버 쪽 상태가 바뀌었을 때 다시 물어본다. */
  refresh: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

/**
 * 로그인 상태를 화면 전체가 나눠 쓰는 통로.
 *
 * 필요한 이유는 인증이 **세션 쿠키**라서다 — 쿠키 자체는 JS 가 읽을 수 없고(HttpOnly),
 * 로그인 여부는 `GET /users/me` 를 불러 봐야 안다. 화면마다 그걸 부르면 같은 질문을
 * 여러 번 던지게 되고, 로그인 직후 헤더만 옛 상태로 남는 일이 생긴다.
 *
 * 데이터를 읽으니 당연히 클라이언트 컴포넌트다. 서버 컴포넌트인 `app/layout.tsx` 가
 * 이걸 렌더해 children 을 감싼다(서버 컴포넌트가 클라이언트 컴포넌트를 렌더하는 건 정상이고,
 * 그 반대 - 클라이언트가 서버를 import 하는 것 - 이 안 되는 방향이다).
 */
export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // 첫 확인. 화면을 떠나면 취소하고, 그 뒤에 도착한 답으로는 상태를 건드리지 않는다.
  useEffect(() => {
    const controller = new AbortController();
    void readSession(controller.signal).then((profile) => {
      if (controller.signal.aborted) return;
      setUser(profile);
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  const refresh = useCallback(async () => {
    setUser(await readSession());
  }, []);

  // user/loading 이 그대로면 같은 객체를 넘긴다 — 안 그러면 컨텍스트를 쓰는 컴포넌트가 매 렌더 다시 그려진다.
  const value = useMemo(() => ({ user, loading, refresh }), [user, loading, refresh]);

  // React 19 부터 컨텍스트 객체 자체를 프로바이더로 쓴다(`<Context.Provider>` 의 짧은 형태).
  return <SessionContext value={value}>{children}</SessionContext>;
}

/**
 * 서버에 로그인 상태를 물어본다.
 *
 * **401 은 오류가 아니라 "비로그인"이라는 정상적인 답이다.** 그 밖의 실패(서버 다운, 네트워크)도
 * 같이 null 로 접는다 — 헤더가 사용자 이름을 보여줄 근거가 없기는 마찬가지고, 여기서 오류를
 * 띄우면 로그인한 적 없는 첫 방문자가 경고를 보게 된다.
 */
function readSession(signal?: AbortSignal): Promise<ProfileResponse | null> {
  return getMe(signal).then(
    (profile) => profile,
    () => null,
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    // 프로바이더 밖에서 부르면 로그인 상태가 늘 null 로 보여 디버깅이 어렵다. 조용히 넘어가지 않는다.
    throw new Error("useSession 은 SessionProvider 안에서만 쓸 수 있습니다.");
  }
  return session;
}
