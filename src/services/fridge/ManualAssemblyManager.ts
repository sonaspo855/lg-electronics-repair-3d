import * as THREE from 'three';
import { PartAssemblyService } from './PartAssemblyService';
import {
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    LEFT_DOOR_DAMPER_ASSEMBLY_NODE
} from '../../shared/utils/fridgeConstants';

/**
 * 수동 조립 관리자
 * 조립/분해 관련 함수를集中的 관리
 */
export class ManualAssemblyManager {
    private partAssemblyService: PartAssemblyService | null = null;
    private sceneRoot: THREE.Object3D | null = null;
    private assemblyProgress: number = 0;
    private isAssemblyPlaying: boolean = false;

    /**
     * 서비스 초기화
     * @param sceneRoot 3D 씬의 루트 노드
     */
    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
        this.partAssemblyService = new PartAssemblyService(sceneRoot);
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
            await this.partAssemblyService.assemblePart(
                LEFT_DOOR_DAMPER_COVER_BODY_NODE,
                LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
                {
                    duration: options?.duration || 2500,
                    snapThreshold: options?.snapThreshold || 0.2,
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
