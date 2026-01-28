# 댐퍼 커버 조립 계획 (Bounding Box & Offset 기반)

## 개요
더미 노드(Socket/Plug)가 없는 3D 모델에서 댐퍼 커버를 댐퍼 어셈블리의 홈에 삽입하는 기능을 구현합니다.

## 방식 선택
**Bounding Box & Offset 기반** (더미 노드가 없으므로)

### 방식 설명
- 홈(Hole) 노드의 Bounding Box를 구한 뒤, 그 중심점(Center)을 타겟 좌표로 설정
- 삽입 로직: 돌출부 노드의 중심을 홈의 중심에 일치시키되, 모델링 데이터의 오프셋을 고려하여 한쪽 축(예: Z축)으로 미세하게 조정
- 추천 상황: 홈의 형상이 단순(사각형, 원형)하고 조립 정밀도가 아주 엄격하지 않을 때 적합

## 구현 단계

### 1. 홈 영역 식별 로직 구현
**파일**: `src/shared/utils/GrooveDetectionUtils.ts` (신규 생성)

```typescript
import * as THREE from 'three';

/**
 * 홈(Groove) 영역 식별 유틸리티
 * 법선 벡터 기반으로 홈 내부를 식별
 */
export class GrooveDetectionUtils {
    /**
     * 법선 벡터 기반으로 홈 영역 식별
     * @param targetNode 대상 노드 (댐퍼 어셈블리)
     * @param normalFilter 필터링할 법선 벡터 (기본: Z축 방향)
     * @param normalTolerance 법선 허용 오차 (기본: 0.2)
     * @returns 홈 영역의 중심점 (월드 좌표)
     */
    public static identifyGrooveCenter(
        targetNode: THREE.Object3D,
        normalFilter: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
        normalTolerance: number = 0.2
    ): THREE.Vector3 | null {
        // 1. 노드의 모든 메쉬 순회
        // 2. 법선 벡터 기반 필터링
        // 3. 필터링된 면들의 중심점 계산
        // 4. 월드 좌표로 변환하여 반환
    }

    /**
     * 바운딩 박스 기반 홈 중심점 계산
     * @param targetNode 대상 노드
     * @param innerBoundRatio 내부 바운딩 비율 (기본: 0.3)
     * @returns 홈 중심점 (월드 좌표)
     */
    public static calculateGrooveCenterByBoundingBox(
        targetNode: THREE.Object3D,
        innerBoundRatio: number = 0.3
    ): THREE.Vector3 | null {
        // 1. 전체 바운딩 박스 계산
        // 2. 내부 바운딩 영역 계산 (중앙 30%)
        // 3. 내부 영역의 중심점 반환
    }
}
```

### 2. assembleDamperCover 함수 수정
**파일**: `src/services/fridge/ManualAssemblyManager.ts`

**수정 위치**: `assembleDamperCover` 함수 (253-323 라인)

**변경 사항**:
1. 홈 영역 식별 로직 추가
2. Bounding Box 기반 중심점 계산
3. 오프셋 적용
4. GSAP 애니메이션으로 부드러운 삽입

### 3. 상수 정의
**파일**: `src/shared/utils/fridgeConstants.ts`

**추가 상수**:
```typescript
// 홈 식별 관련 상수
export const GROOVE_NORMAL_FILTER = new THREE.Vector3(0, 0, 1); // Z축 방향 법선 필터링
export const GROOVE_NORMAL_TOLERANCE = 0.2; // 법선 허용 오차 20%
export const GROOVE_INNER_BOUND_RATIO = 0.3; // 내부 바운딩 비율 30%

// 삽입 오프셋
export const DAMPER_COVER_INSERTION_OFFSET = new THREE.Vector3(0, 0, 0.5); // Z축으로 0.5만큼 삽입
```

## 상세 구현 계획

### 단계 1: GrooveDetectionUtils 생성
- 법선 벡터 기반 홈 식별 함수 구현
- Bounding Box 기반 홈 중심점 계산 함수 구현
- 월드 좌표 변환 로직 포함

### 단계 2: assembleDamperCover 함수 수정
```typescript
public async assembleDamperCover(
    options?: {
        duration?: number;
        onComplete?: () => void;
    },
    camera?: THREE.Camera
): Promise<void> {
    // 1. 노드 찾기
    const damperAssembly = this.sceneRoot?.getObjectByName(LEFT_DOOR_DAMPER_ASSEMBLY_NODE);
    const damperCover = this.sceneRoot?.getObjectByName(LEFT_DOOR_DAMPER_COVER_BODY_NODE);

    if (!damperAssembly || !damperCover) {
        console.error('[ManualAssemblyManager] 노드를 찾을 수 없습니다');
        return;
    }

    // 2. 홈 영역 식별 (Bounding Box 기반)
    const grooveCenter = GrooveDetectionUtils.calculateGrooveCenterByBoundingBox(
        damperAssembly,
        GROOVE_INNER_BOUND_RATIO
    );

    if (!grooveCenter) {
        console.error('[ManualAssemblyManager] 홈 중심점을 계산할 수 없습니다');
        return;
    }

    // 3. 오프셋 적용
    const targetPosition = grooveCenter.clone().add(DAMPER_COVER_INSERTION_OFFSET);

    // 4. 월드 좌표를 로컬 좌표로 변환
    const targetLocalPos = damperCover.parent
        ? CoordinateTransformUtils.worldToLocal(targetPosition, damperCover.parent)
        : targetPosition;

    // 5. GSAP 애니메이션으로 삽입
    return new Promise((resolve) => {
        gsap.to(damperCover.position, {
            x: targetLocalPos.x,
            y: targetLocalPos.y,
            z: targetLocalPos.z,
            duration: (options?.duration || 1500) / 1000,
            ease: 'power2.inOut',
            onComplete: () => {
                console.log('[ManualAssemblyManager] 댐퍼 커버 조립 완료');
                options?.onComplete?.();
                resolve();
            }
        });
    });
}
```

### 단계 3: 테스트 및 검증
1. 홈 중심점 계산 정확성 확인
2. 삽입 애니메이션 부드러움 확인
3. 최종 위치 정확성 확인

## 수정해야 할 파일 목록

1. **신규 생성**: `src/shared/utils/GrooveDetectionUtils.ts`
   - 홈 영역 식별 유틸리티 클래스

2. **수정**: `src/services/fridge/ManualAssemblyManager.ts`
   - `assembleDamperCover` 함수 수정 (253-323 라인)

3. **수정**: `src/shared/utils/fridgeConstants.ts`
   - 홈 식별 관련 상수 추가

## 참고 자료
- `.kilocode/rules/홈영역 파악 및 돌출부 삽입.md`
- `src/shared/utils/commonUtils.ts` (getPreciseBoundingBox 함수)
- `src/shared/utils/CoordinateTransformUtils.ts`
