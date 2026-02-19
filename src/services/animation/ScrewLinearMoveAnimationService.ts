import * as THREE from 'three';
import { getMetadataLoader } from '@/services/data/MetadataLoader';
import { getNodeNameManager } from '@/services/data/NodeNameManager';
// import { visualizeScrewHeadCenter } from '@/shared/utils/commonUtils';
import gsap from 'gsap';

export class ScrewLinearMoveAnimationService {
    private static instance: ScrewLinearMoveAnimationService | null = null;
    private nodeNameManager = getNodeNameManager();
    private metadataLoader = getMetadataLoader();
    private sceneRoot: THREE.Object3D | null = null;

    public setSceneRoot(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
    }

    public static getInstance(): ScrewLinearMoveAnimationService {
        if (!ScrewLinearMoveAnimationService.instance) {
            ScrewLinearMoveAnimationService.instance = new ScrewLinearMoveAnimationService();
        }
        return ScrewLinearMoveAnimationService.instance;
    }

    /**
     * 스크류 노드를 damperCaseBody가 이동한 방향(오프셋)과 동일하게 선형 이동
     * @param screwNodePath 스크류 노드 경로 (예: 'fridge.leftDoorDamper.screw2Customized')
     */
    public async animateScrewLinearMoveToDamperCaseBody(
        screwNodePath: string,
        options: {
            onComplete?: () => void;
        } = {}
    ): Promise<{
        targetPosition: { x: number; y: number; z: number };
        duration: number;
        easing: string;
    } | null> {
        try {
            if (!this.sceneRoot) {
                console.error('Scene Root가 설정되지 않았습니다.');
                return null;
            }

            // 스크류 노드 이름 가져오기
            const screwNodeName = this.nodeNameManager.getNodeName(screwNodePath);
            if (!screwNodeName) {
                console.error(`스크류 노드 이름을 찾을 수 없습니다: ${screwNodePath}`);
                return null;
            }

            // 노드 이름으로 스크류 노드 찾기
            const screwNode = this.sceneRoot.getObjectByName(screwNodeName);
            if (!screwNode) {
                console.error(`스크류 노드를 찾을 수 없습니다: ${screwNodeName}`);
                return null;
            }

            // damperCaseBody 노드 찾기
            const damperCaseBodyNodeName = this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCaseBody');
            if (!damperCaseBodyNodeName) {
                console.error('damperCaseBody 노드 이름을 찾을 수 없습니다.');
                return null;
            }

            const damperCaseBodyNode = this.sceneRoot.getObjectByName(damperCaseBodyNodeName);
            if (!damperCaseBodyNode) {
                console.error(`damperCaseBody 노드를 찾을 수 없습니다: ${damperCaseBodyNodeName}`);
                return null;
            }

            // 스크류별 선형 이동 설정 가져오기
            const metadataKey = screwNodePath.split('.').pop() || screwNodePath;
            const screwLinearMoveConfig = this.metadataLoader.getScrewLinearMoveConfig(metadataKey);
            if (!screwLinearMoveConfig) {
                console.error('스크류 선형 이동 설정을 찾을 수 없습니다.');
                return null;
            }
            console.log('screwLinearMoveConfig>>> ', screwLinearMoveConfig);
            // 애니메이션 옵션 설정
            const metaOptions = {
                duration: screwLinearMoveConfig.duration,
                easing: screwLinearMoveConfig.easing,
                onComplete: options.onComplete
            };

            // 스크류 노드의 현재 월드 위치 가져오기
            screwNode.updateMatrixWorld();
            const screwCurrentWorldPosition = new THREE.Vector3();
            screwNode.getWorldPosition(screwCurrentWorldPosition);

            // 선형 이동 시킬 오프셋 추출
            const offset = new THREE.Vector3(
                screwLinearMoveConfig.offset?.x || 0,
                screwLinearMoveConfig.offset?.y || 0,
                screwLinearMoveConfig.offset?.z || 0
            );

            // 노드 좌표계 원점
            const pivot = new THREE.Vector3(
                screwLinearMoveConfig.pivot?.x || 0,
                screwLinearMoveConfig.pivot?.y || 0,
                screwLinearMoveConfig.pivot?.z || 0
            );

            damperCaseBodyNode.updateMatrixWorld();

            const startVec = damperCaseBodyNode.localToWorld(pivot);  // damperCaseBody 노드의 로컬 좌표계 원점 (0,0,0)을 월드 좌표로 변환
            const endVec = damperCaseBodyNode.localToWorld(pivot.clone().add(offset));  //  damperCaseBody 노드의 로컬 좌표계에서 offset만큼 이동한 지점을 월드 좌표
            const moveVector = endVec.sub(startVec);  // 스크류노드가 이동해야 할 실제 방향과 거리

            // 스크류 타겟 위치 계산 (현재 위치 + 이동 벡터)
            const targetWorldPosition = screwCurrentWorldPosition.clone().add(moveVector);

            // 스크류 머리 중심 시각화를 위한 설정 저장 (애니메이션 완료 후 시각화)
            // const screwConfig = this.metadataLoader.getScrewAnimationConfig(metadataKey);
            // const localExtractDir = new THREE.Vector3(...(screwConfig?.extractDirection || [0, 0, 1]));

            // 월드 타겟 좌표를 스크류 노드 부모의 로컬 좌표계로 변환
            const localTargetPosition = targetWorldPosition.clone();
            const screwParent = screwNode.parent;
            if (screwParent) {
                screwParent.updateMatrixWorld();
                screwParent.worldToLocal(localTargetPosition);
            }

            // GSAP를 사용한 선형 이동 애니메이션
            return new Promise<{
                targetPosition: { x: number; y: number; z: number };
                duration: number;
                easing: string;
            } | null>((resolve) => {
                gsap.to(screwNode.position, {
                    x: localTargetPosition.x,
                    y: localTargetPosition.y,
                    z: localTargetPosition.z,
                    duration: metaOptions.duration / 1000,
                    ease: metaOptions.easing,
                    onComplete: () => {
                        /* // 스크류 머리 중심 시각화 - 이동된 위치에서 시각화
                        visualizeScrewHeadCenter(
                            this.sceneRoot!,
                            screwNode,
                            targetWorldPosition,
                            localExtractDir
                        ); */

                        if (metaOptions.onComplete) {
                            metaOptions.onComplete();
                        }

                        const result = {
                            targetPosition: {
                                x: localTargetPosition.x,
                                y: localTargetPosition.y,
                                z: localTargetPosition.z
                            },
                            duration: metaOptions.duration,
                            easing: metaOptions.easing
                        };

                        resolve(result);
                    }
                });
            });

        } catch (error) {
            console.error('스크류 damperCaseBody 방향 선형 이동 애니메이션 실행 중 오류:', error);
            return null;
        }
    }
}

