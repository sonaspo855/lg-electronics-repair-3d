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

        // 1단계 애니메이션 실행: 전체 조망 위치로 이동
        await new Promise<void>((resolve) => {
            animate(this.cameraControls.object.position, {
                x: alignPos.x,
                y: alignPos.y,
                z: alignPos.z,
                duration: 1.5, // 전체 조망을 위해 부드럽게 이동
                easing: (t: any) => 1 - Math.pow(1 - t, 4), // EaseOutQuart
                onUpdate: () => {
                    // 시선은 타겟 노드를 향해 서서히 일치시킴
                    this.cameraControls.target.lerp(targetCenter, 0.05);
                    this.cameraControls.update();
                },
                onComplete: resolve
            });
        });

        // ---------------------------------------------------------
        // Phase 2: 포물선 로우 앵글 진입 (Parabolic Swoop) - 주석 처리
        // ---------------------------------------------------------
        /*
        // 목표: 1단계 위치(우측 정면)에서 타겟 쪽으로 파고들며 앵글 변화

        // 최종 위치: 1단계와 동일한 각도(우측 정면)를 유지하되 거리만 좁힘
        const zoomDistance = maxDim * 1.5;
        const finalPos = targetCenter.clone().add(
            quarterViewDir.multiplyScalar(zoomDistance)
        );
        // 최종 높이는 살짝 낮춰서 로우 앵글 연출 (웅장함)
        finalPos.y -= (maxDim * 0.3);

        // 제어점(Control Point) 설정: 이동 경로를 아래로 휘게 만듦 ("U"자 곡선)
        const controlPos = new THREE.Vector3(
            (alignPos.x + finalPos.x) / 2,
            Math.min(alignPos.y, finalPos.y) - (maxDim * 0.3), // 딥(Dip) 효과 추가
            (alignPos.z + finalPos.z) / 2
        );

        const curve = new THREE.QuadraticBezierCurve3(alignPos, controlPos, finalPos);

        await new Promise<void>((resolve) => {
            animate((progress) => {
                const point = curve.getPoint(progress);
                this.cameraControls.object.position.copy(point);

                // 카메라가 가까워질수록 타겟 중심을 강하게 주시
                this.cameraControls.target.lerp(targetCenter, 0.2);
                this.cameraControls.update();
            }, {
                duration: 1.5,
                easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t, // EaseInOutQuad
                onComplete: resolve
            });
        });
        */
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
