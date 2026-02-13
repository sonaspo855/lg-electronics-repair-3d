### CameraMovementService 리팩토링 및 공통화 결과

`camera-movement-refactor-plan.md` 계획에 따라 `CameraMovementService`의 복잡한 연산 로직을 `animationUtils.ts`로 이관하고 서비스를 슬림화했습니다.

#### 주요 수정 사항

**1. `animationUtils.ts`: `CinematicSequence` 및 타겟 계산 확장**
```typescript
// CinematicSequence에 컨트롤 연동 및 UP 벡터 보간 추가
export class CinematicSequence {
    // ...
    addBezierPath(params: {
        start: THREE.Vector3;
        control: THREE.Vector3;
        end: THREE.Vector3;
        upTransition?: {
            startUp: THREE.Vector3;
            nodeY: THREE.Vector3;
            targetCenter: THREE.Vector3;
        };
        // ...
    }): this {
        // 베지에 곡선 이동 및 UP 벡터 Lerp 연산 로직 흡수
    }
}

// 타겟 위치 및 거리 통합 계산
export const calculateCameraTargetPosition = (
    camera: THREE.PerspectiveCamera,
    targetBox: THREE.Box3,
    options: CameraTargetOptions = {}
) => {
    // 거리, 방향, 최종 목적지(position)를 객체로 반환
};
```

**2. `CameraMovementService.ts`: 서비스 로직 슬림화**
```typescript
public async moveCameraCinematic(nodeName: string, options: CameraMoveOptions = {}): Promise<void> {
    const targetNode = this.getNodeByName(nodeName);
    // ... 기초 데이터 준비 ...

    // 1. 유틸리티를 통한 타겟 및 목적지 계산
    const { position: endPos } = calculateCameraTargetPosition(camera, targetBox, {
        zoomRatio: options.zoomRatio || 1.2,
        distance: options.distance,
        direction: direction
    });

    // 2. 시퀀스 빌더를 이용한 애니메이션 실행 (복잡한 수학 로직 제거)
    const sequence = new CinematicSequence();
    await sequence.setCamera(camera, this.cameraControls)
            .setTarget(targetCenter)
            .addBezierPath({
                start: startPos,
                control: controlPos,
                end: endPos,
                upTransition: upTransition,
                duration: options.duration || 2500,
                easing: options.easing || 'power3.inOut',
                onUpdate: options.onProgress
            }).play();

    // 3. 후처리 비즈니스 로직만 수행
    this.applyLeftDoorHighlights();
}
```

#### 기대 효과
- **코드 슬림화**: `moveCameraCinematic` 내의 복잡한 베지에 및 UP 벡터 연산이 제거되어 가독성이 높아졌습니다.
- **재사용성**: `CinematicSequence`가 독립적으로 강화되어, 추후 다른 시나리오에서도 시네마틱한 카메라 워킹을 즉시 재사용할 수 있습니다.
- **유지보수**: 카메라 이동 알고리즘 수정 시 `animationUtils.ts` 한 곳만 관리하면 됩니다.
