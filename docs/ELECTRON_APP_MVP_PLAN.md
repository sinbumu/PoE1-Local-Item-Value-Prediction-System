# Electron 기반 Windows 로컬 유틸리티 앱 MVP 계획서

## 1. 문서 목적

이 문서는 **PoE1 Local Item Value Prediction System**의 최종 응용 산출물인 Windows 로컬 유틸리티 앱 MVP를 어떤 방향으로 구현할지 정리하기 위한 추상 설계 문서이다.

이 문서는 세부 데이터 포맷, 정확한 API 스펙, 모델 입출력 JSON schema를 고정하지 않는다. 해당 세부 구현은 실제 코딩 에이전트가 현재 저장소 구조, 학습 산출물, parser/feature builder 상태를 확인한 뒤 결정한다.

본 문서의 목적은 다음을 명확히 하는 것이다.

- 최종 MVP 앱이 반드시 제공해야 하는 사용자 경험
- Electron을 선택하는 이유와 대안
- 앱과 모델 추론 파이프라인의 큰 연결 방식
- 구현 범위와 제외 범위
- 발표/시연 가능한 최소 완성 기준

---

## 2. 최종 MVP 목표

최종 MVP의 목표는 **정확한 시세 숫자를 완벽히 맞히는 것**이 아니다.

PoE1 아이템 가격은 시즌 경제, 수요, 빌드 메타, 매물 수, 판매자 의도에 따라 계속 변하는 시가적 성격을 가진다. 따라서 본 프로젝트의 최종 응용 목표는 다음과 같다.

> 사용자가 게임에서 아이템 정보를 복사했을 때, 해당 아이템이 **검색하거나 판매 시도할 가치가 있는지** 또는 **낮은 가치일 가능성이 큰지**를 로컬에서 빠르게 판단하도록 돕는 Windows 유틸리티 앱을 구현한다.

즉, 앱은 다음 판단을 보조한다.

- 낮은 가치 가능성 높음
- 검색 가치 있음
- 판매 시도 가치 있음
- 고가 후보 가능성 있음
- 모델 신뢰도가 낮아 직접 검색 권장

---

## 3. MVP 사용자 시나리오

### 3.1 기본 사용 흐름

1. 사용자가 PoE1에서 아이템 위에 마우스를 올린다.
2. 사용자가 게임 기본 기능으로 `Ctrl+C`를 눌러 아이템 텍스트를 클립보드에 복사한다.
3. Windows 로컬 유틸리티 앱이 클립보드 텍스트를 읽는다.
4. 앱이 아이템 텍스트를 파싱한다.
5. parser / feature builder가 모델 입력용 피처를 생성한다.
6. 앱이 로컬 추론 모듈에 예측을 요청한다.
7. 결과를 floating panel 또는 overlay 형태로 표시한다.

### 3.2 권장 결과 표시

가격 숫자를 크게 강조하기보다, 의사결정 중심으로 표시한다.

예시:

```text
판단: 검색 가치 있음
신뢰도: 82%
권장: 거래소 직접 검색 또는 판매 시도
근거: 아이템 레벨 / 옵션 조합 / 생명력·저항 계열 피처
주의: 공개 listing price 기반 모델이며 실제 체결가 보장은 아님
```

또는:

```text
판단: 낮은 가치 가능성 높음
신뢰도: 74%
권장: 직접 검색 우선순위 낮음
주의: 특수 빌드용 아이템은 오판 가능
```

---

## 4. 기술 선택 방향

## 4.1 1차 권장안: Electron + TypeScript

앱 MVP는 **Electron + TypeScript** 기반으로 구현하는 것을 우선 권장한다.

선택 이유:

- 현재 저장소의 주요 수집기, ETL, parser, affix dictionary 관련 도구가 Node.js / TypeScript 기반이다.
- 기존 TypeScript 코드 일부를 앱 쪽으로 재사용하기 쉽다.
- Windows global hotkey, clipboard read, tray app, always-on-top window 구현이 가능하다.
- Python 기반 CatBoost 추론 worker와 연동하기 쉽다.
- 일정상 Windows 전용 MVP를 빠르게 구현하기 좋다.

### 4.2 대안 후보

Electron 구현이 예상보다 어렵거나 Windows overlay 안정성이 낮을 경우 아래 대안을 검토할 수 있다.

#### .NET WPF / WinUI

장점:

- Windows 네이티브 앱 구현에 강함
- global hotkey, tray, overlay/floating window를 안정적으로 다룰 수 있음

단점:

- 현재 TypeScript 기반 parser/feature builder 재사용성이 떨어짐
- 별도 C# 구현 비용이 발생함

