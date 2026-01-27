import * as THREE from 'three';
import gsap from 'gsap';
import { createGrooveHighlight } from '../../shared/utils/commonUtils';
import { LEFT_DOOR_DAMPER_ASSEMBLY_NODE } from '../../shared/utils/fridgeConstants';

/**
 * 댐퍼 조립 서비스 (轻型版 - 조립 기능은 ManualAssemblyManager로 이동됨)
 * 이 파일은 단일 getter 함수만 유지
 */

// 싱글톤 인스턴스 (전역에서 사용 가능)
let damperAssemblyServiceInstance: DamperAssemblyService | null = null;

/**
 * 댐퍼 조립 서비스 클래스
 * 조립/분해 기능은 ManualAssemblyManager.ts로 이동됨
 */
export class DamperAssemblyService {
    // 조립 관련 기능은 ManualAssemblyManager로 이동됨
    // 이 클래스는 간단한 상태 관리만 담당
    private sceneRoot: THREE.Object3D | null = null;
    private activeHighlights: THREE.LineSegments[] = [];

    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
        console.log('[DamperAssemblyService] 초기화 완료');
    }

    /**
     * 댐퍼 어셈블리 노드의 홈 부분을 식별하고 하이라이트 효과를 적용합니다.
     */
    public highlightDamperGroove(): void {
        if (!this.sceneRoot) return;

        // 기존 하이라이트 제거
        this.clearHighlights();

        const damperNode = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_ASSEMBLY_NODE);
        if (!damperNode) {
            console.warn(`[DamperAssemblyService] 노드를 찾을 수 없음: ${LEFT_DOOR_DAMPER_ASSEMBLY_NODE}`);
            return;
        }

        // 홈 부분 식별 및 하이라이트 생성 (전략 A: EdgesGeometry)
        // thresholdAngle을 20도로 설정하여 급격한 각도 변화가 있는 홈 부분을 타겟팅
        const highlights = createGrooveHighlight(damperNode, 0x00ff00, 20);
        this.activeHighlights = highlights;

        highlights.forEach((line) => {
            this.sceneRoot?.add(line);

            // GSAP를 이용한 맥동(Pulsing) 효과로 시각적 명인성 강화
            gsap.to(line.material, {
                opacity: 0.2,
                duration: 0.8,
                repeat: -1,
                yoyo: true,
                ease: 'power1.inOut'
            });
        });

        console.log(`[DamperAssemblyService] ${highlights.length}개의 홈 하이라이트 적용 완료`);
    }

    /**
     * 적용된 모든 하이라이트를 제거합니다.
     */
    public clearHighlights(): void {
        this.activeHighlights.forEach((line) => {
            gsap.killTweensOf(line.material);
            this.sceneRoot?.remove(line);
            if (line.geometry) line.geometry.dispose();
            if (line.material instanceof THREE.Material) line.material.dispose();
        });
        this.activeHighlights = [];
    }

    public dispose(): void {
        this.clearHighlights();
        this.sceneRoot = null;
        console.log('[DamperAssemblyService] 서비스 정리 완료');
    }
}

/**
 * 싱글톤 인스턴스 가져오기
 */
export function getDamperAssemblyService(): DamperAssemblyService {
    if (!damperAssemblyServiceInstance) {
        damperAssemblyServiceInstance = new DamperAssemblyService();
    }
    return damperAssemblyServiceInstance;
}
