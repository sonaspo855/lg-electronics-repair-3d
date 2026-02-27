---
tags:
상태: Todo
중요:
생성일: 26-01-30T16:18:38
수정일: 26-02-19T08:33:11
종료일:
라벨:
  - 냉장고
  - codeRef
---
## 0. 참고 레퍼런스
- 
##  ■■ Description ■■
- `moveCamera` 함수는 `DamperServiceOrchestrator.ts:122`에 정의된 메서드로, **도어 열림 후 댐퍼 위치로 카메라를 이동**시키는 기능을 담당한다.
## 1. 함수 호출 흐름
```
DamperServiceOrchestrator.execute()
    └── moveCamera()                                    // Line 122-150
        └── cameraMovementService.moveCameraToLeftDoorDamper()  // CameraMovementService.ts:44
            └── moveCameraCinematic()                   // CameraMovementService.ts:58
                └── CinematicSequence.addBezierPath()   // animationUtils.ts:121
                    └── GSAP Timeline 실행              // animationUtils.ts:261
```
## 2. moveCamera 함수 상세 분석
### 2.1 함수 시그니처 및 위치
- **파일**: `src/services/orchestration/DamperServiceOrchestrator.ts`
### 2.2 함수 구현 코드
```typescript
private async moveCamera(): Promise<void> {
    console.log('Moving camera to left door damper');
    
    // 1. 메타데이터에서 카메라 설정 로드
    const cameraSettings = this.metadataLoader.getCameraSettings('damperService');

    // 2. 카메라 옵션 객체 생성
    const cameraOptions: any = {
        duration: cameraSettings?.duration,
        easing: cameraSettings?.easing,
        distance: cameraSettings?.distance
    };

    // 3. direction 설정이 있으면 Vector3로 변환
    if (cameraSettings?.direction) {
        cameraOptions.direction = new THREE.Vector3(
            cameraSettings.direction.x,
            cameraSettings.direction.y,
            cameraSettings.direction.z
        ).normalize();
    }

    // 4. 카메라 이동 실행
    await this.cameraMovementService.moveCameraToLeftDoorDamper(cameraOptions);

    // 5. 애니메이션 히스토리 기록
    this.recordAnimationHistory(
        AnimationAction.CAMERA_MOVE,
        DoorType.TOP_LEFT,
        cameraOptions,
        'Camera moved to damper position'
    );
}
```
### 2.3 동작 순서
| 순서  | 동작        | 설명                                                                   |
| --- | --------- | -------------------------------------------------------------------- |
| 1   | 메타데이터 로드  | `metadataLoader.getCameraSettings('damperService')` 호출하여 카메라 설정값 가져옴 |
| 2   | 옵션 객체 생성  | duration, easing, distance 값을 옵션 객체에 설정                              |
| 3   | 방향 벡터 변환  | direction 설정이 있는 경우 `THREE.Vector3` 객체로 변환 및 정규화                     |
| 4   | 카메라 이동 실행 | `moveCameraToLeftDoorDamper()` 호출하여 실제 카메라 이동 수행                     |
| 5   | 히스토리 기록   | 애니메이션 완료 후 히스토리 서비스에 기록                                              |
## 3. moveCameraToLeftDoorDamper 함수 분석
### 3.1 함수 시그니처 및 위치
- **파일**: `src/services/camera/CameraMovementService.ts`
### 3.2 함수 구현 코드
```typescript
public async moveCameraToLeftDoorDamper(options: CameraMoveOptions = {}): Promise<void> {
    return this.moveCameraCinematic(LEFT_DOOR_NODES[0], {
        duration: options.duration,
        direction: options.direction,
        zoomRatio: options.zoomRatio,
        easing: options.easing,
        ...options
    });
}
```
### 3.3 동작 설명
- `LEFT_DOOR_NODES[0]` (댐퍼 커버 바디 노드)를 타겟으로 지정
- 전달받은 옵션을 그대로 `moveCameraCinematic`에 전달
## 4. moveCameraCinematic 함수 분석 (핵심 로직)
### 4.1 함수 시그니처 및 위치
- **파일**: `src/services/camera/CameraMovementService.ts`
### 4.2 동작 순서 상세
#### Step 1: 타겟 노드 검색 (CameraMovementService.ts)
```typescript
const targetNode = this.getNodeByName(nodeName);
if (!targetNode) {
    console.error('Target node not found:', nodeName);
    return;
}
```
- `sceneRoot.getObjectByName()`을 통해 타겟 노드 검색
#### Step 2: 카메라 객체 확인 (CameraMovementService.ts)
```typescript
const camera = this.cameraControls.camera || this.cameraControls.object;
if (!camera) {
    console.error('Camera not found');
    return;
}
```
#### Step 3: 타겟 바운딩 박스 및 중심점 계산 (CameraMovementService.ts)
```typescript
const targetBox = getPreciseBoundingBox(targetNode);
const targetCenter = new THREE.Vector3();
targetBox.getCenter(targetCenter);
const size = new THREE.Vector3();
targetBox.getSize(size);
const maxDim = Math.max(size.x, size.y, size.z);
```
- `getPreciseBoundingBox()` 함수로 정밀한 바운딩 박스 계산
- 중심점과 크기 추출
#### Step 4: 목적지 방향 결정 (CameraMovementService.ts)
```typescript
let direction = options.direction || new THREE.Vector3(0, -1, 0);
const damperCoverBodyNode = this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody');

if (nodeName === damperCoverBodyNode && !options.direction) {
    direction = new THREE.Vector3(0.5, -1, 0.5).normalize();
}
```
- 기본 방향: `(0, -1, 0)` (아래쪽)
- 댐퍼 커버 바디인 경우: `(0.5, -1, 0.5).normalize()` (사선 방향)
#### Step 5: 목적지 및 거리 계산 (CameraMovementService.ts)
```typescript
const { position: endPos, distance: zoomDistance } = calculateCameraTargetPosition(camera, targetBox, {
    zoomRatio: options.zoomRatio || 1.2,
    distance: options.distance,
    direction: direction
});
```
- `calculateCameraTargetPosition()` 함수로 최종 카메라 위치 계산
- FOV와 객체 크기를 기반으로 적절한 거리 계산
#### Step 6: 시작 위치 및 상태 저장 (CameraMovementService.ts)
```typescript
const startPos = camera.position.clone();
const startTarget = this.cameraControls.target.clone();

// 거리 체크 (너무 가까우면 즉시 이동)
if (startPos.distanceToSquared(endPos) < 0.0001) {
    camera.position.copy(endPos);
    this.cameraControls.target.copy(targetCenter);
    this.cameraControls.update();
    return;
}
```
#### Step 7: 제어점 계산 - L자형 곡선 (CameraMovementService.ts)
```typescript
const controlPos = new THREE.Vector3(
    (startPos.x + endPos.x) / 2,
    Math.max(startPos.y, endPos.y) + Math.max(size.y, maxDim) * 0.3,
    (startPos.z + endPos.z) / 2
);
```
- **Quadratic Bezier Curve**를 위한 제어점 계산
- 시작점과 끝점의 중간 위치하되, Y축은 더 높게 설정하여 곡선 형성
#### Step 8: 노드 월드 회전 추출 (CameraMovementService.ts)
```typescript
const nodeQuat = new THREE.Quaternion();
targetNode.getWorldQuaternion(nodeQuat);
const nodeY = new THREE.Vector3(0, 1, 0).applyQuaternion(nodeQuat);
```
- UP 벡터 계산을 위한 노드의 월드 회전값 추출
#### Step 9: 시네마틱 시퀀스 실행 (CameraMovementService.ts)
```typescript
const sequence = new CinematicSequence();
sequence.setCamera(camera, this.cameraControls)
    .setTarget(targetCenter);

// Damping 비활성화
const originalDamping = this.cameraControls.enableDamping;
const originalSmoothTime = this.cameraControls.smoothTime;
this.cameraControls.enableDamping = false;
this.cameraControls.smoothTime = 0;

// 카메라 UP 벡터 초기화
camera.up.set(0, 1, 0);

await sequence.addBezierPath({
    start: startPos,
    control: controlPos,
    end: endPos,
    upTransition: upTransition,
    duration: options.duration || 2500,
    easing: options.easing || 'power3.inOut',
    onUpdate: options.onProgress
}).play();
```
#### Step 10: 후처리 (CameraMovementService.ts)
```typescript
// Damping 복구
this.cameraControls.enableDamping = originalDamping;
this.cameraControls.smoothTime = originalSmoothTime;

// 하이라이트 적용
this.applyLeftDoorHighlights();
```
## 5. CinematicSequence.addBezierPath 분석
### 5.1 함수 위치
- **파일**: `src/shared/utils/animationUtils.ts`
### 5.2 핵심 구현 로직
```typescript
addBezierPath(params: {
    start: THREE.Vector3;
    control: THREE.Vector3;
    end: THREE.Vector3;
    upTransition?: {...};
    duration?: number;
    easing?: string;
    onUpdate?: (progress: number) => void;
}): this {
    const duration = (params.duration || 2500) / 1000;
    
    // Quadratic Bezier 곡선 생성
    const curve = new THREE.QuadraticBezierCurve3(params.start, params.control, params.end);
    
    this.timeline.to({}, {
        duration,
        ease: params.easing || 'power1.inOut',
        onUpdate: () => {
            const progress = this.timeline.progress();
            
            // 곡선 위의 점 계산
            const point = curve.getPoint(progress);
            this.camera!.position.copy(point);
            
            // UP 벡터 보간 처리 (로우 앵글 효과)
            if (params.upTransition) {
                const { nodeY, targetCenter, startUp, endUp } = params.upTransition;
                const lookDir = new THREE.Vector3().subVectors(targetCenter, this.camera!.position).normalize();
                let calculatedUp = new THREE.Vector3().crossVectors(nodeY, lookDir).normalize();
                if (calculatedUp.y < 0) calculatedUp.negate();
                
                const easeTransition = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
                const finalUp = startUp.clone().lerp(calculatedUp, easeTransition);
                this.camera!.up.copy(finalUp);
            }
            
            // 카메라 타겟 업데이트
            if (this.controls) {
                this.controls.target.lerpVectors(startTarget, this.targetCenter, progress);
                this.controls.update();
            }
        }
    });
    
    return this;
}
```
### 5.3 기술적 특징

