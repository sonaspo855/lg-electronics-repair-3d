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
            nodeNameManager.getNodeName('fridge.leftDoor.damperCoverBody')!
        ) as THREE.Mesh;
        const assemblyNode = this.sceneRoot.getObjectByName(
            nodeNameManager.getNodeName('fridge.leftDoor.damperAssembly')!
        ) as THREE.Mesh;

        if (!coverNode || !assemblyNode) {
            console.error('Target nodes not found for assembly:', {
                coverName: nodeNameManager.getNodeName('fridge.leftDoor.damperCoverBody'),
                assemblyName: nodeNameManager.getNodeName('fridge.leftDoor.damperAssembly')
            });
            return;
        }

        let plugWorldPos: THREE.Vector3 | null = null;
        let holeWorldPositions: THREE.Vector3[] = [];

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
        console.log('this.detectedPlugs>> ', this.detectedPlugs);

        // 댐퍼 어셈블리 노드에서 홈 탐지 및 하이라이트 실행
        this.detectedHoles = await this.grooveDetectionService.detectAndHighlightGrooves(
            nodeNameManager.getNodeName('fridge.leftDoor.damperAssembly')!
        );
        console.log('this.detectedHoles>>> ', this.detectedHoles);




        // 탐지된 홈 중심점 정보 가져오기  - position은 월드 좌표로 변환된 값
        const holeCenters = this.grooveDetectionService.getHoleCenters();
        holeWorldPositions = holeCenters.map(h => h.position);

        if (this.detectedPlugs.length > 0 && holeWorldPositions.length > 0) {
            // 돌출부와 홈 매칭: 이미 필터링된 돌출부 정보 사용
            const primaryPlug = this.detectedPlugs.sort((a, b) => b.filteredVerticesCount - a.filteredVerticesCount)[0];
            const currentPlugWorldPos = primaryPlug.position;

            // 가장 가까운 홈 찾기 (월드 좌표계 기준 비교)
            const primaryHoleWorldPos = holeWorldPositions.sort((a, b) => {
                const distA = a.distanceTo(currentPlugWorldPos);
                const distB = b.distanceTo(currentPlugWorldPos);
                return distA - distB;
            })[0];

            // primaryHoleWorldPos와 일치하는 홈 정보 찾기
            const primaryHoleInfo = this.detectedHoles.find(hole =>
                new THREE.Vector3(hole.position.x, hole.position.y, hole.position.z)
                    .distanceTo(primaryHoleWorldPos) < 0.001
            );

            // 돌출부에서 홈으로의 이동 벡터 계산
            const moveVector = new THREE.Vector3().subVectors(primaryHoleWorldPos, currentPlugWorldPos);

            // 커버 노드의 현재 월드 좌표
            const currentCoverWorldPos = new THREE.Vector3();
            coverNode.getWorldPosition(currentCoverWorldPos);

            // 목표 월드 좌표 = 현재 커버 좌표 + 이동 벡터
            const targetWorldPos = new THREE.Vector3().addVectors(currentCoverWorldPos, moveVector);

            // [개선] 홈의 insertionDirection을 사용하여 depth 오프셋 계산
            if (config.insertion && config.insertion.depth !== undefined) {
                // 홈의 insertionDirection이 있는 경우 우선 사용
                const insertionDir = primaryHoleInfo?.insertionDirection
                    ? new THREE.Vector3(
                        primaryHoleInfo.insertionDirection.x,
                        primaryHoleInfo.insertionDirection.y,
                        primaryHoleInfo.insertionDirection.z
                    ).normalize()
                    : primaryPlug.insertionDirection.clone().normalize();

                const depthOffset = insertionDir.multiplyScalar(config.insertion.depth * 0.01);
                targetWorldPos.add(depthOffset);
            }

            // 회전 보정 (회전은 기존대로 유지)
            if (config.insertion && config.insertion.rotationOffset) {
                const rotationOffset = new THREE.Vector3(
                    config.insertion.rotationOffset.x || 0,
                    config.insertion.rotationOffset.y || 0,
                    config.insertion.rotationOffset.z || 0
                );
                coverNode.rotation.x += rotationOffset.x;
                coverNode.rotation.y += rotationOffset.y;
                coverNode.rotation.z += rotationOffset.z;
            }

            // 애니메이션 파라미터 준비
            const animationConfig = config?.animation;
            const totalDuration = options?.duration || (animationConfig?.duration ? animationConfig.duration / 1000 : 1.5);

            // [디버깅] 애니메이션 파라미터 로그
            console.log('[디버깅] 애니메이션 파라미터:', {
                totalDuration,
                animationConfig
            });

            // [디버깅] 좌표 정보 로그
            console.log('[디버깅] 좌표 정보:', {
                currentCoverWorldPos: currentCoverWorldPos.toArray(),
                targetWorldPos: targetWorldPos.toArray(),
                distanceToTarget: currentCoverWorldPos.distanceTo(targetWorldPos)
            });

            /* // 경로 시각화
            this.assemblyPathVisualizer.visualizeAssemblyPath(
                currentCoverWorldPos,  // 시작점
                targetWorldPos,  // 종료점
                plugWorldPos || undefined,  // 돌출부
                holeWorldPositions.length > 0 ? holeWorldPositions : undefined  // 홈
            ); */

            // 3. 월드 좌표 애니메이션 상태 객체
            const animState = {
                x: currentCoverWorldPos.x,
                y: currentCoverWorldPos.y,
                z: currentCoverWorldPos.z
            };

            const parentNode = coverNode.parent;
            const updatePosition = () => {
                const currentWorldPos = new THREE.Vector3(animState.x, animState.y, animState.z);
                if (parentNode) {
                    // 월드 좌표를 복제한 후 로컬 좌표로 변환
                    const localPos = parentNode.worldToLocal(currentWorldPos.clone());
                    coverNode.position.copy(localPos);
                } else {
                    coverNode.position.copy(currentWorldPos);
                }
                coverNode.updateMatrixWorld(true);
            };

            return new Promise((resolve) => {
                console.log('[디버깅] GSAP World-Coordinates Timeline 시작 (단일 단계 직선 이동)');
                const tl = gsap.timeline({
                    onComplete: () => {
                        console.log('[디버깅] 애니메이션 완료');
                        this.assemblyPathVisualizer.clearDebugObjects();
                        if (options?.onComplete) options.onComplete();
                        resolve();
                    },
                    onReverseComplete: () => {
                        console.log('[디버깅] 애니메이션 역재생 완료');
                        resolve();
                    }
                });

                // 단일 단계: 시작점에서 최종 목적지까지 직선 이동
                tl.to(animState, {
                    x: targetWorldPos.x,
                    y: targetWorldPos.y,
                    z: targetWorldPos.z,
                    duration: totalDuration,
                    ease: animationConfig?.easing || 'power2.inOut',
                    onStart: () => {
                        console.log('[디버깅] 직선 이동 시작', {
                            from: { x: animState.x, y: animState.y, z: animState.z },
                            to: { x: targetWorldPos.x, y: targetWorldPos.y, z: targetWorldPos.z },
                            duration: totalDuration
                        });
                    },
                    onUpdate: () => {
                        updatePosition();
                    }
                });
            });
        } else {
            throw new Error('Vertex analysis failed. No plug or hole detected.');
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
