import * as THREE from 'three';
import gsap from 'gsap';
import { getNodeNameManager } from '../../shared/utils/NodeNameManager';
import { getMetadataLoader } from '../../shared/utils/MetadataLoader';
import { NormalBasedHighlight } from '../../shared/utils/NormalBasedHighlight';
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
    private detectedPlugs: Array<{
        position: THREE.Vector3;
        rotationAxis: THREE.Vector3;
        insertionDirection: THREE.Vector3;
        filteredVerticesCount: number;
    }> = [];
    private detectedHoles: Array<{
        position: THREE.Vector3;
        rotationAxis?: THREE.Vector3;
        insertionDirection?: THREE.Vector3;
        filteredVerticesCount?: number;
    }> = [];

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
    }

    /**
     * 댐퍼 커버 조립 (메타데이터 기반)
     * 메타데이터가 항상 존재한다고 가정하여 메타데이터 정보로 동작합니다.
     */
    public async assembleDamperCover(options?: {
        duration?: number;
        onComplete?: () => void;
    }): Promise<void> {
        if (!this.sceneRoot) {
            console.error('Scene root not initialized.');
            return;
        }

        const nodeNameManager = getNodeNameManager();
        const coverNode = this.sceneRoot.getObjectByName(
            nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody')!
        ) as THREE.Mesh;
        const assemblyNode = this.sceneRoot.getObjectByName(
            nodeNameManager.getNodeName('fridge.leftDoorDamper.damperAssembly')!
        ) as THREE.Mesh;

        if (!coverNode || !assemblyNode) {
            console.error('Target nodes not found for assembly:', {
                coverName: nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody'),
                assemblyName: nodeNameManager.getNodeName('fridge.leftDoorDamper.damperAssembly')
            });
            return;
        }

        // 메타데이터 로드
        const metadataLoader = getMetadataLoader();
        const assemblyKey = 'damper_cover_assembly';

        if (!metadataLoader.isLoaded()) {
            try {
                await metadataLoader.loadMetadata('/metadata/assembly-offsets.json');
            } catch (error) {
                console.error('Metadata loading failed:', error);
                throw new Error('Failed to load metadata');
            }
        }

        const config = metadataLoader.getAssemblyConfig(assemblyKey);
        if (!config) {
            throw new Error(`Config not found for key: ${assemblyKey}`);
        }

        const grooveParams = config.grooveDetection;

        // [Cover 분석] 결합 돌출부(Plug) 탐지
        const plugAnalyses = NormalBasedHighlight.calculatePlugByEdgeAnalysis(
            coverNode,
            grooveParams.plugSearchDirection ?? new THREE.Vector3(0, 1, 0),
            grooveParams.edgeAngleThreshold ?? 60,
            grooveParams.plugClusteringDistance ?? 0.005
        );

        // 탐지된 돌출부 필터링 (너무 가까운 포인트 중복 제거) - position은 월드 좌표로 변환된 값
        this.detectedPlugs = this.filterDuplicatePlugs(
            plugAnalyses,
            (grooveParams.plugClusteringDistance ?? 0.005) * 1.5
        );
        // console.log('this.detectedPlugs>> ', this.detectedPlugs);

        // 댐퍼 어셈블리 노드에서 홈 탐지 및 하이라이트 실행
        this.detectedHoles = await this.grooveDetectionService.detectAndHighlightGrooves(
            nodeNameManager.getNodeName('fridge.leftDoorDamper.damperAssembly')!
        );
        // console.log('this.detectedHoles>>> ', this.detectedHoles);


        // 탐지된 좌표 시각화 (AssemblyPathVisualizer 사용)
        // this.assemblyPathVisualizer.visualizeDetectedCoordinates(this.detectedPlugs, this.detectedHoles);

        // 돌출부 좌표부터 가장 가까운 홈 좌표까지 coverNode 선형 이동
        if (this.detectedPlugs.length > 0 && this.detectedHoles.length > 0) {
            let minDistance = Infinity;
            let bestPlug = this.detectedPlugs[0];
            let bestHole = this.detectedHoles[0];

            // 모든 플러그와 홈 사이의 최단 거리 쌍 찾기
            for (const plug of this.detectedPlugs) {
                for (const hole of this.detectedHoles) {
                    const dist = plug.position.distanceTo(hole.position);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestPlug = plug;
                        bestHole = hole;
                    }
                }
            }

            // console.log(`[조립] 최단 거리 쌍 발견: 거리 ${minDistance.toFixed(5)}`, { bestPlug, bestHole });

            // 월드 이동 벡터 계산 (플러그가 홈 위치로 가야 함)
            const worldMoveVector = new THREE.Vector3().subVectors(bestHole.position, bestPlug.position);

            // 선형 이동 거리를 줄임 (오프셋 추가)
            // 현재 위치에서 목표 위치로 향하는 직선 경로상에서 일정 거리만큼 덜 이동하게 함
            const offsetDistance = 0.0005;
            const totalDistance = worldMoveVector.length();
            const reducedDistance = Math.max(0, totalDistance - offsetDistance);

            if (totalDistance > 0) {
                worldMoveVector.normalize().multiplyScalar(reducedDistance);
            }

            // 목표 월드 좌표 계산 (현재 커버 위치 + 이동 벡터)
            const currentWorldPos = new THREE.Vector3();
            coverNode.getWorldPosition(currentWorldPos);
            const targetWorldPos = currentWorldPos.clone().add(worldMoveVector);

            // 부모 좌표계로 변환 (로컬 position 업데이트를 위해)
            const targetLocalPos = coverNode.parent
                ? coverNode.parent.worldToLocal(targetWorldPos.clone())
                : targetWorldPos;

            // GSAP 선형 이동 애니메이션
            await new Promise<void>((resolve) => {
                gsap.to(coverNode.position, {
                    x: targetLocalPos.x,
                    y: targetLocalPos.y,
                    z: targetLocalPos.z,
                    duration: options?.duration ? options.duration / 1000 : 1.5,
                    ease: 'power2.inOut',
                    onComplete: () => {
                        console.log('커버 노드 이동 완료');
                        if (options?.onComplete) options.onComplete();
                        resolve();
                    }
                });
            });
        }
    }

    /**
     * 서비스를 정리합니다.
     */
    public dispose(): void {
        this.assemblyPathVisualizer.dispose();
        this.grooveDetectionService.dispose();
        this.sceneRoot = null;
    }

    /**
     * 탐지된 돌출부(Plug) 정보를 반환합니다.
     * @returns 탐지된 돌출부 정보 배열
     */
    public getDetectedPlugs(): Array<{
        position: THREE.Vector3;
        rotationAxis: THREE.Vector3;
        insertionDirection: THREE.Vector3;
        filteredVerticesCount: number;
    }> {
        return this.detectedPlugs;
    }

    /**
     * 탐지된 돌출부 중 너무 가까운 것들을 필터링하여 하나로 합칩니다.
     * @param plugs 탐지된 돌출부 배열
     * @param threshold 거리 임계값
     */
    private filterDuplicatePlugs(
        plugs: Array<{
            position: THREE.Vector3;
            rotationAxis: THREE.Vector3;
            insertionDirection: THREE.Vector3;
            filteredVerticesCount: number;
        }>,
        threshold: number
    ): Array<{
        position: THREE.Vector3;
        rotationAxis: THREE.Vector3;
        insertionDirection: THREE.Vector3;
        filteredVerticesCount: number;
    }> {
        if (plugs.length <= 1) return plugs;

        const uniquePlugs: typeof plugs = [];

        plugs.forEach(plug => {
            let isDuplicate = false;
            for (const unique of uniquePlugs) {
                if (plug.position.distanceTo(unique.position) < threshold) {
                    // 이미 존재하는 포인트와 너무 가까우면, 정점 수가 더 많은 것을 선택
                    if (plug.filteredVerticesCount > unique.filteredVerticesCount) {
                        unique.position.copy(plug.position);
                        unique.rotationAxis.copy(plug.rotationAxis);
                        unique.insertionDirection.copy(plug.insertionDirection);
                        unique.filteredVerticesCount = plug.filteredVerticesCount;
                    }
                    isDuplicate = true;
                    break;
                }
            }

            if (!isDuplicate) {
                uniquePlugs.push({
                    position: plug.position.clone(),
                    rotationAxis: plug.rotationAxis.clone(),
                    insertionDirection: plug.insertionDirection.clone(),
                    filteredVerticesCount: plug.filteredVerticesCount
                });
            }
        });

        return uniquePlugs;
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
