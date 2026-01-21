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

    /**
     * [LG CNS 개선안] 
     * 2단계 시네마틱 이동: 
     * 1단계 - 타겟 정면 수평 정렬 (Alignment)
     * 2단계 - 타겟 중심 lerp를 통한 접근 및 회전 (Zoom & Orbit)
     */
    public async moveCameraCinematic(nodeName: string): Promise<void> {
        const targetNode = this.getNodeByName(nodeName);
        if (!targetNode || !this.sceneRoot) {
            console.warn(`[CameraService] Node or SceneRoot not found`);
            return;
        }

        // 1. 모델 전체(Scene)와 타겟 노드(Node)의 바운딩 박스 각각 계산
        const sceneBox = getPreciseBoundingBox(this.sceneRoot); // 모델 전체 크기
        const targetBox = getPreciseBoundingBox(targetNode);    // 타겟 노드 크기

        const sceneCenter = new THREE.Vector3();
        sceneBox.getCenter(sceneCenter);
        const sceneSize = new THREE.Vector3();
        sceneBox.getSize(sceneSize);

        const targetCenter = new THREE.Vector3();
        targetBox.getCenter(targetCenter);

        // 2. 전체 확인을 위한 안전 거리 계산 (모델 전체 크기 기준)
        // 모델의 가장 긴 축을 기준으로 약 2.5~3배 거리를 확보하여 전체가 담기도록 함
        const maxSceneDim = Math.max(sceneSize.x, sceneSize.y, sceneSize.z);
        const safetyDistance = maxSceneDim * 2.5;

        // 3. 목표 위치 계산: 전체 중심 기준 우측 정면(45도) 대각선
        const quarterViewDir = new THREE.Vector3(1, 0, 1).normalize();
        const alignPos = sceneCenter.clone().add(
            quarterViewDir.multiplyScalar(safetyDistance)
        );

        // [지침 반영] Y축은 모델 전체 중심이 아닌 '지정한 노드의 높이'로 강제 고정
        alignPos.y = targetCenter.y;

        console.log('1단계 애니메이션 실행: 전체 조망 위치로 이동!!');
        // 1단계 애니메이션 실행: 전체 조망 위치로 이동
        await new Promise<void>((resolve) => {
            animate(this.cameraControls.object.position, {
                x: alignPos.x,
                y: alignPos.y,
                z: alignPos.z,
                duration: 1.5,
                easing: (t: any) => 1 - Math.pow(1 - t, 4),
                onUpdate: () => {
                    this.cameraControls.target.lerp(targetCenter, 0.05);
                    this.cameraControls.update();
                },
                onComplete: () => {
                    console.log("[Debug] 1단계 완료 - 2단계 진입"); // 디버깅 확인용
                    resolve(); // 반드시 호출되어야 다음 await로 넘어갑니다.
                }
            });
        });

        // ---------------------------------------------------------
        // Phase 2, 3, 4: 곡선 궤적 진입 및 타겟 포커싱
        // ---------------------------------------------------------
        console.log('Phase 2, 3, 4: 곡선 궤적 진입 및 타겟 포커싱!!');
        console.log('93번 라인 디버깅 주석 출력 확인!!');
        // [4단계] 화면 꽉 참 보장: 타겟 노드의 대각선 길이를 기반으로 동적 거리 계산
        const diagonal = targetBox.min.distanceTo(targetBox.max);
        const fov = this.cameraControls.object.fov * (Math.PI / 180); // Radian 변환

        console.log(`[CameraMovementService] Target diagonal: ${diagonal.toFixed(2)}`);
        console.log(`[CameraMovementService] FOV (radians): ${fov.toFixed(4)}`);

        // FOV를 고려하여 객체가 화면에 꽉 차는 기본 거리 산출 (여유 계수 1.2 ~ 1.5 적용)
        let zoomDistance = (diagonal / 2) / Math.tan(fov / 2);
        zoomDistance *= 1.3;

        console.log(`[CameraMovementService] Calculated zoomDistance: ${zoomDistance.toFixed(2)}`);

        // [2단계-5] 최종 위치: 타겟 기준 우측 정면 방향에서 로우 앵글(웅장함) 연출을 위해 높이 낮춤
        const finalPos = targetCenter.clone().add(
            quarterViewDir.clone().multiplyScalar(zoomDistance)
        );
        finalPos.y -= (diagonal * 0.3); // 타겟 중심보다 아래로 배치하여 올려다보는 각도 형성

        console.log(`[CameraMovementService] Final position: (${finalPos.x.toFixed(2)}, ${finalPos.y.toFixed(2)}, ${finalPos.z.toFixed(2)})`);

        // [2단계-3] 제어점(Control Point) 설정: 아래로 깔리는 궤적 ("U"자 곡선)
        const startPos = this.cameraControls.object.position.clone();
        console.log(`[CameraMovementService] Start position: (${startPos.x.toFixed(2)}, ${startPos.y.toFixed(2)}, ${startPos.z.toFixed(2)})`);

        const controlPos = new THREE.Vector3(
            (startPos.x + finalPos.x) / 2,
            Math.min(startPos.y, finalPos.y) - (diagonal * 0.5), // 중간 지점에서 아래로 훅 떨어지는 Dip 효과
            (startPos.z + finalPos.z) / 2
        );
        console.log(`[CameraMovementService] Control position: (${controlPos.x.toFixed(2)}, ${controlPos.y.toFixed(2)}, ${controlPos.z.toFixed(2)})`);

        // 베지어 곡선 생성
        const curve = new THREE.QuadraticBezierCurve3(startPos, controlPos, finalPos);

        // Phase 2 & 3 애니메이션 실행
        await new Promise<void>((resolve) => {
            animate((progress: number) => {
                // [2단계-4] 곡선 경로를 따라 카메라 이동 (지미집 효과)
                const point = curve.getPoint(progress);
                this.cameraControls.object.position.copy(point);

                // [3단계] 주시점(Target) 고정 연출: 이동 중에도 타겟 중심을 강력하게 추적
                // 카메라가 곡선으로 움직여도 시선이 타겟에 고정되어 Orbit 느낌을 줌
                this.cameraControls.target.lerp(targetCenter, 0.1);
                this.cameraControls.update();

                if (progress === 1) {
                    console.log(`[CameraMovementService] Animation completed`);
                }
            }, {
                duration: 1.8, // 웅장한 연출을 위해 약간 천천히 이동
                easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t, // EaseInOutQuad
                onComplete: resolve
            });
        });
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
