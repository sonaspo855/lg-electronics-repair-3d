import * as THREE from 'three';
import gsap from 'gsap';
import { PartAssemblyService } from './PartAssemblyService';
import {
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
    DAMPER_COVER_SLOT_OFFSET
} from '../../shared/utils/fridgeConstants';
import { getDamperAssemblyService } from '../fridge/DamperAssemblyService';
import { StencilOutlineHighlight } from '../../shared/utils/StencilOutlineHighlight';
import { getMetadataLoader } from '../../shared/utils/MetadataLoader';
import { NormalBasedHighlight } from '../../shared/utils/NormalBasedHighlight';
import { GrooveDetectionUtils } from '../../shared/utils/GrooveDetectionUtils';

/**
 * 수동 조립 관리자
 * 조립/분해 관련 함수를 중앙 집중식 관리
 */
export class ManualAssemblyManager {
    private partAssemblyService: PartAssemblyService | null = null;
    private sceneRoot: THREE.Object3D | null = null;
    private cameraControls: any = null;
    private assemblyProgress: number = 0;
    private isAssemblyPlaying: boolean = false;

    /**
     * 카메라 컨트롤 설정
     * @param cameraControls OrbitControls 또는 CameraControls 객체
     */
    public setCameraControls(cameraControls: any): void {
        this.cameraControls = cameraControls;
    }

    /**
     * 서비스 초기화
     * @param sceneRoot 3D 씬의 루트 노드
     */
    public initialize(sceneRoot: THREE.Object3D, cameraControls?: any): void {
        this.sceneRoot = sceneRoot;
        this.cameraControls = cameraControls || null;
        this.partAssemblyService = new PartAssemblyService(sceneRoot);

        // DamperAssemblyService도 초기화해야 함
        const damperService = getDamperAssemblyService();
        damperService.initialize(sceneRoot);

        console.log('[ManualAssemblyManager] 초기화 완료');
    }

