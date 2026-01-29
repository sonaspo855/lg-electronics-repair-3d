import * as THREE from 'three';

/**
 * 홈(Hole) 시각화 정보 인터페이스
 */
export interface HoleVisualizationInfo {
    position: THREE.Vector3;
    rotationAxis: THREE.Vector3;
    insertionDirection: THREE.Vector3;
    filteredVerticesCount: number;
}

/**
 * 법선 벡터 기반 홈(Hole) 시각화 컴포넌트
 * NormalBasedHighlight로 탐지된 다중 홈을 시각화합니다
 */
export class NormalBasedHoleVisualizer {
    private sceneRoot: THREE.Object3D | null = null;
    private debugObjects: THREE.Object3D[] = [];
    private ellipse: number = 0.0005;
    private debugRenderOrder: number = 999;

    /**
     * 시각화 컴포넌트 초기화
     * @param sceneRoot 씬 루트 객체
     */
    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
    }

    /**
     * 홈 시각화 옵션 설정
     * @param options 시각화 옵션
     */
    public setOptions(options?: {
        ellipse?: number;
        debugRenderOrder?: number;
    }): void {
        if (options?.ellipse !== undefined) {
            this.ellipse = options.ellipse;
        }
        if (options?.debugRenderOrder !== undefined) {
            this.debugRenderOrder = options.debugRenderOrder;
        }
    }

    /**
     * 다중 홈 시각화
     * @param holes 탐지된 홈 정보 배열
     */
    public visualizeHoles(holes: HoleVisualizationInfo[]): void {
        const sceneRoot = this.sceneRoot;
        if (!sceneRoot || holes.length === 0) return;

        holes.forEach((hole, index) => {
            // 홈 위치 마커 (노란색 구체)
            this.createHoleMarker(hole.position);

            // 회전축 화살표 (노란색)
            if (hole.rotationAxis.length() > 0.001) {
                this.createRotationAxisHelper(hole.position, hole.rotationAxis);
            }

            // 삽입 방향 화살표 (청록색)
            if (hole.insertionDirection.length() > 0.001) {
                this.createInsertionDirectionHelper(hole.position, hole.insertionDirection);
            }

            console.log(`[NormalBasedHoleVisualizer] 홈 #${index + 1} 시각화:`, {
                위치: `(${hole.position.x.toFixed(4)}, ${hole.position.y.toFixed(4)}, ${hole.position.z.toFixed(4)})`,
                회전축: `(${hole.rotationAxis.x.toFixed(4)}, ${hole.rotationAxis.y.toFixed(4)}, ${hole.rotationAxis.z.toFixed(4)})`,
                삽입방향: `(${hole.insertionDirection.x.toFixed(4)}, ${hole.insertionDirection.y.toFixed(4)}, ${hole.insertionDirection.z.toFixed(4)})`,
                필터링된_정점수: hole.filteredVerticesCount
            });
        });

        console.log(`[NormalBasedHoleVisualizer] 총 ${holes.length}개의 홈 시각화 완료`);
    }

    /**
     * 홈 위치 마커 생성
     * @param position 홈 위치
     * @param color 마커 색상 (기본값: 노란색)
     */
    public createHoleMarker(position: THREE.Vector3, color: number = 0xffff00): void {
        if (!this.sceneRoot) return;

        const holeGeometry = new THREE.SphereGeometry(this.ellipse, 16, 16);
        const holeMaterial = new THREE.MeshBasicMaterial({
            color: color,
            depthTest: false,
            depthWrite: false,
            transparent: true
        });
        const holePoint = new THREE.Mesh(holeGeometry, holeMaterial);
        holePoint.position.copy(position);
        holePoint.renderOrder = this.debugRenderOrder;
        this.debugObjects.push(holePoint);
        this.sceneRoot.add(holePoint);
    }

    /**
     * 회전축 화살표 생성
     * @param position 시작 위치
     * @param rotationAxis 회전축 방향
     * @param length 화살표 길이 (기본값: 0.02)
     * @param color 화살표 색상 (기본값: 노란색)
     */
    public createRotationAxisHelper(
        position: THREE.Vector3,
        rotationAxis: THREE.Vector3,
        length: number = 0.02,
        color: number = 0xffff00
    ): void {
        if (!this.sceneRoot) return;

        const rotationAxisHelper = new THREE.ArrowHelper(
            rotationAxis.clone().normalize(),
            position,
            length,
            color
        );
        rotationAxisHelper.renderOrder = this.debugRenderOrder;
        const rotationMaterials = [rotationAxisHelper.line.material, rotationAxisHelper.cone.material].flat();
        rotationMaterials.forEach(mat => {
            if (mat instanceof THREE.Material) {
                mat.depthTest = false;
                mat.depthWrite = false;
                mat.transparent = true;
            }
        });
        this.debugObjects.push(rotationAxisHelper);
        this.sceneRoot.add(rotationAxisHelper);
    }

    /**
     * 삽입 방향 화살표 생성
     * @param position 시작 위치
     * @param insertionDirection 삽입 방향
     * @param length 화살표 길이 (기본값: 0.02)
     * @param color 화살표 색상 (기본값: 청록색)
     */
    public createInsertionDirectionHelper(
        position: THREE.Vector3,
        insertionDirection: THREE.Vector3,
        length: number = 0.02,
        color: number = 0x00ffff
    ): void {
        if (!this.sceneRoot) return;

        const insertionDirectionHelper = new THREE.ArrowHelper(
            insertionDirection.clone().normalize(),
            position,
            length,
            color
        );
        insertionDirectionHelper.renderOrder = this.debugRenderOrder;
        const insertionMaterials = [insertionDirectionHelper.line.material, insertionDirectionHelper.cone.material].flat();
        insertionMaterials.forEach(mat => {
            if (mat instanceof THREE.Material) {
                mat.depthTest = false;
                mat.depthWrite = false;
                mat.transparent = true;
            }
        });
        this.debugObjects.push(insertionDirectionHelper);
        this.sceneRoot.add(insertionDirectionHelper);
    }

    /**
     * 모든 시각화 객체 제거
     */
    public clearVisualizations(): void {
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
     * 컴포넌트 정리
     */
    public dispose(): void {
        this.clearVisualizations();
        this.sceneRoot = null;
    }
}