| 특징                | 설명                                               |
| ----------------- | ------------------------------------------------ |
| **Bezier 곡선**     | `THREE.QuadraticBezierCurve3` 사용하여 부드러운 곡선 경로 생성 |
| **GSAP Timeline** | 프레임 단위 애니메이션 제어                                  |
| **UP 벡터 보간**      | Cubic ease-out으로 자연스러운 로우 앵글 효과                  |
| **Damping 제어**    | 애니메이션 중 컨트롤러 간섭 방지                               |
## 6. 전체 동작 시퀀스 다이어그램
```
┌─────────────────────────────────────────────────────────────────┐
│                    DamperServiceOrchestrator                     │
│                         execute() 호출                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        moveCamera()                              │
│  1. 메타데이터에서 카메라 설정 로드                              │
│  2. cameraOptions 객체 생성                                     │
│  3. direction Vector3 변환                                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              moveCameraToLeftDoorDamper()                        │
│  - LEFT_DOOR_NODES[0]을 타겟으로 설정                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   moveCameraCinematic()                          │
│  1. 타겟 노드 검색                                              │
│  2. 카메라 객체 확인                                            │
│  3. 바운딩 박스 및 중심점 계산                                  │
│  4. 목적지 방향 결정                                            │
│  5. 목적지 위치 및 거리 계산                                    │
│  6. Bezier 곡선 제어점 계산                                     │
│  7. Damping 비활성화                                            │
│  8. CinematicSequence 생성 및 실행                              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              CinematicSequence.addBezierPath()                   │
│  1. QuadraticBezierCurve3 곡선 생성                             │
│  2. GSAP Timeline으로 프레임 단위 위치 업데이트                 │
│  3. UP 벡터 보간 (로우 앵글 효과)                               │
│  4. 카메라 타겟 보간                                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        후처리                                    │
│  1. Damping 설정 복구                                           │
│  2. 애니메이션 히스토리 기록                                    │
│  3. 왼쪽 도어 하이라이트 적용                                   │
└─────────────────────────────────────────────────────────────────┘
```
## 7. 주요 의존성

