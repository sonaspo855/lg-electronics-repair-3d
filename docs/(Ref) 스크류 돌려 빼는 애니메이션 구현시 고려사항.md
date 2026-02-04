---
tags:
상태: Updated
중요:
생성일: 26-02-03T16:34:09
수정일: 26-02-03T23:50:00
종료일:
라벨:
summary:
---

## 0. 참고 레퍼런스
- `src/services/fridge/ScrewAnimationService.ts` (구현된 파일)
- `src/services/fridge/ManualAssemblyManager.ts` (구현된 파일)
- `src/components/shared/viewer/NodeHierarchy.tsx` (isFastener() 함수 참고)

## 1. 구현 현황 요약

### ✅ 계획서대로 잘 구현된 부분

| 항목 | 상태 | 설명 |
|------|------|------|
| 싱글톤 패턴 | ✅ | `getScrewAnimationService()` 함수 구현 |
| GSAP Timeline | ✅ | `gsap.timeline()` 사용 |
| 나사산 간격 계산 | ✅ | `(rotationAngle / 360) * screwPitch` 공식 적용 |
| isScrewNode() | ✅ | `/screw|bolt/i.test()` 패턴 활용 |
| 애니메이션 제어 | ✅ | pause, resume, reverse 구현 |
| ManualAssemblyManager 연동 | ✅ | loosenScrew() 메서드 추가 |
| 초기화/정리 | ✅ | initialize(), dispose() 구현 |

## 2. 개선이 필요한 부분

### ⚠️ 문제점 1: pullDistance 옵션 미사용

**현재 코드 (line 70):**
```typescript
const translationDistance = (config.rotationAngle / 360) * config.screwPitch;
```

**문제점:**
- 계획서에는 `pullDistance` 옵션이 정의되어 있으나 실제 코드에서 사용되지 않음
- `pullDistance`와 `screwPitch` 기반 계산 중 하나만 사용해야 함

**해결 방안:**
- `pullDistance`를 우선 사용하고, `pullDistance`가 없으면 `screwPitch` 기반으로 계산
- 또는 `pullDistance` 옵션을 제거하고 `screwPitch` 기반으로 통일

### ⚠️ 문제점 2: 애니메이션 재호출 시 기존 timeline 처리 부재

**현재 코드 (line 72):**
```typescript
this.timeline = gsap.timeline({...});
```

**문제점:**
- 새 애니메이션 시작 시 기존 timeline을 `kill()`하지 않음
- 메모리 누수 발생 가능
- 기존 애니메이션이 강제로 중단되지 않아 예상치 못한 동작 발생 가능

**해결 방안:**
```typescript
// 새 애니메이션 시작 전 기존 timeline 정리
if (this.timeline) {
    this.timeline.kill();
    this.timeline = null;
}
this.timeline = gsap.timeline({...});
```

### ⚠️ 문제점 3: isFastener() 함수 중복 구현

**현재 코드:**
- `NodeHierarchy.tsx:845`에 `isFastener(node: THREE.Object3D): boolean` 존재
- `ScrewAnimationService.ts:38`에 `isScrewNode(nodeName: string): boolean` 별도 구현

**문제점:**
- 동일한 정규식 로직이 두 곳에 중복
- 유지보수성 저하

**해결 방안:**
- `NodeHierarchy.tsx`의 `isFastener` 함수를 `shared/utils`로 이동하여 재사용
- 또는 `ScrewAnimationService`에서 `node.name`만 전달받아 동일한 로직 사용

### ⚠️ 문제점 4: 회전축(Z) 하드코딩

**현재 코드 (line 88-92):**
```typescript
this.timeline.to(node.rotation, {
    z: -config.rotationAngle * (Math.PI / 180),
    ...
}, 0);
```

**문제점:**
- 모든 나사가 Z축 회전이라는 보장이 없음
- 모델마다 회전축이 다를 수 있음

**해결 방안:**
```typescript
export interface ScrewAnimationOptions {
    // ... 기존 옵션
    rotationAxis?: 'x' | 'y' | 'z'; // 기본값: 'z'
}

// 사용 시
const axis = config.rotationAxis || 'z';
this.timeline.to(node.rotation, {
    [axis]: -config.rotationAngle * (Math.PI / 180),
    ...
}, 0);
```

## 3. 수정된 구현 계획

### 3-1. ScrewAnimationService.ts 수정사항

```typescript
export interface ScrewAnimationOptions {
    duration?: number;           // 전체 애니메이션 시간 (ms)
    rotationAngle?: number;      // 회전 각도 (도, 기본값: 720도 = 2바퀴)
    pullDistance?: number;       // 빼내는 거리 (m, 기본값: 0.02m = 2cm)
    screwPitch?: number;         // 나사산 간격 (m, 기본값: 0.005m = 0.5cm)
    rotationAxis?: 'x' | 'y' | 'z'; // 회전축 (기본값: 'z')
    onComplete?: () => void;    // 완료 콜백
    onProgress?: (progress: number) => void; // 진행률 콜백
}

public async animateScrewRotation(
    nodeName: string,
    options: ScrewAnimationOptions = {}
): Promise<void> {
    // 기존 timeline 정리 (추가)
    if (this.timeline) {
        this.timeline.kill();
        this.timeline = null;
    }

    const config = {
        duration: options.duration || 1500,
        rotationAngle: options.rotationAngle || 720,
        screwPitch: options.screwPitch || 0.005,
        rotationAxis: options.rotationAxis || 'z',
        ...options
    };

    // pullDistance 우선 사용, 없으면 screwPitch 기반으로 계산
    let translationDistance: number;
    if (config.pullDistance !== undefined) {
        translationDistance = config.pullDistance;
    } else {
        translationDistance = (config.rotationAngle / 360) * config.screwPitch;
    }

    // ... 기존 코드

    const axis = config.rotationAxis;
    this.timeline.to(node.rotation, {
        [axis]: -config.rotationAngle * (Math.PI / 180),
        duration: config.duration / 1000,
        ease: 'power2.inOut'
    }, 0);

    this.timeline.to(node.position, {
        z: node.position.z + translationDistance, // Z축 방향으로 이동
        duration: config.duration / 1000,
        ease: 'power2.inOut'
    }, 0);
}
```

