import * as THREE from 'three';
import gsap from 'gsap';
import { getNodeNameManager } from '../data/NodeNameManager';
import { getMetadataLoader } from '../data/MetadataLoader';
import { NormalBasedHighlightService } from '../visualization/NormalBasedHighlightService';
import { getAssemblyPathVisualizer } from '../visualization/AssemblyPathVisualizer';
import { getGrooveDetectionService } from '../detection/GrooveDetectionService';
import { getPreciseBoundingBox } from '../../shared/utils/commonUtils';

/**
 * damperCoverBody 노드와 damperCover 노드 결합 로직
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
     * damperCoverBody 노드와 damperCover 노드 결합 서비스 초기화
     * @param sceneRoot 씬 루트 객체
     */
    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
        this.assemblyPathVisualizer.initialize(sceneRoot);
        this.grooveDetectionService.initialize(sceneRoot);

        this.nodeNameManager.enableMetadataMode();
    }

    /**
     * damperCoverBody 노드와 damperCover 돌출부/홈 결합
     */
    public async assembleDamperCover(options?: {
        onComplete?: () => void;
    }): Promise<{
        targetPosition: { x: number; y: number; z: number };
        originalPosition: { x: number; y: number; z: number };
        duration: number;
        easing: string;
        translationDistance: number;
        extractDirection: [number, number, number];
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

        // 본래 로컬 위치
        const originalPosition = {
            x: coverNode.position.x,
            y: coverNode.position.y,
            z: coverNode.position.z
        };

        const assemblyKey = 'damper_cover_assembly';

        if (!this.metadataLoader.isLoaded()) {
            try {
                await this.metadataLoader.loadMetadata();
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

        // damperCoverBody 노드의 돌출부 탐지
        const plugAnalyses = NormalBasedHighlightService.calculatePlugByEdgeAnalysis(
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

        // damperAssembly 노드에서 홈 탐지 및 하이라이트 실행
        this.detectedHoles = await this.grooveDetectionService.detectAndHighlightGrooves(
            this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperAssembly')!
        );
        // console.log('this.detectedHoles>>> ', this.detectedHoles);


        // 탐지된 좌표 시각화
        // this.assemblyPathVisualizer.visualizeDetectedCoordinates(this.detectedPlugs, this.detectedHoles);

        // damperCoverBody 노드 돌출부 좌표부터 가장 가까운 홈 좌표까지 coverNode 선형 이동
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

            // 월드 이동 벡터 계산 (damperCoverBody 노드가 damperAssembly 노드의 홈 위치로 이동되어야할 거리 계산)
            const worldMoveVector = new THREE.Vector3().subVectors(bestHole.position, bestPlug.position);

            // 추출 방향 (이동 방향) 저장
            const direction = worldMoveVector.clone().normalize();
            const extractDirection: [number, number, number] = [direction.x, direction.y, direction.z];

            // 메타데이터에서 데이터 가져오기
            const distanceReduction = config?.insertion?.distanceReduction ?? 0.0005;  // 선형이동될 거리 줄이기
            const totalDistance = worldMoveVector.length();
            const reducedDistance = Math.max(0, totalDistance - distanceReduction);

            if (totalDistance > 0) {
                worldMoveVector.normalize().multiplyScalar(reducedDistance);
            }

            // 목표 월드 좌표 계산 (현재 커버 위치 + 이동 벡터)
            const currentWorldPos = new THREE.Vector3();
            coverNode.getWorldPosition(currentWorldPos);
            const targetWorldPos = currentWorldPos.clone().add(worldMoveVector);

            // 부모 좌표계로 변환
            // targetLocalPos: 이동될 목표 위치의 좌표
            const targetLocalPos = coverNode.parent
                ? coverNode.parent.worldToLocal(targetWorldPos.clone())
                : targetWorldPos;

            // GSAP 선형 이동 애니메이션
            const duration = grooveParams.duration;

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

            // targetLocalPos: 이동될 목표 위치의 좌표
            const targetPosition = {
                x: targetLocalPos.x,
                y: targetLocalPos.y,
                z: targetLocalPos.z
            };

            const result = {
                targetPosition,
                originalPosition,
                duration,
                easing,
                translationDistance: reducedDistance,
                extractDirection
            };

            return result;
        }

        // 돌출부나 홈이 없는 경우 null 반환
        return null;
    }

    /**
     * damperCoverBody 노드를 원래 위치로 복구하는 함수
     */
    public async restoreDamperCover(
        originalPosition: { x: number; y: number; z: number },
        options?: {
            duration?: number;
            onComplete?: () => void;
        }
    ): Promise<{
        targetPosition: { x: number; y: number; z: number };
        duration: number;
        easing: string;
    } | null> {
        if (!this.sceneRoot) {
            console.error('Scene root not initialized.');
            return null;
        }

        const damperCaseBodyNodeName = this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody');
        if (!damperCaseBodyNodeName) {
            console.error('댐퍼 케이스 바디 노드 이름을 찾을 수 없습니다.');
            return null;
        }

        const damperCaseBodyNode = this.sceneRoot.getObjectByName(damperCaseBodyNodeName);

        if (!damperCaseBodyNode) {
            console.error('Target node not found for restoration:', {
                coverName: this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody')
            });
            return null;
        }

        const duration = options?.duration || 1500;
        const easing = 'power2.inOut';

        await new Promise<void>((resolve) => {
            gsap.to(damperCaseBodyNode.position, {
                x: originalPosition.x,
                y: originalPosition.y,
                z: originalPosition.z,
                duration: duration / 1000,
                ease: easing,
                onComplete: () => {
                    console.log('커버 노드 복구 완료');
                    if (options?.onComplete) options.onComplete();
                    resolve();
                }
            });
        });

        return {
            targetPosition: originalPosition,
            duration,
            easing
        };
    }

    /**
     * 동작 서비스를 정리
     */
    public dispose(): void {
        this.assemblyPathVisualizer.dispose();
        this.grooveDetectionService.dispose();
        this.sceneRoot = null;
    }

    /**
     * damperCoverBody 노드의 탐지된 돌출부(Plug) 정보를 반환
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
     * damperCoverBody 노드의 탐지된 돌출부 중 너무 가까운 것들을 필터링하여 하나로 합침
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
     * assemblyNode 노드 분리 및 사라짐 효과 애니메이션 함수
     * 1단계: 힌지(돌출부/홈)를 축으로 한 틸팅 및 리프트
     * 2단계: 홈에서 빠져나오는 방향으로 슬라이드
     * 3단계: 페이드 아웃 및 제거
     */
    public async removeAssemblyNode(
        assemblyNode: THREE.Object3D
    ): Promise<{
        targetPosition: { x: number; y: number; z: number };
        originalPosition: { x: number; y: number; z: number };
        duration: number;
        easing: string;
        rotationAngle: number;
        rotationAxis: 'x' | 'y' | 'z';
        translationDistance: number;
        extractDirection: [number, number, number];
        disassemblyConfig: {
            liftDistance: number;
            slideDistance: number;
            liftDuration: number;
            slideDuration: number;
            fadeDuration: number;
            tiltAngle: number;
        };
    } | null> {
        if (!assemblyNode) {
            console.warn('assemblyNode가 존재하지 않습니다.');
            return null;
        }

        console.log('틸팅 효과를 포함한 3단계 제거 애니메이션 시작:', assemblyNode.name);

        // 본래 위치 저장
        const originalPosition = {
            x: assemblyNode.position.x,
            y: assemblyNode.position.y,
            z: assemblyNode.position.z
        };

        // 메타데이터에서 설정 로드
        const assemblyKey = 'damper_cover_assembly';
        const config = this.metadataLoader.getAssemblyConfig(assemblyKey);
        const disassemblyConfig = config?.disassembly;

        const liftDist = disassemblyConfig?.liftDistance ?? 0;
        const slideDist = disassemblyConfig?.slideDistance ?? 0;
        const liftDur = (disassemblyConfig?.liftDuration ?? 0) / 1000;
        const slideDur = (disassemblyConfig?.slideDuration ?? 0) / 1000;
        const fadeDur = (disassemblyConfig?.fadeDuration ?? 0) / 1000;
        const tiltAngleDeg = disassemblyConfig?.tiltAngle ?? 0;

        // 1. 힌지(Pivot) 포인트 결정
        let hingeWorldPos = new THREE.Vector3();
        const box = getPreciseBoundingBox(assemblyNode);

        if (this.detectedHoles && this.detectedHoles.length > 0 && this.detectedPlugs && this.detectedPlugs.length > 0) {
            // 플러그와 가장 가까운 홈 찾기
            let minDistance = Infinity;
            let bestHole = this.detectedHoles[0];

            for (const plug of this.detectedPlugs) {
                for (const hole of this.detectedHoles) {
                    const dist = plug.position.distanceTo(hole.position);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestHole = hole;
                    }
                }
            }

            // 홈 좌표 근처의 노드 외곽 지점을 힌지로 설정
            // X, Y, Z 중 바운딩 박스의 경계와 가장 가까운 쪽을 힌지 축의 외곽으로 결정
            hingeWorldPos.copy(bestHole.position);

            // X축 경계 중 가까운 쪽으로 투영 (일반적인 댐퍼 설치 방향 고려)
            const distToMinX = Math.abs(hingeWorldPos.x - box.min.x);
            const distToMaxX = Math.abs(hingeWorldPos.x - box.max.x);

            if (distToMinX < distToMaxX) {
                hingeWorldPos.x = box.min.x;
            } else {
                hingeWorldPos.x = box.max.x;
            }
        } else {
            // 탐지된 정보가 없으면 Bounding Box의 한쪽 끝을 힌지로 가정
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
                console.log('제거 애니메이션 완료');
            }
        });

        // 1단계: 힌지를 고정하고 틸팅
        const tiltAngle = THREE.MathUtils.degToRad(tiltAngleDeg);
        const startPos = assemblyNode.position.clone();
        const startRotY = assemblyNode.rotation.y;

        tl.to({ progress: 0 }, {
            progress: 1,
            duration: liftDur,
            ease: 'power2.out',
            onUpdate: function () {
                const p = this.targets()[0].progress;
                const currentTilt = tiltAngle * p;

                // 1. 회전 적용
                assemblyNode.rotation.y = startRotY + currentTilt;

                // 2. 피벗을 고정하기 위한 위치 보정
                const currentQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, currentTilt, 0));
                const pivotDelta = localPivot.clone().sub(localPivot.clone().applyQuaternion(currentQuat));

                const initialQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, startRotY, 0));
                const rotatedDelta = pivotDelta.applyQuaternion(initialQuat);

                // 3. 힌지 쪽 충돌 방지를 위한 미세한 선행 리프트 (Hinge Lift)
                // 힌지 자체도 약간 들어올려야(Z축 위쪽) 다른 노드와의 간섭을 피할 수 있음
                const hingeLift = liftDist * 0.3 * p;

                assemblyNode.position.set(
                    startPos.x + rotatedDelta.x,
                    startPos.y + rotatedDelta.y,
                    startPos.z + rotatedDelta.z - (liftDist * p) - hingeLift
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
            onUpdate: function () {
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

        await new Promise<void>((resolve) => {
            tl.eventCallback('onComplete', () => resolve());
        });

        const targetPosition = {
            x: assemblyNode.position.x,
            y: assemblyNode.position.y,
            z: assemblyNode.position.z
        };
        const duration = (liftDur + slideDur + fadeDur) * 1000; // 전체 시간 (ms)

        const result = {
            targetPosition,
            originalPosition,
            duration,
            easing: 'power2.inOut',
            rotationAngle: tiltAngleDeg,
            rotationAxis: 'y' as const,
            translationDistance: slideDist,
            extractDirection: [0, 1, 0] as [number, number, number],
            disassemblyConfig: {
                liftDistance: liftDist,
                slideDistance: slideDist,
                liftDuration: liftDur * 1000,
                slideDuration: slideDur * 1000,
                fadeDuration: fadeDur * 1000,
                tiltAngle: tiltAngleDeg
            }
        };


        // 애니메이션 결과 반환
        return result;
    }
}

// 싱글톤 인스턴스 관리
let damperCoverAssemblyServiceInstance: DamperCoverAssemblyService | null = null;

/**
 * damperCoverBody 노드와 damperCover 노드 결합 서비스 인스턴스 반환
 * @returns DamperCoverAssemblyService 인스턴스
 */
export function getDamperCoverAssemblyService(): DamperCoverAssemblyService {
    if (!damperCoverAssemblyServiceInstance) {
        damperCoverAssemblyServiceInstance = new DamperCoverAssemblyService();
    }
    return damperCoverAssemblyServiceInstance;
}
