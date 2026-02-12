import * as THREE from 'three';
// import { NormalBasedHighlightServiceService } from '../visualization/NormalBasedHighlightServiceService';
import { NormalBasedHighlightService } from '../visualization/NormalBasedHighlightService';

import { getNodeNameManager } from '../data/NodeNameManager';

/**
 * 댐퍼 조립 서비스 (조립 기능은 ManualAssemblyManager로 이동됨)
 * 이 파일은 디버깅용 노드 구조 출력 기능만 유지
 */

// 싱글톤 인스턴스 (전역에서 사용 가능)
let damperAssemblyServiceInstance: DamperAssemblyService | null = null;

/**
 * 댐퍼 조립 서비스 클래스
 * 조립/분해 기능은 ManualAssemblyManager.ts로 이동됨
 */
export class DamperAssemblyService {
    private sceneRoot: THREE.Object3D | null = null;
    private normalHighlight: NormalBasedHighlightService | null = null;

    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;

        // 하이라이트 컴포넌트 초기화
        this.normalHighlight = new NormalBasedHighlightService();
        this.normalHighlight.initialize(sceneRoot);

        // 메타데이터 미리 로드
        const nodeNameManager = getNodeNameManager();
        nodeNameManager.enableMetadataMode();
    }

    /**
     * 적용된 모든 하이라이트를 제거합니다.
     */
    public clearHighlights(): void {
        this.normalHighlight?.clearHighlights();
    }

    public dispose(): void {
        this.clearHighlights();
        this.normalHighlight?.dispose();
        this.normalHighlight = null;
        this.sceneRoot = null;
    }

    // ==================== 디버깅용 메서드들 ====================

    /**
     * 노드의 모든 자식 노드 이름을 콘솔에 출력합니다.
     */
    private printNodeNames(node: THREE.Object3D | null | undefined, prefix: string = ''): void {
        if (!node) return;
        console.log('prefix>> ' + prefix + node.name);
        node.children.forEach(child => this.printNodeNames(child, prefix + '  '));
    }

    /**
     * [디버깅] Damper Assembly와 Cover의 노드 구조를 콘솔에 출력합니다.
     */
    public debugPrintDamperStructure(): void {
        if (!this.sceneRoot) {
            return;
        }

        const nodeNameManager = getNodeNameManager();
        const damperAssembly = this.sceneRoot.getObjectByName(
            nodeNameManager.getNodeName('fridge.leftDoorDamper.damperAssembly')!
        );
        const damperCover = this.sceneRoot.getObjectByName(
            nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody')!
        );

        this.printNodeNames(damperAssembly);
        this.printNodeNames(damperCover);
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
