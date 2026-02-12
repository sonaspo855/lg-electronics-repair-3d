import * as THREE from 'three';

/**
 * 디버그 객체 관리자
 * 디버그용 시각적 객체들을 생성하고 관리합니다.
 */
export class DebugObjectManager {
    private sceneRoot: THREE.Object3D | null = null;
    private debugObjects: THREE.Object3D[] = [];

    /**
     * 디버그 객체 관리자를 초기화합니다.
     * @param sceneRoot 씬 루트 객체
     */
    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
        console.log('[DebugObjectManager] 초기화 완료');
    }

    /**
     * 구체 마커를 생성하고 씬에 추가합니다.
     * @param position 마커 위치
     * @param color 마커 색상
     * @param size 마커 크기 (기본: 0.0005)
     * @param name 마커 이름 (선택적)
     * @returns 생성된 마커 메쉬
     */
    public createSphereMarker(
        position: THREE.Vector3,
        color: number,
        size: number = 0.0005,
        name?: string
    ): THREE.Mesh {
        if (!this.sceneRoot) {
            console.warn('[DebugObjectManager] sceneRoot가 초기화되지 않았습니다.');
            throw new Error('sceneRoot가 초기화되지 않았습니다.');
        }

        const geometry = new THREE.SphereGeometry(size, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.8
        });
        const marker = new THREE.Mesh(geometry, material);
        marker.position.copy(position);
        marker.renderOrder = 1000;
        if (name) marker.name = name;

        this.debugObjects.push(marker);
        this.sceneRoot.add(marker);

        return marker;
    }

    /**
     * 라인을 생성하고 씬에 추가합니다.
     * @param points 라인을 구성하는 점들
     * @param color 라인 색상
     * @param opacity 투명도 (기본: 0.5)
     * @returns 생성된 라인
     */
    public createLine(
        points: THREE.Vector3[],
        color: number,
        opacity: number = 0.5
    ): THREE.Line {
        if (!this.sceneRoot) {
            console.warn('[DebugObjectManager] sceneRoot가 초기화되지 않았습니다.');
            throw new Error('sceneRoot가 초기화되지 않았습니다.');
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            depthTest: false,
            depthWrite: false
        });
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 1000;

        this.debugObjects.push(line);
        this.sceneRoot.add(line);

        return line;
    }

    /**
     * 점선을 생성하고 씬에 추가합니다.
     * @param points 점선을 구성하는 점들
     * @param color 점선 색상
     * @param dashSize 대시 크기 (기본: 0.05)
     * @param gapSize 간격 크기 (기본: 0.02)
     * @returns 생성된 점선
     */
    public createDashedLine(
        points: THREE.Vector3[],
        color: number,
        dashSize: number = 0.05,
        gapSize: number = 0.02
    ): THREE.Line {
        if (!this.sceneRoot) {
            console.warn('[DebugObjectManager] sceneRoot가 초기화되지 않았습니다.');
            throw new Error('sceneRoot가 초기화되지 않았습니다.');
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: color,
            dashSize: dashSize,
            gapSize: gapSize,
            linewidth: 2,
            depthTest: false,
            depthWrite: false,
            transparent: true
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        line.renderOrder = 1000;

        this.debugObjects.push(line);
        this.sceneRoot.add(line);

        return line;
    }

    /**
     * 화살표 헬퍼를 생성하고 씬에 추가합니다.
     * @param direction 방향 벡터
     * @param origin 시작 위치
     * @param length 화살표 길이
     * @param color 화살표 색상 (기본: 0xffff00)
     * @returns 생성된 화살표 헬퍼
     */
    public createArrowHelper(
        direction: THREE.Vector3,
        origin: THREE.Vector3,
        length: number,
        color: number = 0xffff00
    ): THREE.ArrowHelper {
        if (!this.sceneRoot) {
            console.warn('[DebugObjectManager] sceneRoot가 초기화되지 않았습니다.');
            throw new Error('sceneRoot가 초기화되지 않았습니다.');
        }

        const arrowHelper = new THREE.ArrowHelper(
            direction.clone().normalize(),
            origin,
            length,
            color
        );
        arrowHelper.renderOrder = 1000;

        const arrowMaterials = [arrowHelper.line.material, arrowHelper.cone.material].flat();
        arrowMaterials.forEach(mat => {
            if (mat instanceof THREE.Material) {
                mat.depthTest = false;
                mat.depthWrite = false;
                mat.transparent = true;
            }
        });

        this.debugObjects.push(arrowHelper);
        this.sceneRoot.add(arrowHelper);

        return arrowHelper;
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
            } else if (obj instanceof THREE.ArrowHelper) {
                if (obj.line.geometry) obj.line.geometry.dispose();
                if (obj.line.material instanceof THREE.Material) obj.line.material.dispose();
                if (obj.cone.geometry) obj.cone.geometry.dispose();
                if (obj.cone.material instanceof THREE.Material) obj.cone.material.dispose();
            }
        });
        this.debugObjects = [];
    }

    /**
     * 저장된 디버그 객체의 개수를 반환합니다.
     * @returns 디버그 객체 개수
     */
    public getDebugObjectsCount(): number {
        return this.debugObjects.length;
    }

    /**
     * 관리자를 정리합니다.
     */
    public dispose(): void {
        this.clearDebugObjects();
        this.sceneRoot = null;
        console.log('[DebugObjectManager] 서비스 정리 완료');
    }
}

// 싱글톤 인스턴스 관리
let debugObjectManagerInstance: DebugObjectManager | null = null;

/**
 * 디버그 객체 관리자 인스턴스를 반환합니다.
 * @returns DebugObjectManager 인스턴스
 */
export function getDebugObjectManager(): DebugObjectManager {
    if (!debugObjectManagerInstance) {
        debugObjectManagerInstance = new DebugObjectManager();
    }
    return debugObjectManagerInstance;
}
