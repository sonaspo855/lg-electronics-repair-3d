import { LEFT_DOOR_DAMPER_NODE_NAME } from '../../shared/utils/fridgeConstants';
import * as THREE from 'three';
import { getPreciseBoundingBox } from '../../shared/utils/commonUtils';
import { animate, calculateCameraTargetPosition, NodeCache } from '../../shared/utils/animationUtils';

// Camera movement options
export interface CameraMoveOptions {
    duration?: number; // milliseconds
    zoomRatio?: number; // Custom zoom ratio
    direction?: THREE.Vector3; // Custom camera direction
    onProgress?: (progress: number) => void; // Progress callback
}

// Camera movement service for fridge animations
export class CameraMovementService {
    private cameraControls: any;
    private sceneRoot: THREE.Object3D | null = null;
    private nodeCache: NodeCache = new NodeCache();

    constructor(cameraControls: any, sceneRoot?: THREE.Object3D) {
        this.cameraControls = cameraControls;
        this.sceneRoot = sceneRoot || null;
    }

    // Set scene root reference for node lookup
    public setSceneRoot(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
        this.nodeCache.clear(); // Clear cache when scene root changes
    }

    public async moveCameraToNode(nodeName: string, options: CameraMoveOptions = {}): Promise<void> {
        // 단순히 시네마틱 로직을 실행하도록 연결
        return this.moveCameraCinematic(nodeName);
    }

    private drawCameraPath(points: THREE.Vector3[]): void {
        if (!this.sceneRoot) return;

        // 1. 점을 연결하는 곡선 생성
        const curve = new THREE.CatmullRomCurve3(points);
        const curvePoints = curve.getPoints(100); // 100개의 세밀한 점 추출

        // 2. 지오메트리 생성 및 점선 패턴 계산
        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);

        // 3. 점선 재질 설정 (노란색 점선)
        const material = new THREE.LineDashedMaterial({
            color: 0xff0000,
            dashSize: 0.4,
            gapSize: 0.1,
        });

        const line = new THREE.Line(geometry, material);
        line.computeLineDistances(); // 점선 계산 필수

        // 4. 씬에 추가 (디버깅용 객체임을 식별하기 위해 이름 부여)
        line.name = "DEBUG_CAMERA_PATH";
        this.sceneRoot.add(line);