#### Python PySide / PyQt

장점:

- Python CatBoost 추론과 자연스럽게 연결 가능

단점:

- 기존 TypeScript 자산과 분리됨
- Windows packaging, overlay, hotkey 구현이 별도 부담이 될 수 있음

#### Tauri

장점:

- 가볍고 앱 완성도가 좋을 수 있음

단점:

- Rust 기반 구성 이해가 필요하고 현재 일정상 추가 학습 비용이 큼

### 4.3 현재 결론

이번 학기 MVP 기준으로는 **Electron + TypeScript**가 가장 현실적이다.

다만 최종 앱의 목적은 상용 제품 수준의 UI가 아니라, **모델 추론 결과가 실제 사용자 입력 흐름에 연결되는 것을 시연하는 것**이다.

---

## 5. 권한 및 게임 정책 고려

## 5.1 권장 입력 방식

앱은 사용자가 직접 수행한 `Ctrl+C` 결과를 읽는 방식으로 동작한다.

즉, 앱이 게임에 키 입력을 보내거나 마우스를 움직이는 방식은 MVP 범위에서 제외한다.

권장:

- 사용자가 직접 PoE1에서 `Ctrl+C`
- 앱이 clipboard text read
- 앱이 결과 표시

비권장:

- 앱이 PoE 창에 직접 `Ctrl+C` 입력 전송
- 화면 픽셀/OCR을 기반으로 자동 반응
- 자동 클릭
- 자동 판매
- NPC 판매창 자동 배치

### 5.2 관리자 권한

기본 MVP 기능은 일반 사용자 권한 프로세스에서 동작하는 것을 목표로 한다.

- 클립보드 읽기
- 전역 단축키 등록
- tray app
- always-on-top floating window

위 기능은 일반적으로 관리자 권한 없이 구현 가능한 범위로 본다. 다만 실제 Windows 환경, PoE 실행 방식, 전체화면 모드에 따라 동작이 달라질 수 있으므로, 구현 중 실측 검증이 필요하다.

### 5.3 시연 환경

시연 안정성을 위해 PoE는 다음 모드 중 하나로 실행하는 것을 권장한다.

- Windowed Fullscreen
- Borderless Window
- Windowed Mode

exclusive fullscreen에서는 overlay 또는 always-on-top window가 정상 표시되지 않을 수 있다.

---

## 6. 앱 구성요소

## 6.1 Electron Main Process

역할:

- 앱 lifecycle 관리
- tray icon 관리
- global hotkey 등록
- clipboard 접근
- Python inference worker 실행 및 관리
- renderer/overlay window 생성
- IPC routing

## 6.2 Renderer / UI

역할:

- 결과 표시
- 최근 분석 결과 표시
- 현재 모델 상태 표시
- 오류/경고 메시지 표시
- 수동 paste 입력 fallback 제공

UI는 단순해도 된다. 중요한 것은 다음이다.

- 판단 결과가 바로 보일 것
- 신뢰도/확률이 표시될 것
- 직접 검색 권장 여부가 보일 것
- 모델 한계 문구가 표시될 것

## 6.3 Clipboard Parser Adapter

역할:

- 클립보드 텍스트가 PoE 아이템 텍스트인지 판정
- 기존 parser 또는 parser service 호출
- ParsedItem 형태로 변환

MVP에서는 영문 클라이언트 기준 parser를 우선 사용한다.
한국어 클라이언트 지원은 현재 학기 범위에서 필수로 보지 않는다.

## 6.4 Feature Builder Adapter

역할:

- ParsedItem을 모델 입력 피처로 변환
- V2 mod-aware feature가 준비되어 있으면 이를 반영
- feature 생성 실패 시 fallback 처리

세부 피처 포맷은 코딩 에이전트가 현재 학습 산출물과 feature policy를 기준으로 결정한다.

## 6.5 Inference Client

역할:

- 모델 추론 모듈에 요청 전송
- 응답 수신
- 실패 시 fallback 처리

권장 방식은 Python inference worker와의 로컬 프로세스 통신이다.

## 6.6 Result Presenter

역할:

- 예측 결과를 사용자 친화적 메시지로 변환
- 확률/구간/권장 행동 표시
- 오류 또는 불확실성 표시

예:

- `Search Worthy`
- `Low Listed Value`
- `High Value Candidate`
- `Needs Manual Trade Search`
- `Unsupported Item Type`

---

## 7. 모델 추론 연결 방식

## 7.1 권장안: Persistent Python Inference Worker

