import * as THREE from 'three';
import { getMetadataLoader } from '@/shared/utils/MetadataLoader';
import { getNodeNameManager } from '@/shared/utils/NodeNameManager';
import { LinearMovementAnimationConfig } from '@/shared/utils/MetadataLoader';
import gsap from 'gsap';

/**
 * 댐퍼 케이스 바디 애니메이션 서비스 클래스
 * 댐퍼 케이스 바디의 선형 이동 애니메이션을 관리합니다.
 */
export class DamperCaseBodyAnimationService {
    private static instance: DamperCaseBodyAnimationService | null = null;
    private nodeNameManager = getNodeNameManager();
    private metadataLoader = getMetadataLoader();
    private sceneRoot: THREE.Object3D | null = null;

    private constructor() { }

    /**
     * Scene Root를 설정합니다.
     * @param sceneRoot Three.js Scene Root 객체
     */
    public setSceneRoot(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
    }

    /**
     * 싱글톤 인스턴스를 반환합니다.
     */
    public static getInstance(): DamperCaseBodyAnimationService {
        if (!DamperCaseBodyAnimationService.instance) {
            DamperCaseBodyAnimationService.instance = new DamperCaseBodyAnimationService();
        }
        return DamperCaseBodyAnimationService.instance;
    }

    /**
     * 댐퍼 케이스 바디 선형 이동 애니메이션을 실행합니다.
     * @param options 애니메이션 옵션
     * @returns 애니메이션 완료 여부
     */
    public async animateDamperCaseBodyLinearMove(options: {
        duration?: number;
        easing?: string;
        onComplete?: () => void;
    } = {}): Promise<boolean> {
        try {
            console.log('animateDamperCaseBodyLinearMove!!!');
            if (!this.sceneRoot) {
                console.error('Scene Root가 설정되지 않았습니다. setSceneRoot()를 먼저 호출해주세요.');
                return false;
            }

            // 노드 이름 가져오기
            const damperCaseBodyNodeName = this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCaseBody');
            console.log('damperCaseBodyNodeName>> ', damperCaseBodyNodeName);
            if (!damperCaseBodyNodeName) {
                console.error('댐퍼 케이스 바디 노드 이름을 찾을 수 없습니다.');
                return false;
            }

            // 메타데이터 설정 가져오기
            const animationConfig = this.metadataLoader.getDamperCaseBodyAnimationConfig(damperCaseBodyNodeName);
            if (!animationConfig) {
                console.error('댐퍼 케이스 바디 애니메이션 설정을 찾을 수 없습니다.');
                return false;
            }

            // 애니메이션 옵션 병합
            const mergedOptions = {
                duration: options.duration || animationConfig.duration,
                easing: options.easing || animationConfig.easing,
                onComplete: options.onComplete
            };

            // 애니메이션 실행
            console.log('댐퍼 케이스 바디 선형 이동 애니메이션 시작');
            console.log('애니메이션 설정:', animationConfig);
            console.log('병합된 옵션:', mergedOptions);

            // 노드 찾기
            const damperCaseBodyNode = this.sceneRoot.getObjectByName(damperCaseBodyNodeName);
            if (!damperCaseBodyNode) {
                console.error(`댐퍼 케이스 바디 노드를 찾을 수 없습니다: ${damperCaseBodyNodeName}`);
                return false;
            }

            // damperCaseBody 현재 위치 출력
            const damperCaseBodyCurrentPosition = new THREE.Vector3();
            damperCaseBodyNode.getWorldPosition(damperCaseBodyCurrentPosition);
            console.log('damperCaseBody 현재 위치:', damperCaseBodyCurrentPosition);

            // 타겟 위치 계산 (screw2Customized 위치 기반 또는 fallback)
            let targetPosition: THREE.Vector3;
            const method = animationConfig.method || 'fallback';

            if (method === 'screwPositionBased') {
                // screw2Customized 위치 기반 방식
                const screw2NodeName = this.nodeNameManager.getNodeName(animationConfig.targetScrewNode || '');
                console.log('screw2NodeName>> ', screw2NodeName);

                if (screw2NodeName) {
                    const screw2Node = this.sceneRoot.getObjectByName(screw2NodeName);
                    if (screw2Node) {
                        // screw2Customized의 현재 월드 위치 가져오기
                        const screw2Position = new THREE.Vector3();
                        screw2Node.getWorldPosition(screw2Position);
                        console.log('screw2Customized 월드 위치:', screw2Position);

                        // 오프셋 적용
                        const offset = new THREE.Vector3(
                            animationConfig.offset?.x || 0,
                            animationConfig.offset?.y || 0,
                            animationConfig.offset?.z || 0
                        );
                        // [수정] 댐퍼 케이스 바디의 로컬 좌표계를 기준으로 오프셋이 적용된 '월드 좌표'를 구합니다.
                        // localToWorld는 노드의 현재 회전과 위치를 모두 반영하여 해당 방향의 월드 좌표를 반환합니다.
                        damperCaseBodyNode.updateMatrixWorld(); // 최신 행렬 상태 보장
                        targetPosition = damperCaseBodyNode.localToWorld(offset.clone());
                        console.log('댐퍼 케이스 바디 로컬 기준 변환된 월드 타겟 위치:', targetPosition);
                    } else {
                        console.error('screw2Customized 노드를 찾을 수 없습니다:', screw2NodeName);
                        return false;
                    }
                } else {
                    console.error('screw2Customized 노드 이름을 찾을 수 없습니다:', animationConfig.targetScrewNode);
                    return false;
                }
            } else {
                console.error('지원하지 않는 method입니다:', method);
                return false;
            }

            // 월드 타겟 좌표를 부모의 로컬 좌표계로 변환
            const localTargetPosition = targetPosition.clone();
            const parent = damperCaseBodyNode.parent;
            if (parent) {
                // 부모의 world matrix가 업데이트 되었는지 확인 후 역행렬을 이용해 로컬로 변환합니다.
                parent.updateMatrixWorld();
                parent.worldToLocal(localTargetPosition);
                console.log('월드 타겟 좌표:', targetPosition);
                console.log('변환된 로컬 타겟 좌표:', localTargetPosition);
            }

            // GSAP를 사용한 선형 이동 애니메이션
            return new Promise<boolean>((resolve) => {
                gsap.to(damperCaseBodyNode.position, {
                    x: localTargetPosition.x,
                    y: localTargetPosition.y,
                    z: localTargetPosition.z,
                    duration: mergedOptions.duration / 1000, // ms를 초로 변환
                    ease: mergedOptions.easing,
                    onComplete: () => {
                        console.log('댐퍼 케이스 바디 선형 이동 애니메이션 완료');

                        // 애니메이션 완료 콜백 실행
                        if (mergedOptions.onComplete) {
                            mergedOptions.onComplete();
                        }

                        resolve(true);
                    }
                });
            });

        } catch (error) {
            console.error('댐퍼 케이스 바디 애니메이션 실행 중 오류:', error);
            return false;
        }
    }

