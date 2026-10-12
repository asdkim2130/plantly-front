/**
 * 주소 검색 — 카카오(다음) 우편번호 서비스.
 *
 * 백엔드에 주소 검색 API 가 없고, 우편번호·도로명·지번은 사용자가 손으로 치면 형식이 제각각이 된다
 * (등록 DTO 는 우편번호를 5자리 숫자로만 받는다). 그래서 세 칸은 읽기 전용으로 두고 이 창의 결과로만 채운다.
 *
 * 키가 필요 없는 공개 스크립트라 설정할 것이 없다. **쓸 기색이 보일 때 처음 한 번만 받아 온다** — 등록
 * 화면을 열기만 하고 주소를 안 바꾸는 사람(이어쓰기)까지 외부 스크립트를 받게 하지 않으려고.
 */

const SCRIPT_URL = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

export type PostcodeResult = {
  postalCode: string;
  roadAddress: string;
  /** 도로명만 있는 신주소는 지번이 없다(빈 문자열) */
  jibunAddress: string;
};

type DaumPostcodeData = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  /** 사용자가 도로명을 골랐을 때 지번은 비고, 대신 여기에 자동 매칭된 지번이 온다 */
  autoJibunAddress: string;
};

type DaumPostcode = new (options: { oncomplete: (data: DaumPostcodeData) => void }) => { open: () => void };

declare global {
  interface Window {
    daum?: { Postcode: DaumPostcode };
  }
}

let loading: Promise<void> | null = null;

function load(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // 실패를 캐시하지 않는다 — 다음 클릭에서 다시 받아 볼 수 있게.
      loading = null;
      reject(new Error("주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** 버튼에 마우스가 올라오거나 포커스가 오면 미리 받아 둔다(아래 openPostcode 의 팝업 차단 이유). */
export function preloadPostcode() {
  load().catch(() => {
    // 실제로 누를 때 다시 시도하고, 그때 실패를 알린다.
  });
}

/**
 * 주소 검색 창을 띄운다. 고르면 onSelect 가 불린다(닫으면 아무 일도 없다).
 *
 * 창은 팝업이다. 브라우저는 **클릭과 같은 흐름에서 열린 창**만 통과시키므로, 스크립트가 이미 있으면
 * await 없이 곧바로 연다. 처음 받는 클릭은 비동기 뒤라 막힐 수 있어서 `preloadPostcode` 로 미리 받아 둔다.
 */
export function openPostcode(onSelect: (result: PostcodeResult) => void): Promise<void> {
  const open = () => {
    const Postcode = window.daum!.Postcode;
    new Postcode({
      oncomplete: (data) =>
        onSelect({
          postalCode: data.zonecode,
          roadAddress: data.roadAddress,
          jibunAddress: data.jibunAddress || data.autoJibunAddress || "",
        }),
    }).open();
  };
  if (window.daum?.Postcode) {
    open();
    return Promise.resolve();
  }
  return load().then(open);
}
