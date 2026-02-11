# DamperCoverAssemblyService.ts assembleDamperCover 함수 틸팅 효과 구현

## 수정된 코드 위치
`src/services/fridge/DamperCoverAssemblyService.ts` - `assembleDamperCover` 함수 (라인 159-183)

## 주요 변경 사항

### 기존 코드 (단순 선형 이동)
```typescript
// GSAP 선형 이동 애니메이션
const duration = options?.duration;

if (!duration) {
    return null;
}

const easing = 'power2.inOut';

await new Promise<void>((resolve) => {
    gsap.to(coverNode.position, {
        x: targetLocalPos.x,
        y: targetLocalPos.y,
        z: targetLocalPos.z,
        duration: duration / 1000,
        ease: easing,
        onComplete: () => {
            console.log('커버 노드 이동 완료');
            if (options?.onComplete) options.onComplete();
            resolve();
        }
    });
});
```

### 수정된 코드 (틸팅 효과 포함 3단계 애니메이션)
```typescript
// GSAP Timeline을 사용한 틸팅 효과 포함 애니메이션
// 돌출부 쪽을 힌지로 삼아 반대쪽(먼 쪽)을 들어 올리는 효과
const duration = options?.duration;

if (!duration) {
    return null;
}

const easing = 'power2.inOut';
const durationSec = duration / 1000;

// 힌지(돌출부)와 반대쪽(먼 쪽)의 거리 계산
const coverBox = getPreciseBoundingBox(coverNode);
const coverSize = new THREE.Vector3();
coverBox.getSize(coverSize);
const coverCenter = new THREE.Vector3();
coverBox.getCenter(coverCenter);

// 돌출부(플러그)와 커버 중심 사이의 벡터 계산
const plugToCoverCenter = new THREE.Vector3().subVectors(coverCenter, bestPlug.position);
const hingeToFarDistance = plugToCoverCenter.length();

// 틸팅 회전축 계산 (플러그와 홈을 연결하는 선에 수직인 방향)
const plugToHole = new THREE.Vector3().subVectors(bestHole.position, bestPlug.position).normalize();
const worldUp = new THREE.Vector3(0, 1, 0);
const tiltAxis = new THREE.Vector3().crossVectors(plugToHole, worldUp).normalize();

// 틸팅 각도 계산 (거리에 비례)
const tiltAngle = Math.min(Math.PI / 6, hingeToFarDistance * 2); // 최대 30도

// GSAP Timeline 생성
const tl = gsap.timeline({
    onComplete: () => {
        console.log('커버 노드 틸팅 이동 완료');
        if (options?.onComplete) options.onComplete();
    }
});

// 1단계: 돌출부 쪽을 힌지로 삼아 반대쪽을 들어 올리는 틸팅 애니메이션
tl.to(coverNode.rotation, {
    x: coverNode.rotation.x + tiltAxis.x * tiltAngle,
    y: coverNode.rotation.y + tiltAxis.y * tiltAngle,
    z: coverNode.rotation.z + tiltAxis.z * tiltAngle,
    duration: durationSec * 0.4,
    ease: 'power2.out'
});

// 2단계: 틸팅 상태에서 선형 이동 (돌출부가 홈으로 향함)
tl.to(coverNode.position, {
    x: targetLocalPos.x,
    y: targetLocalPos.y,
    z: targetLocalPos.z,
    duration: durationSec * 0.6,
    ease: easing
}, "<"); // 회전과 동시에 시작하여 자연스러운 틸팅 이동

// 3단계: 최종 위치에서 회전 복원 (정렬)
tl.to(coverNode.rotation, {
    x: coverNode.rotation.x,
    y: coverNode.rotation.y,
    z: coverNode.rotation.z,
    duration: durationSec * 0.3,
    ease: 'power2.in'
});

await new Promise<void>((resolve) => {
    tl.eventCallback('onComplete', () => resolve());
});
```

## 구현된 틸팅 효과 설명

### 1단계: 틸팅 시작 (40% 시간)
- 돌출부(플러그) 쪽을 힌지로 삼아 반대쪽(먼 쪽)을 들어 올리는 회전 애니메이션
- `tiltAxis`를 계산하여 적절한 회전축 설정
- `tiltAngle`은 힌지에서 먼 쪽까지의 거리에 비례하여 최대 30도로 제한

### 2단계: 틸팅 상태 이동 (60% 시간)
- 틸팅된 상태에서 선형 이동 수행
- `"<"` 파라미터로 회전과 동시에 시작하여 자연스러운 틸팅 이동 효과
- 돌출부가 홈으로 향하면서 반대쪽이 들려있는 상태 유지

### 3단계: 회전 복원 (30% 시간)
- 최종 위치에 도달한 후 회전 복원
- 정확한 정렬을 위해 원래 회전값으로 복귀

## 참고 문서
- `assembly-node-removal-3-stage-animation-plan.md` - 3단계 애니메이션 구현 계획 참조
