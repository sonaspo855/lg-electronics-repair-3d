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
                        targetPosition = screw2Position.clone().add(offset);
                        console.log('오프셋 적용 후 타겟 위치:', targetPosition);
                    } else {
                        console.warn('screw2Customized 노드를 찾을 수 없어 fallback 방식 사용');
                        targetPosition = this.calculateFallbackPosition(damperCaseBodyNode, animationConfig);
                    }
                } else {
                    console.warn('screw2Customized 노드 이름을 찾을 수 없어 fallback 방식 사용');
                    targetPosition = this.calculateFallbackPosition(damperCaseBodyNode, animationConfig);
                }
            } else {
                // Fallback 방식 (기존 방식)
                console.log('Fallback 방식 사용');
                targetPosition = this.calculateFallbackPosition(damperCaseBodyNode, animationConfig);
            }

            // GSAP를 사용한 선형 이동 애니메이션
            return new Promise<boolean>((resolve) => {
                gsap.to(damperCaseBodyNode.position, {
                    x: targetPosition.x,
                    y: targetPosition.y,
                    z: targetPosition.z,
                    duration: mergedOptions.duration / 1000, // ms를 초로 변환
                    ease: mergedOptions.easing,
                    onUpdate: () => {
                        // 스테이지별 진행 상황 출력
                        const progress = gsap.getProperty(damperCaseBodyNode.position, 'x') as number;
                        const currentProgress = (progress - damperCaseBodyNode.position.x) / (targetPosition.x - damperCaseBodyNode.position.x);

                        for (const stage of animationConfig.stages) {
                            if (currentProgress >= stage.progress) {
                                console.log(`스테이지 [${stage.name}] 진행: ${stage.progress * 100}% - ${stage.description}`);
                            }
                        }
                    },
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
     * Fallback 방식으로 타겟 위치를 계산합니다.
     * @param damperCaseBodyNode 댐퍼 케이스 바디 노드
     * @param animationConfig 애니메이션 설정
     * @returns 계산된 타겟 위치
     */
    private calculateFallbackPosition(
        damperCaseBodyNode: THREE.Object3D,
        animationConfig: LinearMovementAnimationConfig
    ): THREE.Vector3 {
        // 기존 방식: direction + distance
        const direction = new THREE.Vector3(
            animationConfig.fallback?.direction.x || animationConfig.direction?.x || 1,
            animationConfig.fallback?.direction.y || animationConfig.direction?.y || 0,
            animationConfig.fallback?.direction.z || animationConfig.direction?.z || 0
        ).normalize();

        const distance = animationConfig.fallback?.distance || animationConfig.distance || 1;

        return damperCaseBodyNode.position.clone().add(
            direction.clone().multiplyScalar(distance)
        );
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