export function getScrewLinearMoveAnimationService(): ScrewLinearMoveAnimationService {
    return ScrewLinearMoveAnimationService.getInstance();
}

/**
 * 스크류 노드를 원래 위치로 선형 이동시킵니다 (조립용).
 * @param screwNodePath 스크류 노드 경로
 * @param options 애니메이션 옵션
 */
export async function animateScrewLinearMoveReverse(
    sceneRoot: THREE.Object3D,
    screwNodePath: string,
    options: {
        duration?: number;
        easing?: string;
        onComplete?: () => void;
    } = {}
): Promise<{
    position: { x: number; y: number; z: number };
    duration: number;
    easing: string;
} | null> {
    const nodeNameManager = getNodeNameManager();
    const metadataLoader = getMetadataLoader();

    try {
        if (!sceneRoot) {
            console.error('Scene Root가 설정되지 않았습니다.');
            return null;
        }

        // 스크류 노드 이름 가져오기
        const screwNodeName = nodeNameManager.getNodeName(screwNodePath);
        if (!screwNodeName) {
            console.error(`스크류 노드 이름을 찾을 수 없습니다: ${screwNodePath}`);
            return null;
        }

        // 스크류 노드 찾기
        const screwNode = sceneRoot.getObjectByName(screwNodeName);
        if (!screwNode) {
            console.error(`스크류 노드를 찾을 수 없습니다: ${screwNodeName}`);
            return null;
        }

        // damperCaseBody 노드 찾기
        const damperCaseBodyNodeName = nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCaseBody');
        if (!damperCaseBodyNodeName) {
            console.error('damperCaseBody 노드 이름을 찾을 수 없습니다.');
            return null;
        }

        const damperCaseBodyNode = sceneRoot.getObjectByName(damperCaseBodyNodeName);
        if (!damperCaseBodyNode) {
            console.error(`damperCaseBody 노드를 찾을 수 없습니다: ${damperCaseBodyNodeName}`);
            return null;
        }

        // 스크류별 선형 이동 설정 가져오기
        const metadataKey = screwNodePath.split('.').pop() || screwNodePath;
        const screwLinearMoveConfig = metadataLoader.getScrewLinearMoveConfig(metadataKey);
        if (!screwLinearMoveConfig) {
            console.error('스크류 선형 이동 설정을 찾을 수 없습니다.');
            return null;
        }

        // 애니메이션 옵션 병합
        const mergedOptions = {
            duration: options.duration ?? screwLinearMoveConfig.duration,
            easing: options.easing ?? screwLinearMoveConfig.easing,
            onComplete: options.onComplete
        };

        // 스크류 노드의 현재 월드 위치 가져오기
        screwNode.updateMatrixWorld();
        const screwCurrentWorldPosition = new THREE.Vector3();
        screwNode.getWorldPosition(screwCurrentWorldPosition);

        // 스크류 선형 이동 오프셋 가져오기
        const offset = new THREE.Vector3(
            screwLinearMoveConfig.offset?.x || 0,
            screwLinearMoveConfig.offset?.y || 0,
            screwLinearMoveConfig.offset?.z || 0
        );

        // damperCaseBody의 이동 벡터 계산 (역방향)
        damperCaseBodyNode.updateMatrixWorld();
        const startVec = damperCaseBodyNode.localToWorld(new THREE.Vector3(0, 0, 0));
        const endVec = damperCaseBodyNode.localToWorld(offset.clone());
        const moveVector = endVec.sub(startVec).negate(); // 역방향

        // 스크류 타겟 위치 계산 (현재 위치 + 역방향 이동 벡터)
        const targetWorldPosition = screwCurrentWorldPosition.clone().add(moveVector);

        // 월드 타겟 좌표를 스크류 부모의 로컬 좌표계로 변환
        const localTargetPosition = targetWorldPosition.clone();
        const screwParent = screwNode.parent;
        if (screwParent) {
            screwParent.updateMatrixWorld();
            screwParent.worldToLocal(localTargetPosition);
        }

        // GSAP를 사용한 선형 이동 애니메이션
        return new Promise<{
            position: { x: number; y: number; z: number };
            duration: number;
            easing: string;
        } | null>((resolve) => {
            gsap.to(screwNode.position, {
                x: localTargetPosition.x,
                y: localTargetPosition.y,
                z: localTargetPosition.z,
                duration: mergedOptions.duration / 1000,
                ease: mergedOptions.easing,
                onComplete: () => {
                    console.log(`스크류 ${screwNodeName} 원래 위치로 선형 이동 완료`);

                    if (mergedOptions.onComplete) {
                        mergedOptions.onComplete();
                    }

                    const result = {
                        position: {
                            x: localTargetPosition.x,
                            y: localTargetPosition.y,
                            z: localTargetPosition.z
                        },
                        duration: mergedOptions.duration,
                        easing: mergedOptions.easing
                    };

                    resolve(result);
                }
            });
        });

    } catch (error) {
        console.error('스크류 원래 위치 선형 이동 애니메이션 실행 중 오류:', error);
        return null;
    }
}
