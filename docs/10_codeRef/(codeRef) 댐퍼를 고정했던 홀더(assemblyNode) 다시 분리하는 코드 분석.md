---
tags:
상태: Todo
중요:
생성일: 26-02-11T16:14:57
수정일: 26-02-11T16:19:08
종료일:
라벨:
  - 냉장고
  - codeRef
summary:
---
## 0. 참고 레퍼런스
- 
##  ■■ Description ■■
- `removeAssemblyNode` 함수는 댐퍼를 고정했던 홀더(assemblyNode)를 3단계 애니메이션으로 제거하는 기능을 수행하는 코드이다.
## 1. 호출 경로
```
AnimatorAgent.ts (line 1179)
  └─> ManualAssemblyManager.removeAssemblyNode() (line 164-191)
      └─> DamperCoverAssemblyService.removeAssemblyNode() (line 285-472)
```
## 2. 구현 방식
### 2-1. 초기화 및 검증 (DamperCoverAssemblyService.ts)
```typescript
if (!assemblyNode) {
    console.warn('[DamperCoverAssemblyService] assemblyNode가 존재하지 않습니다.');
    return null;
}
```
- `assemblyNode` 파라미터의 존재 여부 확인
- 노드가 없으면 `null` 반환
### 3-2. 메타데이터 로드 (DamperCoverAssemblyService.ts)
```typescript
const assemblyKey = 'damper_cover_assembly';
const config = this.metadataLoader.getAssemblyConfig(assemblyKey);
const disassemblyConfig = config?.disassembly;

const liftDist = disassemblyConfig?.liftDistance ?? 0.01;
const slideDist = disassemblyConfig?.slideDistance ?? 0.05;
const liftDur = (disassemblyConfig?.liftDuration ?? 500) / 1000;
const slideDur = (disassemblyConfig?.slideDuration ?? 700) / 1000;
const fadeDur = (disassemblyConfig?.fadeDuration ?? 500) / 1000;
const tiltAngleDeg = disassemblyConfig?.tiltAngle ?? 35;
```
- `damper_cover_assembly` 키로 메타데이터 설정 로드
- 분해 관련 설정값 추출 (기본값 적용):
  - `liftDistance`: 0.01 (리프트 거리)
  - `slideDistance`: 0.05 (슬라이드 거리)
  - `liftDuration`: 500ms (리프트 시간)
  - `slideDuration`: 700ms (슬라이드 시간)
  - `fadeDuration`: 500ms (페이드 아웃 시간)
  - `tiltAngle`: 35도 (틸트 각도)
