# 홈(Hole) 탐지 및 시각화 가이드

## 개요

이 가이드는 [`NormalBasedHighlight`](../src/shared/utils/NormalBasedHighlight.ts) 클래스를 사용하여 3D 모델에서 홈(Groove/Hole)을 탐지하고 각 홈의 중심점에 마젠타색 구를 생성하는 방법을 설명합니다.

## 주요 기능

1. **법선 벡터 기반 필터링**: 특정 방향을 바라보는 면들만 추출
2. **클러스터링**: 인접한 면들을 그룹화하여 홈 식별
3. **자동 홈 식별**: 가장 큰 클러스터(겉면)를 제외하고 나머지를 홈으로 판단
4. **시각화**: 각 홈의 중심점에 마젠타색 구 생성

## 사용 방법

### 1. 기본 사용법

```typescript
import * as THREE from 'three';
import { NormalBasedHighlight } from '../src/shared/utils/NormalBasedHighlight';

// 1. NormalBasedHighlight 인스턴스 생성 및 초기화
const highlighter = new NormalBasedHighlight();
highlighter.initialize(sceneRoot);

// 2. 홈 탐지 및 시각화
const holes = highlighter.detectAndVisualizeHoles(
    targetNode,                    // 탐지할 대상 노드
    new THREE.Vector3(0, 0, 1),   // 필터링할 방향 (Z축)
    0.2,                           // 법선 허용 오차
    0.05,                          // 클러스터링 거리 임계값 (5cm)
    0.005                          // 마젠타색 구 반지름 (5mm)
);

// 3. 결과 확인
console.log(`탐지된 홈 개수: ${holes.length}`);
holes.forEach((hole, index) => {
    console.log(`홈 #${index + 1} 위치:`, hole.position);
});
```

### 2. 카메라 기준 하이라이트와 함께 사용

```typescript
// 먼저 카메라를 기준으로 면을 하이라이트
highlighter.highlightFacesByCameraFilter(
    targetNode,
    camera,
    0xff0000,  // 빨간색
    15         // 엣지 임계값
);

// 그 다음 홈 탐지 및 시각화
const holes = highlighter.detectAndVisualizeHoles(
    targetNode,
    new THREE.Vector3(0, 0, 1),
    0.2,
    0.05,
    0.005
);
```

## 파라미터 설명

### `detectAndVisualizeHoles` 메서드

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| `targetNode` | `THREE.Object3D` | 필수 | 홈을 탐지할 대상 노드 |
| `normalFilter` | `THREE.Vector3` | `(0, 0, 1)` | 필터링할 방향 법선 벡터 |
| `normalTolerance` | `number` | `0.2` | 법선 벡터 허용 오차 (0~1) |
| `clusterThreshold` | `number` | `0.05` | 클러스터링 거리 임계값 (미터 단위) |
| `sphereRadius` | `number` | `0.005` | 마젠타색 구의 반지름 (미터 단위) |

### 파라미터 튜닝 가이드

#### `normalTolerance` (법선 허용 오차)
- **값이 작을수록 (0.1)**: 더 엄격한 필터링, 정확히 해당 방향을 바라보는 면만 선택
- **값이 클수록 (0.3)**: 더 넓은 범위 필터링, 약간 기울어진 면도 포함
- **권장값**: `0.2` (대부분의 경우 적절)

#### `clusterThreshold` (클러스터링 거리 임계값)
- **값이 작을수록 (0.03)**: 더 많은 작은 클러스터 생성, 세밀한 홈 분리
- **값이 클수록 (0.08)**: 더 적은 큰 클러스터 생성, 인접한 홈들을 하나로 병합
- **권장값**: `0.05` (5cm, 대부분의 경우 적절)

#### `sphereRadius` (마젠타색 구 반지름)
- 홈의 크기에 따라 조절
- **작은 홈**: `0.003` (3mm)
- **중간 홈**: `0.005` (5mm)
- **큰 홈**: `0.01` (10mm)

## 반환값

`detectAndVisualizeHoles` 메서드는 다음 구조의 배열을 반환합니다:

```typescript
Array<{
    position: THREE.Vector3;      // 홈의 중심점 (월드 좌표)
    filteredVerticesCount: number; // 해당 홈의 정점 수
    sphere: THREE.Mesh;           // 생성된 마젠타색 구 메쉬
}>
```

## 알고리즘 설명

### 1. 법선 필터링
특정 방향(`normalFilter`)을 바라보는 모든 면(Face)을 추출합니다.

### 2. 클러스터링
추출된 면들을 인접 거리(`clusterThreshold`) 기준으로 그룹화합니다.

### 3. 홈 식별
- 가장 큰 클러스터(정점 수가 가장 많은)를 '겉면'으로 간주하여 제외
- 나머지 작은 클러스터들을 '홈'으로 식별

### 4. 시각화
각 홈의 중심점에 마젠타색 구를 생성하여 시각화합니다.

## 예제 코드

### 예제 1: 기본 홈 탐지

```typescript
import { demonstrateHoleDetection } from './hole-detection-example';

