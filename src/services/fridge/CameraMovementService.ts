import gsap from 'gsap';
// import { LEFT_DOOR_DAMPER_COVER_BODY_NODE, LEFT_DOOR_DAMPER_ASSEMBLY_NODE, LEFT_DOOR_SCREW1_CUSTOMIZED_NODE, LEFT_DOOR_SCREW2_CUSTOMIZED_NODE } from '../../shared/utils/fridgeConstants';
import { LEFT_DOOR_NODES } from '../../shared/utils/fridgeConstants';
import * as THREE from 'three';
import { getPreciseBoundingBox } from '../../shared/utils/commonUtils';
import { findNodeHeight } from '../../shared/utils/findNodeHeight'

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

    constructor(cameraControls: any, sceneRoot?: THREE.Object3D) {
        this.cameraControls = cameraControls;
        this.sceneRoot = sceneRoot || null;
    }

    // Set scene root reference for node lookup
    public setSceneRoot(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
    }

    // Move camera to the left door damper node (for backward compatibility)
    public async moveCameraToLeftDoorDamper(options: CameraMoveOptions = {}): Promise<void> {
        const upwardDirection = new THREE.Vector3(0, -1, 0).normalize();

        // LEFT_DOOR_DAMPER_COVER_BODY_NODE 노드를 하이라이트
        /* const targetNode = this.getNodeByName(LEFT_DOOR_DAMPER_COVER_BODY_NODE);
        if (targetNode) {
            const camera = this.cameraControls.camera || this.cameraControls.object;
            if (camera) {
                findNodeHeight(this.sceneRoot || targetNode, camera, this.cameraControls, {
                    highlightNodeName: LEFT_DOOR_DAMPER_COVER_BODY_NODE,
                    matchMode: 'equals',
                    boxColor: 0x00ff00 // 녹색으로 변경
                });
            }
        } */

        return this.moveCameraCinematic(LEFT_DOOR_NODES[0], {
            duration: options.duration || 1000,
            direction: options.direction || upwardDirection,
            zoomRatio: options.zoomRatio || 3,
            easing: options.easing || 'power3.inOut',
            ...options
        });
    }

    // Move camera to node (for backward compatibility)
    public async moveCameraToNode(nodeName: string, options: CameraMoveOptions = {}): Promise<void> {
        return this.moveCameraCinematic(nodeName, options);
    }

    // Move camera to upward view (for backward compatibility)
    public async moveCameraToUpwardView(nodeName: string, options: CameraMoveOptions = {}): Promise<void> {
        const upwardDirection = new THREE.Vector3(0, -1, 0).normalize();

        return this.moveCameraCinematic(nodeName, {
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

        // 특정 노드(왼쪽 도어 댐퍼)에 대해 일관된 뷰를 제공하도록 방향 강제
        // if (nodeName === LEFT_DOOR_DAMPER_COVER_BODY_NODE && !options.direction) {
        if (nodeName === LEFT_DOOR_NODES[0] && !options.direction) {
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
                    // 1. 카메라 및 컨트롤 최종 상태 확정
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

                    // 카메라 이동 완료 후 노드 하이라이트
                    LEFT_DOOR_NODES.forEach((nodeName, index) => {
                        const node = this.getNodeByName(nodeName);
                        if (node && camera) {
                            console.log(`[Highlight] Target: ${nodeName}`);
                            findNodeHeight(this.sceneRoot || node, camera, this.cameraControls, {
                                highlightNodeName: nodeName,
                                matchMode: 'equals',
                                boxColor: 0x00ff00,
                                append: index > 0
                            });
                        }
                    });

                    // 모든 노드 하이라이트가 완료된 후 추가 확인
                    console.log('All nodes highlighted');
                    resolve();
                }
            });
        });
    }

    // Find a node by name in the scene
    private getNodeByName(nodeName: string): THREE.Object3D | null {
        if (!this.sceneRoot) {
            console.error('Scene root not available for node lookup');
            return null;
        }

        return this.sceneRoot.getObjectByName(nodeName) || null;
    }
}