앱에서 CatBoost 모델을 직접 구현하려 하지 않고, Python 추론 worker를 별도 프로세스로 실행한다.

권장 흐름:

```text
Electron app start
  -> Python inference worker start
  -> worker loads CatBoost model(s)
  -> Electron sends feature request
  -> worker returns prediction response
  -> Electron displays result
```

이 방식의 장점:

- 기존 Python/CatBoost 학습 산출물을 활용하기 쉽다.
- 모델 로딩 비용을 앱 시작 시 1회로 제한할 수 있다.
- 추론 로직과 UI 로직을 분리할 수 있다.
- 모델 교체가 쉽다.

### 7.2 비추천: 요청마다 Python 실행

아이템 하나를 분석할 때마다 Python 스크립트를 새로 실행하는 방식은 구현은 쉽지만 비추천한다.

문제:

- 모델 로딩 비용이 반복됨
- UI 반응성이 낮아짐
- 앱처럼 느껴지지 않고 batch script처럼 느껴질 수 있음

다만 최악의 경우 fallback 시연용으로는 사용할 수 있다.

### 7.3 대안: Local HTTP Server

FastAPI 같은 로컬 서버를 띄우고 Electron이 localhost API를 호출하는 방식도 가능하다.

장점:

- 디버깅이 쉽다.
- API 명세가 명확하다.

단점:

- 포트 관리 필요
- 방화벽/보안 팝업 가능성
- 앱 패키징 복잡도 증가

MVP에서는 stdin/stdout 기반 worker 또는 단순 child process IPC를 우선 검토한다.

---

## 8. 앱 결과 해석 정책

앱은 예측 결과를 다음처럼 표현한다.

### 8.1 주요 출력

- search-worthy 여부
- search-worthy 확률
- 가치 구간 또는 판단 라벨
- 모델이 사용한 segment
- 주요 근거 피처 요약
- 직접 검색 권장 여부
- 모델 한계 문구

### 8.2 표시하지 않거나 약하게 표시할 것

- 정확한 최종 판매가처럼 보이는 숫자
- 실제 체결가 보장 표현
- 자동 판매 가능성
- 게임사 정책상 오해될 수 있는 자동 조작 기능

### 8.3 추천 메시지 예시

```text
검색 가치 있음
이 아이템은 공개 매물 데이터 기준으로 판매 시도 가치가 있을 가능성이 높습니다.
거래소 직접 검색을 권장합니다.
```

```text
낮은 가치 가능성 높음
현재 모델 기준으로 검색 우선순위가 낮습니다.
단, 특수 빌드용 아이템은 오판 가능성이 있으므로 확신이 없으면 직접 검색하세요.
```

```text
지원 범위 밖 아이템
현재 MVP 모델은 rare equipment와 filtered unique equipment 중심입니다.
이 아이템은 직접 검색이 필요합니다.
```

---

## 9. MVP 필수 기능

최종 발표 시점의 필수 기능은 아래 정도로 정의한다.

1. Windows에서 앱 실행 가능
2. 사용자가 직접 복사한 PoE1 아이템 클립보드 텍스트 읽기 가능
3. 영문 아이템 텍스트 parser 동작
4. feature builder 또는 adapter 동작
5. Python inference worker 호출 가능
6. 모델 예측 결과 수신 가능
7. 결과를 앱 UI 또는 floating panel에 표시
8. unsupported item / parse failure / inference failure에 대한 fallback 메시지 제공
9. 발표용 샘플 아이템 3~5개로 시연 가능

---

## 10. MVP 선택 기능

시간이 남을 경우 아래를 추가한다.

- 전역 단축키로 현재 클립보드 분석
- 최근 분석 기록 목록
- 항상 위 floating result window
- 간단한 confidence color 표시
- value band 표시
- 모델 segment 표시
- 직접 검색 링크 생성
- 수동 paste 입력창

---

## 11. 명시적 제외 범위

이번 학기 MVP에서는 아래를 제외한다.

- 자동 클릭
- 자동 판매
- NPC 판매창 자동 배치
- 게임 화면 OCR 기반 자동 분석
- 화면 픽셀을 읽어 자동 반응하는 기능
- 한국어 클라이언트 완전 지원
- 상용 수준 UI/UX
- 완전한 installer/auto-update
- 모든 아이템 타입 지원
- 실시간 가격 보장
- 실제 체결가 예측 보장

---

## 12. 구현 단계 제안

## Phase App-0. 앱 설계 및 프로토콜 초안

목표:

- 앱과 inference worker의 추상 요청/응답 구조 정의
- 사용 시나리오 확정
- UI 최소 화면 정의

산출물:

