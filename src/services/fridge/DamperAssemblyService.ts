import * as THREE from 'three';
import { PartAssemblyService } from './PartAssemblyService';
import {
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    LEFT_DOOR_DAMPER_ASSEMBLY_NODE
} from '../../shared/utils/fridgeConstants';

/**
 * 댐퍼 조립 통합 서비스
 * 기존 DamperAnimationService를 확장하여 조립 기능 추가
 */
export class DamperAssemblyService {
    private partAssemblyService: PartAssemblyService | null = null;
    private sceneRoot: THREE.Object3D | null = null;

    /**
     * 서비스 초기화
     * @param sceneRoot 3D 씬의 루트 노드
     */
    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
        this.partAssemblyService = new PartAssemblyService(sceneRoot);
        console.log('[DamperAssemblyService] 초기화 완료');
    }

    /**
     * 댐퍼 커버 조립
     * LEFT_DOOR_DAMPER_COVER_BODY_NODE를 LEFT_DOOR_DAMPER_ASSEMBLY_NODE로 이동
     */
    public async assembleDamperCover(options?: {
        duration?: number;
        liftHeight?: number;
        snapThreshold?: number;
        onComplete?: () => void;
    }): Promise<void> {
        if (!this.partAssemblyService || !this.sceneRoot) {
            throw new Error('[DamperAssemblyService] 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
        }

        console.log('[DamperAssemblyService] 댐퍼 커버 조립 시작');

        await this.partAssemblyService.assemblePart(
            LEFT_DOOR_DAMPER_COVER_BODY_NODE,
            LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
            {
                duration: options?.duration || 2500,
                liftHeight: options?.liftHeight || 2.0,
                snapThreshold: options?.snapThreshold || 0.2,
                onComplete: () => {
                    console.log('[DamperAssemblyService] 댐퍼 커버 조립 완료');
                    options?.onComplete?.();
                }
            }
        );
    }

    /**
     * 댐퍼 커버 분해 (원래 위치로 복귀)
     */
    public async disassembleDamperCover(options?: {
        duration?: number;
        liftHeight?: number;
        onComplete?: () => void;
    }): Promise<void> {
        if (!this.partAssemblyService) {
            throw new Error('[DamperAssemblyService] 초기화되지 않았습니다.');
        }

        console.log('[DamperAssemblyService] 댐퍼 커버 분해 시작');

        await this.partAssemblyService.disassemblePart(
            LEFT_DOOR_DAMPER_COVER_BODY_NODE,
            {
                duration: options?.duration || 1500,
                liftHeight: options?.liftHeight || 1.5,
                onComplete: () => {
                    console.log('[DamperAssemblyService] 댐퍼 커버 분해 완료');
                    options?.onComplete?.();
                }
            }
        );
    }

    /**
     * 현재 진행률 확인
     */
    public getProgress(): number {
        return this.partAssemblyService?.getProgress() || 0;
    }

    /**
     * 애니메이션 중인지 확인
     */
    public isPlaying(): boolean {
        return this.partAssemblyService?.isPlaying() || false;
    }

    /**
     * 서비스 정리
     */
    public dispose(): void {
        this.partAssemblyService?.dispose();
        this.partAssemblyService = null;
        this.sceneRoot = null;
        console.log('[DamperAssemblyService] 서비스 정리 완료');
    }
}

// 싱글톤 인스턴스 (전역에서 사용 가능)
let damperAssemblyServiceInstance: DamperAssemblyService | null = null;

/**
 * 싱글톤 인스턴스 가져오기
 */
export function getDamperAssemblyService(): DamperAssemblyService {
    if (!damperAssemblyServiceInstance) {
        damperAssemblyServiceInstance = new DamperAssemblyService();
    }
    return damperAssemblyServiceInstance;
}

/**
 * 예시: 직접 호출 가능한 함수
 */
export async function exampleDamperAssembly(sceneRoot: THREE.Object3D): Promise<void> {
    const service = getDamperAssemblyService();
    service.initialize(sceneRoot);

    await service.assembleDamperCover({
        duration: 2500,
        liftHeight: 2.0,
        onComplete: () => {
            console.log('✅ 조립 완료!');
        }
    });
}
