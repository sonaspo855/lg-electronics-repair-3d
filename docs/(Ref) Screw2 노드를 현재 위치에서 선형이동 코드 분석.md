---
tags:
상태: Todo
중요:
생성일: 26-02-10T16:23:58
수정일: 26-02-10T16:34:47
종료일:
라벨:
  - codeRef
  - 냉장고
summary:
---
## 0. 참고 레퍼런스
- 
##  ■■ Description ■■
- `moveScrewLinearToDamperCaseBody` 함수는 분리된 왼쪽 스크류2 노드를 damperCaseBody 방향으로 선형 이동시키는 애니메이션을 구현하는 코드이다.,
## 1. 호출 경로
```
AnimatorAgent.ts:1115
  └─> ManualAssemblyManager.moveScrewLinearToDamperCaseBody()
      └─> ScrewLinearMoveAnimationService.animateScrewLinearMoveToDamperCaseBody()
```
## 2. 함수 시그니처
### 2-1. ManualAssemblyManager.ts
```typescript
public async moveScrewLinearToDamperCaseBody(
    screwNodePath: string,
    options?: {
        duration?: number;
        easing?: string;
        onComplete?: () => void;
    }
): Promise<{
    position: { x: number; y: number; z: number };
    duration: number;
    easing: string;
} | null>
```
### 2-2. ScrewLinearMoveAnimationService.ts
```typescript
public async animateScrewLinearMoveToDamperCaseBody(
    screwNodePath: string,
    options: {
        duration?: number;
        easing?: string;
        onComplete?: () => void;
    } = {}
): Promise<{
    position: { x: number; y: number; z: number };
    duration: number;
    easing: string;
} | null>
```
## 3. 동작 순서
### 3-1. 초기화 및 유효성 검사
```typescript
if (!this.sceneRoot) {
    console.error('Scene Root가 설정되지 않았습니다.');
    return null;
}
```
- SceneRoot가 설정되었는지 확인
### 3-2. 스크류 노드 이름 가져오기
```typescript
const screwNodeName = this.nodeNameManager.getNodeName(screwNodePath);
if (!screwNodeName) {
    console.error(`스크류 노드 이름을 찾을 수 없습니다: ${screwNodePath}`);
    return null;
}
```
- `screwNodePath` (예: `'fridge.leftDoorDamper.screw2Customized'`)를 통해 실제 노드 이름 조회
### 3-3. 스크류 노드 찾기
```typescript
const screwNode = this.sceneRoot.getObjectByName(screwNodeName);
if (!screwNode) {
    console.error(`스크류 노드를 찾을 수 없습니다: ${screwNodeName}`);
    return null;
}
```
- SceneRoot에서 스크류 노드 검색
### 3-4. damperCaseBody 노드 찾기
```typescript
const damperCaseBodyNodeName = this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCaseBody');
if (!damperCaseBodyNodeName) {
    console.error('damperCaseBody 노드 이름을 찾을 수 없습니다.');
    return null;
}

const damperCaseBodyNode = this.sceneRoot.getObjectByName(damperCaseBodyNodeName);
if (!damperCaseBodyNode) {
    console.error(`damperCaseBody 노드를 찾을 수 없습니다: ${damperCaseBodyNodeName}`);
    return null;
}
```
- damperCaseBody 노드 이름 조회 및 검색
### 3-5. 스크류별 선형 이동 설정 가져오기
```typescript
const metadataKey = screwNodePath.split('.').pop() || screwNodePath;
const screwLinearMoveConfig = this.metadataLoader.getScrewLinearMoveConfig(metadataKey);
if (!screwLinearMoveConfig) {
    console.error('스크류 선형 이동 설정을 찾을 수 없습니다.');
    return null;
}
```
- 메타데이터에서 스크류별 선형 이동 설정 로드
- `metadataKey`는 경로의 마지막 요소 (예: `'screw2Customized'`)
### 3-6. 애니메이션 옵션 병합
```typescript
const mergedOptions = {
    duration: options.duration ?? screwLinearMoveConfig.duration,
    easing: options.easing ?? screwLinearMoveConfig.easing,
    onComplete: options.onComplete
};
```
- 전달된 옵션과 메타데이터 설정 병합
### 3-7. 스크류 노드의 현재 월드 위치 가져오기
```typescript
screwNode.updateMatrixWorld();
const screwCurrentWorldPosition = new THREE.Vector3();
screwNode.getWorldPosition(screwCurrentWorldPosition);
```
- 스크류 노드의 월드 매트릭스 업데이트
- 현재 월드 위치 저장
### 3-8. 스크류 선형 이동 오프셋 가져오기
```typescript
const offset = new THREE.Vector3(
    screwLinearMoveConfig.offset?.x || 0,
    screwLinearMoveConfig.offset?.y || 0,
    screwLinearMoveConfig.offset?.z || 0
);
```
- 메타데이터에서 오프셋 벡터 추출
### 3-9. damperCaseBody의 이동 벡터 계산
```typescript
damperCaseBodyNode.updateMatrixWorld();
const startVec = damperCaseBodyNode.localToWorld(new THREE.Vector3(0, 0, 0));
const endVec = damperCaseBodyNode.localToWorld(offset.clone());
const moveVector = endVec.sub(startVec);
```
- **핵심 로직**: `localToWorld`를 사용하여 damperCaseBody의 회전, 스케일이 적용된 오프셋 벡터 계산
- `(0,0,0)`과 `(offset)`의 월드 좌표 차이를 구하면 위치(Translation)는 상쇄되고 순수한 회전/스케일이 적용된 오프셋 벡터만 남음
### 3-10. 스크류 타겟 위치 계산
```typescript
const targetWorldPosition = screwCurrentWorldPosition.clone().add(moveVector);
```
- 스크류 현재 위치에 이동 벡터를 더하여 타겟 위치 계산
### 3-11. 월드 타겟 좌표를 스크류 부모의 로컬 좌표계로 변환
```typescript
const localTargetPosition = targetWorldPosition.clone();
const screwParent = screwNode.parent;
if (screwParent) {
    screwParent.updateMatrixWorld();
    screwParent.worldToLocal(localTargetPosition);
}
```
- 월드 좌표를 스크류 부모 노드의 로컬 좌표계로 변환
### 3-12. GSAP를 사용한 선형 이동 애니메이션 실행
```typescript
return new Promise<{
    position: { x: number; y: number; z: number };
    duration: number;
    easing: string;
} | null>((resolve) => {
    gsap.to(screwNode.position, {
        x: localTargetPosition.x,
        y: localTargetPosition.y,
        z: localTargetPosition.z,
        duration: mergedOptions.duration / 1000,
        ease: mergedOptions.easing,
        onComplete: () => {
            console.log(`스크류 ${screwNodeName} damperCaseBody 방향으로 선형 이동 완료`);
            if (mergedOptions.onComplete) {
                mergedOptions.onComplete();
            }
            const result = {
                position: {
                    x: localTargetPosition.x,
                    y: localTargetPosition.y,
                    z: localTargetPosition.z
                },
                duration: mergedOptions.duration,
                easing: mergedOptions.easing
            };
            resolve(result);
        }
    });
});
```
- GSAP 라이브러리를 사용하여 부드러운 선형 이동 애니메이션 실행
- 애니메이션 완료 시 결과 반환
## 4. 핵심 기술 포인트
### 4-1. localToWorld를 통한 오프셋 벡터 계산
```typescript
const startVec = damperCaseBodyNode.localToWorld(new THREE.Vector3(0, 0, 0));
const endVec = damperCaseBodyNode.localToWorld(offset.clone());
const moveVector = endVec.sub(startVec);
```
- damperCaseBody의 회전, 스케일이 적용된 오프셋 벡터를 정확하게 계산
- 이를 통해 스크류가 damperCaseBody와 동일한 방향/크기로 이동
### 4-2. 월드 좌표 ↔ 로컬 좌표 변환
```typescript
// 월드 위치 가져오기
screwNode.getWorldPosition(screwCurrentWorldPosition);

// 월드 타겟을 로컬로 변환
screwParent.worldToLocal(localTargetPosition);
```
- Three.js의 좌표계 변환을 활용하여 정확한 위치 계산
### 4-3. GSAP 애니메이션
- `gsap.to()`를 사용하여 부드러운 이동 효과 구현
- Promise 패턴을 사용하여 비동기 애니메이션 완료 대기
## 메타데이터 구조 (예상)
```json
{
  "screw2Customized": {
    "offset": {
      "x": 0.05,
      "y": 0,
      "z": 0
    },
    "duration": 1000,
    "easing": "power2.inOut"
  }
}
```
