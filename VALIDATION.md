# 검증 결과

## 통과한 검사

- 상태 모델 자동 검사: **16개 통과** (`tests/model.test.mjs`).
- 실제 Chrome 브라우저 사용 흐름: **17개 통과**, 브라우저 JavaScript 예외 **0건** (`qa-output/browser-results.json`).
- Supabase 공용 모드 실제 Chrome 검사: **초대 코드 인증 → 공용 보드 로드 → 후보 등록 → 다른 참여자 접속 → 투표 → 댓글 → 삭제·정리 통과** (`qa/remote-browser-check.cjs`).
- RLS 위조 검사: p2 초대 코드로 `author_member_id=p1` 후보 등록을 시도하면 **HTTP 401 / RLS 거부** 확인.
- 온라인 지도 확인: 샘플 확정 일정 **핀 2개**, 검사 당시 배경 지도 타일 **15개** 로드, JavaScript 예외 **0건** (`qa-output/online-map-results.json`).
- 화면 폭 320·360·390·430·768·1024·1440px에서 메인 화면 가로 넘침 없음.
- HTTP 서버 없이 `index.html`을 파일로 열어 후보를 저장하고, 새로고침 뒤 유지되는 것을 Chrome에서 확인.

## 브라우저에서 직접 검사한 흐름

빈 보드, 후보 등록, 지도 링크 좌표 추출, 참여자별 투표와 취소, 댓글 입력과 HTML 이스케이프,
작성 중 댓글 보존, 별도 일정 확정, 비용 합계, 공동 순위, 우천 대안,
검색·카테고리 필터·내 투표 화면, 날짜 잠금과 해제, 비활성 시간대의 데이터 보존,
잘못된 시간 설정의 일괄 취소, 제안자별 수정·삭제 버튼,
JSON 다운로드·잘못된 가져오기 거부·확인 후 전체 교체,
실제 데이터와 분리된 샘플 체험, 지도 서버 차단 시 대체 화면,
같은 브라우저 탭 간 변경 반영과 오래된 편집 거부,
새로고침 저장 유지, 파일 직접 열기, 손상된 저장 원본 보호.

## 화면 검토

`qa-output/mobile-viewport.png`, `mobile-add-form.png`, `desktop-demo.png`, `desktop-map-online.png`를 생성하고 검토했습니다.
작은 화면의 설명·행동 버튼 대비를 높였으며, 모바일 헤더와 여행 티켓 그림의 잘림을 조정했습니다.

## 공용 데이터 검증

- Supabase 프로젝트: `tennis-homepage-preview`; 신규 `osaka_trip_*` 테이블에만 작업.
- 기본 데이터: 여행 1건, 참여자 5명, 날짜 3개, 시간대 24개.
- 테스트 종료 후 후보·투표·PICK·댓글은 모두 **0건**으로 정리 확인.
- 초대 코드 원문은 DB에 저장하지 않고 `private.osaka_trip_member_tokens`에 SHA-256 해시 5건만 보관.
- 모든 공개 `osaka_trip_*` 테이블에 RLS 활성화. Supabase 보안 Advisor에서 이번 오사카 테이블 관련 보안 경고 없음.
- 다른 참여자의 변경은 약 5초마다 revision을 확인하고 변경 시 전체 상태를 다시 불러오는 방식으로 검증. WebSocket Realtime은 사용하지 않음.

## 검증 범위 밖

Supabase Auth 계정 로그인과 WebSocket Realtime은 사용하지 않습니다. 현재는 참여자별 초대 코드와 5초 주기 동기화를 사용합니다.
Safari·Firefox 및 실제 Android/iOS 기기의 실기기 검사는 수행하지 않았습니다.
샘플 위치·가격은 실제 장소에 대한 사실 검증이나 여행 추천이 아닙니다.
