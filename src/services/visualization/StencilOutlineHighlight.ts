import * as THREE from 'three';

/**
 * Outline Shader/Stencil Buffer 방식을 사용하여 하이라이트하는 컴포넌트
 * 메쉬를 클론하고 Stencil Buffer를 사용하여 외곽선 효과를 생성합니다
 */
export class StencilOutlineHighlight {
    private sceneRoot: THREE.Object3D | null = null;
    private activeHighlights: THREE.Object3D[] = [];

    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
    }

    /**
     * [레거시] 메쉬를 클론하고 Outline Shader/Stencil Buffer 방식을 사용하여
     * 노드의 안쪽 홈 부분을 하이라이트합니다 (단일 메쉬 대상)
     * @param originalMesh 하이라이트할 원본 메쉬
     * @param color 하이라이트 색상 (기본값: 빨강)
     */
    public createSingleMeshCloneHighlight(originalMesh: THREE.Mesh, color: number = 0xff0000): void {
        if (!this.sceneRoot) return;

        // 원본 메쉬의 월드 매트릭스 업데이트
        originalMesh.updateMatrixWorld(true);

        // 메쉬 클론 (안쪽 홈 부분 하이라이트용)
        const highlightMesh = originalMesh.clone();
        highlightMesh.applyMatrix4(originalMesh.matrixWorld);

        // 안쪽 홈 하이라이트용 재질 설정
        const highlightMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
            stencilWrite: true,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilRef: 1,
            stencilZPass: THREE.ReplaceStencilOp
        });

        highlightMesh.material = highlightMaterial;

        // Outline 메쉬 생성
        const outlineMesh = originalMesh.clone();
        outlineMesh.applyMatrix4(originalMesh.matrixWorld);
        outlineMesh.scale.multiplyScalar(1.03);

        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            side: THREE.BackSide,
            depthTest: false,
            depthWrite: false,
            stencilWrite: true,
            stencilFunc: THREE.EqualStencilFunc,
            stencilRef: 1,
            stencilZPass: THREE.KeepStencilOp
        });

        outlineMesh.material = outlineMaterial;

        this.sceneRoot.add(highlightMesh);
        this.sceneRoot.add(outlineMesh);
        this.activeHighlights.push(highlightMesh, outlineMesh);

        console.log('[StencilOutlineHighlight] 단일 메쉬 클론 홈 하이라이트 완료');
    }

    /**
     * 활성화된 모든 하이라이트를 제거합니다
     */
    public clearHighlights(): void {
        this.activeHighlights.forEach(highlight => {
            if (this.sceneRoot) {
                this.sceneRoot.remove(highlight);
            }
            if (highlight instanceof THREE.Mesh || highlight instanceof THREE.LineSegments) {
                highlight.geometry.dispose();
                if (highlight.material instanceof THREE.Material) {
                    highlight.material.dispose();
                }
            }
        });
        this.activeHighlights = [];
    }
}
