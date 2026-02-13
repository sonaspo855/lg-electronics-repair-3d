import gsap from 'gsap';
import { getNodeNameManager } from '../data/NodeNameManager';
import { LEFT_DOOR_NODES } from '../../shared/constants/fridgeConstants';
import * as THREE from 'three';
import { getPreciseBoundingBox } from '../../shared/utils/commonUtils';
import { 
    calculateCameraTargetPosition, 
    CinematicSequence 
} from '../../shared/utils/animationUtils';

// ============================================================================
// Camera movement options
// ============================================================================

export interface CameraMoveOptions {
    duration?: number;           // milliseconds
    zoomRatio?: number;          // Custom zoom ratio
    distance?: number;           // Explicit distance from target
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
    private nodeNameManager = getNodeNameManager();

    constructor(cameraControls: any, sceneRoot?: THREE.Object3D) {
        this.cameraControls = cameraControls;
        this.sceneRoot = sceneRoot || null;
    }

    // Set scene root reference for node lookup
    public setSceneRoot(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
    }

    // 카메라를 
    public async moveCameraToLeftDoorDamper(options: CameraMoveOptions = {}): Promise<void> {
        return this.moveCameraCinematic(LEFT_DOOR_NODES[0], {
            duration: options.duration,
            direction: options.direction,
            zoomRatio: options.zoomRatio,
            easing: options.easing,
            ...options
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

        // 1. 타겟 바운딩 박스 및 중심점 계산
        const targetBox = getPreciseBoundingBox(targetNode);
        const targetCenter = new THREE.Vector3();
        targetBox.getCenter(targetCenter);
        const size = new THREE.Vector3();
        targetBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        // 2. 목적지 방향 결정
        let direction = options.direction || new THREE.Vector3(0, -1, 0);
        const damperCoverBodyNode = this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody');

        if (nodeName === damperCoverBodyNode && !options.direction) {
            direction = new THREE.Vector3(0.5, -1, 0.5).normalize();
        }

        // 3. 목적지 및 거리 계산
        const { position: endPos, distance: zoomDistance } = calculateCameraTargetPosition(camera, targetBox, {
            zoomRatio: options.zoomRatio || 1.2,
            distance: options.distance,
            direction: direction
        });

        // 4. 시작 위치 및 상태 저장
        const startPos = camera.position.clone();
        const startTarget = this.cameraControls.target.clone();

        // 거리 체크 (너무 가까우면 즉시 이동)
        if (startPos.distanceToSquared(endPos) < 0.0001) {
            camera.position.copy(endPos);
            this.cameraControls.target.copy(targetCenter);
            this.cameraControls.update();
            return;
        }

        // 5. 제어점 계산 (L자형 곡선)
        const controlPos = new THREE.Vector3(
            (startPos.x + endPos.x) / 2,
            Math.max(startPos.y, endPos.y) + Math.max(size.y, maxDim) * 0.3,
            (startPos.z + endPos.z) / 2
        );

        // 6. 노드의 월드 회전 (UP 벡터 계산용)
        const nodeQuat = new THREE.Quaternion();
        targetNode.getWorldQuaternion(nodeQuat);
        const nodeY = new THREE.Vector3(0, 1, 0).applyQuaternion(nodeQuat);

        // 7. 시네마틱 시퀀스 빌드 및 실행
        const sequence = new CinematicSequence();
        sequence.setCamera(camera, this.cameraControls)
                .setTarget(targetCenter);

        // Damping 비활성화 (애니메이션 중 부드러운 전환을 위해)
        const originalDamping = this.cameraControls.enableDamping;
        const originalSmoothTime = this.cameraControls.smoothTime;
        this.cameraControls.enableDamping = false;
        this.cameraControls.smoothTime = 0;

        // 카메라 UP 벡터 초기화
        camera.up.set(0, 1, 0);

        const upTransition = (options.direction && Math.abs(options.direction.y) > 0.8) ? {
            startUp: new THREE.Vector3(0, 1, 0),
            endUp: new THREE.Vector3(0, 1, 0), // 내부에서 계산됨
            nodeY: nodeY,
            targetCenter: targetCenter
        } : undefined;

        await sequence.addBezierPath({
            start: startPos,
            control: controlPos,
            end: endPos,
            upTransition: upTransition,
            duration: options.duration || 2500,
            easing: options.easing || 'power3.inOut',
            onUpdate: options.onProgress
        }).play();

        // 8. 후처리 (Damping 복구 및 하이라이트)
        this.cameraControls.enableDamping = originalDamping;
        this.cameraControls.smoothTime = originalSmoothTime;

        this.applyLeftDoorHighlights();
    }

    /**
     * 왼쪽 문 부품들에 하이라이트 적용 (애니메이션 완료 후 비즈니스 로직)
     */
    private applyLeftDoorHighlights(): void {
        const nodeColors = [
            0x325311, // 녹색 (Cover Body)
            0xff3333, // 빨간색 (Damper Assembly)
            0x3333ff, // 파란색 (Screw 1)
            0xffff33  // 노란색 (Screw 2)
        ];

        LEFT_DOOR_NODES.forEach((nodeName, index) => {
            if (index > 1) return; // 0, 1번 인덱스만 적용 (CoverBody, Assembly)

            const node = this.getNodeByName(nodeName);
            if (node) {
                node.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(m => {
                                const newM = m.clone();
                                this.applyEmissive(newM, nodeColors[index]);
                                return newM;
                            });
                        } else {
                            child.material = child.material.clone();
                            this.applyEmissive(child.material, nodeColors[index]);
                        }
                    }
                });
            }
        });
    }

    // Helper 함수 (가독성을 위해 분리)
    private applyEmissive(material: THREE.Material, color: number) {
        if ('emissive' in material) {
            (material as any).emissive.setHex(color);
            (material as any).emissiveIntensity = 0.8;
            material.needsUpdate = true;
        }
    }

    // Find a node by name in the scene
    private getNodeByName(nodeName: string): THREE.Object3D | null {
        if (!this.sceneRoot) {
            console.error('Scene root not available for node lookup');
            return null;
        }

        return this.sceneRoot.getObjectByName(nodeName) || null;
    }

    // Set camera controls reference
    public setCameraControls(cameraControls: any): void {
        this.cameraControls = cameraControls;
    }
}
