import gsap from 'gsap';
import { LEFT_DOOR_DAMPER_NODE_NAME } from '../../shared/utils/fridgeConstants';
import * as THREE from 'three';
import { getPreciseBoundingBox } from '../../shared/utils/commonUtils';
import {
    NodeCache,
    createHighlightMaterial,
    CinematicSequence
} from '../../shared/utils/animationUtils';

// ============================================================================
// Camera movement options
// ============================================================================

export interface CameraMoveOptions {
    duration?: number;           // milliseconds
    zoomRatio?: number;          // Custom zoom ratio
    direction?: THREE.Vector3;   // Custom camera direction
    easing?: string;             // GSAP easing name (default: 'power3.inOut')
    onProgress?: (progress: number) => void;
}

// ============================================================================
// Camera movement service for fridge animations
// ============================================================================

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
        this.nodeCache.clear();
    }

    public async moveCameraToNode(nodeName: string, options: CameraMoveOptions = {}): Promise<void> {
        return this.moveCameraCinematic(nodeName, options);
    }

    /**
     * 특정 노드와 그 자식 메쉬들을 하이라이트 처리합니다.
     */
    public applyHighlight(nodeName: string, color: number = 0xffff00): void {
        const targetNode = this.getNodeByName(nodeName);
        if (!targetNode) {
            console.warn(`Highlight failed: Node "${nodeName}" not found.`);
            return;
        }

        console.log('Applying highlight to node:', targetNode.name);

        const highlightMat = createHighlightMaterial(color);

        let meshCount = 0;
        targetNode.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                meshCount++;
                if (!child.userData.originalMaterial) {
                    child.userData.originalMaterial = child.material;
                }
                child.material = highlightMat;
            }
        });

        console.log(`Applied highlight to ${meshCount} meshes`);
    }

    /**
     * 노드에 적용된 하이라이트를 제거하고 원래 재질로 복구합니다.
     */
    public resetHighlight(nodeName: string): void {
        const targetNode = this.getNodeByName(nodeName);
        if (!targetNode) return;

        targetNode.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData.originalMaterial) {
                child.material = child.userData.originalMaterial;
                delete child.userData.originalMaterial;
            }
        });
    }

    public async moveCameraToUpwardView(nodeName: string, options: CameraMoveOptions = {}): Promise<void> {
        const upwardDirection = new THREE.Vector3(0, -1, 0).normalize();

        return this.moveCameraToNode(nodeName, {
            ...options,
            direction: options.direction || upwardDirection,
            zoomRatio: options.zoomRatio || 3,
            easing: options.easing || 'power3.inOut'
        });
    }

    /**
     * [GSAP 기반] 시네마틱 카메라 워킹
     * 1) 직선 접근 -> 2) 막바지 급격한 하강(Drop) -> 3) 로우 앵글(Low Angle)
     */
    public async moveCameraCinematic(nodeName: string, options: CameraMoveOptions = {}): Promise<void> {
        console.log('🎬 moveCameraCinematic:', nodeName);

        const targetNode = this.getNodeByName(nodeName);
        if (!targetNode) {
            console.error('Target node not found:', nodeName);
            return;
        }

        const camera = this.cameraControls.camera || this.cameraControls.object;
        if (!camera) {
            console.error('Camera not found');
            return;
        }

        // 타겟 바운딩 박스 및 중심점 계산
        const targetBox = getPreciseBoundingBox(targetNode);
        const targetCenter = new THREE.Vector3();
        targetBox.getCenter(targetCenter);
        const size = new THREE.Vector3();
        targetBox.getSize(size);

        // 시작 위치
        const startPos = camera.position.clone();
        const startTarget = this.cameraControls.target.clone();

        // 거리 계산
        const fovRad = (camera.fov * Math.PI) / 180;
        const maxDim = Math.max(size.x, size.y, size.z);
        const zoomDistance = (maxDim / 2) / Math.tan(fovRad / 2) * (options.zoomRatio || 1.2);

        // 목적지 계산
        let direction = options.direction || new THREE.Vector3(0, -1, 0);

        // [수정] 특정 노드(왼쪽 도어 댐퍼 등)에 대해 항상 일관된 뷰(왼쪽 출력)를 제공하도록 방향 강제
        if (nodeName === LEFT_DOOR_DAMPER_NODE_NAME && !options.direction) {
            // 모델의 로컬 좌표계나 월드 좌표계 기준에 따라 다르지만, 
            // 이미지를 통해 확인된 '왼쪽 출력'을 위해 X축 방향을 조정합니다.
            // 기존 (0, -1, 0)에서 약간의 X축 오프셋을 주어 카메라가 오른쪽에서 왼쪽을 바라보게 하거나 그 반대를 설정합니다.
            // 사용자가 원하는 '왼쪽 출력'은 객체가 화면의 왼쪽에 위치하는 것이 아니라, 
            // 특정 방향에서 바라본 일관된 뷰를 의미하는 것으로 보입니다.
            direction = new THREE.Vector3(0.5, -1, 0.5).normalize();
        }

        const endPos = targetCenter.clone().add(direction.clone().multiplyScalar(zoomDistance));

        // 거리 체크 (너무 가까우면 직선 이동)
        const distSq = startPos.distanceToSquared(endPos);
        if (distSq < 0.0001) {
            camera.position.copy(endPos);
            this.cameraControls.target.copy(targetCenter);
            this.cameraControls.update();
            return;
        }

        // 제어점 계산 (L자형 곡선)
        const controlPos = new THREE.Vector3(
            (startPos.x + endPos.x) / 2,
            Math.max(startPos.y, endPos.y) + Math.max(size.y, maxDim) * 0.3,
            (startPos.z + endPos.z) / 2
        );

        // 베지에 곡선 생성
        const cinematicCurve = new THREE.QuadraticBezierCurve3(
            startPos.clone(),
            controlPos,
            endPos.clone()
        );

        // 노드의 월드 회전 (UP 벡터 계산용)
        const nodeQuat = new THREE.Quaternion();
        targetNode.getWorldQuaternion(nodeQuat);
        const nodeY = new THREE.Vector3(0, 1, 0).applyQuaternion(nodeQuat);

        // Damping 비활성화
        const originalDamping = this.cameraControls.enableDamping;
        const originalSmoothTime = this.cameraControls.smoothTime;
        this.cameraControls.enableDamping = false;
        this.cameraControls.smoothTime = 0;

        // UP 벡터 리셋
        camera.up.set(0, 1, 0);

        // GSAP 애니메이션 실행
        const duration = (options.duration || 2500) / 1000;
        const easing = options.easing || 'power3.inOut';

        await new Promise<void>((resolve) => {
            const animObj = { progress: 0 };

            gsap.to(animObj, {
                progress: 1,
                duration,
                ease: easing,
                onUpdate: () => {
                    const smoothProgress = animObj.progress;

                    // 곡선에서 위치 가져오기
                    const point = cinematicCurve.getPoint(smoothProgress);
                    camera.position.copy(point);

                    // UP 벡터 점진적 전환 (로우 앵글 효과)
                    if (options.direction && Math.abs(options.direction.y) > 0.8) {
                        const lookDir = new THREE.Vector3()
                            .subVectors(targetCenter, camera.position)
                            .normalize();

                        // 노드Y × 시선방향 (Cross Product)
                        let calculatedUp = new THREE.Vector3()
                            .crossVectors(nodeY, lookDir)
                            .normalize();

                        // 아래를 향하면 반전
                        if (calculatedUp.y < 0) {
                            calculatedUp.negate();
                        }

                        // 점진적 UP 전환 (Cubic ease-out)
                        const easeTransition = 1 - Math.pow(1 - smoothProgress, 3);
                        const finalUp = new THREE.Vector3(0, 1, 0).lerp(calculatedUp, easeTransition);
                        camera.up.copy(finalUp);
                    } else {
                        camera.up.set(0, 1, 0);
                    }

                    // 타겟 lerp
                    this.cameraControls.target.lerpVectors(startTarget, targetCenter, smoothProgress);
                    this.cameraControls.update();

                    options.onProgress?.(smoothProgress);
                },
                onComplete: () => {
                    // 최종 UP 벡터 설정
                    if (options.direction && Math.abs(options.direction.y) > 0.8) {
                        const lookDir = new THREE.Vector3()
                            .subVectors(targetCenter, camera.position)
                            .normalize();

                        let calculatedUp = new THREE.Vector3()
                            .crossVectors(nodeY, lookDir)
                            .normalize();

                        if (calculatedUp.y < 0) {
                            calculatedUp.negate();
                        }

                        camera.up.copy(calculatedUp);
                        this.cameraControls.target.copy(targetCenter);
                        this.cameraControls.update();
                    }

                    // Damping 복원
                    this.cameraControls.enableDamping = originalDamping;
                    this.cameraControls.smoothTime = originalSmoothTime;

                    resolve();
                }
            });
        });

        console.log('✅ moveCameraCinematic 완료');
    }

    /**
     * [GSAP Timeline 기반] 분해 카메라 시퀀스
     * 커버 -> 레버 -> 힌지 순으로 카메라 추적
     */
    public async playDisassemblyCameraSequence(): Promise<void> {
        console.log('🎬 playDisassemblyCameraSequence 시작');

        const sequence = new CinematicSequence();
        const camera = this.cameraControls.camera || this.cameraControls.object;

        // 1단계: 도어 커버 집중
        await this.moveCameraToNode("Door_Cover", {
            duration: 1200,
            zoomRatio: 2,
            easing: 'power2.inOut'
        });

        // 2단계: 레버 분리 - 올려다보는 시점
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.moveCameraToUpwardView("Lever_Part", {
            duration: 1500,
            zoomRatio: 1.5,
            easing: 'power3.inOut'
        });

        // 3단계: 힌지 분리 시점
        await this.moveCameraToNode("Hinge_Assembly", {
            duration: 1000,
            zoomRatio: 1.2,
            easing: 'power2.inOut'
        });

        console.log('✅ playDisassemblyCameraSequence 완료');
    }

    /**
     * [GSAP Timeline 활용] 커스텀 시네마틱 시퀀스
     */
    public createCinematicSequence(): CinematicSequence {
        return new CinematicSequence();
    }

    // Find a node by name in the scene (with caching)
    private getNodeByName(nodeName: string): THREE.Object3D | null {
        if (!this.sceneRoot) {
            console.error('Scene root not available for node lookup');
            return null;
        }

        return this.nodeCache.findNodeByName(this.sceneRoot, nodeName);
    }

    // Default camera movement parameters
    private static readonly DEFAULT_DAMPER_DURATION = 1000;

    // Move camera to the left door damper node
    public async moveCameraToLeftDoorDamper(options: CameraMoveOptions = {}): Promise<void> {
        console.log('🎬 moveCameraToLeftDoorDamper');

        await this.moveCameraToUpwardView(LEFT_DOOR_DAMPER_NODE_NAME, {
            duration: options.duration || 1000,
            ...options
        });

        // 대상 노드를 하이라이트 처리
        this.applyHighlight(LEFT_DOOR_DAMPER_NODE_NAME);
    }

    /**
     * [단순화된 API] 지정된 위치로 카메라 이동
     */
    public async moveTo(
        position: THREE.Vector3,
        target: THREE.Vector3,
        options: CameraMoveOptions = {}
    ): Promise<void> {
        const camera = this.cameraControls.camera || this.cameraControls.object;
        if (!camera) return;

        const duration = (options.duration || 1500) / 1000;
        const easing = options.easing || 'power2.out';

        // Damping 비활성화
        const originalDamping = this.cameraControls.enableDamping;
        this.cameraControls.enableDamping = false;

        await new Promise<void>((resolve) => {
            gsap.to(camera.position, {
                x: position.x,
                y: position.y,
                z: position.z,
                duration,
                ease: easing,
                onUpdate: () => {
                    this.cameraControls.target.lerp(target, 0.1);
                    this.cameraControls.update();
                },
                onComplete: () => {
                    this.cameraControls.target.copy(target);
                    this.cameraControls.update();
                    this.cameraControls.enableDamping = originalDamping;
                    resolve();
                }
            });
        });
    }

    /**
     * 줌 효과
     */
    public async zoomTo(
        zoomRatio: number,
        options: CameraMoveOptions = {}
    ): Promise<void> {
        const camera = this.cameraControls.camera || this.cameraControls.object;
        if (!camera) return;

        const targetBox = getPreciseBoundingBox(this.sceneRoot!);
        const targetCenter = new THREE.Vector3();
        targetBox.getCenter(targetCenter);

        const currentPos = camera.position.clone();
        const direction = currentPos.clone().sub(targetCenter).normalize();
        const currentDistance = currentPos.distanceTo(targetCenter);
        const targetDistance = currentDistance / zoomRatio;
        const targetPos = targetCenter.clone().add(direction.multiplyScalar(targetDistance));

        return this.moveTo(targetPos, targetCenter, options);
    }
}
