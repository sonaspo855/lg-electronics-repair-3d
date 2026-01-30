import * as THREE from 'three';
import gsap from 'gsap';
import { getNodeNameManager } from '../../shared/utils/NodeNameManager';
import { getMetadataLoader } from '../../shared/utils/MetadataLoader';
import { GrooveDetectionUtils } from '../../shared/utils/GrooveDetectionUtils';
import { getAssemblyPathVisualizer } from '../../shared/utils/AssemblyPathVisualizer';
import { getGrooveDetectionService } from '../../shared/utils/GrooveDetectionService';

/**
 * 댐퍼 커버 조립 서비스
 * 댐퍼 커버 조립 로직을 담당합니다.
 */
export class DamperCoverAssemblyService {
    private sceneRoot: THREE.Object3D | null = null;
    private assemblyPathVisualizer = getAssemblyPathVisualizer();
    private grooveDetectionService = getGrooveDetectionService();

    /**
     * 댐퍼 커버 조립 서비스를 초기화합니다.
     * @param sceneRoot 씬 루트 객체
     */
    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
        this.assemblyPathVisualizer.initialize(sceneRoot);
        this.grooveDetectionService.initialize(sceneRoot);

        // 메타데이터 미리 로드
        const nodeNameManager = getNodeNameManager();
        nodeNameManager.enableMetadataMode();

