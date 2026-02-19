import * as THREE from 'three';
import { getMetadataLoader } from '@/services/data/MetadataLoader';
import { getNodeNameManager } from '@/services/data/NodeNameManager';
import { LinearMovementAnimationConfig } from '@/services/data/MetadataLoader';
import gsap from 'gsap';

/**
 * 댐퍼 케이스 바디 애니메이션 서비스 클래스
 * 댐퍼 케이스 바디의 선형 이동 애니메이션을 관리
 */
export class DamperCaseBodyAnimationService {
    private static instance: DamperCaseBodyAnimationService | null = null;
    private nodeNameManager = getNodeNameManager();
    private metadataLoader = getMetadataLoader();
    private sceneRoot: THREE.Object3D | null = null;

    private constructor() { }

    /**
     * Scene Root를 설정
     * @param sceneRoot Three.js Scene Root 객체
     */
    public setSceneRoot(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
    }

    /**
     * 싱글톤 인스턴스를 반환
     */
    public static getInstance(): DamperCaseBodyAnimationService {
        if (!DamperCaseBodyAnimationService.instance) {
            DamperCaseBodyAnimationService.instance = new DamperCaseBodyAnimationService();
        }
        return DamperCaseBodyAnimationService.instance;
    }

    /**
     * 댐퍼 케이스 바디 선형 이동 애니메이션을 실행
     * @param options 애니메이션 옵션
     * @returns 애니메이션 정보 (위치, duration, easing) 또는 null
     */
    public async animateDamperCaseBodyLinearMove(options: {
        onComplete?: () => void;
    } = {}): Promise<{
        targetPosition: { x: number; y: number; z: number };
        duration: number;
        easing: string;
    } | null> {
        try {
            if (!this.sceneRoot) {
                console.error('Scene Root가 설정되지 않았습니다. setSceneRoot()를 먼저 호출해주세요.');
                return null;
            }

            // 노드 이름 가져오기
            const damperCaseBodyNodeName = this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCaseBody');
            // console.log('damperCaseBodyNodeName>> ', damperCaseBodyNodeName);
            if (!damperCaseBodyNodeName) {
                console.error('댐퍼 케이스 바디 노드 이름을 찾을 수 없습니다.');
                return null;
            }

            // 메타데이터 설정 가져오기
            const animationConfig = this.metadataLoader.getDamperCaseBodyAnimationConfig(damperCaseBodyNodeName);
            if (!animationConfig) {
                console.error('댐퍼 케이스 바디 애니메이션 설정을 찾을 수 없습니다.');
                return null;
            }

            // 애니메이션 옵션 병합
            const metaOptions = {
                duration: animationConfig.duration,
                easing: animationConfig.easing,
                onComplete: options.onComplete
            };

            // 노드 찾기
            const damperCaseBodyNode = this.sceneRoot.getObjectByName(damperCaseBodyNodeName);
            if (!damperCaseBodyNode) {
                console.error(`댐퍼 케이스 바디 노드를 찾을 수 없습니다: ${damperCaseBodyNodeName}`);
                return null;
            }

            // damperCaseBody 현재 위치 출력
            const damperCaseBodyCurrentPosition = new THREE.Vector3();
            damperCaseBodyNode.getWorldPosition(damperCaseBodyCurrentPosition);
            // console.log('damperCaseBody 현재 위치:', damperCaseBodyCurrentPosition);

            // 이동될 타겟 위치 계산 (로컬 오프셋 기반)
            let targetPosition: THREE.Vector3;

            // 오프셋 적용
            const offset = new THREE.Vector3(
                animationConfig.offset?.x || 0,
                animationConfig.offset?.y || 0,
                animationConfig.offset?.z || 0
            );

            damperCaseBodyNode.updateMatrixWorld(); // 최신 행렬 상태 보장
            targetPosition = damperCaseBodyNode.localToWorld(offset.clone());  // 로컬 좌표계를 기준으로 오프셋이 적용된 '월드 좌표'를 계산
            const localTargetPosition = targetPosition.clone();  // 월드 타겟 좌표를 부모의 로컬 좌표계로 변환
            const parent = damperCaseBodyNode.parent;

            if (parent) {
                // 부모의 world matrix가 업데이트 되었는지 확인 후 역행렬을 이용해 로컬로 변환
                parent.updateMatrixWorld();
                parent.worldToLocal(localTargetPosition);
            }

            // GSAP를 사용한 선형 이동 애니메이션
            return new Promise<{
                targetPosition: { x: number; y: number; z: number };
                duration: number;
                easing: string;
            } | null>((resolve) => {
                gsap.to(damperCaseBodyNode.position, {
                    x: localTargetPosition.x,
                    y: localTargetPosition.y,
                    z: localTargetPosition.z,
                    duration: metaOptions.duration / 1000, // ms를 초로 변환
                    ease: metaOptions.easing,
                    onComplete: () => {
                        if (metaOptions.onComplete) {  // 애니메이션 완료 콜백 호출
                            metaOptions.onComplete();
                        }

                        const targetPosition = {
                            x: localTargetPosition.x,
                            y: localTargetPosition.y,
                            z: localTargetPosition.z
                        };

                        const result = {
                            targetPosition,
                            duration: metaOptions.duration,
                            easing: metaOptions.easing
                        };

                        resolve(result);
                    }
                });
            });

        } catch (error) {
            console.error('댐퍼 케이스 바디 애니메이션 실행 중 오류:', error);
            return null;
        }
    }

    /**
     * 댐퍼 케이스 바디 노드 이름을 가져오기
     * @returns 노드 이름 또는 null
     */
    public getDamperCaseBodyNodeName(): string | null {
        return this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCaseBody');
    }

    /**
     * 애니메이션 설정을 가져오기
     * @returns 애니메이션 설정 또는 null
     */
    public getAnimationConfig(): LinearMovementAnimationConfig | null {
        const nodeName = this.getDamperCaseBodyNodeName();
        if (!nodeName) return null;
        return this.metadataLoader.getDamperCaseBodyAnimationConfig(nodeName);
    }

    /**
     * 애니메이션 디버그 정보를 출력
     */
    public debugAnimationInfo(): void {
        console.log('=== 댐퍼 케이스 바디 애니메이션 디버그 정보 ===');

        const nodeName = this.getDamperCaseBodyNodeName();
        console.log('노드 이름:', nodeName || '없음');

        const config = this.getAnimationConfig();
        if (config) {
            console.log('애니메이션 설정:', config);
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