### 3-3. 힌지(Pivot) 포인트 결정 (DamperCoverAssemblyService.ts)
#### 3-1. 바운딩 박스 계산
```typescript
const box = getPreciseBoundingBox(assemblyNode);
```
- `getPreciseBoundingBox` 함수로 노드의 정확한 바운딩 박스 계산
### 3-2. 가장 가까운 홈-플러그 쌍 찾기
```typescript
if (this.detectedHoles && this.detectedHoles.length > 0 && 
    this.detectedPlugs && this.detectedPlugs.length > 0) {
    let minDistance = Infinity;
    let bestHole = this.detectedHoles[0];

    for (const plug of this.detectedPlugs) {
        for (const hole of this.detectedHoles) {
            const dist = plug.position.distanceTo(hole.position);
            if (dist < minDistance) {
                minDistance = dist;
                bestHole = hole;
            }
        }
    }
```
- 탐지된 홈(`detectedHoles`)과 플러그(`detectedPlugs`) 중 가장 가까운 쌍 찾기
### 3-3. 힌지 위치 결정
```typescript
hingeWorldPos.copy(bestHole.position);

const distToMinX = Math.abs(hingeWorldPos.x - box.min.x);
const distToMaxX = Math.abs(hingeWorldPos.x - box.max.x);

if (distToMinX < distToMaxX) {
    hingeWorldPos.x = box.min.x;
} else {
    hingeWorldPos.x = box.max.x;
}
```
- 홈 좌표 근처의 노드 외곽 지점을 힌지로 설정
- X축 경계 중 가까운 쪽으로 투영
### 3-4. 로컬 피벗 좌표 계산
```typescript
const localPivot = assemblyNode.worldToLocal(hingeWorldPos.clone());
```
- 월드 좌표의 힌지 위치를 로컬 좌표로 변환
## 4. 초기 상태 설정 (lines 363-373)
```typescript
assemblyNode.visible = true;
assemblyNode.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(m => {
            m.transparent = true;
            m.opacity = 1;
        });
    }
});
```
- 노드를 visible로 설정
- 모든 자식 메쉬의 material을 transparent로 설정하고 opacity를 1로 초기화
## 5. GSAP Timeline 생성 (lines 375-380)
```typescript
const tl = gsap.timeline({
    onComplete: () => {
        assemblyNode.visible = false;
        console.log('[DamperCoverAssemblyService] 제거 애니메이션 완료');
    }
});
```
- GSAP 타임라인 생성
- 완료 시 노드를 visible = false로 설정
## 6. 동작 순서 (3단계 애니메이션)
### 1단계: 힌지를 고정하고 틸팅 (Pivot Rotation) (lines 382-415)
```typescript
const tiltAngle = THREE.MathUtils.degToRad(tiltAngleDeg);
const startPos = assemblyNode.position.clone();
const startRotY = assemblyNode.rotation.y;

tl.to({ progress: 0 }, {
    progress: 1,
    duration: liftDur,
    ease: 'power2.out',
    onUpdate: function () {
        const p = this.targets()[0].progress;
        const currentTilt = tiltAngle * p;

        // 1. 회전 적용
        assemblyNode.rotation.y = startRotY + currentTilt;

        // 2. 피벗을 고정하기 위한 위치 보정
        const currentQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, currentTilt, 0));
        const pivotDelta = localPivot.clone().sub(localPivot.clone().applyQuaternion(currentQuat));

        const initialQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, startRotY, 0));
        const rotatedDelta = pivotDelta.applyQuaternion(initialQuat);

        // 3. 힌지 쪽 충돌 방지를 위한 미세한 선행 리프트 (Hinge Lift)
        const hingeLift = liftDist * 0.3 * p;

        assemblyNode.position.set(
            startPos.x + rotatedDelta.x,
            startPos.y + rotatedDelta.y,
            startPos.z + rotatedDelta.z - (liftDist * p) - hingeLift
        );
    }
});
```
**동작 내용:**
1. 틸트 각도를 라디안으로 변환
2. 시작 위치와 회전값 저장
3. GSAP 애니메이션으로 틸팅 실행
4. 회전 적용 (Y축 회전)
5. 피벗을 고정하기 위한 위치 보정 (쿼터니언 계산)
6. 힌지 쪽 충돌 방지를 위한 미세한 선행 리프트 적용 (Z축 방향)
### 2단계: 슬라이드 분리 (DamperCoverAssemblyService.ts)
```typescript
tl.to(assemblyNode.position, {
    y: `+=${slideDist}`,
    duration: slideDur,
    ease: 'power2.inOut'
});
```
**동작 내용:**
- Y축 방향으로 `slideDist`만큼 슬라이드 이동
- `power2.inOut` 이징 함수 사용
### 3단계: 페이드 아웃 (DamperCoverAssemblyService.ts)
```typescript
tl.to({}, {
    duration: fadeDur,
    onUpdate: function () {
        const progress = this.progress();
        assemblyNode.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(m => {
                    m.opacity = 1 - progress;
                });
            }
        });
    }
});
```
**동작 내용:**
- 투명도(opacity)를 점진적으로 감소
- 1에서 0으로 페이드 아웃
## 7. 결과 반환 (DamperCoverAssemblyService.ts)
```typescript
const position = {
    x: assemblyNode.position.x,
    y: assemblyNode.position.y,
    z: assemblyNode.position.z
};
const duration = (liftDur + slideDur + fadeDur) * 1000;

const result = {
    position,
    duration,
    easing: 'power2.inOut',
    rotationAngle: tiltAngleDeg,
    rotationAxis: 'y' as const,
    translationDistance: slideDist,
    extractDirection: [0, 1, 0] as [number, number, number],
    disassemblyConfig: {
        liftDistance: liftDist,
        slideDistance: slideDist,
        liftDuration: liftDur * 1000,
        slideDuration: slideDur * 1000,
        fadeDuration: fadeDur * 1000,
        tiltAngle: tiltAngleDeg
    }
};
```
**반환 값:**
- `position`: 최종 위치 좌표
- `duration`: 전체 애니메이션 시간 (ms)
- `easing`: 이징 함수
- `rotationAngle`: 회전 각도 (도)
- `rotationAxis`: 회전 축 ('y')
- `translationDistance`: 이동 거리
- `extractDirection`: 추출 방향 [0, 1, 0]
- `disassemblyConfig`: 분해 설정 상세 정보
## 7. 요약
| 단계     | 동작                        | 시간    | 이징           |
| ------ | ------------------------- | ----- | ------------ |
| 1단계    | 힌지 고정 틸팅 (Pivot Rotation) | 500ms | power2.out   |
| 2단계    | 슬라이드 분리 (Y축 방향)           | 700ms | power2.inOut |
| 3단계    | 페이드 아웃 (투명도 감소)           | 500ms | -            |
| **전체** | **총 1700ms**              |       |              |
