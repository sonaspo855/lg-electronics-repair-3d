import { getNodeNameManager } from '../data/NodeNameManager';
import { getMetadataLoader } from '../data/MetadataLoader';
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

export interface HighlightConfig {
    nodePath: string;
    color: string | number;
}

export interface CameraMoveOptions {
    duration?: number;           // milliseconds
    zoomRatio?: number;          // Custom zoom ratio
    distance?: number;           // Explicit distance from target
    direction?: THREE.Vector3;   // Custom camera direction
    easing?: string;             // GSAP easing name (default: 'power3.inOut')
    bezierOffset?: number;       // Bezier curve control point offset multiplier
    upThreshold?: number;        // Threshold for UP vector transition
    highlights?: HighlightConfig[]; // Nodes to highlight after movement
    onProgress?: (progress: number) => void;
}

// ============================================================================
// Camera movement service for fridge animations
// ============================================================================

export class CameraMovementService {
    private cameraControls: any;
    private sceneRoot: THREE.Object3D | null = null;
    private nodeNameManager = getNodeNameManager();
    private metadataLoader = getMetadataLoader();

    constructor(cameraControls: any, sceneRoot?: THREE.Object3D) {
        this.cameraControls = cameraControls;
        this.sceneRoot = sceneRoot || null;
    }

    // Set scene root reference for node lookup
    public setSceneRoot(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
    }

    // 카메라를 댐퍼 위치로 이동
    public async moveCameraToLeftDoorDamper(): Promise<{
        duration: number;
        easing: string;
        direction: THREE.Vector3 | null;
        distance: number | undefined;
    } | null> {
        return this.moveCameraCinematic(LEFT_DOOR_NODES[0], {});
    }

    /**
     * [GSAP 기반] 시네마틱 카메라 워킹
     * 1) 직선 접근 -> 2) 막바지 급격한 하강(Drop) -> 3) 로우 앵글(Low Angle)
     */
    public async moveCameraCinematic(
        nodeName: string,
        options: CameraMoveOptions = {}
    ): Promise<{
        duration: number;
        easing: string;
        direction: THREE.Vector3 | null;
        distance: number | undefined;
    } | null> {
        const metadataKey = 'damperService';
        const targetNode = this.getNodeByName(nodeName);
        if (!targetNode) {
            console.error('Target node not found:', nodeName);
            return null;
        }

        const camera = this.cameraControls.camera || this.cameraControls.object;
        if (!camera) {
            console.error('Camera not found');
            return null;
        }

        // 메타데이터 로드
        let mergedOptions: CameraMoveOptions = { ...options };

        if (metadataKey) {
            const cameraSettings = this.metadataLoader.getCameraSettings(metadataKey);
            mergedOptions = {
                duration: options.duration ?? cameraSettings?.duration ?? 0,
                easing: options.easing ?? cameraSettings?.easing ?? 'power3.inOut',
                distance: options.distance ?? cameraSettings?.distance,
                zoomRatio: options.zoomRatio ?? cameraSettings?.zoomRatio ?? 0,
                bezierOffset: options.bezierOffset ?? cameraSettings?.bezierOffset ?? 0,
                upThreshold: options.upThreshold ?? cameraSettings?.upThreshold ?? 0,
                highlights: options.highlights ?? cameraSettings?.highlights,
                ...options
            };

            // direction 설정이 있으면 Vector3로 변환
            if (cameraSettings?.direction && !options.direction) {
                mergedOptions.direction = new THREE.Vector3(
                    cameraSettings.direction.x,
                    cameraSettings.direction.y,
                    cameraSettings.direction.z
                ).normalize();
            }
        }

        // 1. 타겟 바운딩 박스 및 중심점 계산
        const targetBox = getPreciseBoundingBox(targetNode);
        const targetCenter = new THREE.Vector3();
        targetBox.getCenter(targetCenter);
        const size = new THREE.Vector3();
        targetBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        // 2. 목적지 방향 결정
        const direction = mergedOptions.direction || new THREE.Vector3(0, -1, 0);

        // 3. 목적지 및 거리 계산
        const { position: endPos } = calculateCameraTargetPosition(camera, targetBox, {
            zoomRatio: mergedOptions.zoomRatio || 0,
            distance: mergedOptions.distance,
            direction: direction
        });

        // 4. 시작 위치 및 상태 저장
        const startPos = camera.position.clone();

        // 거리 체크 (너무 가까우면 즉시 이동)
        if (startPos.distanceToSquared(endPos) < 0.0001) {
            camera.position.copy(endPos);
            this.cameraControls.target.copy(targetCenter);
            this.cameraControls.update();
        } else {
            // 5. 제어점 계산 (L자형 곡선)
            const bezierOffset = mergedOptions.bezierOffset ?? 0.3;
            const controlPos = new THREE.Vector3(
                (startPos.x + endPos.x) / 2,
                Math.max(startPos.y, endPos.y) + Math.max(size.y, maxDim) * bezierOffset,
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

            const upThreshold = mergedOptions.upThreshold ?? 0.8;
            const upTransition = (mergedOptions.direction && Math.abs(mergedOptions.direction.y) > upThreshold) ? {
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
                duration: mergedOptions.duration || 2500,
                easing: mergedOptions.easing || 'power3.inOut',
                onUpdate: mergedOptions.onProgress
            }).play();

            // 8. 후처리 (Damping 복구 및 하이라이트)
            this.cameraControls.enableDamping = originalDamping;
            this.cameraControls.smoothTime = originalSmoothTime;
        }

        if (mergedOptions.highlights) {
            this.applyHighlights(mergedOptions.highlights);
        }

        return {
            duration: mergedOptions.duration || 2500,
            easing: mergedOptions.easing || 'power3.inOut',
            direction: mergedOptions.direction || null,
            distance: mergedOptions.distance
        };
    }

    /**
     * 메타데이터 설정에 따른 하이라이트 적용
     */
    private applyHighlights(highlights: HighlightConfig[]): void {
        highlights.forEach((config) => {
            const nodeName = this.nodeNameManager.getNodeName(config.nodePath);
            if (!nodeName) return;

            const node = this.getNodeByName(nodeName);
            if (node) {
                const color = typeof config.color === 'string' ? parseInt(config.color, 16) : config.color;
                node.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(m => {
                                const newM = m.clone();
                                this.applyEmissive(newM, color);
                                return newM;
                            });
                        } else {
                            child.material = child.material.clone();
                            this.applyEmissive(child.material, color);
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
