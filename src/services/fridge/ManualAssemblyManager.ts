import * as THREE from 'three';
import { PartAssemblyService } from './PartAssemblyService';
import { getNodeNameManager } from '../../shared/utils/NodeNameManager';
import { getNodeNameLoader } from '../../shared/utils/NodeNameLoader';
import { getDamperAssemblyService } from './DamperAssemblyService';
import { getDamperCoverAssemblyService } from './DamperCoverAssemblyService';
import { getGrooveDetectionService } from '../../shared/utils/GrooveDetectionService';
import { getAssemblyStateManager } from '../../shared/utils/AssemblyStateManager';
import { getHoleCenterManager, type HoleCenterInfo } from '../../shared/utils/HoleCenterManager';
import { getScrewAnimationService } from './ScrewAnimationService';
import { extractMetadataKey } from '../../shared/utils/commonUtils';
import { AnimationHistoryService } from '../AnimationHistoryService';
import { AnimationAction } from '../AnimatorAgent';

/**
 * 수동 조립 관리자
 * 조립/분해 관련 함수를 중앙 집중식 관리
 */
export class ManualAssemblyManager {
    private partAssemblyService: PartAssemblyService | null = null;
    private nodeNameLoader = getNodeNameLoader();

    // 서비스 인스턴스
    private damperAssemblyService = getDamperAssemblyService();
    private damperCoverAssemblyService = getDamperCoverAssemblyService();
    private grooveDetectionService = getGrooveDetectionService();
    private assemblyStateManager = getAssemblyStateManager();
    private holeCenterManager = getHoleCenterManager();
    private screwAnimationService = getScrewAnimationService();
    private nodeNameManager = getNodeNameManager();
    private animationHistoryService: AnimationHistoryService | null = null;

    public setAnimationHistoryService(service: AnimationHistoryService): void {
        this.animationHistoryService = service;
    }

    public async initialize(sceneRoot: THREE.Object3D, cameraControls?: any): Promise<void> {
        this.partAssemblyService = new PartAssemblyService(sceneRoot);

        // 서비스 초기화
        this.damperAssemblyService.initialize(sceneRoot);
        this.damperCoverAssemblyService.initialize(sceneRoot);
        this.grooveDetectionService.initialize(sceneRoot, cameraControls);
        this.screwAnimationService.initialize(sceneRoot);

        // 노드 이름 로드
        if (!this.nodeNameLoader.isLoadedData()) {
            await this.nodeNameLoader.loadNodeNames();
        }
    }

    public async disassembleDamperCover(options?: {
        duration?: number;
        onComplete?: () => void;
    }): Promise<void> {
        if (!this.partAssemblyService) {
            throw new Error('초기화되지 않았습니다.');
        }

        console.log('분해 시작');
        this.assemblyStateManager.startAssembly();

        // const nodeNameManager = getNodeNameManager();
        const damperCoverBodyNode = this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody');

        if (!damperCoverBodyNode) {
            throw new Error('damperCoverBodyNode를 찾을 수 없습니다.');
        }

        try {
            await this.partAssemblyService.disassemblePart(
                damperCoverBodyNode,
                {
                    duration: options?.duration || 1500,
                    onComplete: () => {
                        console.log('분해 완료');
                        this.assemblyStateManager.completeAssembly();
                        options?.onComplete?.();
                    }
                }
            );
        } catch (error) {
            console.error('분해 실패:', error);
            this.assemblyStateManager.stopAssembly();
            throw error;
        }
    }

    public getProgress(): number {
        return this.assemblyStateManager.getProgress();
    }

    public isPlaying(): boolean {
        return this.assemblyStateManager.isPlaying();
    }

    /**
     * 저장된 홈 중심점 정보들을 반환합니다.
     * @returns 홈 중심점 정보 배열
     */
    public getHoleCenters(): HoleCenterInfo[] {
        return this.holeCenterManager.getHoleCenters();
    }

    /**
     * ID로 홈 중심점 정보를 찾습니다.
     * @param id 홈 중심점 ID
     * @returns 홈 중심점 정보 또는 null
     */
    public getHoleCenterById(id: string): HoleCenterInfo | null {
        return this.holeCenterManager.getHoleCenterById(id);
    }

    /**
     * 인덱스로 홈 중심점 정보를 찾습니다.
     * @param index 홈 중심점 인덱스
     * @returns 홈 중심점 정보 또는 null
     */
    public getHoleCenterByIndex(index: number): HoleCenterInfo | null {
        return this.holeCenterManager.getHoleCenterByIndex(index);
    }