    /**
     * 조립 준비
     * 대상 노드를 목표 위치로 이동시킵니다.
     */
    public async prepareManualAssembly(options?: {
        duration?: number;
        snapThreshold?: number;
        onProgress?: (progress: number) => void;
        onComplete?: () => void;
    }): Promise<void> {
        if (!this.partAssemblyService || !this.sceneRoot) {
            throw new Error('[ManualAssemblyManager] 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
        }

        console.log('[ManualAssemblyManager] 조립 준비 시작');
        this.isAssemblyPlaying = true;

        try {
            await this.partAssemblyService.animateLinearAssembly(
                LEFT_DOOR_DAMPER_COVER_BODY_NODE,
                LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
                {
                    duration: options?.duration || 2500,
                    slotOffset: DAMPER_COVER_SLOT_OFFSET, // 슬롯 오프셋 적용
                    onProgress: (progress) => {
                        this.assemblyProgress = progress;
                        options?.onProgress?.(progress);
                    },
                    onComplete: () => {
                        console.log('[ManualAssemblyManager] 조립 완료');
                        this.isAssemblyPlaying = false;
                        this.assemblyProgress = 1;
                        options?.onComplete?.();
                    }
                }
            );
        } catch (error) {
            console.error('[ManualAssemblyManager] 조립 실패:', error);
            this.isAssemblyPlaying = false;
            throw error;
        }
    }

    /**
     * 조립 진행률 업데이트
     * 애니메이션 진행 중 상태를 업데이트합니다.
     */
    public updateManualProgress(progress: number): void {
        this.assemblyProgress = Math.max(0, Math.min(1, progress));
        console.log(`[ManualAssemblyManager] 진행률 업데이트: ${(this.assemblyProgress * 100).toFixed(1)}%`);
    }

    /**
     * 분해 (원래 위치로 복귀)
     */
    public async disassembleDamperCover(options?: {
        duration?: number;
        onComplete?: () => void;
    }): Promise<void> {
        if (!this.partAssemblyService) {
            throw new Error('[ManualAssemblyManager] 초기화되지 않았습니다.');
        }

        console.log('[ManualAssemblyManager] 분해 시작');
        this.isAssemblyPlaying = true;

        try {
            await this.partAssemblyService.disassemblePart(
                LEFT_DOOR_DAMPER_COVER_BODY_NODE,
                {
                    duration: options?.duration || 1500,
                    onComplete: () => {
                        console.log('[ManualAssemblyManager] 분해 완료');
                        this.isAssemblyPlaying = false;
                        this.assemblyProgress = 0;
                        options?.onComplete?.();
                    }
                }
            );
        } catch (error) {
            console.error('[ManualAssemblyManager] 분해 실패:', error);
            this.isAssemblyPlaying = false;
            throw error;
        }
    }

    /**
     * 현재 진행률 반환
     */
    public getProgress(): number {
        return this.assemblyProgress;
    }

    /**
     * 애니메이션 재생 중인지 확인
     */
    public isPlaying(): boolean {
        return this.isAssemblyPlaying;
    }

    /**
     * 서비스 정리
     */
    public dispose(): void {
        this.partAssemblyService?.dispose();
        this.partAssemblyService = null;
        this.sceneRoot = null;
        this.assemblyProgress = 0;
        this.isAssemblyPlaying = false;
        console.log('[ManualAssemblyManager] 서비스 정리 완료');
    }

    private debugObjects: THREE.Object3D[] = [];

    /**
     * 조립 경로를 시각화하는 디버깅 메서드
     * @param startPosition 시작 위치 (월드 좌표)
     * @param endPosition 종료 위치 (월드 좌표)
     * @param plugPosition 돌출부 위치 (월드 좌표)
     * @param holePosition 홈 위치 (월드 좌표)
     */
    private visualizeAssemblyPath(
        startPosition: THREE.Vector3,
        endPosition: THREE.Vector3,
        plugPosition?: THREE.Vector3,
        holePosition?: THREE.Vector3
    ): void {
        // 기존 디버그 객체 정리
        this.clearDebugObjects();

        if (!this.sceneRoot) return;

        // 1. 시작 위치 (빨간 구)
        const startGeometry = new THREE.SphereGeometry(0.0005, 16, 16);
        const startMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const startPoint = new THREE.Mesh(startGeometry, startMaterial);
        startPoint.position.copy(startPosition);
        this.debugObjects.push(startPoint);
        this.sceneRoot.add(startPoint);

        // 2. 종료 위치 (초록 구)
        const endGeometry = new THREE.SphereGeometry(0.0005, 16, 16);
        const endMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const endPoint = new THREE.Mesh(endGeometry, endMaterial);
        endPoint.position.copy(endPosition);
        this.debugObjects.push(endPoint);
        this.sceneRoot.add(endPoint);

        // 3. 조립 경로 선 (노란색 점선)
        const pathPoints = [startPosition.clone(), endPosition.clone()];
        const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
        const pathMaterial = new THREE.LineDashedMaterial({
            color: 0xffff00,
            dashSize: 0.05,
            gapSize: 0.02,
            linewidth: 2
        });
        const pathLine = new THREE.Line(pathGeometry, pathMaterial);
        pathLine.computeLineDistances(); // 점선 계산을 위해 필요
        this.debugObjects.push(pathLine);
        this.sceneRoot.add(pathLine);

        // 4. 돌출부 위치 (파란색 구)
        if (plugPosition) {
            const plugGeometry = new THREE.SphereGeometry(0.0005, 16, 16);
            const plugMaterial = new THREE.MeshBasicMaterial({ color: 0x0088ff });
            const plugPoint = new THREE.Mesh(plugGeometry, plugMaterial);
            plugPoint.position.copy(plugPosition);
            this.debugObjects.push(plugPoint);
            this.sceneRoot.add(plugPoint);

            // 돌출부에서 시작 위치로 연결선
            const plugToStart = new THREE.BufferGeometry().setFromPoints([plugPosition, startPosition]);
            const plugToStartLine = new THREE.Line(
                plugToStart,
                new THREE.LineBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.5 })
            );
            this.debugObjects.push(plugToStartLine);
            this.sceneRoot.add(plugToStartLine);
        }

