import * as THREE from 'three';

/**
 * 클릭한 지점의 기하학적 특성을 저장하는 인터페이스
 */
export interface ClickPointSignature {
    position: THREE.Vector3;
    normal: THREE.Vector3;
    relativeHeight: number;
    curvature: number;
    nodeName: string;
}

/**
 * 클릭한 지점에 파란색 구를 생성하고 패턴을 학습하는 클래스
 */
export class ClickPointMarker {
    private scene: THREE.Scene;
    private markers: Map<string, THREE.Mesh> = new Map();
    private signatures: ClickPointSignature[] = [];
    private markerIdCounter = 0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    /**
     * 클릭한 지점에 파란색 구 마커를 생성
     * @param point 클릭 지점 (월드 좌표)
     * @param normal 클릭된 면의 법선 벡터
     * @param nodeName 클릭된 노드 이름
     * @returns 생성된 마커 ID
     */
    public createMarker(
        point: THREE.Vector3,
        normal: THREE.Vector3,
        nodeName: string
    ): string {
        const markerId = `marker_${this.markerIdCounter++}`;

        // 파란색 구 생성
        const geometry = new THREE.SphereGeometry(0.005, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x007bff,
            transparent: true,
            opacity: 0.8,
            depthTest: false,      // 다른 객체에 가려지지 않게 설정
            depthWrite: false,     // 투명 객체용
        });
        const marker = new THREE.Mesh(geometry, material);

        // 마커 위치 설정
        marker.position.copy(point);
        marker.name = markerId;
        marker.renderOrder = 999;  // 렌더 순서 보장

        // 씬에 추가
        this.scene.add(marker);
        this.markers.set(markerId, marker);

        // 클릭 지점의 기하학적 특성 추출 및 저장
        const signature = this.extractSignature(point, normal, nodeName);
        this.signatures.push(signature);

        console.log(`[ClickPointMarker] 마커 생성됨: ${markerId}`);
        console.log(`[ClickPointMarker] 추출된 패턴:`, signature);

