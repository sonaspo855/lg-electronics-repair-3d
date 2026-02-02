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
        await this.grooveDetectionService.detectAndHighlightGrooves(
            nodeNameManager.getNodeName('fridge.leftDoor.damperAssembly')!
        );

        // 탐지된 홈 중심점 정보 가져오기  - position은 월드 좌표로 변환된 값
        const holeCenters = this.grooveDetectionService.getHoleCenters();
        holeWorldPositions = holeCenters.map(h => h.position);

        const moveDelta = new THREE.Vector3();
        if (plugAnalyses.length > 0 && holeWorldPositions.length > 0) {
            // [개선] 다중 돌출부/홈 매칭: 모든 돌출부와 홈을 매칭하여 최적의 이동 벡터 계산
            const validPlugs = plugAnalyses.filter(p => p.filteredVerticesCount < 2000);
            const primaryPlug = validPlugs.length > 0
                ? validPlugs.sort((a, b) => b.filteredVerticesCount - a.filteredVerticesCount)[0]
                : plugAnalyses[0];

            // 추출된 좌표는 이미 월드 좌표임
            plugWorldPos = primaryPlug.position;

            const currentPlugWorldPos = plugWorldPos;
            if (!currentPlugWorldPos) throw new Error('Plug position is null');

            // 가장 가까운 홈 찾기 (월드 좌표계 기준 비교)
            const primaryHoleWorldPos = holeWorldPositions.sort((a, b) => {
                const distA = a.distanceTo(currentPlugWorldPos!);
                const distB = b.distanceTo(currentPlugWorldPos!);
                return distA - distB;
            })[0];

            // 월드 좌표계에서의 이동 벡터 계산
            moveDelta.subVectors(primaryHoleWorldPos, currentPlugWorldPos!);

            // 1. 최종 목표 월드 좌표 계산
            const currentCoverWorldPos = new THREE.Vector3();
            coverNode.getWorldPosition(currentCoverWorldPos);
            const targetWorldPos = new THREE.Vector3().addVectors(currentCoverWorldPos, moveDelta);

            // 2. 메타데이터 기반 미세 조정 (월드 좌표계에 적용)
            if (config.insertion && config.insertion.offset) {
                const offset = new THREE.Vector3(
                    config.insertion.offset.x || 0,
                    config.insertion.offset.y || 0,
                    config.insertion.offset.z || 0
                );
                targetWorldPos.add(offset);
            }

            if (config.insertion && config.insertion.depth !== undefined) {
                const insertionDir = primaryPlug.insertionDirection.clone().normalize();
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
            const stages = animationConfig?.stages || [
                { name: 'approach', progress: 0.7 },
                { name: 'insert', progress: 1.0 }
            ];

            const approachStage = stages.find(s => s.name === 'approach') || { progress: 0.7 };
            const totalDuration = options?.duration || (animationConfig?.duration ? animationConfig.duration / 1000 : 1.5);
            const approachDuration = totalDuration * approachStage.progress;
            const insertDuration = totalDuration * (1.0 - approachStage.progress);

            // [디버깅] 애니메이션 파라미터 로그
            console.log('[디버깅] 애니메이션 파라미터:', {
                totalDuration,
                approachStageProgress: approachStage.progress,
                approachDuration,
                insertDuration,
                stages
            });

            // 접근 단계 목적지 (월드 좌표)
            const approachWorldPos = new THREE.Vector3().lerpVectors(
                currentCoverWorldPos,
                targetWorldPos,
                approachStage.progress
            );

            // [디버깅] 좌표 정보 로그
            console.log('[디버깅] 좌표 정보:', {
                currentCoverWorldPos: currentCoverWorldPos.toArray(),
                targetWorldPos: targetWorldPos.toArray(),
                approachWorldPos: approachWorldPos.toArray(),
                distanceToTarget: currentCoverWorldPos.distanceTo(targetWorldPos),
                distanceToApproach: currentCoverWorldPos.distanceTo(approachWorldPos),
                approachToTargetDistance: approachWorldPos.distanceTo(targetWorldPos)
            });

            // 경로 시각화
            this.assemblyPathVisualizer.visualizeAssemblyPath(
                currentCoverWorldPos,
                targetWorldPos,
                plugWorldPos || undefined,
                holeWorldPositions.length > 0 ? holeWorldPositions : undefined
            );

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
                    parentNode.worldToLocal(coverNode.position.copy(currentWorldPos));
                } else {
                    coverNode.position.copy(currentWorldPos);
                }
                coverNode.updateMatrixWorld(true);
            };

            return new Promise((resolve) => {
                console.log('[디버깅] GSAP World-Coordinates Timeline 시작');
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

                // [디버깅] 타임라인 상태 확인
                console.log('[디버깅] 타임라인 생성 완료:', {
                    duration: tl.duration(),
                    progress: tl.progress(),
                    isActive: tl.isActive()
                });

                // 1단계: 접근
                tl.to(animState, {
                    x: approachWorldPos.x,
                    y: approachWorldPos.y,
                    z: approachWorldPos.z,
                    duration: approachDuration,
                    ease: animationConfig?.easing || 'power2.out',
                    onStart: () => {
                        console.log('[디버깅] 접근 단계 시작', {
                            from: { x: animState.x, y: animState.y, z: animState.z },
                            to: { x: approachWorldPos.x, y: approachWorldPos.y, z: approachWorldPos.z },
                            duration: approachDuration
                        });
                    },
                    onUpdate: () => {
                        updatePosition();
                        /* console.log('[디버깅] 접근 단계 진행 중:', {
                            progress: tl.progress(),
                            position: { x: animState.x, y: animState.y, z: animState.z }
                        }); */
                    },
                    onComplete: () => {
                        console.log('[디버깅] 접근 단계 완료', {
                            finalPosition: { x: animState.x, y: animState.y, z: animState.z }
                        });
                    }
                });

                // [디버깅] 1단계 추가 후 타임라인 상태 확인
                console.log('[디버깅] 1단계(접근) 추가 후 타임라인:', {
                    duration: tl.duration(),
                    childrenCount: tl.getChildren().length
                });

                // 2단계: 삽입
                tl.to(animState, {
                    x: targetWorldPos.x,
                    y: targetWorldPos.y,
                    z: targetWorldPos.z,
                    duration: insertDuration,
                    ease: 'power1.inOut',
                    onStart: () => {
                        console.log('[디버깅] 삽입 단계 시작', {
                            from: { x: animState.x, y: animState.y, z: animState.z },
                            to: { x: targetWorldPos.x, y: targetWorldPos.y, z: targetWorldPos.z },
                            duration: insertDuration,
                            insertDurationIsZero: insertDuration === 0
                        });
                    },
                    onUpdate: () => {
                        updatePosition();
                        console.log('[디버깅] 삽입 단계 진행 중:', {
                            progress: tl.progress(),
                            position: { x: animState.x, y: animState.y, z: animState.z }
                        });
                    },
                    onComplete: () => {
                        console.log('[디버깅] 삽입 단계 완료', {
                            finalPosition: { x: animState.x, y: animState.y, z: animState.z }
                        });
                    }
                });

                // [디버깅] 2단계 추가 후 타임라인 상태 확인
                console.log('[디버깅] 2단계(삽입) 추가 후 타임라인:', {
                    totalDuration: tl.duration(),
                    childrenCount: tl.getChildren().length,
                    timelineActive: tl.isActive()
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
