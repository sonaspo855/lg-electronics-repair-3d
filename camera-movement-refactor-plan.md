# CameraMovementService 리팩토링 및 공통화 계획

## 1. 현재 상황 분석
`CameraMovementService.ts`의 `moveCameraCinematic` 함수는 다음과 같은 중복된 로직과 잠재적 개선점을 가지고 있습니다.

- **중복 로직**: `src/shared/utils/animationUtils.ts`의 `calculateCameraTargetPosition` 및 `CinematicSequence.addBezierPath`와 기능적으로 겹치는 부분이 많습니다.
- **관심사 분리 미흡**: 타겟 위치 계산(수학), 애니메이션 실행(GSAP), 후처리(하이라이트)가 하나의 거대한 함수에 섞여 있습니다.
- **재사용성**: 현재는 댐퍼 노드에 특화된 처리(`direction` 강제 등)가 포함되어 있어 다른 프로젝트나 노드에 적용하기 어렵습니다.

## 2. 개선 방향: 공통 컴포넌트 활용
기존 `animationUtils.ts`를 강화하고 `CameraMovementService`는 이를 조합하는 역할만 수행하도록 변경합니다.

### 2.1 단계별 분리
1.  **연산 로직 (Math)**: `calculateCameraTargetPosition`을 개선하여 `moveCameraCinematic`에서 수행하는 정밀한 바운딩 박스 중심점 및 거리 계산을 포함하도록 합니다.
2.  **애니메이션 엔진 (Animation)**: `CinematicSequence` 클래스를 활용하여 베지에 곡선 경로와 UP 벡터 보간을 처리합니다.
3.  **서비스 레이어 (Service)**: `CameraMovementService`는 메타데이터에서 값을 가져와 유틸리티 함수에 전달하고, 이동 완료 후의 비즈니스 로직(하이라이트 등)만 관리합니다.

## 3. 리팩토링 실행 계획

### [1단계] `animationUtils.ts` 확장
- `calculateCameraTargetPosition`에 `distance` 파라미터 지원 추가.
- `CinematicSequence`에 카메라 UP 벡터 보간(Lerp) 기능 추가.

### [2단계] `CameraMovementService.ts` 슬림화
- 복잡한 수학 연산(Bezier 계산 등)을 `animationUtils.ts`로 이관.
- `moveCameraCinematic` 내부 로직을 `CinematicSequence`를 사용하는 방식으로 교체.

### [3단계] 메타데이터 연동 강화
- `direction`, `distance`, `duration`, `easing` 등 모든 파라미터를 유틸리티 함수가 유연하게 받을 수 있도록 인터페이스 정제.

## 4. 기대 효과
- **코드 가독성**: `CameraMovementService`의 코드 길이가 약 50% 감소합니다.
- **유지보수성**: 카메라 이동 알고리즘(수학)을 수정하고 싶을 때 유틸리티 함수 한 곳만 수정하면 전역에 적용됩니다.
- **확장성**: 추후 냉장고 문 외에 다른 부품(컴프레서, 선반 등)에 대한 시네마틱 뷰를 만들 때 유틸리티를 즉시 재사용할 수 있습니다.