- Electron app skeleton
- 추론 요청/응답 인터페이스 초안
- MVP UI wireframe 수준의 화면

## Phase App-1. Electron shell 구현

목표:

- Windows에서 실행되는 앱 껍데기 구현
- tray / window / hotkey / clipboard read 확인

산출물:

- Electron 실행 가능
- clipboard text read 가능
- result window 표시 가능

## Phase App-2. Parser 연결

목표:

- PoE Ctrl+C 텍스트를 parser에 연결
- parse result를 UI에 표시

산출물:

- 샘플 clipboard text 분석 가능
- unsupported input fallback 가능

## Phase App-3. Inference worker 연결

목표:

- Python worker 실행
- dummy prediction 또는 실제 모델 prediction 수신

산출물:

- Electron -> worker -> Electron 왕복 통신 성공
- worker crash 시 최소 fallback 처리

## Phase App-4. 모델 및 feature builder 연결

목표:

- V2 model 또는 임시 baseline model 연결
- feature builder에서 모델 입력 생성

산출물:

- 실제 아이템 텍스트로 search-worthy 예측 가능
- 결과 confidence 표시 가능

## Phase App-5. 발표용 시연 준비

목표:

- 실제 발표에서 안정적으로 보여줄 시나리오 준비

산출물:

- 낮은 가치 아이템 샘플
- 검색 가치 있음 샘플
- 고가 후보 샘플
- unsupported/fallback 샘플
- 시연 순서 문서

---

## 13. 실패/불확실성 대응

## 13.1 Overlay가 불안정한 경우

대응:

- overlay 대신 일반 always-on-top floating window 사용
- 그래도 불안정하면 일반 앱 패널에 결과 표시

중요:

- 앱 MVP의 핵심은 “게임 위 overlay” 자체가 아니라 “클립보드 입력 → 모델 판단 → 결과 표시” 흐름이다.

## 13.2 Clipboard 자동 감지가 불안정한 경우

대응:

- 수동 “Analyze Clipboard” 버튼 제공
- 수동 paste 입력창 제공

## 13.3 Python worker 연결이 불안정한 경우

대응:

- worker 재시작 버튼
- dummy model 또는 last known result fallback
- CLI script 직접 실행 시연 fallback

단, 최종 MVP는 CLI-only가 아니라 앱 UI에서 결과가 보여야 한다.

## 13.4 V2 모델 준비가 늦어지는 경우

대응:

- V1 baseline model로 먼저 앱 연결
- 이후 V2 model artifact로 교체

중요:

- 앱 구조는 모델 버전과 분리되어야 한다.
- 모델 교체로 앱 전체를 다시 만들 필요가 없어야 한다.

---

## 14. 코딩 에이전트에게 주는 구현 원칙

1. 앱은 이번 학기 최종 산출물의 필수 요소다.
2. CLI-only 결과물로 최종 MVP를 대체하지 않는다.
3. Electron + TypeScript를 우선 사용하되, 실제 Windows 검증에서 문제가 크면 대안을 검토한다.
4. 게임 입력 자동화는 구현하지 않는다.
5. 사용자가 직접 복사한 클립보드 텍스트를 분석하는 흐름을 기본으로 한다.
6. 모델 추론은 Python persistent worker 방식을 우선 검토한다.
7. 앱과 모델 추론은 분리해서, 모델이 바뀌어도 앱을 크게 바꾸지 않게 한다.
8. UI는 예쁘게 만들기보다 결과 전달과 시연 안정성을 우선한다.
9. unsupported item / parse failure / inference failure를 반드시 사용자에게 명확히 표시한다.
10. 최종 발표용 샘플 시나리오를 기준으로 우선 구현한다.

---

## 15. 최종 성공 기준

이번 학기 앱 MVP의 성공 기준은 다음이다.

> Windows에서 실행되는 로컬 유틸리티 앱이 사용자가 복사한 PoE1 아이템 텍스트를 읽고, parser와 feature builder를 거쳐 로컬 CatBoost 추론 결과를 받아, 해당 아이템이 검색/판매 시도 가치가 있는지 사용자에게 표시한다.

이를 만족하면 상용 수준 UI나 완전한 overlay가 아니더라도, 인공지능 응용 캡스톤의 최종 MVP로 충분히 의미가 있다.

---

## 16. 한 줄 결론

이번 학기 최종 응용 산출물은 **Electron 기반 Windows 로컬 유틸리티 앱**으로 구현하며, 핵심 시연 흐름은 **Ctrl+C 클립보드 입력 → parser/feature builder → Python CatBoost worker 추론 → search-worthy 결과 표시**이다.