        // 5. 홈 위치 (마젠타색 구)
        if (holePosition) {
            const holeGeometry = new THREE.SphereGeometry(0.0005, 16, 16);
            const holeMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff });
            const holePoint = new THREE.Mesh(holeGeometry, holeMaterial);
            holePoint.position.copy(holePosition);
            this.debugObjects.push(holePoint);
            this.sceneRoot.add(holePoint);

            // 홈에서 종료 위치로 연결선
            const holeToEnd = new THREE.BufferGeometry().setFromPoints([holePosition, endPosition]);
            const holeToEndLine = new THREE.Line(
                holeToEnd,
                new THREE.LineBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.5 })
            );
            this.debugObjects.push(holeToEndLine);
            this.sceneRoot.add(holeToEndLine);
        }

        // 6. 이동 벡터 화살표
        const direction = new THREE.Vector3().subVectors(endPosition, startPosition);
        const arrowHelper = new THREE.ArrowHelper(
            direction.normalize(),
            startPosition,
            direction.length(),
            0xffff00
        );
        this.debugObjects.push(arrowHelper);
        this.sceneRoot.add(arrowHelper);

        console.log('[Assembly Debug] 경로 시각화 생성:', {
            시작위치: `(${startPosition.x.toFixed(3)}, ${startPosition.y.toFixed(3)}, ${startPosition.z.toFixed(3)})`,
            종료위치: `(${endPosition.x.toFixed(3)}, ${endPosition.y.toFixed(3)}, ${endPosition.z.toFixed(3)})`,
            돌출부: plugPosition ? `(${plugPosition.x.toFixed(3)}, ${plugPosition.y.toFixed(3)}, ${plugPosition.z.toFixed(3)})` : '없음',
            홈: holePosition ? `(${holePosition.x.toFixed(3)}, ${holePosition.y.toFixed(3)}, ${holePosition.z.toFixed(3)})` : '없음',
            이동거리: direction.length().toFixed(4)
        });
    }

    /**
     * 디버그 객체 일괄 정리
     */
    private clearDebugObjects(): void {
        this.debugObjects.forEach((obj) => {
            this.sceneRoot?.remove(obj);
            if (obj instanceof THREE.Mesh) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material instanceof THREE.Material) obj.material.dispose();
            } else if (obj instanceof THREE.Line || obj instanceof THREE.LineSegments) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material instanceof THREE.Material) obj.material.dispose();
            }
        });
        this.debugObjects = [];
    }

    /**
     * [Modified] 댐퍼 커버 조립 (정점 법선 분석 기반 Auto-Snap 적용)
     * 돌출부와 홈의 정점 데이터를 분석하여 자동으로 정확한 위치로 결합합니다.
     */
    public async assembleDamperCover(
        options?: {
            duration?: number;
            onComplete?: () => void;
        }
    ): Promise<void> {
        // 1. Scene Root 확인
        if (!this.sceneRoot) {
            console.error('[ManualAssemblyManager] Scene root not initialized.');
            return;
        }

        // 2. [Correction] 노드 직접 조회 (Service 의존성 제거)
        const coverNode = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_COVER_BODY_NODE) as THREE.Mesh;
        const assemblyNode = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_ASSEMBLY_NODE) as THREE.Mesh;

        // 3. 노드 존재 여부 검증
        if (!coverNode || !assemblyNode) {
            console.error('[ManualAssemblyManager] Target nodes not found for assembly:', {
                coverName: LEFT_DOOR_DAMPER_COVER_BODY_NODE,
                assemblyName: LEFT_DOOR_DAMPER_ASSEMBLY_NODE
            });
            return;
        }

        console.log('[Assembly] Starting Vertex Normal Analysis for Auto-Snap...');

        // 4. [Cover 분석] 결합 돌출부(Plug) 탐지
        // 댐퍼 커버의 핀이 향하는 방향(예: 로컬 Z 또는 Y)에 맞춰 벡터를 조정하세요.
        const plugAnalysis = GrooveDetectionUtils.calculateVirtualPivotByNormalAnalysis(
            coverNode,
            new THREE.Vector3(0, 0, 1),
            0.5
        );

        // 5. [Assembly 분석] 결합 홈(Hole) 탐지
        const holeAnalysis = GrooveDetectionUtils.calculateVirtualPivotByNormalAnalysis(
            assemblyNode,
            new THREE.Vector3(0, 0, 1),
            0.5
        );

        let targetPosition = new THREE.Vector3();
        let plugWorldPos: THREE.Vector3 | null = null;
        let holeWorldPos: THREE.Vector3 | null = null;

        // 6. 결합 위치 계산
        if (plugAnalysis && holeAnalysis) {
            console.log('[Assembly] Auto-Snap: 정점 분석 성공. 정밀 좌표 계산 중...');

            const currentCoverPos = coverNode.position.clone();
            plugWorldPos = plugAnalysis.position;
            holeWorldPos = holeAnalysis.position;

            // 이동 벡터(Delta) 계산: 홈 위치 - 돌출부 위치
            const moveDelta = new THREE.Vector3().subVectors(holeWorldPos, plugWorldPos);

            // 목표 위치 설정
            targetPosition.addVectors(currentCoverPos, moveDelta);

        } else {
            console.warn('[Assembly] Auto-Snap: 정점 분석 실패. Fallback(BoundingBox) 실행.');

            // Fallback: 기존 Bounding Box 방식
            const holeCenter = GrooveDetectionUtils.calculateGrooveCenterByBoundingBox(assemblyNode);

            if (holeCenter) {
                targetPosition.copy(holeCenter);
                // 부모가 있다면 로컬 좌표로 변환
                if (coverNode.parent) {
                    coverNode.parent.worldToLocal(targetPosition);
                }
            } else {
                targetPosition.set(0, 0, 0); // 최후의 안전장치
            }
        }

        // 7. 디버그 시각화: 조립 경로 표시
        const currentCoverWorldPos = new THREE.Vector3();
        coverNode.getWorldPosition(currentCoverWorldPos);
        const targetWorldPos = new THREE.Vector3();
        if (coverNode.parent) {
            coverNode.parent.localToWorld(targetWorldPos.copy(targetPosition));
        } else {
            targetWorldPos.copy(targetPosition);
        }

        // 디버그 시각화 호출 (시작, 종료, 돌출부, 홈)
        this.visualizeAssemblyPath(
            currentCoverWorldPos,
            targetWorldPos,
            plugWorldPos || undefined,
            holeWorldPos || undefined
        );

        // 8. 애니메이션 실행
        return new Promise((resolve) => {
            this.isAssemblyPlaying = true;

            gsap.to(coverNode.position, {
                x: targetPosition.x,
                y: targetPosition.y,
                z: targetPosition.z,
                duration: options?.duration || 1.5,
                ease: 'power2.inOut',
                onUpdate: () => {
                    // 애니메이션 진행 중 디버그 시각화 업데이트
                    const currentWorldPos = new THREE.Vector3();
                    coverNode.getWorldPosition(currentWorldPos);
                    const currentTargetWorldPos = new THREE.Vector3();
                    if (coverNode.parent) {
                        coverNode.parent.localToWorld(currentTargetWorldPos.copy(targetPosition));
                    } else {
                        currentTargetWorldPos.copy(targetPosition);
                    }
                    // 진행 상황 로그 (100%마다 출력)
                    // const progress = coverNode.position.distanceTo(targetPosition) / startToTargetDistance;
                },
                onComplete: () => {
                    // 애니메이션 완료 후 디버그 객체 정리
                    this.clearDebugObjects();
                    this.isAssemblyPlaying = false;
                    console.log('[Assembly] 결합 완료');
                    if (options?.onComplete) options.onComplete();
                    resolve();
                }
            });
        });
    }
}