        return markerId;
    }

    /**
     * 클릭한 지점의 기하학적 특성(지문) 추출
     */
    private extractSignature(
        point: THREE.Vector3,
        normal: THREE.Vector3,
        nodeName: string
    ): ClickPointSignature {
        // 1. Local Normal (국부 법선)
        const localNormal = normal.clone().normalize();

        // 2. Relative Height (상대적 높이)
        // 씬의 바운딩 박스를 기준으로 상대적 높이 계산
        const sceneBox = new THREE.Box3().setFromObject(this.scene);
        const sceneHeight = sceneBox.max.y - sceneBox.min.y;
        const relativeHeight = (point.y - sceneBox.min.y) / sceneHeight;

        // 3. Topology Pattern (위상 패턴 - 곡률)
        // 법선 벡터의 변화율을 근사치로 사용 (단순화된 접근)
        const curvature = this.calculateCurvature(normal);

        return {
            position: point.clone(),
            normal: localNormal,
            relativeHeight,
            curvature,
            nodeName,
        };
    }

    /**
     * 법선 벡터를 기반으로 곡률 계산 (단순화된 접근)
     */
    private calculateCurvature(normal: THREE.Vector3): number {
        // 법선 벡터가 수직(0, 1, 0)에서 얼마나 벗어나 있는지를 곡률의 근사치로 사용
        const upVector = new THREE.Vector3(0, 1, 0);
        const angle = normal.angleTo(upVector);
        return angle; // 라디안 단위
    }

    /**
     * 저장된 모든 패턴 서명 반환
     */
    public getSignatures(): ClickPointSignature[] {
        return [...this.signatures];
    }

    /**
     * 특정 마커 제거
     */
    public removeMarker(markerId: string): boolean {
        const marker = this.markers.get(markerId);
        if (marker) {
            this.scene.remove(marker);
            marker.geometry.dispose();
            if (Array.isArray(marker.material)) {
                marker.material.forEach((mat) => mat.dispose());
            } else {
                marker.material.dispose();
            }
            this.markers.delete(markerId);
            console.log(`[ClickPointMarker] 마커 제거됨: ${markerId}`);
            return true;
        }
        return false;
    }

    /**
     * 모든 마커 제거
     */
    public clearAllMarkers(): void {
        this.markers.forEach((marker, markerId) => {
            this.scene.remove(marker);
            marker.geometry.dispose();
            if (Array.isArray(marker.material)) {
                marker.material.forEach((mat) => mat.dispose());
            } else {
                marker.material.dispose();
            }
        });
        this.markers.clear();
        this.signatures = [];
        console.log('[ClickPointMarker] 모든 마커 제거됨');
    }

    /**
     * 유사한 패턴 탐색 (돌출부 식별)
     * @param targetSignature 기준이 되는 패턴
     * @param threshold 유사도 임계값 (0~1, 낮을수록 엄격)
     * @returns 유사한 패턴 목록
     */
    public findSimilarPatterns(
        targetSignature: ClickPointSignature,
        threshold: number = 0.3
    ): ClickPointSignature[] {
        return this.signatures.filter((sig) => {
            if (sig === targetSignature) return false;

            // 법선 벡터 유사도
            const normalSimilarity = sig.normal.angleTo(targetSignature.normal);

            // 상대적 높이 차이
            const heightDiff = Math.abs(sig.relativeHeight - targetSignature.relativeHeight);

            // 곡률 차이
            const curvatureDiff = Math.abs(sig.curvature - targetSignature.curvature);

            // 종합 유사도 점수 (낮을수록 유사)
            const similarityScore = normalSimilarity + heightDiff + curvatureDiff;

            return similarityScore < threshold;
        });
    }

    /**
     * 마커의 색상 변경
     */
    public updateMarkerColor(markerId: string, color: number): boolean {
        const marker = this.markers.get(markerId);
        if (marker && marker.material instanceof THREE.MeshBasicMaterial) {
            marker.material.color.setHex(color);
            return true;
        }
        return false;
    }

    /**
     * 마커의 크기 변경
     */
    public updateMarkerSize(markerId: string, radius: number): boolean {
        const marker = this.markers.get(markerId);
        if (marker) {
            marker.geometry.dispose();
            marker.geometry = new THREE.SphereGeometry(radius, 32, 32);
            return true;
        }
        return false;
    }

    /**
     * 모든 마커의 표시/숨김 토글
     */
    public toggleMarkersVisibility(visible: boolean): void {
        this.markers.forEach((marker) => {
            marker.visible = visible;
        });
    }

    /**
     * 저장된 패턴을 JSON으로 내보내기
     */
    public exportSignatures(): string {
        const exportData = this.signatures.map((sig) => ({
            position: { x: sig.position.x, y: sig.position.y, z: sig.position.z },
            normal: { x: sig.normal.x, y: sig.normal.y, z: sig.normal.z },
            relativeHeight: sig.relativeHeight,
            curvature: sig.curvature,
            nodeName: sig.nodeName,
        }));
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * JSON에서 패턴 가져오기
     */
    public importSignatures(jsonString: string): void {
        try {
            const importData = JSON.parse(jsonString);
            this.signatures = importData.map((data: any) => ({
                position: new THREE.Vector3(data.position.x, data.position.y, data.position.z),
                normal: new THREE.Vector3(data.normal.x, data.normal.y, data.normal.z),
                relativeHeight: data.relativeHeight,
                curvature: data.curvature,
                nodeName: data.nodeName,
            }));
            console.log(`[ClickPointMarker] ${this.signatures.length}개의 패턴 가져옴`);
        } catch (error) {
            console.error('[ClickPointMarker] 패턴 가져오기 실패:', error);
        }
    }
}

/**
 * ClickPointMarker 인스턴스를 관리하는 싱글톤 팩토리
 */
let clickPointMarkerInstance: ClickPointMarker | null = null;

export function getClickPointMarker(scene?: THREE.Scene): ClickPointMarker {
    if (!clickPointMarkerInstance) {
        if (!scene) {
            throw new Error('[ClickPointMarker] 씬이 제공되지 않았습니다.');
        }
        clickPointMarkerInstance = new ClickPointMarker(scene);
    }
    return clickPointMarkerInstance;
}

export function resetClickPointMarker(): void {
    if (clickPointMarkerInstance) {
        clickPointMarkerInstance.clearAllMarkers();
        clickPointMarkerInstance = null;
    }
}