    /**
     * 댐퍼 케이스 바디 노드 이름을 가져옵니다.
     * @returns 노드 이름 또는 null
     */
    public getDamperCaseBodyNodeName(): string | null {
        return this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCaseBody');
    }

    /**
     * 애니메이션 설정을 가져옵니다.
     * @returns 애니메이션 설정 또는 null
     */
    public getAnimationConfig(): LinearMovementAnimationConfig | null {
        const nodeName = this.getDamperCaseBodyNodeName();
        if (!nodeName) return null;
        return this.metadataLoader.getDamperCaseBodyAnimationConfig(nodeName);
    }

    /**
     * 애니메이션 스테이지 정보를 가져옵니다.
     * @returns 스테이지 배열 또는 null
     */
    public getAnimationStages(): Array<{
        name: string;
        progress: number;
        description: string;
    }> | null {
        const config = this.getAnimationConfig();
        return config?.stages || null;
    }

    /**
     * 애니메이션 디버그 정보를 출력합니다.
     */
    public debugAnimationInfo(): void {
        console.log('=== 댐퍼 케이스 바디 애니메이션 디버그 정보 ===');

        const nodeName = this.getDamperCaseBodyNodeName();
        console.log('노드 이름:', nodeName || '없음');

        const config = this.getAnimationConfig();
        if (config) {
            console.log('애니메이션 설정:', config);
            console.log('스테이지 정보:');
            config.stages.forEach(stage => {
                console.log(`  - ${stage.name}: ${stage.progress * 100}% - ${stage.description}`);
            });
        } else {
            console.log('애니메이션 설정 없음');
        }
    }
}

/**
 * 싱글톤 인스턴스 가져오기
 */
export function getDamperCaseBodyAnimationService(): DamperCaseBodyAnimationService {
    return DamperCaseBodyAnimationService.getInstance();
}