        // 5. 10초 후 자동 제거 (화면 유지 시간 조절 가능)
        setTimeout(() => {
            if (this.sceneRoot) this.sceneRoot.remove(line);
        }, 10000);
    }

    /**
     * [LG CNS 개선안] 
     * 2단계 시네마틱 이동: 
     * 1단계 - 타겟 정면 수평 정렬 (Alignment)
     * 2단계 - 타겟 중심 lerp를 통한 접근 및 회전 (Zoom & Orbit)
     */
    public async moveCameraCinematic(nodeName: string): Promise<void> {
        const targetNode = this.getNodeByName(nodeName);
        if (!targetNode || !this.sceneRoot) return;

        const sceneBox = getPreciseBoundingBox(this.sceneRoot);
        const targetBox = getPreciseBoundingBox(targetNode);
        const sceneCenter = new THREE.Vector3();
        sceneBox.getCenter(sceneCenter);
        const targetCenter = new THREE.Vector3();
        targetBox.getCenter(targetCenter);
        const sceneSize = new THREE.Vector3();
        sceneBox.getSize(sceneSize);

        // 1단계 목표 위치 계산
        const safetyDistance = Math.max(sceneSize.x, sceneSize.y, sceneSize.z) * 2.5;
        const quarterViewDir = new THREE.Vector3(1, 0, 1).normalize();
        const alignPos = sceneCenter.clone().add(quarterViewDir.clone().multiplyScalar(safetyDistance));
        alignPos.y = targetCenter.y; // 타겟 높이 고정

        const startPos1 = this.cameraControls.object.position.clone();
        const startTarget1 = this.cameraControls.target.clone();

        console.log("1단계 시작: 전체 조망 이동");

        // [개선] new Promise 대신 animate의 자체 반환 Promise를 await 합니다.
        await animate((progress: number, eased: number) => {
            this.cameraControls.object.position.lerpVectors(startPos1, alignPos, eased);
            this.cameraControls.target.lerpVectors(startTarget1, targetCenter, eased * 0.1); // 서서히 주시
            this.cameraControls.update();
        }, { duration: 1500 }); // ms 단위

        // ---------------------------------------------------------
        // 2, 3, 4단계 진입 (여기서부터 96번 라인 이후 로직)
        // ---------------------------------------------------------
        console.log('Phase 2, 3, 4: 곡선 궤적 진입 및 타겟 포커싱!!');

        // [4단계] 화면 꽉 참 보장: 바운딩 박스 기반 동적 거리 계산
        const diagonal = targetBox.min.distanceTo(targetBox.max);
        const fovRad = (this.cameraControls.object.fov * Math.PI) / 180;
        let zoomDistance = (diagonal / 2) / Math.tan(fovRad / 2);
        zoomDistance *= 1.3; // 여유 계수

        // [2단계] 최종 위치 설정 (로우 앵글)
        const finalPos = targetCenter.clone().add(quarterViewDir.clone().multiplyScalar(zoomDistance));
        finalPos.y -= (diagonal * 0.4); // 도착 지점 높이를 조금 더 낮춰 웅장함 강조

        const startPos2 = this.cameraControls.object.position.clone();
        const startTarget2 = this.cameraControls.target.clone();

        // [핵심 수정] 제어점(Control Point)의 하강폭을 diagonal * 0.5에서 1.5로 대폭 강화하여 깊은 포물선 유도
        const controlPos = new THREE.Vector3(
            (startPos2.x + finalPos.x) / 2,
            Math.min(startPos2.y, finalPos.y) - (diagonal * 1.5), // <--- 깊이(Depth) 강화
            (startPos2.z + finalPos.z) / 2
        );
        const curve = new THREE.QuadraticBezierCurve3(startPos2, controlPos, finalPos);

        // [디버깅] 1~4단계 핵심 포인트 추출
        const pathPoints = [
            this.cameraControls.object.position.clone(), // 현재 시작점
            alignPos.clone(),                            // 1단계: 전체 조망 포인트
            controlPos.clone(),                          // 2단계: 지미집 최저점 (포물선 정점)
            finalPos.clone()                             // 4단계: 최종 타겟 근접 포인트
        ];

        // 경로 그리기 실행
        this.drawCameraPath(pathPoints);

        // 애니메이션 실행
        await animate((progress: number, eased: number) => {
            // eased를 사용하여 곡선 위의 좌표를 추출하여 카메라 위치 강제 고정
            const point = curve.getPoint(eased);
            this.cameraControls.object.position.copy(point);

            // [3단계] 주시점(Target) 고정: 카메라가 아래로 크게 휘어지는 동안 시선은 타겟에 강력하게 고정
            this.cameraControls.target.lerpVectors(startTarget2, targetCenter, eased);

            this.cameraControls.update();
        }, { duration: 2000 }); // 깊어진 궤적을 충분히 감상할 수 있도록 시간(2초) 소폭 증가

        console.log("[CameraMovementService] 모든 시네마틱 단계 완료");
    }

    /**
     * [추가] webp 시나리오: 커버 -> 레버 -> 힌지 순으로 카메라가 추적하는 시퀀스
     */
    public async playDisassemblyCameraSequence(): Promise<void> {
        // 1단계: 도어 커버 집중 (정면 사선)
        await this.moveCameraToNode("Door_Cover", { duration: 1200, zoomRatio: 2 });

        // 2단계: 레버 분리 시점에 맞춰 상단으로 이동
        await new Promise(resolve => setTimeout(resolve, 500)); // 애니메이션 타이밍 동기화
        await this.moveCameraToNode("Lever_Part", { duration: 1000, direction: new THREE.Vector3(0, 1, 0.5) });

        // 3단계: 힌지 분리 시점에 맞춰 측면 집중
        await this.moveCameraToNode("Hinge_Assembly", { duration: 1000, zoomRatio: 1.2 });
    }

    // Smooth camera movement with duration (Promise-based)
    private async smoothCameraMovement(
        targetPosition: THREE.Vector3,
        targetLookAt: THREE.Vector3,
        options: CameraMoveOptions
    ): Promise<void> {
        const duration = options.duration || 1000; // Default 1 second
        const startPosition = this.cameraControls.object.position.clone();
        const startTarget = this.cameraControls.target.clone();

        await animate((progress: number, eased: number) => {
            // Interpolate between start and target position with horizontal movement and slight downward angle
            const currentPosition = new THREE.Vector3(
                startPosition.x + (targetPosition.x - startPosition.x) * eased,
                targetPosition.y - 1.5, // Move camera slightly below target for upward view
                startPosition.z + (targetPosition.z - startPosition.z) * eased
            );
            this.cameraControls.object.position.copy(currentPosition);

            // Interpolate between start and target look at position
            const currentLookAt = startTarget.clone().lerp(targetLookAt, eased);
            this.cameraControls.target.copy(currentLookAt);

            // Update controls
            this.cameraControls.update();

            // Call progress callback
            if (options.onProgress) {
                options.onProgress(eased);
            }
        }, { duration });
    }

    // Find a node by name in the scene (with caching)
    private getNodeByName(nodeName: string): THREE.Object3D | null {
        if (!this.sceneRoot) {
            console.error('Scene root not available for node lookup');
            return null;
        }

        return this.nodeCache.findNodeByName(this.sceneRoot, nodeName);
    }

    // Calculate the target position for the camera using bounding box
    private calculateTargetPosition(node: any, options: CameraMoveOptions): THREE.Vector3 {
        const targetBox = getPreciseBoundingBox(node);
        return calculateCameraTargetPosition(this.cameraControls.object, targetBox, {
            zoomRatio: options.zoomRatio,
            direction: options.direction
        });
    }

    // Default camera movement parameters
    private static readonly DEFAULT_DAMPER_DURATION = 1000;

    // Move camera to the left door damper node (Promise-based)
    public async moveCameraToLeftDoorDamper(options: CameraMoveOptions = {}): Promise<void> {
        console.log('moveCameraToLeftDoorDamper!!');
        await this.moveCameraToNode(LEFT_DOOR_DAMPER_NODE_NAME, {
            duration: options.duration || CameraMovementService.DEFAULT_DAMPER_DURATION,
            // Ensure horizontal direction for front view
            direction: new THREE.Vector3(1, 0, 0).normalize(),
            ...options
        });
    }
}
