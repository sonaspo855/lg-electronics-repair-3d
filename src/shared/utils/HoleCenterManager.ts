import * as THREE from 'three';

/**
 * 홈 중심점 정보 인터페이스
 */
export interface HoleCenterInfo {
    id: string;                    // 고유 ID
    position: THREE.Vector3;       // 중심점 위치 (월드 좌표)
    color: number;                 // 마커 색상
    name: string;                  // 마커 이름
    marker?: THREE.Mesh;            // 시각적 마커 객체 (선택적)
    rotationAxis?: THREE.Vector3;  // 회전축 (선택적)
    insertionDirection?: THREE.Vector3; // 삽입 방향 (선택적)
    filteredVerticesCount?: number; // 필터링된 정점 수 (선택적)
}

/**
 * 홈 중심점 관리자
 * 탐지된 홈 중심점 정보를 저장하고 관리합니다.
 */
export class HoleCenterManager {
    private holeCenters: HoleCenterInfo[] = [];
    private sceneRoot: THREE.Object3D | null = null;
    private debugObjects: THREE.Object3D[] = [];

    /**
     * 홈 중심점 관리자를 초기화합니다.
     * @param sceneRoot 씬 루트 객체
     */
    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
    }

    /**
     * 탐지된 홈 중심점들에 시각적 마커를 표시하고 정보를 저장합니다.
     * @param analyses 홈 분석 결과 배열
     * @param colors 마커 색상 배열
     * @param markerSize 마커 크기 (기본: 0.0005)
     */
    public visualizeHoleCenters(
        analyses: Array<{
            position: THREE.Vector3;
            rotationAxis?: THREE.Vector3;
            insertionDirection?: THREE.Vector3;
            filteredVerticesCount?: number;
        }>,
        colors: number[],
        markerSize: number = 0.0005
    ): void {
        if (!this.sceneRoot) {
            console.warn('sceneRoot가 초기화되지 않았습니다.');
            return;
        }

        const debugRenderOrder = 1000;

        // 기존 홈 중심점 정보 초기화
        this.clearHoleCenters();

        analyses.forEach((analysis, index) => {
            const color = colors[index % colors.length];
            const geometry = new THREE.SphereGeometry(markerSize, 16, 16);
            const material = new THREE.MeshBasicMaterial({
                color: color,
                depthTest: false,
                depthWrite: false,
                transparent: true,
                opacity: 0.8
            });
            const marker = new THREE.Mesh(geometry, material);
            marker.position.copy(analysis.position);
            marker.renderOrder = debugRenderOrder;
            marker.name = `hole_marker_${index}`;

            this.debugObjects.push(marker);
            this.sceneRoot?.add(marker);

            // 홈 중심점 정보 저장
            const holeInfo: HoleCenterInfo = {
                id: `hole_${Date.now()}_${index}`,
                position: analysis.position.clone(),
                color: color,
                name: marker.name,
                marker: marker,
                rotationAxis: analysis.rotationAxis?.clone(),
                insertionDirection: analysis.insertionDirection?.clone(),
                filteredVerticesCount: analysis.filteredVerticesCount
            };
            this.holeCenters.push(holeInfo);
        });

        console.log('저장된 홈 중심점 정보:', this.holeCenters.map(h => ({
            id: h.id,
            position: `(${h.position.x.toFixed(4)}, ${h.position.y.toFixed(4)}, ${h.position.z.toFixed(4)})`,
            color: `0x${h.color.toString(16).padStart(6, '0')}`,
            filteredVerticesCount: h.filteredVerticesCount
        })));
    }

    /**
     * 저장된 홈 중심점 정보들을 반환합니다.
     * @returns 홈 중심점 정보 배열 (복사본)
     */
    public getHoleCenters(): HoleCenterInfo[] {
        return [...this.holeCenters]; // 복사본 반환하여 외부 수정 방지
    }

    /**
     * ID로 홈 중심점 정보를 찾습니다.
     * @param id 홈 중심점 ID
     * @returns 홈 중심점 정보 또는 null
     */
    public getHoleCenterById(id: string): HoleCenterInfo | null {
        return this.holeCenters.find(h => h.id === id) || null;
    }

    /**
     * 인덱스로 홈 중심점 정보를 찾습니다.
     * @param index 홈 중심점 인덱스
     * @returns 홈 중심점 정보 또는 null
     */
    public getHoleCenterByIndex(index: number): HoleCenterInfo | null {
        return this.holeCenters[index] || null;
    }

    /**
     * 저장된 홈 중심점의 개수를 반환합니다.
     * @returns 홈 중심점 개수
     */
    public getHoleCentersCount(): number {
        return this.holeCenters.length;
    }

    /**
     * 특정 홈 중심점의 마커만 제거합니다.
     * @param id 홈 중심점 ID
     */
    public removeHoleCenterMarker(id: string): void {
        const index = this.holeCenters.findIndex(h => h.id === id);
        if (index !== -1) {
            const holeInfo = this.holeCenters[index];
            if (holeInfo.marker && this.sceneRoot) {
                this.sceneRoot.remove(holeInfo.marker);
                if (holeInfo.marker.geometry) holeInfo.marker.geometry.dispose();
                if (holeInfo.marker.material instanceof THREE.Material) {
                    holeInfo.marker.material.dispose();
                }
            }
            this.holeCenters.splice(index, 1);
            console.log(`홈 중심점 마커 제거: ${id}`);
        }
    }

    /**
     * 모든 홈 중심점 정보를 초기화합니다.
     */
    public clearHoleCenters(): void {
        this.holeCenters.forEach(holeInfo => {
            if (holeInfo.marker && this.sceneRoot) {
                this.sceneRoot.remove(holeInfo.marker);
                if (holeInfo.marker.geometry) holeInfo.marker.geometry.dispose();
                if (holeInfo.marker.material instanceof THREE.Material) {
                    holeInfo.marker.material.dispose();
                }
            }
        });
        this.holeCenters = [];
    }

    /**
     * 모든 디버그 객체를 제거합니다.
     */
    public clearDebugObjects(): void {
        this.debugObjects.forEach((obj) => {
            this.sceneRoot?.remove(obj);
            if (obj instanceof THREE.Mesh) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material instanceof THREE.Material) obj.material.dispose();
            } else if (obj instanceof THREE.Line || obj instanceof THREE.LineSegments) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material instanceof THREE.Material) obj.material.dispose();
            }
        });
        this.debugObjects = [];
    }

    /**
     * 관리자를 정리합니다.
     */
    public dispose(): void {
        this.clearHoleCenters();
        this.clearDebugObjects();
        this.sceneRoot = null;
    }
}

// 싱글톤 인스턴스 관리
let holeCenterManagerInstance: HoleCenterManager | null = null;

/**
 * 홈 중심점 관리자 인스턴스를 반환합니다.
 * @returns HoleCenterManager 인스턴스
 */
export function getHoleCenterManager(): HoleCenterManager {
    if (!holeCenterManagerInstance) {
        holeCenterManagerInstance = new HoleCenterManager();
    }
    return holeCenterManagerInstance;
}