    /**
     * 저장된 홈 중심점의 개수를 반환합니다.
     * @returns 홈 중심점 개수
     */
    public getHoleCentersCount(): number {
        return this.holeCenterManager.getHoleCentersCount();
    }

    /**
     * 노드의 면을 하이라이트하고 홈을 찾아 중심점을 체크합니다.
     * @param nodeName 대상 노드 이름
     */
    public async detectAndHighlightGrooves(nodeName: string): Promise<void> {
        await this.grooveDetectionService.detectAndHighlightGrooves(nodeName);
    }

    /**
     * 댐퍼 돌출부/홈 결합
     */
    public async assembleDamperCover(
        options?: {
            duration?: number;
            onComplete?: () => void;
        }
    ): Promise<{
        position: { x: number; y: number; z: number };
        duration: number;
        easing: string;
    } | null> {
        return await this.damperCoverAssemblyService.assembleDamperCover(options);
    }

    /**
     * Screw를 돌려서 빼는 애니메이션을 실행합니다.
     * @param screwNodeNameOrPath 노드 이름 또는 경로 (예: 'fridge.leftDoorDamper.screw1Customized')
     * @param options 애니메이션 옵션
     */
    public async loosenScrew(
        screwNodePath: string,
        options?: {
            duration?: number;
            rotationAngle?: number;
            rotationAxis?: 'x' | 'y' | 'z';
            extractDirection?: [number, number, number];
            pullDistance?: number
            screwPitch?: number;
            onComplete?: () => void;
        }
    ): Promise<void> {
        // 경로이면 실제 노드 이름으로 변환
        const actualNodeName = this.nodeNameManager.getNodeName(screwNodePath);

        if (!actualNodeName) {
            console.warn(`${screwNodePath}에 해당하는 노드 이름을 찾을 수 없음`);
            return;
        }

        if (!this.screwAnimationService.isScrewNode(actualNodeName)) {
            console.warn(`${actualNodeName}은 Screw 노드가 아님`);
            return;
        }

        console.log('options11>> ', options);

        // 메타데이터 키 추출 (경로에서 마지막 요소 사용: 'fridge.leftDoorDamper.screw1Customized' -> 'screw1Customized')
        const metadataKey = extractMetadataKey(screwNodePath);
        const usedConfig = await this.screwAnimationService.animateScrewRotation(screwNodePath, metadataKey, options);

        // console.log('usedConfig000>> ', usedConfig);

        // 애니메이션 히스토리 기록
        if (this.animationHistoryService) {
            const screwMessage = `${actualNodeName} 스크류 분리 완료`;
            this.animationHistoryService.addAnimationHistory(
                {
                    door: 'top_left' as any,
                    action: AnimationAction.SCREW_LOOSEN,
                    duration: usedConfig.duration,
                    easing: usedConfig.easing,
                    rotationAngle: usedConfig.rotationAngle,
                    rotationAxis: usedConfig.rotationAxis,
                    extractDirection: usedConfig.extractDirection,
                    translationDistance: usedConfig.extractDistance
                },
                screwMessage
            );
            console.log('3344_Animation history after screw loosening:', this.animationHistoryService.getAllHistory());
        }
    }

    public dispose(): void {
        this.damperAssemblyService.dispose();
        this.damperCoverAssemblyService.dispose();
        this.grooveDetectionService.dispose();
        this.assemblyStateManager.reset();
        this.holeCenterManager.dispose();
        this.screwAnimationService.dispose();
        this.partAssemblyService?.dispose();
        this.partAssemblyService = null;
    }
}

let manualAssemblyManagerInstance: ManualAssemblyManager | null = null;

export function getManualAssemblyManager(): ManualAssemblyManager {
    if (!manualAssemblyManagerInstance) {
        manualAssemblyManagerInstance = new ManualAssemblyManager();
    }
    return manualAssemblyManagerInstance;
}

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

export async function runDamperAssembly(duration: number = 1500): Promise<void> {
    const manager = getManualAssemblyManager();
    await manager.assembleDamperCover({ duration });
}

/**
 * 노드의 면을 하이라이트하고 홈을 찾아 중심점을 체크합니다.
 */
export async function detectAndHighlightGrooves(
    sceneRoot: THREE.Object3D,
    nodeName: string,
    cameraControls: any
): Promise<void> {
    const manager = getManualAssemblyManager();
    manager.initialize(sceneRoot, cameraControls);
    await manager.detectAndHighlightGrooves(nodeName);
}