// 싱글톤 인스턴스 (전역에서 사용 가능)
let manualAssemblyManagerInstance: ManualAssemblyManager | null = null;

/**
 * 싱글톤 인스턴스 가져오기
 */
export function getManualAssemblyManager(): ManualAssemblyManager {
    if (!manualAssemblyManagerInstance) {
        manualAssemblyManagerInstance = new ManualAssemblyManager();
    }
    return manualAssemblyManagerInstance;
}

/**
 * 조립 준비 함수 (간편 호출용)
 */
export async function prepareManualAssembly(
    sceneRoot: THREE.Object3D,
    options?: {
        duration?: number;
        snapThreshold?: number;
        onProgress?: (progress: number) => void;
        onComplete?: () => void;
    }
): Promise<void> {
    const manager = getManualAssemblyManager();
    manager.initialize(sceneRoot);
    await manager.prepareManualAssembly(options);
}

/**
 * 진행률 업데이트 함수 (간편 호출용)
 */
export function updateManualProgress(progress: number): void {
    const manager = getManualAssemblyManager();
    manager.updateManualProgress(progress);
}

/**
 * 분해 함수 (간편 호출용)
 */
export async function disassembleDamperCover(
    sceneRoot: THREE.Object3D,
    options?: {
        duration?: number;
        onComplete?: () => void;
    }
): Promise<void> {
    const manager = getManualAssemblyManager();
    manager.initialize(sceneRoot);
    await manager.disassembleDamperCover(options);
}

/**
 * [New] 외부에서 호출 가능한 조립 함수 export
 * @param duration 애니메이션 지속 시간
 */
export async function runDamperAssembly(duration: number = 1500): Promise<void> {
    const manager = getManualAssemblyManager();
    await manager.assembleDamperCover({ duration });
}