### 3-2. isFastener() 함수 재사용 권장方案

** Option A: shared/utils/isFastener.ts로 분리**
```typescript
// src/shared/utils/isFastener.ts
export function isFastenerNodeName(nodeName: string): boolean {
    return /screw|bolt/i.test(nodeName);
}

export function isFastenerNode(node: THREE.Object3D): boolean {
    return isFastenerNodeName(node.name || '');
}

// 사용
import { isFastenerNodeName } from '../../shared/utils/isFastener';
```

**Option B: NodeHierarchy.tsx에서 직접 import**
```typescript
import { isFastenerNodeName } from '@/shared/utils/isFastener';

// ScrewAnimationService.ts에서
public isScrewNode(nodeName: string): boolean {
    return isFastenerNodeName(nodeName);
}
```

## 4. 좌표계 및 회전 방향 고려사항

### 4-1. 회전축 결정 기준

| 상황 | 권장 회전축 | 설명 |
|------|------------|------|
| 일반적인 측면 나사 | Z축 | 모델의 수평면에서 돌리는 나사 |
| 수직 방향 나사 | X축 또는 Y축 | 위아래로 체결된 나사 |
| 커스텀 모델 | 메타데이터 기반 | 모델별 axis 정보 로드 |

### 4-2. 회전 방향 (나사 종류에 따라 다름)

- **오른나사 (Standard)**: 시계 방향 → 음수 각도
- **왜나사 (Reverse)**: 반시계 방향 → 양수 각도

```typescript
// 나사 종류에 따른 방향 설정
const screwType = options.screwType || 'standard'; // 'standard' | 'reverse'
const direction = screwType === 'standard' ? -1 : 1;
const finalAngle = direction * config.rotationAngle;
```

### 4-3. 이동 방향

- 나사를 빼내는 방향은 **회전축의 양수/음수 방향**과 무관하게 **"밖으로"** 향해야 함
- 일반적으로 Z축 양수 방향이 "앞으로 뺀다"는 직관적 해석에 맞음

## 5. 테스트 검증 체크리스트

### 5-1. 기능 테스트

- [ ] Screw 노드 선택 후 "Pull Out" 버튼 클릭 시 회전+이동 동시 수행
- [ ] 일반 노드는 기존 이동 애니메이션대로 동작
- [ ] pause/resume/reverse 컨트롤 정상 동작
- [ ] 애니메이션 재호출 시 기존 애니메이션 정상 종료

### 5-2. 다양한 Screw 타입 테스트

| Screw 타입 | 회전축 | 회전 방향 | 이동 거리 계산 |
|------------|--------|----------|---------------|
| 측면 나사 | Z | 음수 | screwPitch 기반 |
| 수직 나사 | Y | 음수 | screwPitch 기반 |
| 왜나사 | Z | 양수 | screwPitch 기반 |

### 5-3. 성능 테스트

- [ ] 연속 애니메이션 호출 시 메모리 누수 없음 확인
- [ ] 10개 이상의 Screw 순차 애니메이션 성능 확인

## 6. 사용 예시 (수정됨)

### 6-1. 기본 사용

```typescript
const screwService = getScrewAnimationService();
screwService.initialize(sceneRoot);

// 기본값 사용 (Z축, 720도 회전, 0.5cm 이동)
await screwService.animateScrewRotation('leftDoorScrew1');
```

### 6-2. 커스텀 옵션 사용

```typescript
await screwService.animateScrewRotation('leftDoorScrew1', {
    duration: 2000,           // 2초
    rotationAngle: 1440,       // 4바퀴
    pullDistance: 0.03,        // 3cm 이동 (screwPitch보다 우선)
    rotationAxis: 'z',          // Z축 회전
    onComplete: () => {
        console.log('Screw 제거 완료');
    }
});
```

### 6-3. ManualAssemblyManager 사용

```typescript
const manager = getManualAssemblyManager();
manager.initialize(sceneRoot);

// Screw 제거
await manager.loosenScrew('leftDoorScrew1', {
    duration: 1500,
    rotationAngle: 720,
    screwPitch: 0.005
});
```

## 7. 결론 및 권장사항

1. **pullDistance 옵션 처리**: 명시적으로 처리하여 혼란 방지
2. **애니메이션 lifecycle 관리**: 새 애니메이션 시작 전 기존 timeline 정리 필수
3. **회전축 동적 설정**: 하드코딩된 Z축을 옵션으로 변경하여 유연성 확보
4. **isFastener() 함수 공유**: 중복 제거를 위해 shared 모듈로 분리 권장
5. **테스트 케이스 확장**: 다양한 나사 타입과 회전축에 대한 테스트 필수

