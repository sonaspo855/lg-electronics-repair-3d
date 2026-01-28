import * as THREE from 'three';
import { PartAssemblyService } from './PartAssemblyService';
import {
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
    DAMPER_COVER_SLOT_OFFSET
} from '../../shared/utils/fridgeConstants';
import { getDamperAssemblyService } from '../fridge/DamperAssemblyService';
import { CameraMovementService } from './CameraMovementService';
import { StencilOutlineHighlight } from '../../shared/utils/StencilOutlineHighlight';

/**
 * 수동 조립 관리자
 * 조립/분해 관련 함수를集中的 관리
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

    /**
     * 스텐실 아웃라인 하이라이트 적용
     * 대상 노드를 카메라 방향 기준으로 필터링하여 하이라이트
     */
    private StencilOutlineWithHighlight(activeCamera: THREE.Camera): void {
        const targetNodeName = LEFT_DOOR_DAMPER_ASSEMBLY_NODE;
        const targetNode = this.sceneRoot?.getObjectByName(targetNodeName);

        if (targetNode) {
            // StencilOutlineHighlight 인스턴스 생성 및 초기화
            const stencilHighlight = new StencilOutlineHighlight();
            stencilHighlight.initialize(this.sceneRoot!);

            // 카메라 방향 벡터 가져오기
            const cameraDirection = new THREE.Vector3();
            activeCamera.getWorldDirection(cameraDirection);
            cameraDirection.normalize();

            // 대상 노드의 메쉬를 순회하며 필터링
            const filteredIndices: number[] = [];
            targetNode.updateMatrixWorld(true);

            targetNode.traverse((child) => {
                if (child instanceof THREE.Mesh && child.geometry) {
                    const geometry = child.geometry;
                    const normals = geometry.attributes.normal;
                    const indices = geometry.index;

                    if (!normals) {
                        geometry.computeVertexNormals();
                    }

                    const worldQuat = new THREE.Quaternion();
                    child.getWorldQuaternion(worldQuat);
                    const faceCount = indices ? indices.count / 3 : geometry.attributes.position.count / 3;

                    for (let i = 0; i < faceCount; i++) {
                        let idx1, idx2, idx3;
                        if (indices) {
                            idx1 = indices.getX(i * 3);
                            idx2 = indices.getX(i * 3 + 1);
                            idx3 = indices.getX(i * 3 + 2);
                        } else {
                            idx1 = i * 3;
                            idx2 = i * 3 + 1;
                            idx3 = i * 3 + 2;
                        }

                        // 평균 법선 계산 (월드 좌표로 변환)
                        const normal1 = new THREE.Vector3().fromBufferAttribute(normals, idx1).applyQuaternion(worldQuat);
                        const normal2 = new THREE.Vector3().fromBufferAttribute(normals, idx2).applyQuaternion(worldQuat);
                        const normal3 = new THREE.Vector3().fromBufferAttribute(normals, idx3).applyQuaternion(worldQuat);
                        const avgNormal = new THREE.Vector3().addVectors(normal1, normal2).add(normal3).normalize();

                        // 카메라 방향과 내적하여 카메라를 향하는 면 판정
                        const dotProduct = avgNormal.dot(cameraDirection);
                        if (dotProduct < -0.3) { // 카메라를 향하는 면
                            filteredIndices.push(idx1, idx2, idx3);
                        }
                    }
                }
            });

            // 필터링된 면이 있으면 StencilOutlineHighlight로 하이라이트
            if (filteredIndices.length > 0) {
                // 순회 중 발견한 첫 번째 메쉬 사용
                let originalMesh: THREE.Mesh | null = null;
                targetNode.traverse((child) => {
                    if (!originalMesh && child instanceof THREE.Mesh) {
                        originalMesh = child;
                    }
                });

                if (originalMesh) {
                    stencilHighlight.createFilteredMeshHighlight(
                        originalMesh,
                        filteredIndices,
                        0xff0000, // 빨강색
                        15,       // thresholdAngle
                        0.6       // opacity
                    );
                    console.log('[ManualAssemblyManager] StencilOutlineHighlight로 하이라이트 적용 완료');
                }
            }
        } else {
            console.warn('[ManualAssemblyManager] 대상 노드를 찾을 수 없습니다:', targetNodeName);
        }
    }

    /**
     * 댐퍼 커버 조립 (충돌 방지 로직 적용)
     * @param options 조립 옵션
     * @param camera 카메라 객체 (선택사항, 제공되지 않으면 자동 탐색)
     */
    public async assembleDamperCover(
        options?: {
            duration?: number;
            onComplete?: () => void;
        },
        camera?: THREE.Camera
    ): Promise<void> {
        if (!this.partAssemblyService || !this.sceneRoot) return;

        console.log('[ManualAssemblyManager] 댐퍼 커버 조립 시작 (충돌 방지 모드)');

        // 댐퍼 홈 하이라이트 활성화 (법선 벡터 기반)
        // const damperService = getDamperAssemblyService();

        // 카메라 찾기 (매개 변수로 전달받거나 CameraMovementService 사용)
        let activeCamera: THREE.Camera | null = camera || null;
        if (!activeCamera && this.sceneRoot) {
            // CameraMovementService를 통한 카메라 탐색
            const { CameraMovementService } = await import('./CameraMovementService');
            const cameraMovementService = new CameraMovementService(this.cameraControls, this.sceneRoot);
            activeCamera = cameraMovementService.getCamera();
            console.log('activeCamera000>>> ', activeCamera);
        }

        console.log('activeCamera>>> ', activeCamera);

        if (activeCamera) {
            this.StencilOutlineWithHighlight(activeCamera);
        } else {
            console.warn('[ManualAssemblyManager] 하이라이트를 위한 카메라를 찾을 수 없습니다.');
        }


        return;

        const service = this.partAssemblyService;
        const root = this.sceneRoot;
        if (!service || !root || !options) return;

        // 1. [Lifting Step] ASSEMBLY 노드를 살짝 들어올려 공간 확보
        const LIFT_OFFSET = new THREE.Vector3(0, 0, -10);
        console.log('LIFT_OFFSET>>  ', LIFT_OFFSET);

        await service.movePartRelative(
            LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
            LIFT_OFFSET,
            2000 // 2초 동안 리프팅
        );

        // 2. [Assembly Step] COVER 노드 선형 이동 (기존 조립 로직)
        await service.assemblePart(
            LEFT_DOOR_DAMPER_COVER_BODY_NODE,
            LEFT_DOOR_DAMPER_ASSEMBLY_NODE, // 타겟 노드
            {
                duration: options?.duration || 1000,
            }
        );

        // (선택 사항) 3. [Settling Step] 들어올렸던 ASSEMBLY 노드를 다시 원위치로 내리기
        await service.movePartRelative(
            LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
            LIFT_OFFSET.clone().negate(), // 반대 방향으로 이동
            2000
        );

        console.log('[ManualAssemblyManager] 댐퍼 커버 조립 완료');

        if (options && typeof options.onComplete === 'function') {
            options.onComplete();
        }
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
 * @param camera 카메라 객체 (선택사항)
 */
export async function runDamperAssembly(duration: number = 1500, camera?: THREE.Camera): Promise<void> {
    const manager = getManualAssemblyManager();
    await manager.assembleDamperCover({ duration }, camera);
}