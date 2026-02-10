import * as THREE from 'three';
import { getMetadataLoader } from '@/shared/utils/MetadataLoader';
import { getNodeNameManager } from '@/shared/utils/NodeNameManager';
import { visualizeScrewHeadCenter } from '@/shared/utils/commonUtils';
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
     * 스크류 노드를 damperCaseBody가 이동한 방향(오프셋)과 동일하게 선형 이동시킵니다.
     * (마치 damperCaseBody를 따라가는 것처럼 이동)
     * @param screwNodePath 스크류 노드 경로 (예: 'fridge.leftDoorDamper.screw2Customized')
     * @param options 애니메이션 옵션
     */
    public async animateScrewLinearMoveToDamperCaseBody(
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

            // 스크류 노드 찾기
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

            // damperCaseBody 메타데이터 설정 가져오기 (이동했던 오프셋 정보 확인용)
            const damperCaseBodyConfig = this.metadataLoader.getDamperCaseBodyAnimationConfig(damperCaseBodyNodeName);
            if (!damperCaseBodyConfig) {
                console.error('damperCaseBody 애니메이션 설정을 찾을 수 없습니다.');
                return null;
            }

            // 애니메이션 옵션 병합
            const mergedOptions = {
                duration: options.duration ?? damperCaseBodyConfig.duration,
                easing: options.easing ?? damperCaseBodyConfig.easing,
                onComplete: options.onComplete
            };

            // 스크류 노드의 현재 월드 위치 가져오기
            screwNode.updateMatrixWorld();
            const screwCurrentWorldPosition = new THREE.Vector3();
            screwNode.getWorldPosition(screwCurrentWorldPosition);

            // damperCaseBody의 오프셋 가져오기
            const offset = new THREE.Vector3(
                damperCaseBodyConfig.offset?.x || 0,
                damperCaseBodyConfig.offset?.y || 0,
                damperCaseBodyConfig.offset?.z || 0
            );

            // damperCaseBody의 이동 벡터 계산 (Scale, Rotation 반영)
            // localToWorld는 객체의 월드 매트릭스(회전, 위치, 스케일 포함)를 적용합니다.
            // (0,0,0)과 (offset)의 월드 좌표 차이를 구하면, 위치(Translation)는 상쇄되고
            // 순수한 회전/스케일이 적용된 오프셋 벡터(방향 및 크기)만 남게 됩니다.
            damperCaseBodyNode.updateMatrixWorld();
            const startVec = damperCaseBodyNode.localToWorld(new THREE.Vector3(0, 0, 0));
            const endVec = damperCaseBodyNode.localToWorld(offset.clone());
            const moveVector = endVec.sub(startVec);

            // 스크류 타겟 위치 계산 (현재 위치 + 이동 벡터)
            const targetWorldPosition = screwCurrentWorldPosition.clone().add(moveVector);

            // 스크류 머리 중심 시각화를 위한 설정 저장 (애니메이션 완료 후 시각화)
            const metadataKey = screwNodePath.split('.').pop() || screwNodePath;
            const screwConfig = this.metadataLoader.getScrewAnimationConfig(metadataKey);
            const localExtractDir = new THREE.Vector3(...(screwConfig?.extractDirection || [0, 0, 1]));

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
                        console.log(`스크류 ${screwNodeName} damperCaseBody 방향으로 선형 이동 완료`);

                        // 스크류 머리 중심 시각화 - 이동된 위치에서 시각화
                        visualizeScrewHeadCenter(
                            this.sceneRoot!,
                            screwNode,
                            targetWorldPosition,
                            localExtractDir
                        );

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
            console.error('스크류 damperCaseBody 방향 선형 이동 애니메이션 실행 중 오류:', error);
            return null;
        }
    }
}

export function getScrewLinearMoveAnimationService(): ScrewLinearMoveAnimationService {
    return ScrewLinearMoveAnimationService.getInstance();
}
