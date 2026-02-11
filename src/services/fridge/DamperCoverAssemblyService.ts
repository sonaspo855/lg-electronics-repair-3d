import * as THREE from 'three';
import gsap from 'gsap';
import { getNodeNameManager } from '../../shared/utils/NodeNameManager';
import { getMetadataLoader } from '../../shared/utils/MetadataLoader';
import { NormalBasedHighlight } from '../../shared/utils/NormalBasedHighlight';
import { getAssemblyPathVisualizer } from '../../shared/utils/AssemblyPathVisualizer';
import { getGrooveDetectionService } from '../../shared/utils/GrooveDetectionService';
import { getPreciseBoundingBox } from '../../shared/utils/commonUtils';

/**
 * 댐퍼 커버 조립 서비스
 * 댐퍼 커버 조립 로직을 담당
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
    private nodeNameManager = getNodeNameManager();
    private metadataLoader = getMetadataLoader();

    /**
     * 댐퍼 커버 조립 서비스를 초기화
     * @param sceneRoot 씬 루트 객체
     */
    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
        this.assemblyPathVisualizer.initialize(sceneRoot);
        this.grooveDetectionService.initialize(sceneRoot);

        this.nodeNameManager.enableMetadataMode();
    }

    /**
     * 댐퍼 돌출부/홈 결합
     */
    public async assembleDamperCover(options?: {
        duration?: number;
        onComplete?: () => void;
    }): Promise<{
        position: { x: number; y: number; z: number };
        duration: number;
        easing: string;
    } | null> {
        if (!this.sceneRoot) {
            console.error('Scene root not initialized.');
            return null;
        }

        const coverNode = this.sceneRoot.getObjectByName(this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody')!) as THREE.Mesh;
        const assemblyNode = this.sceneRoot.getObjectByName(this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperAssembly')!) as THREE.Mesh;

        if (!coverNode || !assemblyNode) {
            console.error('Target nodes not found for assembly:', {
                coverName: this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody'),
                assemblyName: this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperAssembly')
            });
            return null;
        }

        const assemblyKey = 'damper_cover_assembly';

        if (!this.metadataLoader.isLoaded()) {
            try {
                await this.metadataLoader.loadMetadata('/metadata/assembly-offsets.json');
            } catch (error) {
                console.error('Metadata loading failed:', error);
                throw new Error('Failed to load metadata');
            }
        }

        const config = this.metadataLoader.getAssemblyConfig(assemblyKey);
        if (!config) {
            throw new Error(`Config not found for key: ${assemblyKey}`);
        }

        const grooveParams = config.grooveDetection;

        // 결합 돌출부(Plug) 탐지
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
            this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperAssembly')!
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
            // targetLocalPos: 이동될 목표 위치의 좌표
            const targetLocalPos = coverNode.parent
                ? coverNode.parent.worldToLocal(targetWorldPos.clone())
                : targetWorldPos;

            // GSAP 선형 이동 애니메이션
            // const duration = options?.duration ? options.duration / 1000 : 1.5;
            const duration = options?.duration;

            if (!duration) {
                return null;
            }

            const easing = 'power2.inOut';

            await new Promise<void>((resolve) => {
                gsap.to(coverNode.position, {
                    x: targetLocalPos.x,
                    y: targetLocalPos.y,
                    z: targetLocalPos.z,
                    duration: duration / 1000, // 밀리초를 초 단위로 변환
                    ease: easing,
                    onComplete: () => {
                        console.log('커버 노드 이동 완료');
                        if (options?.onComplete) options.onComplete();
                        resolve();
                    }
                });
            });

            // 좌표 정보 반환
            // targetLocalPos: 이동될 목표 위치의 좌표
            const position = {
                x: targetLocalPos.x,
                y: targetLocalPos.y,
                z: targetLocalPos.z
            };

            const result = {
                position,
                duration,
                easing
            };

            return result;
        }

        // 돌출부나 홈이 없는 경우 null 반환
        return null;
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

    /**
     * assemblyNode를 3단계 애니메이션으로 제거합니다.
     * 1단계: 힌지(돌출부/홈)를 축으로 한 틸팅 및 리프트
     * 2단계: 홈에서 빠져나오는 방향으로 슬라이드
     * 3단계: 페이드 아웃 및 제거
     */
    public async removeAssemblyNode(
        assemblyNode: THREE.Object3D,
        options?: {
            liftDistance?: number;
            slideDistance?: number;
            liftDuration?: number;
            slideDuration?: number;
            fadeDuration?: number;
            onComplete?: () => void;
        }
    ): Promise<void> {
        if (!assemblyNode) {
            console.warn('[DamperCoverAssemblyService] assemblyNode가 존재하지 않습니다.');
            return;
        }

        console.log('[DamperCoverAssemblyService] 틸팅 효과를 포함한 3단계 제거 애니메이션 시작:', assemblyNode.name);

        const liftDist = options?.liftDistance ?? 0.01;
        const slideDist = options?.slideDistance ?? 0.05;
        const liftDur = (options?.liftDuration ?? 500) / 1000;
        const slideDur = (options?.slideDuration ?? 700) / 1000;
        const fadeDur = (options?.fadeDuration ?? 500) / 1000;

        // 1. 힌지(Pivot) 포인트 결정
        let hingeWorldPos = new THREE.Vector3();
        if (this.detectedHoles && this.detectedHoles.length > 0) {
            // 탐지된 홈들의 중심점을 힌지로 사용
            this.detectedHoles.forEach(h => hingeWorldPos.add(h.position));
            hingeWorldPos.divideScalar(this.detectedHoles.length);
        } else {
            // 탐지된 홈이 없으면 Bounding Box의 한쪽 끝을 힌지로 가정
            const box = getPreciseBoundingBox(assemblyNode);
            hingeWorldPos.set(box.min.x, (box.min.y + box.max.y) / 2, box.min.z);
        }

        // 로컬 공간의 피벗 좌표 계산
        const localPivot = assemblyNode.worldToLocal(hingeWorldPos.clone());

        // 초기 상태 설정
        assemblyNode.visible = true;
        assemblyNode.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(m => {
                    m.transparent = true;
                    m.opacity = 1;
                });
            }
        });

        const tl = gsap.timeline({
            onComplete: () => {
                assemblyNode.visible = false;
                console.log('[DamperCoverAssemblyService] 제거 애니메이션 완료');
                options?.onComplete?.();
            }
        });

        // 1단계: 힌지를 고정하고 틸팅 (Pivot Rotation)
        // 회전각 (약 15도)
        const tiltAngle = THREE.MathUtils.degToRad(15);
        
        // 헬퍼 객체를 이용한 피벗 회전 구현 (또는 직접 계산)
        // 여기서는 직접 계산 방식을 사용하여 부드러운 애니메이션 구현
        const startPos = assemblyNode.position.clone();
        const startRotY = assemblyNode.rotation.y;

        tl.to({ progress: 0 }, {
            progress: 1,
            duration: liftDur,
            ease: 'power2.out',
            onUpdate: function() {
                const p = this.targets()[0].progress;
                const currentTilt = tiltAngle * p;
                
                // 1. 회전 적용 (기존 코드의 Y축 회전 패턴 유지)
                assemblyNode.rotation.y = startRotY + currentTilt;

                // 2. 피벗을 고정하기 위한 위치 보정
                // Origin_new = Pivot + R(Origin - Pivot)
                // Position_delta = Origin_new - Origin = Pivot - R(Pivot)
                const currentQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, currentTilt, 0));
                const pivotDelta = localPivot.clone().sub(localPivot.clone().applyQuaternion(currentQuat));
                
                // 월드 델타를 부모 좌표계로 변환 (단순화를 위해 현재는 로컬 델타를 직접 적용)
                // 주의: assemblyNode가 회전된 상태이므로 초기 회전을 고려해야 함
                const initialQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, startRotY, 0));
                const rotatedDelta = pivotDelta.applyQuaternion(initialQuat);

                assemblyNode.position.set(
                    startPos.x + rotatedDelta.x,
                    startPos.y + rotatedDelta.y,
                    startPos.z + rotatedDelta.z - (liftDist * p) // 약간 위로 들기 포함
                );
            }
        });

        // 2단계: 슬라이드 분리 (바깥쪽 방향)
        tl.to(assemblyNode.position, {
            y: `+=${slideDist}`,
            duration: slideDur,
            ease: 'power2.inOut'
        });

        // 3단계: 페이드 아웃
        tl.to({}, {
            duration: fadeDur,
            onUpdate: function() {
                const progress = this.progress();
                assemblyNode.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(m => {
                            m.opacity = 1 - progress;
                        });
                    }
                });
            }
        });

        return new Promise<void>((resolve) => {
            tl.eventCallback('onComplete', () => resolve());
        });
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
