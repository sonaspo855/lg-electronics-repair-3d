---
trigger: always_on
---

# (Ref) camera-direction-variation-despite-same-command-and-initial-position.md

---
tags:
상태: Ref
중요:
생성일: 26-01-23T09:20:40
수정일: 26-01-23T09:51:50
종료일:
라벨:
  - 냉장고
  - 카메라
---
## 0. 참고 레퍼런스
- 
##  ■■ Description ■■
- 동일한 LLM 명령과 동일한 카메라 위치에서 시작함에도 불구하고 
  결과가 달라지는 현상(Non-deterministic behavior)은 
  주로 **카메라의 '오른쪽 벡터(Right Vector)' 계산 방식**과 
  **객체의 '월드 행렬(World Matrix)' 업데이트 타이밍**에서 발생한다.
## 1. 원인 분석
1. **카메라 상대 좌표 기반의 오프셋 계산 (가장 유력)**: 
	- `zoomTo` 함수 내에서 객체를 화면 왼쪽에 배치하기 위해 오프셋을 적용할 때, 
	  현재 카메라의 `matrix`나 `up` 벡터를 기준으로 '오른쪽'을 계산한다면, 
	  미세한 초기 각도 차이가 결과값에 누적되어 `right.png`처럼 객체가 밀려 보이는 현상이 발생한다.
2. **도어 애니메이션과의 동기화 문제**: 
	- 도어가 열리는 도중에 `getPreciseBoundingBox`가 호출되면, 
	  계산된 `targetCenter`가 문이 완전히 열린 후의 중심점이 아닌 
	  '이동 중인 상태'의 중심점이 되어 카메라 타겟이 어긋나게 됩니다.
3. **CameraControls의 Damping 간섭**: 
	- `cameraControls`의 `damping`이 활성화된 상태에서 GSAP이 좌표를 강제로 업데이트하면, 
	  컨트롤러가 자체적으로 보간(interpolation)을 시도하면서 
	  최종 목적지에 도달하지 못하고 튕기거나 밀리는 현상이 발생할 수 있습니다.
## 2. 샘플 코드
```tsx
// CameraMovementService.ts

public async zoomTo(
    zoomRatio: number,
    options: CameraMoveOptions = {}
): Promise<void> {
    const camera = this.cameraControls.camera || this.cameraControls.object;
    if (!camera) return;

    // [필수] 애니메이션 시작 전 최신 월드 행렬 강제 업데이트
    this.sceneRoot?.updateMatrixWorld(true);
    const targetBox = getPreciseBoundingBox(this.sceneRoot!);
    const targetCenter = new THREE.Vector3();
    targetBox.getCenter(targetCenter);

    const fixedDirection = options.direction || new THREE.Vector3(1, 0.5, 1).normalize();
    const currentDistance = camera.position.distanceTo(targetCenter);
    const targetDistance = currentDistance / zoomRatio;

    // [개선] 현재 카메라의 방향이 아닌, '고정된 시점' 기준의 오른쪽 벡터 계산
    // 월드 Up(0, 1, 0)과 fixedDirection을 외적하여 항상 일관된 가로 오프셋 방향 산출
    const worldUp = new THREE.Vector3(0, 1, 0);
    const sideVector = new THREE.Vector3().crossVectors(fixedDirection, worldUp).normalize();
    
    // 객체를 화면 왼쪽에 두기 위해 타겟(시선)을 오른쪽으로 이동 (값은 바운딩 박스 크기에 비례 권장)
    const boxSize = new THREE.Vector3();
    targetBox.getSize(boxSize);
    const horizontalOffset = sideVector.multiplyScalar(boxSize.x * 0.5); 

    const finalTarget = targetCenter.clone().add(horizontalOffset);
    const targetPos = finalTarget.clone().add(fixedDirection.clone().multiplyScalar(targetDistance));

    // GSAP 실행 전 Damping 일시 정지
    const originalDamping = this.cameraControls.enableDamping;
    this.cameraControls.enableDamping = false;

    return new Promise((resolve) => {
        gsap.to(camera.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration: (options.duration || 1000) / 1000,
            ease: options.easing || 'power3.inOut',
            onUpdate: () => {
                this.cameraControls.target.copy(finalTarget);
                this.cameraControls.update();
            },
            onComplete: () => {
                this.cameraControls.enableDamping = originalDamping;
                resolve();
            }
        });
    });
}
```