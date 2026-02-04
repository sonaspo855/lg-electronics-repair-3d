import * as THREE from 'three';
import { NormalBasedHighlight } from './NormalBasedHighlight';
import { getHoleCenterManager } from './HoleCenterManager';

/**
 * 홈 탐지 서비스
 * 홈(Groove) 영역을 탐지하고 시각화합니다.
 */
export class GrooveDetectionService {
    private sceneRoot: THREE.Object3D | null = null;
    private cameraControls: any = null;
    private normalBasedHighlight: NormalBasedHighlight = new NormalBasedHighlight();
    private holeCenterManager = getHoleCenterManager();

    /**
     * 홈 탐지 서비스를 초기화합니다.
     * @param sceneRoot 씬 루트 객체
     * @param cameraControls 카메라 컨트롤러
     */
    public initialize(sceneRoot: THREE.Object3D, cameraControls?: any): void {
        this.sceneRoot = sceneRoot;
        this.cameraControls = cameraControls || null;
        this.normalBasedHighlight.initialize(sceneRoot);
        this.holeCenterManager.initialize(sceneRoot);
    }

    /**
     * 노드의 면을 하이라이트하고 홈을 찾아 중심점을 체크합니다.
     * @param nodeName 대상 노드 이름
     * @returns 탐지된 홈 분석 결과 배열
     */
    public async detectAndHighlightGrooves(nodeName: string): Promise<Array<{
        position: THREE.Vector3;
        rotationAxis?: THREE.Vector3;
        insertionDirection?: THREE.Vector3;
        filteredVerticesCount?: number;
    }>> {
        if (!this.sceneRoot || !this.cameraControls) {
            console.warn('sceneRoot 또는 cameraControls가 초기화되지 않았습니다.');
            return [];
        }

        const targetNode = this.sceneRoot.getObjectByName(nodeName);
        if (!targetNode) {
            console.warn(`노드를 찾을 수 없습니다: ${nodeName}`);
            return [];
        }

        // 1. 기존 하이라이트 제거
        this.normalBasedHighlight.clearHighlights();

        // 2. 카메라 방향 가져오기
        const camera = this.cameraControls.camera || this.cameraControls.object;
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);

        // 3. 시각적 하이라이트 적용 (카메라 필터 기반)
        const highlightedFaces = this.normalBasedHighlight.highlightFacesByCameraFilter(
            targetNode,
            camera,
            0xff0000, // 정면: 빨강
            15        // 임계 각도
        );

        // 4. 홈 탐지 및 중심점 계산
        const holeAnalyses = NormalBasedHighlight.clusterFaces(
            highlightedFaces,
            0.02
        );

        /* 
        // 5. 탐지된 각 홈을 서로 다른 색상으로 하이라이트
        const highlightColors = [0x00ff00, 0x0088ff, 0xff00ff, 0xffff00, 0xff8800];
        this.normalBasedHighlight.highlightClusters(holeAnalyses, highlightColors);

        // 6. 탐지된 경계 루프(구멍 테두리) 시각화
        const boundaryLoops = holeAnalyses
            .filter(analysis => !!analysis.boundaryLoop)
            .map(analysis => analysis.boundaryLoop as THREE.Vector3[]);

        if (boundaryLoops.length > 0) {
            this.normalBasedHighlight.highlightBoundaryLoops(boundaryLoops, 0xff0080); // 테두리 표시
        }

        // 7. 탐지된 중심점에 마커 표시 (하이라이트 색상과 동기화)
        if (holeAnalyses.length > 0) {
            this.holeCenterManager.visualizeHoleCenters(holeAnalyses, highlightColors);
        } */

        return holeAnalyses;
    }

    /**
     * 저장된 홈 중심점 정보들을 반환합니다.
     * @returns 홈 중심점 정보 배열
     */
    public getHoleCenters() {
        return this.holeCenterManager.getHoleCenters();
    }

    /**
     * ID로 홈 중심점 정보를 찾습니다.
     * @param id 홈 중심점 ID
     * @returns 홈 중심점 정보 또는 null
     */
    public getHoleCenterById(id: string) {
        return this.holeCenterManager.getHoleCenterById(id);
    }

    /**
     * 인덱스로 홈 중심점 정보를 찾습니다.
     * @param index 홈 중심점 인덱스
     * @returns 홈 중심점 정보 또는 null
     */
    public getHoleCenterByIndex(index: number) {
        return this.holeCenterManager.getHoleCenterByIndex(index);
    }

    /**
     * 저장된 홈 중심점의 개수를 반환합니다.
     * @returns 홈 중심점 개수
     */
    public getHoleCentersCount(): number {
        return this.holeCenterManager.getHoleCentersCount();
    }

    /**
     * 모든 하이라이트를 제거합니다.
     */
    public clearHighlights(): void {
        this.normalBasedHighlight.clearHighlights();
    }

    /**
     * 서비스를 정리합니다.
     */
    public dispose(): void {
        this.normalBasedHighlight.dispose();
        this.holeCenterManager.dispose();
        this.sceneRoot = null;
        this.cameraControls = null;
    }
}

// 싱글톤 인스턴스 관리
let grooveDetectionServiceInstance: GrooveDetectionService | null = null;

/**
 * 홈 탐지 서비스 인스턴스를 반환합니다.
 * @returns GrooveDetectionService 인스턴스
 */
export function getGrooveDetectionService(): GrooveDetectionService {
    if (!grooveDetectionServiceInstance) {
        grooveDetectionServiceInstance = new GrooveDetectionService();
    }
    return grooveDetectionServiceInstance;
}
