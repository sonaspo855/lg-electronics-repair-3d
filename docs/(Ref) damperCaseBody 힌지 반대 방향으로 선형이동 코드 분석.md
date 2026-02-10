---
tags:
상태: Todo
중요:
생성일: 26-02-10T11:12:46
수정일: 26-02-10T12:19:54
종료일:
라벨:
  - 냉장고]
  - codeRef
summary:
---
## 0. 참고 레퍼런스
- 
## ■■ Description ■■
- `animateDamperCaseBodyLinearMove` 함수는 **댐퍼 케이스 바디(DamperCaseBody)를 힌지 반대 방향으로** 선형 이동시키는 애니메이션 구현 코드이다.
- 이 함수는 **GSAP 라이브러리를 사용**하여 부드러운 이징 효과를 적용하고, 메타데이터 기반의 오프셋 설정을 활용한다.
## 1. 함수 구현 방식
### 1-1. 함수 시그니처
```typescript
public async animateDamperCaseBodyLinearMove(options: {
    duration?: number;
    easing?: string;
    onComplete?: () => void;
} = {}): Promise<{
    position: { x: number; y: number; z: number };
    duration: number;
    easing: string;
} | null>
```
### 1-2. 주요 구성 요소
| 구성 요소               | 설명                         |
| ------------------- | -------------------------- |
| **Scene Root**      | Three.js 씬의 루트 객체 (노드 검색용) |
| **NodeNameManager** | 노드 이름 매핑 관리자               |
| **MetadataLoader**  | 애니메이션 설정 메타데이터 로더          |
| **GSAP**            | 애니메이션 라이브러리                |
## 2. 동작 순서
### 2-1. 초기화 및 검증 단계 (DamperCaseBodyAnimationService.ts)
```typescript
// 1. Scene Root 확인
if (!this.sceneRoot) {
    console.error('Scene Root가 설정되지 않았습니다.');
    return null;
}

// 2. 노드 이름 가져오기
const damperCaseBodyNodeName = this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCaseBody');
if (!damperCaseBodyNodeName) {
    console.error('댐퍼 케이스 바디 노드 이름을 찾을 수 없습니다.');
    return null;
}

// 3. 메타데이터 설정 가져오기
const animationConfig = this.metadataLoader.getDamperCaseBodyAnimationConfig(damperCaseBodyNodeName);
if (!animationConfig) {
    console.error('댐퍼 케이스 바디 애니메이션 설정을 찾을 수 없습니다.');
    return null;
}
```
**검증 항목:**
- Scene Root가 설정되었는지
- 노드 이름이 존재하는지
- 메타데이터 설정이 존재하는지
### 2-2. 옵션 병합 단계 (DamperCaseBodyAnimationService.ts)
```typescript
const mergedOptions = {
    duration: animationConfig.duration,      // 메타데이터 기본값: 1000ms
    easing: animationConfig.easing,          // 메타데이터 기본값: 'power2.inOut'
    onComplete: options.onComplete          // 호출 시 전달된 콜백
};
```
### 2-3. 노드 검색 및 현재 위치 확인 단계 (DamperCaseBodyAnimationService.ts)
```typescript
// 노드 찾기
const damperCaseBodyNode = this.sceneRoot.getObjectByName(damperCaseBodyNodeName);
if (!damperCaseBodyNode) {
    console.error(`댐퍼 케이스 바디 노드를 찾을 수 없습니다: ${damperCaseBodyNodeName}`);
    return null;
}

// 현재 위치 확인
const damperCaseBodyCurrentPosition = new THREE.Vector3();
damperCaseBodyNode.getWorldPosition(damperCaseBodyCurrentPosition);
```
### 2-4. 타겟 위치 계산 단계 (DamperCaseBodyAnimationService.ts)
```typescript
// 오프셋 적용
const offset = new THREE.Vector3(
    animationConfig.offset?.x || 0,  // 메타데이터: 1
    animationConfig.offset?.y || 0,  // 메타데이터: 0
    animationConfig.offset?.z || 0   // 메타데이터: 0
);

// 로컬 오프셋을 월드 좌표로 변환
damperCaseBodyNode.updateMatrixWorld();
targetPosition = damperCaseBodyNode.localToWorld(offset.clone());

// 월드 타겟 좌표를 부모의 로컬 좌표계로 변환
const localTargetPosition = targetPosition.clone();
const parent = damperCaseBodyNode.parent;
if (parent) {
    parent.updateMatrixWorld();
    parent.worldToLocal(localTargetPosition);
}
```
**좌표 변환 과정:**
1. **로컬 오프셋** → **월드 좌표**: `localToWorld()` 메서드 사용
2. **월드 좌표** → **부모 로컬 좌표**: `worldToLocal()` 메서드 사용
### 2-5. GSAP 애니메이션 실행 단계 (DamperCaseBodyAnimationService.ts)
```typescript
return new Promise((resolve) => {
    gsap.to(damperCaseBodyNode.position, {
        x: localTargetPosition.x,
        y: localTargetPosition.y,
        z: localTargetPosition.z,
        duration: mergedOptions.duration / 1000,  // ms를 초로 변환
        ease: mergedOptions.easing,
        onComplete: () => {
            console.log('댐퍼 케이스 바디 선형 이동 애니메이션 완료');
            
            // 완료 콜백 실행
            if (mergedOptions.onComplete) {
                mergedOptions.onComplete();
            }
            
            // 결과 반환
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
## 3. 메타데이터 설정
### 3-1. assembly-offsets.json 설정
```json
"damperCaseBodyAnimations": {
    "linearMovement": {
        "method": "screwPositionBased",
        "targetScrewNode": "fridge.leftDoorDamper.screw2Customized",
        "offset": {
            "x": 1,
            "y": 0,
            "z": 0
        },
        "duration": 1000,
        "easing": "power2.inOut",
        "stages": [
            {
                "name": "approach",
                "progress": 0.3,
                "description": "screw2Customized 위치로 접근"
            },
            {
                "name": "movement",
                "progress": 0.7,
                "description": "선형 이동 실행"
            },
            {
                "name": "complete",
                "progress": 1.0,
                "description": "이동 완료"
            }
        ]
    }
}
```
### 3-2. 설정 파라미터 설명
| 파라미터              | 값                                        | 설명                   |
| ----------------- | ---------------------------------------- | -------------------- |
| `method`          | `screwPositionBased`                     | 스크류 위치 기반 방식         |
| `targetScrewNode` | `fridge.leftDoorDamper.screw2Customized` | 타겟 스크류 노드            |
| `offset.x`        | `1`                                      | X축 방향 오프셋 (힌지 반대 방향) |
| `offset.y`        | `0`                                      | Y축 방향 오프셋            |
| `offset.z`        | `0`                                      | Z축 방향 오프셋            |
| `duration`        | `1000`                                   | 애니메이션 지속 시간 (ms)     |
| `easing`          | `power2.inOut`                           | 이징 함수                |
## 4. 전체 동작 플로우
```
┌─────────────────────────────────────────────────────────────┐
│ 1. 초기화 및 검증                                              │
│    - Scene Root 확인                                          │
│    - 노드 이름 가져오기                                        │
│    - 메타데이터 설정 가져오기                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 옵션 병합                                                  │
│    - duration: 1000ms                                        │
│    - easing: 'power2.inOut'                                  │
│    - onComplete 콜백 설정                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 노드 검색 및 현재 위치 확인                                │
│    - damperCaseBodyNode 검색                                 │
│    - 현재 월드 위치 저장                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 타겟 위치 계산                                             │
│    - 오프셋 벡터 생성 (1, 0, 0)                               │
│    - 로컬 오프셋 → 월드 좌표 변환                             │
│    - 월드 좌표 → 부모 로컬 좌표 변환                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. GSAP 애니메이션 실행                                       │
│    - position 속성에 대해 GSAP 애니메이션 적용                 │
│    - duration: 1초                                           │
│    - ease: 'power2.inOut'                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. 완료 처리                                                  │
│    - onComplete 콜백 실행                                    │
│    - 결과 객체 반환 (position, duration, easing)             │
└─────────────────────────────────────────────────────────────┘
```
## 5. AnimatorAgent에서의 호출
### 5-1. 호출 코드 (AnimatorAgent.ts)
```typescript
// damperCaseBody 힌지 반대 방향으로 선형이동 실행
if (this.damperCaseBodyAnimationService) {
    try {
        console.log('damperCaseBody 힌지 반대 방향으로 선형이동 시작!!!');

        // 애니메이션 실행
        const animationResult = await this.damperCaseBodyAnimationService.animateDamperCaseBodyLinearMove({
            duration: 1000,
            easing: 'power2.inOut',
            onComplete: () => {
                console.log('damperCaseBody 힌지 반대 방향으로 선형이동 완료!!!');
            }
        });

        // 애니메이션 히스토리 기록
        if (animationResult && this.animationHistoryService) {
            const animationCommand = {
                door: commandsArray[0].door,
                action: AnimationAction.DAMPER_CASE_BODY_MOVE,
                degrees: 0,
                speed: 1,
                position: animationResult.position,
                easing: animationResult.easing,
                duration: animationResult.duration
            };
            const animationMessage = 'damperCaseBody 힌지 반대 방향으로 선형이동 완료';
            this.animationHistoryService.addAnimationHistory(animationCommand, animationMessage);
        }
    } catch (error) {
        console.error('damperCaseBody 힌지 반대 방향으로 선형이동 실행 중 에러:', error);
    }
}
```
### 5-2. 호출 시점
- 냉장고 문이 열린 후
- 카메라가 댐퍼 위치로 이동한 후
- 댐퍼 커버 조립이 완료된 후
- 스크류 분리 애니메이션이 완료된 후
## 6. 기술적 특징
### 6-1. 좌표계 변환
- **로컬 오프셋 기반**: 노드의 로컬 좌표계를 기준으로 오프셋 적용
- **월드 좌표 변환**: `localToWorld()`를 통해 월드 좌표로 변환
- **부모 로컬 좌표 변환**: `worldToLocal()`을 통해 부모의 로컬 좌표계로 변환
### 6-2. GSAP 활용
- **부드러운 이징**: `power2.inOut` 이징 함수로 자연스러운 움직임
- **Promise 기반**: 비동기 애니메이션 처리
- **콜백 지원**: 완료 시점에 추가 작업 수행 가능
### 6-3. 메타데이터 기반 설정
- **유연한 설정**: JSON 파일을 통해 애니메이션 파라미터 관리
- **캐싱 지원**: MetadataLoader에서 설정 캐싱
- **확장성**: 새로운 애니메이션 추가 시 메타데이터만 수정
## 7. 주의사항
### 7-1. 필수 전제 조건
1. **Scene Root 설정**: `setSceneRoot()`가 먼저 호출되어야 함
2. **메타데이터 로딩**: `assembly-offsets.json`이 로딩되어야 함
3. **노드 존재**: 대상 노드가 씬 내에 존재해야 함
### 7-2. 오류 처리
- Scene Root 미설정 시 `null` 반환
- 노드 이름 미존재 시 `null` 반환
- 메타데이터 설정 미존재 시 `null` 반환
- 노드 검색 실패 시 `null` 반환
### 7-3. 성능 고려사항
- `updateMatrixWorld()` 호출로 최신 행렬 상태 보장
- GSAP의 내부 최적화 활용
- 메타데이터 캐싱으로 반복 로딩 방지