// 기본 홈 탐지 실행
demonstrateHoleDetection(
    sceneRoot,
    targetNode,
    camera
);
```

### 예제 2: 사용자 정의 방향으로 탐지

```typescript
import { demonstrateHoleDetectionWithCustomDirection } from './hole-detection-example';

// Y축 방향으로 홈 탐지
const holes = demonstrateHoleDetectionWithCustomDirection(
    sceneRoot,
    targetNode,
    new THREE.Vector3(0, 1, 0)  // 위쪽 방향
);
```

### 예제 3: 다양한 파라미터 테스트

```typescript
import { testHoleDetectionWithVariousParameters } from './hole-detection-example';

// 다양한 파라미터로 홈 탐지 테스트
testHoleDetectionWithVariousParameters(
    sceneRoot,
    targetNode
);
```

## 주의사항

1. **sceneRoot 초기화**: `initialize()` 메서드를 먼저 호출해야 합니다.
2. **월드 매트릭스 업데이트**: 내부적으로 `updateMatrixWorld(true)`가 호출되므로 별도로 호출할 필요가 없습니다.
3. **메모리 관리**: `clearHighlights()` 또는 `dispose()`를 호출하여 생성된 하이라이트를 제거할 수 있습니다.
4. **성능**: 복잡한 모델의 경우 클러스터링 연산에 시간이 걸릴 수 있습니다.

## 관련 파일

- [`NormalBasedHighlight.ts`](../src/shared/utils/NormalBasedHighlight.ts) - 메인 구현
- [`hole-detection-example.ts`](./hole-detection-example.ts) - 예제 코드
- [`GrooveDetectionUtils.ts`](../src/shared/utils/GrooveDetectionUtils.ts) - 유틸리티 함수

## 추가 기능

### 하이라이트 제거

```typescript
// 모든 하이라이트 제거
highlighter.clearHighlights();

// 또는 컴포넌트 전체 정리
highlighter.dispose();
```

### 개별 홈 접근

```typescript
const holes = highlighter.detectAndVisualizeHoles(...);

// 첫 번째 홈의 위치에 접근
const firstHolePosition = holes[0].position;

// 첫 번째 홈의 마젠타색 구에 접근
const firstHoleSphere = holes[0].sphere;

// 마젠타색 구 색상 변경
firstHoleSphere.material.color.setHex(0x00ff00); // 녹색으로 변경
```

## 문제 해결

### 홈이 탐지되지 않는 경우
1. `normalFilter` 방향이 올바른지 확인
2. `normalTolerance` 값을 늘려보세요
3. `clusterThreshold` 값을 조정해보세요

### 너무 많은 홈이 탐지되는 경우
1. `normalTolerance` 값을 줄이세요
2. `clusterThreshold` 값을 늘리세요

### 마젠타색 구가 너무 크거나 작은 경우
1. `sphereRadius` 값을 조정하세요

## 라이선스

이 코드는 프로젝트의 라이선스를 따릅니다.
