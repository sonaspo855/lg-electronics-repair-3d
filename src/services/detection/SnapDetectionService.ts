import * as THREE from 'three';
import gsap from 'gsap';
import { getNodeNameManager } from './NodeNameManager';

/**
 * 스냅 존 설정 인터페이스
 */
export interface SnapZoneConfig {
    threshold: number;      // 스냅 감지 거리
    strength: number;       // 스냅 강도 (0~1)
    duration: number;       // 스냅 애니메이션 시간 (초)
    easing: string;         // GSAP easing 함수
}

/**
 * 스냅 감지 및 적용 유틸리티 클래스
 * 부품 조립 시 자석처럼 끌어당기는 효과 구현
 */
export class SnapDetectionService {
    /**
     * 기본 스냅 존 설정
     */
    private static readonly DEFAULT_CONFIG: SnapZoneConfig = {
        threshold: 0.15,        // 15cm 이내
        strength: 1.0,          // 최대 강도
        duration: 0.3,          // 0.3초
        easing: 'back.out(3)'   // 오버슈트 효과
    };

    /**
     * 스냅 존 진입 여부 확인
     * 
     * @param currentPos 현재 위치
     * @param targetPos 타겟 위치
     * @param threshold 임계값 (기본값: 0.15)
     * @returns 스냅 존 내에 있으면 true
     * 
     * @example
     * if (SnapDetectionService.isInSnapZone(currentPos, targetPos, 0.2)) {
     *     console.log('스냅 존 진입!');
     * }
     */
    static isInSnapZone(
        currentPos: THREE.Vector3,
        targetPos: THREE.Vector3,
        threshold: number = this.DEFAULT_CONFIG.threshold
    ): boolean {
        return currentPos.distanceTo(targetPos) < threshold;
    }

    /**
     * 거리 기반 스냅 강도 계산 (0~1)
     * 가까울수록 1에 가까움
     * 
     * @param distance 현재 거리
     * @param maxDistance 최대 거리
     * @returns 스냅 강도 (0~1)
     * 
     * @example
     * const strength = SnapDetectionService.calculateSnapStrength(0.05, 0.15);
     * // strength = 0.67 (가까우므로 강한 끌림)
     */
    static calculateSnapStrength(
        distance: number,
        maxDistance: number
    ): number {
        if (distance >= maxDistance) return 0;
        return 1 - (distance / maxDistance);
    }

    /**
     * 스냅 효과 적용 (자석처럼 끌어당김)
     * 
     * @param object 이동할 객체
     * @param targetPos 타겟 위치
     * @param config 스냅 설정 (선택)
     * @returns Promise (애니메이션 완료 시 resolve)
     * 
     * @example
     * await SnapDetectionService.applySnapEffect(coverBody, targetPos, {
     *     duration: 0.5,
     *     easing: 'elastic.out(1, 0.5)'
     * });
     */
    static applySnapEffect(
        object: THREE.Object3D,
        targetPos: THREE.Vector3,
        config: Partial<SnapZoneConfig> = {}
    ): Promise<void> {
        const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

        return new Promise((resolve) => {
            gsap.to(object.position, {
                x: targetPos.x,
                y: targetPos.y,
                z: targetPos.z,
                duration: finalConfig.duration,
                ease: finalConfig.easing,
                onStart: () => {
                    console.log('[Snap] 스냅 효과 시작');
                },
                onComplete: () => {
                    console.log('[Snap] 부품이 정확히 결합되었습니다.');
                    resolve();
                }
            });
        });
    }

    /**
     * 점진적 스냅 (거리에 따라 끌어당기는 힘 조절)
     * 프레임마다 호출하여 부드러운 끌림 효과 구현
     * 
     * @param object 이동할 객체
     * @param targetPos 타겟 위치
     * @param currentDistance 현재 거리
     * @param maxSnapDistance 최대 스냅 거리
     * 
     * @example
     * // 애니메이션 루프 내에서 호출
     * const distance = object.position.distanceTo(targetPos);
     * SnapDetectionService.applyGradualSnap(object, targetPos, distance, 0.5);
     */
    static applyGradualSnap(
        object: THREE.Object3D,
        targetPos: THREE.Vector3,
        currentDistance: number,
        maxSnapDistance: number
    ): void {
        const strength = this.calculateSnapStrength(currentDistance, maxSnapDistance);

        if (strength > 0) {
            // 타겟 방향으로 끌어당김
            const direction = new THREE.Vector3()
                .subVectors(targetPos, object.position)
                .normalize();

            const pullForce = direction.multiplyScalar(strength * 0.05);
            object.position.add(pullForce);
        }
    }

    /**
     * 스냅 존 시각화 (디버깅용)
     * 
     * @param scene Three.js 씬
     * @param targetPos 타겟 위치
     * @param threshold 스냅 존 반경
     * @param color 색상 (기본값: 0x00ff00)
     * @returns 생성된 헬퍼 객체
     * 
     * @example
     * const helper = SnapDetectionService.visualizeSnapZone(scene, targetPos, 0.15);
     * // 나중에 제거: scene.remove(helper);
     */
    static visualizeSnapZone(
        scene: THREE.Scene,
        targetPos: THREE.Vector3,
        threshold: number,
        color: number = 0x00ff00
    ): THREE.Mesh | null {
        const nodeNameManager = getNodeNameManager();
        const helperName = nodeNameManager.getNodeName('helpers.snapZoneHelper');
        if (!helperName) return null;


        const geometry = new THREE.SphereGeometry(threshold, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.2,
            wireframe: true
        });

        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(targetPos);
        sphere.name = helperName;
        scene.add(sphere);

        return sphere;
    }

    /**
     * 스냅 존 헬퍼 제거
     * 
     * @param scene Three.js 씬
     * 
     * @example
     * SnapDetectionService.removeSnapZoneHelper(scene);
     */
    static removeSnapZoneHelper(scene: THREE.Scene): void {
        const nodeNameManager = getNodeNameManager();
        const helperName = nodeNameManager.getNodeName('helpers.snapZoneHelper');
        if (!helperName) return;

        const helper = scene.getObjectByName(helperName);
        if (helper) {
            scene.remove(helper);
            if (helper instanceof THREE.Mesh) {
                helper.geometry.dispose();
                if (helper.material instanceof THREE.Material) {
                    helper.material.dispose();
                }
            }
        }
    }

    /**
     * 여러 타겟 중 가장 가까운 스냅 타겟 찾기
     * 
     * @param currentPos 현재 위치
     * @param targets 타겟 위치 배열
     * @param threshold 스냅 임계값
     * @returns 가장 가까운 타겟 (없으면 null)
     * 
     * @example
     * const targets = [pos1, pos2, pos3];
     * const nearest = SnapDetectionService.findNearestSnapTarget(currentPos, targets, 0.2);
     * if (nearest) {
     *     console.log('가장 가까운 타겟:', nearest);
     * }
     */
    static findNearestSnapTarget(
        currentPos: THREE.Vector3,
        targets: THREE.Vector3[],
        threshold: number
    ): THREE.Vector3 | null {
        let nearestTarget: THREE.Vector3 | null = null;
        let minDistance = threshold;

        for (const target of targets) {
            const distance = currentPos.distanceTo(target);
            if (distance < minDistance) {
                minDistance = distance;
                nearestTarget = target;
            }
        }

        return nearestTarget;
    }
}