        console.log('[DamperCoverAssemblyService] 초기화 완료');
    }

    /**
     * 댐퍼 커버 조립 (메타데이터 기반)
     * 메타데이터가 항상 존재한다고 가정하여 메타데이터 정보로 동작합니다.
     */
    public async assembleDamperCover(options?: {
        duration?: number;
        onComplete?: () => void;
    }): Promise<void> {
        console.log('[DamperCoverAssemblyService] Starting Metadata-based Assembly...');

        if (!this.sceneRoot) {
            console.error('[DamperCoverAssemblyService] Scene root not initialized.');
            return;
        }

        const nodeNameManager = getNodeNameManager();
        const coverNode = this.sceneRoot.getObjectByName(
            nodeNameManager.getNodeName('fridge.leftDoor.damperCoverBody')!
        ) as THREE.Mesh;
        const assemblyNode = this.sceneRoot.getObjectByName(
            nodeNameManager.getNodeName('fridge.leftDoor.damperAssembly')!
        ) as THREE.Mesh;

        if (!coverNode || !assemblyNode) {
            console.error('[DamperCoverAssemblyService] Target nodes not found for assembly:', {
                coverName: nodeNameManager.getNodeName('fridge.leftDoor.damperCoverBody'),
                assemblyName: nodeNameManager.getNodeName('fridge.leftDoor.damperAssembly')
            });
            return;
        }

        let targetPosition = new THREE.Vector3();
        let plugWorldPos: THREE.Vector3 | null = null;
        let holeWorldPositions: THREE.Vector3[] = [];

        // 메타데이터 로드
        const metadataLoader = getMetadataLoader();
        const assemblyKey = 'damper_cover_assembly';

        if (!metadataLoader.isLoaded()) {
            try {
                console.log('[DamperCoverAssemblyService] Loading metadata from /metadata/assembly-offsets.json...');
                await metadataLoader.loadMetadata('/metadata/assembly-offsets.json');
                console.log('[DamperCoverAssemblyService] Metadata loaded successfully');
            } catch (error) {
                console.error('[DamperCoverAssemblyService] Metadata loading failed:', error);
                throw new Error('[DamperCoverAssemblyService] Failed to load metadata');
            }
        }

        const config = metadataLoader.getAssemblyConfig(assemblyKey);
        if (!config) {
            throw new Error(`[DamperCoverAssemblyService] Config not found for key: ${assemblyKey}`);
        }

        console.log('[DamperCoverAssemblyService] Applying metadata-based assembly with grooveDetection parameters.');

        const grooveParams = config.grooveDetection;

        // [Cover 분석] 결합 돌출부(Plug) 탐지
        const plugAnalyses = GrooveDetectionUtils.calculatePlugByEdgeAnalysis(
            coverNode,
            grooveParams.plugSearchDirection
                ? new THREE.Vector3(
                    grooveParams.plugSearchDirection.x,
                    grooveParams.plugSearchDirection.y,
                    grooveParams.plugSearchDirection.z
                )
                : new THREE.Vector3(0, -1, 0),
            grooveParams.edgeAngleThreshold ?? 60,
            grooveParams.plugClusteringDistance ?? 0.005
        );

        // 댐퍼 어셈블리 노드에서 홈 탐지 및 하이라이트 실행
        await this.grooveDetectionService.detectAndHighlightGrooves(
            nodeNameManager.getNodeName('fridge.leftDoor.damperAssembly')!
        );

        // 탐지된 홈 중심점 정보 가져오기
        const holeCenters = this.grooveDetectionService.getHoleCenters();
        holeWorldPositions = holeCenters.map(h => h.position);

        if (plugAnalyses.length > 0 && holeWorldPositions.length > 0) {
            console.log(`[DamperCoverAssemblyService] Vertex Analysis success. Plug: ${plugAnalyses.length}, Hole: ${holeWorldPositions.length}`);

            const validPlugs = plugAnalyses.filter(p => p.filteredVerticesCount < 2000);
            const primaryPlug = validPlugs.length > 0
                ? validPlugs.sort((a, b) => b.position.y - a.position.y)[0]
                : plugAnalyses[0];

            plugWorldPos = primaryPlug.position;

            const currentPlugPos = plugWorldPos;
            if (!currentPlugPos) throw new Error('[DamperCoverAssemblyService] Plug position is null');

            const primaryHoleWorldPos = holeWorldPositions.sort((a, b) => {
                const distA = a.distanceTo(currentPlugPos!);
                const distB = b.distanceTo(currentPlugPos!);
                return distA - distB;
            })[0];

            const moveDelta = new THREE.Vector3().subVectors(primaryHoleWorldPos, currentPlugPos!);
            const currentCoverPos = coverNode.position.clone();
            targetPosition.addVectors(currentCoverPos, moveDelta);
        } else {
            throw new Error('[DamperCoverAssemblyService] Vertex analysis failed. No plug or hole detected.');
        }

        const currentCoverWorldPos = new THREE.Vector3();
        coverNode.getWorldPosition(currentCoverWorldPos);

        const targetWorldPos = new THREE.Vector3();
        const parentNode = coverNode.parent;
        if (parentNode) {
            (parentNode as THREE.Object3D).localToWorld(targetWorldPos.copy(targetPosition));
        } else {
            targetWorldPos.copy(targetPosition);
        }

        // 경로 시각화
        this.assemblyPathVisualizer.visualizeAssemblyPath(
            currentCoverWorldPos,
            targetWorldPos,
            plugWorldPos || undefined,
            holeWorldPositions.length > 0 ? holeWorldPositions : undefined
        );

        const animationConfig = config?.animation;

        return new Promise((resolve) => {
            gsap.to(coverNode.position, {
                x: targetPosition.x,
                y: targetPosition.y,
                z: targetPosition.z,
                duration: options?.duration || (animationConfig?.duration ? animationConfig.duration / 1000 : 1.5),
                ease: animationConfig?.easing || 'power2.inOut',
                onComplete: () => {
                    this.assemblyPathVisualizer.clearDebugObjects();
                    console.log('[DamperCoverAssemblyService] Completed using metadata');
                    if (options?.onComplete) options.onComplete();
                    resolve();
                }
            });
        });
    }

    /**
     * 서비스를 정리합니다.
     */
    public dispose(): void {
        this.assemblyPathVisualizer.dispose();
        this.grooveDetectionService.dispose();
        this.sceneRoot = null;
        console.log('[DamperCoverAssemblyService] 서비스 정리 완료');
    }
}

// 싱글톤 인스턴스 관리
let damperCoverAssemblyServiceInstance: DamperCoverAssemblyService | null = null;

/**
 * 댐퍼 커버 조립 서비스 인스턴스를 반환합니다.
 * @returns DamperCoverAssemblyService 인스턴스
 */
export function getDamperCoverAssemblyService(): DamperCoverAssemblyService {
    if (!damperCoverAssemblyServiceInstance) {
        damperCoverAssemblyServiceInstance = new DamperCoverAssemblyService();
    }
    return damperCoverAssemblyServiceInstance;
}
