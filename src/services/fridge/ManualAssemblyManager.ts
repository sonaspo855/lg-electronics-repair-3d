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

    /**
     * 댐퍼 커버 조립 (정점 법선 벡터 분석을 통한 가상 피벗 방식)
     * 메쉬의 정점과 법선 벡터를 분석하여 가상 회전축을 생성하고 조립합니다.
     * @param options 조립 옵션
     * @param _camera 카메라 객체 (선택사항, 제공되지 않으면 자동 탐색) - 현재 미사용
     */
    public async assembleDamperCover(
        options?: {
            duration?: number;
            onComplete?: () => void;
        },
        _camera?: THREE.Camera
    ): Promise<void> {
        if (!this.sceneRoot) return;

        console.log('[ManualAssemblyManager] 댐퍼 커버 조립 시작 (선형 이동 방식)');

        try {
            // 1. 노드 확보
            const damperAssembly = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_ASSEMBLY_NODE); // 분홍색 (Target)
            const damperCover = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_COVER_BODY_NODE);   // 녹색 (Moving Part)

            if (!damperAssembly || !damperCover) {
                console.error('[Error] 필수 노드를 찾을 수 없습니다.');
                return;
            }

            // 2. 메타데이터 및 설정 로드
            const metadataLoader = getMetadataLoader();
            const config = await metadataLoader.loadAssemblyConfig('damper_cover_assembly');

            // 3. 정점 법선 벡터 분석을 통한 가상 피벗 계산
            // Z축 방향(0, 0, 1)을 기준으로 법선 필터링
            const virtualPivot = NormalBasedHighlight.calculateVirtualPivotByNormalAnalysis(
                damperAssembly,
                new THREE.Vector3(0, 0, 1), // Z축 방향 필터
                config?.grooveDetection.normalTolerance || 0.2
            );

            if (!virtualPivot) {
                console.error('[Error] 가상 피벗을 계산할 수 없습니다.');
                return;
            }

            // [추가] 커버의 대응되는 피벗(Plug) 계산
            // 어셈블리의 법선과 반대 방향(-Z)을 가진 면을 찾음
            const coverPivot = NormalBasedHighlight.calculateVirtualPivotByNormalAnalysis(
                damperCover,
                new THREE.Vector3(0, 0, -1), // 반대 방향 필터
                config?.grooveDetection.normalTolerance || 0.2
            );

            console.log('[ManualAssemblyManager] 가상 피벗 정보:', {
                assemblyPivot: virtualPivot.position,
                coverPivot: coverPivot?.position,
                rotationAxis: virtualPivot.rotationAxis,
                insertionDirection: virtualPivot.insertionDirection
            });

            // 디버그용 시각화: 가상 피벗 위치에 구체 생성
            const pivotSphereGeometry = new THREE.SphereGeometry(0.0005, 16, 16);
            const pivotSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const pivotSphere = new THREE.Mesh(pivotSphereGeometry, pivotSphereMaterial);
            pivotSphere.position.copy(virtualPivot.position);
            this.sceneRoot.add(pivotSphere);

            // 4. 타겟 상태 계산 (가상 피벗 간의 차이를 이용한 선형 이동)
            if (!coverPivot) {
                console.error('[Error] 커버의 피벗을 찾을 수 없어 이동 경로를 계산할 수 없습니다.');
                return;
            }

            // [수정] 분홍색 홈 피벗(virtualPivot)과 녹색 돌기 피벗(coverPivot) 사이의 월드 좌표 차이 계산
            const worldOffset = new THREE.Vector3().subVectors(
                virtualPivot.position,
                coverPivot.position
            );

            // 현재 커버의 월드 위치에 해당 오프셋을 더해 최종 월드 위치 계산
            const currentWorldPos = new THREE.Vector3();
            damperCover.getWorldPosition(currentWorldPos);
            const finalWorldPos = currentWorldPos.clone().add(worldOffset);

            const finalLocalPos = finalWorldPos.clone();
            if (damperCover.parent) {
                damperCover.parent.updateMatrixWorld(true);
                damperCover.parent.worldToLocal(finalLocalPos);
            }

            // 회전은 현재 상태 유지 (사용하지 않음)

            // 5. 애니메이션 설정 (선형 이동)
            const duration = options?.duration || 1500;
            const startPos = damperCover.position.clone();

            await new Promise<void>((resolve) => {
                const animObj = { progress: 0 };

                gsap.to(animObj, {
                    progress: 1,
                    duration: duration / 1000,
                    ease: "power2.inOut",
                    onUpdate: () => {
                        const p = animObj.progress;

                        // 위치만 선형 보간 (회전 없음)
                        damperCover.position.lerpVectors(startPos, finalLocalPos, p);
                        // 회전은 시작 상태 유지
                    },
                    onComplete: () => {
                        console.log('[ManualAssemblyManager] 조립 완료 (선형 이동 방식)');
                        options?.onComplete?.();
                        resolve();
                    }
                });
            });

        } catch (error) {
            console.error('[Error] 조립 로직 실패:', error);
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
