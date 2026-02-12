import * as THREE from 'three';

/**
 * 조립 경로 시각화 관리자
 * 조립 경로를 시각화하는 기능을 제공합니다.
 */
export class AssemblyPathVisualizer {
    private sceneRoot: THREE.Object3D | null = null;
    private debugObjects: THREE.Object3D[] = [];

    /**
     * 조립 경로 시각화 관리자를 초기화합니다.
     * @param sceneRoot 씬 루트 객체
     */
    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;

    }

    /**
     * 조립 경로를 시각화합니다.
     * @param startPosition 시작 위치
     * @param endPosition 종료 위치
     * @param plugPosition 돌출부 위치 (선택적)
     * @param holePosition 홈 위치 (선택적)
     */
    public visualizeAssemblyPath(
        startPosition: THREE.Vector3,
        endPosition: THREE.Vector3,
        plugPosition?: THREE.Vector3,
        holePosition?: THREE.Vector3 | THREE.Vector3[]
    ): void {
        this.clearDebugObjects();

        if (!this.sceneRoot) return;
        const ellipse = 0.0005;
        const debugRenderOrder = 999;

        // 시작점 마커
        const startGeometry = new THREE.SphereGeometry(ellipse, 16, 16);
        const startMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            depthTest: false,
            depthWrite: false,
            transparent: true
        });
        const startPoint = new THREE.Mesh(startGeometry, startMaterial);
        startPoint.position.copy(startPosition);
        startPoint.renderOrder = debugRenderOrder;
        this.debugObjects.push(startPoint);
        this.sceneRoot.add(startPoint);

        // 종료점 마커
        const endGeometry = new THREE.SphereGeometry(ellipse, 16, 16);
        const endMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            depthTest: false,
            depthWrite: false,
            transparent: true
        });
        const endPoint = new THREE.Mesh(endGeometry, endMaterial);
        endPoint.position.copy(endPosition);
        endPoint.renderOrder = debugRenderOrder;
        this.debugObjects.push(endPoint);
        this.sceneRoot.add(endPoint);

        // 경로 라인
        const pathPoints = [startPosition.clone(), endPosition.clone()];
        const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
        const pathMaterial = new THREE.LineDashedMaterial({
            color: 0x000000,
            dashSize: 0.05,
            gapSize: 0.02,
            linewidth: 2,
            depthTest: false,
            depthWrite: false,
            transparent: true
        });
        const pathLine = new THREE.Line(pathGeometry, pathMaterial);
        pathLine.computeLineDistances();
        pathLine.renderOrder = debugRenderOrder;
        this.debugObjects.push(pathLine);
        this.sceneRoot.add(pathLine);

        // 돌출부 마커
        if (plugPosition) {
            const plugGeometry = new THREE.SphereGeometry(ellipse, 16, 16);
            const plugMaterial = new THREE.MeshBasicMaterial({
                color: 0xff00ff,
                depthTest: false,
                depthWrite: false,
                transparent: true
            });
            const plugPoint = new THREE.Mesh(plugGeometry, plugMaterial);
            plugPoint.position.copy(plugPosition);
            plugPoint.renderOrder = debugRenderOrder;
            this.debugObjects.push(plugPoint);
            this.sceneRoot.add(plugPoint);

            const plugToStart = new THREE.BufferGeometry().setFromPoints([plugPosition, startPosition]);
            const plugToStartLine = new THREE.Line(
                plugToStart,
                new THREE.LineBasicMaterial({
                    color: 0x000000,
                    transparent: true,
                    opacity: 0.5,
                    depthTest: false,
                    depthWrite: false
                })
            );
            plugToStartLine.renderOrder = debugRenderOrder;
            this.debugObjects.push(plugToStartLine);
            this.sceneRoot.add(plugToStartLine);
        }

        // 홈 마커
        if (holePosition && this.sceneRoot) {
            const holePositions = Array.isArray(holePosition) ? holePosition : [holePosition];
            const root = this.sceneRoot;

            holePositions.forEach((hPos) => {
                // console.log('hPos>> ', hPos);
                const holeGeometry = new THREE.SphereGeometry(ellipse, 16, 16);
                const holeMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff8000,
                    depthTest: false,
                    depthWrite: false,
                    transparent: true
                });
                const holePoint = new THREE.Mesh(holeGeometry, holeMaterial);
                holePoint.position.copy(hPos);
                holePoint.renderOrder = debugRenderOrder;
                this.debugObjects.push(holePoint);
                root.add(holePoint);

                const holeToEnd = new THREE.BufferGeometry().setFromPoints([hPos, endPosition]);
                const holeToEndLine = new THREE.Line(
                    holeToEnd,
                    new THREE.LineBasicMaterial({
                        color: 0x000000,
                        transparent: true,
                        opacity: 0.5,
                        depthTest: false,
                        depthWrite: false
                    })
                );
                holeToEndLine.renderOrder = debugRenderOrder;
                this.debugObjects.push(holeToEndLine);
                root.add(holeToEndLine);
            });
        }

        // 방향 화살표
        const direction = new THREE.Vector3().subVectors(endPosition, startPosition);
        if (direction.length() > 0.0001 && this.sceneRoot) {
            const arrowHelper = new THREE.ArrowHelper(
                direction.clone().normalize(),
                startPosition,
                direction.length(),
                0x000000
            );

            arrowHelper.renderOrder = debugRenderOrder;
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
        }

        console.log('경로 시각화 생성:', {
            시작위치: `(${startPosition.x.toFixed(3)}, ${startPosition.y.toFixed(3)}, ${startPosition.z.toFixed(3)})`,
            종료위치: `(${endPosition.x.toFixed(3)}, ${endPosition.y.toFixed(3)}, ${endPosition.z.toFixed(3)})`,
            돌출부: plugPosition ? `(${plugPosition.x.toFixed(3)}, ${plugPosition.y.toFixed(3)}, ${plugPosition.z.toFixed(3)})` : '없음',
            홈: Array.isArray(holePosition)
                ? `${holePosition.length}개 탐지`
                : (holePosition ? `(${holePosition.x.toFixed(3)}, ${holePosition.y.toFixed(3)}, ${holePosition.z.toFixed(3)})` : '없음'),
            이동거리: direction.length().toFixed(4)
        });
    }

    /**
     * 탐지된 돌출부(Plug)와 홈(Hole) 좌표를 시각화합니다.
     * @param plugs 탐지된 돌출부 정보 배열
     * @param holes 탐지된 홈 정보 배열
     */
    public visualizeDetectedCoordinates(
        plugs: Array<{ position: THREE.Vector3 }>,
        holes: Array<{ position: THREE.Vector3 }>
    ): void {
        if (!this.sceneRoot) return;

        const plugPositions = plugs.map(plug => plug.position);
        const holePositions = holes.map(hole => hole.position);

        // 플러그와 홈이 모두 탐지된 경우에만 시각화
        if (plugPositions.length > 0 && holePositions.length > 0) {
            // 첫 번째 플러그와 홈을 기준으로 시각화
            const startPos = plugPositions[0];
            const endPos = holePositions[0];

            this.visualizeAssemblyPath(
                startPos,
                endPos,
                plugPositions[0],
                holePositions
            );

            console.log('[시각화] 탐지된 좌표 정보:', {
                detectedPlugs: plugPositions.map(p => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`),
                detectedHoles: holePositions.map(h => `(${h.x.toFixed(3)}, ${h.y.toFixed(3)}, ${h.z.toFixed(3)})`)
            });
        }
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
        this.clearDebugObjects();
        this.sceneRoot = null;
    }
}

// 싱글톤 인스턴스 관리
let assemblyPathVisualizerInstance: AssemblyPathVisualizer | null = null;

/**
 * 조립 경로 시각화 관리자 인스턴스를 반환합니다.
 * @returns AssemblyPathVisualizer 인스턴스
 */
export function getAssemblyPathVisualizer(): AssemblyPathVisualizer {
    if (!assemblyPathVisualizerInstance) {
        assemblyPathVisualizerInstance = new AssemblyPathVisualizer();
    }
    return assemblyPathVisualizerInstance;
}