| 모듈                              | 용도                 |
| ------------------------------- | ------------------ |
| `gsap`                          | 애니메이션 타임라인 및 이징 효과 |
| `THREE.QuadraticBezierCurve3`   | 베지에 곡선 경로 계산       |
| `getPreciseBoundingBox`         | 정밀 바운딩 박스 계산       |
| `calculateCameraTargetPosition` | 카메라 타겟 위치 계산       |
| `CinematicSequence`             | 시네마틱 카메라 시퀀스 빌더    |
| `MetadataLoader`                | 카메라 설정 메타데이터 로드    |
## 8. 메타데이터 설정 예시
```json
{
  "cameraSettings": {
    "damperService": {
      "duration": 2500,
      "easing": "power3.inOut",
      "distance": 2.5,
      "direction": {
        "x": 0.5,
        "y": -1,
        "z": 0.5
      }
    }
  }
}
```
## 9. 요약
`moveCamera` 함수는 다음과 같은 방식으로 구현되어 있습니다:
1. **메타데이터 기반 설정**: 외부 JSON에서 카메라 설정을 로드하여 유연성 확보
2. **Bezier 곡선 경로**: `QuadraticBezierCurve3`를 사용하여 부드러운 카메라 이동 경로 생성
3. **GSAP Timeline**: 프레임 단위 정밀 제어 및 다양한 이징 효과 적용
4. **Damping 제어**: 애니메이션 중 카메라 컨트롤러의 간섭을 방지하기 위해 일시적 비활성화
5. **UP 벡터 보간**: Cubic ease-out을 적용하여 자연스러운 로우 앵글 효과 구현
6. **히스토리 기록**: 애니메이션 완료 후 실행 기록을 저장하여 디버깅 및 되돌리기 지원
