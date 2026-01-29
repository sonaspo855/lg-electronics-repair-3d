# 홈(Groove) 탐지 알고리즘 개선 계획서

## 1. 현황 분석 및 문제점

### 1.1 현재 방식 (Bounding Box 기반 필터링)
- **위치**: `src/services/fridge/ManualAssemblyManager.ts` (Line 404-500)
- **로직**: `innerBoundRatio`를 사용하여 전체 바운딩 박스의 중심 영역에 포함된 정점만 필터링.
- **문제점**:
    - **기하학적 부정확성**: 부품이 비대칭이거나 복잡한 형상(L자, U자 등)일 경우 바운딩 박스 중심이 실제 홈의 위치와 일치하지 않음.
    - **휴리스틱 의존**: 단순 거리 비율에 의존하므로 외곽에 위치한 정밀한 홈을 탐지하지 못하거나, 홈이 아닌 평면을 홈으로 오인할 가능성이 높음.

## 2. 개선 제안: 법선 벡터 및 클러스터링 기반 탐지

`NormalBasedHighlight.ts`의 로직을 활용하여 형상 특징(Feature)을 기반으로 홈을 탐지하는 방식을 제안합니다.

### 2.1 핵심 알고리즘 (Feature-Based Detection)

1.  **Normal Filtering (법선 필터링)**:
    - 특정 방향(예: 삽입 방향)을 바라보는 모든 면(Face)을 추출.
    - 결과물: 부품의 '겉면' + '홈의 바닥면'이 포함된 데이터셋.

2.  **Spatial Clustering (공간 클러스터링)**:
    - 추출된 면들을 인접 거리(Threshold) 기준으로 그룹화.
    - `NormalBasedHighlight.calculateMultipleVirtualPivotsByNormalAnalysis` 활용.

3.  **Hole Identification (홈 식별)**:
    - **Cluster Size**: 정점 수가 가장 많은 클러스터는 '부품 겉면'으로 간주하여 제외.
    - **Relative Depth**: 겉면 클러스터의 평균 높이보다 낮은 위치에 있는 클러스터들을 '홈'으로 식별.

### 2.2 기대 효과
- **홈 개수 파악**: 식별된 소규모 클러스터의 개수가 곧 부품의 홈 개수와 일치.
- **정밀 좌표 추출**: 각 클러스터의 중심점(Center)을 구함으로써 홈의 정중앙 좌표를 정확히 특정.
- **범용성**: 부품의 전체 크기나 모양에 상관없이 기하학적 특징만으로 홈을 찾으므로 유지보수 효율성 증대.

## 3. 프로세스 흐름도

```mermaid
graph TD
    A[대상 노드 분석] --> B[특정 법선 벡터 면 추출]
    B --> C[거리 기반 클러스터링]
    C --> D{클러스터 성격 판별}
    D -- "정점 수 많음 (Main Surface)" --> E[부품 겉면으로 간주/제외]
    D -- "정점 수 적음 (Sub Clusters)" --> F[개별 홈(Hole)으로 식별]
    F --> G[홈 개수 카운트]
    F --> H[각 홈의 중심 좌표 추출]
    G & H --> I[정밀 조립/분해 경로 생성]
```

## 4. 향후 구현 참조 코드 (의사 코드)

```typescript
// 1. 모든 클러스터 추출
const clusters = NormalBasedHighlight.calculateMultipleVirtualPivotsByNormalAnalysis(node, normal);

// 2. 크기순 정렬 (가장 큰 것은 겉면)
const sortedClusters = clusters.sort((a, b) => b.filteredVerticesCount - a.filteredVerticesCount);
const mainSurface = sortedClusters[0];
const potentialHoles = sortedClusters.slice(1);

// 3. 홈 개수 및 좌표 출력
console.log(`탐지된 홈 개수: ${potentialHoles.length}`);
potentialHoles.forEach((hole, index) => {
    console.log(`홈 #${index + 1} 좌표:`, hole.position);
});
```
