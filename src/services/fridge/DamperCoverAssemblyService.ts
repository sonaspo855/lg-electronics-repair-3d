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

        let targetPosition = new THREE.Vector3();
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

        // 탐지된 돌출부 필터링 (너무 가까운 포인트 중복 제거)
        this.detectedPlugs = this.filterDuplicatePlugs(
            plugAnalyses,
            (grooveParams.plugClusteringDistance ?? 0.005) * 1.5
        );
        console.log('this.detectedPlugs>> ', this.detectedPlugs);

        // 댐퍼 어셈블리 노드에서 홈 탐지 및 하이라이트 실행
        await this.grooveDetectionService.detectAndHighlightGrooves(
            nodeNameManager.getNodeName('fridge.leftDoor.damperAssembly')!
        );

        // 탐지된 홈 중심점 정보 가져오기
        const holeCenters = this.grooveDetectionService.getHoleCenters();
        holeWorldPositions = holeCenters.map(h => h.position);

        if (plugAnalyses.length > 0 && holeWorldPositions.length > 0) {
            // [개선] 다중 돌출부/홈 매칭: 모든 돌출부와 홈을 매칭하여 최적의 이동 벡터 계산
            const validPlugs = plugAnalyses.filter(p => p.filteredVerticesCount < 2000);
            const primaryPlug = validPlugs.length > 0
                ? validPlugs.sort((a, b) => b.filteredVerticesCount - a.filteredVerticesCount)[0]
                : plugAnalyses[0];

            plugWorldPos = primaryPlug.position;

            const currentPlugPos = plugWorldPos;
            if (!currentPlugPos) throw new Error('Plug position is null');

            // 가장 가까운 홈 찾기
            const primaryHoleWorldPos = holeWorldPositions.sort((a, b) => {
                const distA = a.distanceTo(currentPlugPos!);
                const distB = b.distanceTo(currentPlugPos!);
                return distA - distB;
            })[0];

            // 기본 이동 델타 계산
            const moveDelta = new THREE.Vector3().subVectors(primaryHoleWorldPos, currentPlugPos!);
            const currentCoverPos = coverNode.position.clone();
            targetPosition.addVectors(currentCoverPos, moveDelta);

            // [개선] 메타데이터 기반 미세 조정 (Offset Mapping)
            // Position Offset: insertion.offset 값을 최종 좌표에 추가하여 정밀 정렬
            if (config.insertion && config.insertion.offset) {
                const offset = new THREE.Vector3(
                    config.insertion.offset.x || 0,
                    config.insertion.offset.y || 0,
                    config.insertion.offset.z || 0
                );
                targetPosition.add(offset);
            }

            // Insertion Depth: insertion.depth를 활용하여 홈 내부로 삽입되는 깊이 조절
            if (config.insertion && config.insertion.depth !== undefined) {
                const insertionDir = primaryPlug.insertionDirection.clone().normalize();
                const depthOffset = insertionDir.multiplyScalar(config.insertion.depth * 0.01); // depth를 적절한 스케일로 변환
                targetPosition.add(depthOffset);
            }

            // [개선] 회전 보정: insertionDirection을 활용하여 정확한 삽입 각도 보정
            if (config.insertion && config.insertion.rotationOffset) {
                const rotationOffset = new THREE.Vector3(
                    config.insertion.rotationOffset.x || 0,
                    config.insertion.rotationOffset.y || 0,
                    config.insertion.rotationOffset.z || 0
                );
                // 회전 보정은 coverNode의 회전에 적용
                coverNode.rotation.x += rotationOffset.x;
                coverNode.rotation.y += rotationOffset.y;
                coverNode.rotation.z += rotationOffset.z;
            }
        } else {
            throw new Error('Vertex analysis failed. No plug or hole detected.');
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
        const stages = animationConfig?.stages || [
            { name: 'approach', progress: 0.7 },
            { name: 'insert', progress: 1.0 }
        ];

        console.log('시네마틱 조립 애니메이션: 2단계 시퀀스 (접근 단계 + 삽입 단계)');
        // [개선] 시네마틱 조립 애니메이션: 2단계 시퀀스 (접근 단계 + 삽입 단계)
        const approachStage = stages.find(s => s.name === 'approach') || { progress: 0.7 };
        const insertStage = stages.find(s => s.name === 'insert') || { progress: 1.0 };

        const totalDuration = options?.duration || (animationConfig?.duration ? animationConfig.duration / 1000 : 1.5);
        const approachDuration = totalDuration * approachStage.progress;
        const insertDuration = totalDuration * (insertStage.progress - approachStage.progress);

        console.log('애니메이션 설정:', {
            totalDuration,
            approachDuration,
            insertDuration,
            approachProgress: approachStage.progress,
            insertProgress: insertStage.progress
        });

        // 접근 단계 목적지 (홈 입구 근처) - 로컬 좌표로 계산
        const approachWorldPos = new THREE.Vector3().lerpVectors(
            currentCoverWorldPos,
            targetWorldPos,
            approachStage.progress
        );
        const approachTarget = new THREE.Vector3();
        if (parentNode) {
            (parentNode as THREE.Object3D).worldToLocal(approachTarget.copy(approachWorldPos));
        } else {
            approachTarget.copy(approachWorldPos);
        }

        console.log('좌표 정보:', {
            currentCoverPos: coverNode.position,
            approachTarget,
            targetPosition,
            currentCoverWorldPos,
            targetWorldPos
        });

        return new Promise((resolve) => {
            console.log('GSAP Timeline 생성 시작');
            // GSAP Timeline을 사용하여 2단계 시퀀스 구현
            const timeline = gsap.timeline({
                paused: false, // 명시적으로 실행 상태 지정
                onComplete: () => {
                    console.log('애니메이션 완료');
                    this.assemblyPathVisualizer.clearDebugObjects();
                    if (options?.onComplete) options.onComplete();
                    resolve();
                },
                onReverseComplete: () => {
                    console.log('애니메이션 역방향 완료');
                    this.assemblyPathVisualizer.clearDebugObjects();
                    if (options?.onComplete) options.onComplete();
                    resolve();
                }
            });

            console.log('1단계: 접근 단계 애니메이션 추가');
            // 1단계: 접근 단계 (홈 입구 근처까지 부드럽게 이동)
            timeline.to(coverNode.position, {
                x: approachTarget.x,
                y: approachTarget.y,
                z: approachTarget.z,
                duration: approachDuration,
                ease: animationConfig?.easing || 'power2.out',
                onStart: () => {
                    console.log('접근 단계 시작');
                },
                onUpdate: () => {
                    // Three.js 렌더링을 위해 업데이트 필요 시
                    if (coverNode.parent) {
                        coverNode.parent.updateMatrixWorld(true);
                    }
                }
            });

            console.log('2단계: 삽입 단계 애니메이션 추가');
            // 2단계: 삽입 단계 (홈 내부로 정밀하게 결합)
            timeline.to(coverNode.position, {
                x: targetPosition.x,
                y: targetPosition.y,
                z: targetPosition.z,
                duration: insertDuration,
                ease: 'power1.inOut', // 삽입 시 더 부드러운 이징
                onStart: () => {
                    console.log('삽입 단계 시작');
                },
                onUpdate: () => {
                    // Three.js 렌더링을 위해 업데이트 필요 시
                    if (coverNode.parent) {
                        coverNode.parent.updateMatrixWorld(true);
                    }
                }
            });

            console.log('Timeline 생성 완료, 재생 시작');
            timeline.play(); // 명시적으로 재생 시작
        });
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
