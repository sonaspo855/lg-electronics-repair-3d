import * as THREE from 'three';
import { getMetadataLoader } from '@/shared/utils/MetadataLoader';
import { getNodeNameManager } from '@/shared/utils/NodeNameManager';
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
     * 스크류 노드를 기준으로 선형 이동 애니메이션 실행
     * @param screwNodePath 스크류 노드 경로 (예: 'fridge.leftDoorDamper.screw2Customized')
     * @param options 애니메이션 옵션
     */
    public async animateScrewLinearMove(
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

            // 메타데이터 설정 가져오기
            const metadataKey = screwNodePath.split('.').pop() || screwNodePath;
            const animationConfig = this.metadataLoader.getScrewLinearMoveConfig(metadataKey);
            if (!animationConfig) {
                console.error(`[ScrewLinearMoveAnimationService] 스크류 선형 이동 설정을 찾을 수 없습니다: ${metadataKey}`);
                return null;
            }

            // 애니메이션 옵션 병합
            const mergedOptions = {
                duration: options.duration ?? animationConfig.duration,
                easing: options.easing ?? animationConfig.easing,
                onComplete: options.onComplete
            };

            // 스크류 노드의 현재 월드 위치 가져오기
            screwNode.updateMatrixWorld();
            const currentWorldPosition = new THREE.Vector3();
            screwNode.getWorldPosition(currentWorldPosition);

            // 오른쪽 방향 오프셋 계산 (월드 좌표계 기준)
            const offset = new THREE.Vector3(
                animationConfig.offset?.x || 0,
                animationConfig.offset?.y || 0,
                animationConfig.offset?.z || 0
            );

            // 타겟 위치 계산 (월드 좌표)
            const targetWorldPosition = currentWorldPosition.clone().add(offset);

            // 월드 타겟 좌표를 부모의 로컬 좌표계로 변환
            const localTargetPosition = targetWorldPosition.clone();
            const parent = screwNode.parent;
            if (parent) {
                parent.updateMatrixWorld();
                parent.worldToLocal(localTargetPosition);
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
                        console.log(`스크류 ${screwNodeName} 선형 이동 완료`);

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
            console.error('스크류 선형 이동 애니메이션 실행 중 오류:', error);
            return null;
        }
    }
}

export function getScrewLinearMoveAnimationService(): ScrewLinearMoveAnimationService {
    return ScrewLinearMoveAnimationService.getInstance();
}
