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
     * [신규] 법선 벡터 기반 필터링 + 메쉬 클론 + Stencil Buffer 방식으로
     * 노드의 안쪽 홈 부분을 정밀하게 하이라이트합니다
     * @param targetNode 하이라이트할 대상 노드
     * @param color 하이라이트 색상 (기본값: 빨강)
     * @param thresholdAngle 엣지로 판정할 최소 각도 (기본값: 15도)
     * @param targetNormal 필터링할 방향 법선 벡터 (기본값: Z축 방향)
     * @param normalTolerance 법선 벡터 허용 오차 (기본값: 0.2)
     */
    public createGrooveMeshHighlightWithNormalFilter(
        targetNode: THREE.Object3D,
        color: number = 0xff0000,
        thresholdAngle: number = 15,
        targetNormal: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
        normalTolerance: number = 0.2
    ): void {
        console.log('createGrooveMeshHighlightWithNormalFilter!!!');
        if (!this.sceneRoot) return;

        // 월드 매트릭스 최신화
        targetNode.updateMatrixWorld(true);

        targetNode.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
                this.processMeshForGrooveHighlight(
                    child,
                    color,
                    thresholdAngle,
                    targetNormal,
                    normalTolerance
                );
            }
        });

        console.log('[StencilOutlineHighlight] 법선 필터링 + 클론 + Stencil 버퍼 홈 하이라이트 완료');
    }

    /**
     * [내부 메서드] 개별 메쉬를 처리하여 홈 하이라이트 생성
     */
    private processMeshForGrooveHighlight(
        originalMesh: THREE.Mesh,
        color: number,
        thresholdAngle: number,
        targetNormal: THREE.Vector3,
        normalTolerance: number
    ): void {
        console.log('processMeshForGrooveHighlight!!!');
        const geometry = originalMesh.geometry;

        // 법선 벡터가 없으면 계산
        if (!geometry.attributes.normal) {
            geometry.computeVertexNormals();
        }

        const positions = geometry.attributes.position;
        const normals = geometry.attributes.normal;
        const indices = geometry.index;

        // 필터링된 인덱스와 제외된 인덱스를 저장할 배열
        const filteredIndices: number[] = [];
        const excludedIndices: number[] = [];

        if (indices) {
            // 인덱스 버퍼가 있는 경우
            for (let i = 0; i < indices.count; i += 3) {
                const idx1 = indices.getX(i);
                const idx2 = indices.getX(i + 1);
                const idx3 = indices.getX(i + 2);

                const avgNormal = this.calculateAverageNormal(
                    normals, idx1, idx2, idx3, originalMesh.quaternion
                );

                const dotProduct = Math.abs(avgNormal.dot(targetNormal));
                if (dotProduct > (1 - normalTolerance)) {
                    filteredIndices.push(idx1, idx2, idx3);
                } else {
                    excludedIndices.push(idx1, idx2, idx3);
                }
            }
        } else {
            // 인덱스 버퍼가 없는 경우
            for (let i = 0; i < positions.count; i += 3) {
                const avgNormal = this.calculateAverageNormal(
                    normals, i, i + 1, i + 2, originalMesh.quaternion
                );

                const dotProduct = Math.abs(avgNormal.dot(targetNormal));
                if (dotProduct > (1 - normalTolerance)) {
                    filteredIndices.push(i, i + 1, i + 2);
                } else {
                    excludedIndices.push(i, i + 1, i + 2);
                }
            }
        }

        // 1. 필터링된 영역 하이라이트 (이미지상의 주황색/노란색 영역)
        if (filteredIndices.length > 0) {
            this.createFilteredMeshHighlight(
                originalMesh,
                filteredIndices,
                color,
                thresholdAngle
            );
        }

        console.log('제외된 영역 하이라이트 (이미지상에서 색상화되지 않은 영역 -> 붉은색)!!!');
        // 2. 제외된 영역 하이라이트 (이미지상에서 색상화되지 않은 영역 -> 붉은색)
        if (excludedIndices.length > 0) {
            console.log(`[StencilOutlineHighlight] 제외된 영역(붉은색) 인덱스 수: ${excludedIndices.length}`);
            this.createFilteredMeshHighlight(
                originalMesh,
                excludedIndices,
                0xff0000, // 붉은색
                thresholdAngle,
                0.8 // 디버깅을 위해 불투명도 상향
            );

            // [디버깅용] 제외된 영역의 중심점에 작은 포인트 또는 라인 시각화
            this.visualizeExcludedArea(originalMesh, excludedIndices);
        }
    }

    /**
     * [디버깅용] 제외된 영역을 시각적으로 확인하기 위한 라인 렌더링
     */
    private visualizeExcludedArea(originalMesh: THREE.Mesh, indices: number[]): void {
        console.log('visualizeExcludedArea!!!');
        if (!this.sceneRoot) return;

        const positions = originalMesh.geometry.attributes.position;
        const linePoints: THREE.Vector3[] = [];

        // 너무 많으면 성능에 영향을 주므로 처음 100개의 삼각형만 시각화
        const limit = Math.min(indices.length, 300);
        for (let i = 0; i < limit; i += 3) {
            const p1 = new THREE.Vector3().fromBufferAttribute(positions, indices[i]);
            const p2 = new THREE.Vector3().fromBufferAttribute(positions, indices[i + 1]);
            const p3 = new THREE.Vector3().fromBufferAttribute(positions, indices[i + 2]);

            linePoints.push(p1, p2, p2, p3, p3, p1);
        }

        const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000,
            depthTest: false,
            transparent: true,
            opacity: 1.0
        });

        const debugLines = new THREE.LineSegments(lineGeometry, lineMaterial);
        debugLines.applyMatrix4(originalMesh.matrixWorld);

        this.sceneRoot.add(debugLines);
        this.activeHighlights.push(debugLines);

        console.log('[StencilOutlineHighlight] 제외된 영역 시각화 라인 추가됨');
    }

    /**
     * [내부 메서드] 평균 법선 벡터 계산
     */
    private calculateAverageNormal(
        normals: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
        idx1: number,
        idx2: number,
        idx3: number,
        quaternion: THREE.Quaternion
    ): THREE.Vector3 {
        const normal1 = new THREE.Vector3(
            normals.getX(idx1),
            normals.getY(idx1),
            normals.getZ(idx1)
        );
        const normal2 = new THREE.Vector3(
            normals.getX(idx2),
            normals.getY(idx2),
            normals.getZ(idx2)
        );
        const normal3 = new THREE.Vector3(
            normals.getX(idx3),
            normals.getY(idx3),
            normals.getZ(idx3)
        );

        normal1.applyQuaternion(quaternion);
        normal2.applyQuaternion(quaternion);
        normal3.applyQuaternion(quaternion);

        return new THREE.Vector3()
            .addVectors(normal1, normal2)
            .add(normal3)
            .normalize();
    }

    /**
     * [내부 메서드] 필터링된 영역의 메쉬 클론 + Stencil 하이라이트 생성
     */
    private createFilteredMeshHighlight(
        originalMesh: THREE.Mesh,
        filteredIndices: number[],
        color: number,
        thresholdAngle: number,
        opacity: number = 0.4
    ): void {
        if (!this.sceneRoot) return;

        // 1. 필터링된 인덱스로 새로운 지오메트리 생성
        const filteredGeometry = new THREE.BufferGeometry();
        const positions = originalMesh.geometry.attributes.position;
        const normals = originalMesh.geometry.attributes.normal;
        const filteredPositions = new Float32Array(filteredIndices.length * 3);
        const filteredNormals = normals ? new Float32Array(filteredIndices.length * 3) : null;

        for (let i = 0; i < filteredIndices.length; i++) {
            const idx = filteredIndices[i];
            filteredPositions[i * 3] = positions.getX(idx);
            filteredPositions[i * 3 + 1] = positions.getY(idx);
            filteredPositions[i * 3 + 2] = positions.getZ(idx);

            if (filteredNormals && normals) {
                filteredNormals[i * 3] = normals.getX(idx);
                filteredNormals[i * 3 + 1] = normals.getY(idx);
                filteredNormals[i * 3 + 2] = normals.getZ(idx);
            }
        }

        filteredGeometry.setAttribute('position', new THREE.BufferAttribute(filteredPositions, 3));
        if (filteredNormals) {
            filteredGeometry.setAttribute('normal', new THREE.BufferAttribute(filteredNormals, 3));
        } else {
            filteredGeometry.computeVertexNormals();
        }

        // 2. 필터링된 지오메트리의 EdgesGeometry 생성 (홈 모서리 하이라이트)
        const edgesGeometry = new THREE.EdgesGeometry(filteredGeometry, thresholdAngle);
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
            depthWrite: false
        });

        const edgesLine = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        edgesLine.applyMatrix4(originalMesh.matrixWorld);

        // 3. Stencil Buffer를 사용한 내부 채우기 하이라이트
        const fillGeometry = filteredGeometry.clone();
        const fillMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
            stencilWrite: true,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilRef: 1,
            stencilZPass: THREE.ReplaceStencilOp
        });

        const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
        fillMesh.applyMatrix4(originalMesh.matrixWorld);

        // 4. 스케일 확대를 사용한 외곽선 효과 (Stencil Buffer 방식)
        const outlineMesh = new THREE.Mesh(filteredGeometry.clone(), fillMaterial.clone());
        outlineMesh.applyMatrix4(originalMesh.matrixWorld);
        outlineMesh.scale.multiplyScalar(1.02);

        const outlineFillMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            side: THREE.BackSide,
            depthTest: false,
            depthWrite: false,
            stencilWrite: true,
            stencilFunc: THREE.EqualStencilFunc,
            stencilRef: 1,
            stencilZPass: THREE.KeepStencilOp
        });
        outlineMesh.material = outlineFillMaterial;

        // 5. 씬에 추가
        this.sceneRoot.add(edgesLine);
        this.sceneRoot.add(fillMesh);
        this.sceneRoot.add(outlineMesh);

        // 활성 하이라이트 목록에 추가
        this.activeHighlights.push(edgesLine, fillMesh, outlineMesh);
    }

    /**
     * [신규] 카메라를 기준으로 가장 먼저 보이는 면(가장 가까운 면)만
     * 정밀하게 하이라이트합니다. 카메라 방향과 노드 법선을 직접 비교합니다.
     * @param targetNode 하이라이트할 대상 노드
     * @param camera 카메라 객체
     * @param color 하이라이트 색상 (기본값: 빨강)
     * @param thresholdAngle 엣지로 판정할 최소 각도 (기본값: 15도)
     */
    public createGrooveMeshHighlightWithCameraFilter(
        targetNode: THREE.Object3D,
        camera: THREE.Camera,
        color: number = 0xff0000,
        thresholdAngle: number = 15
    ): void {
        console.log('createGrooveMeshHighlightWithCameraFilter - Threshold Based!!');
        if (!this.sceneRoot) return;

        // 월드 매트릭스 최신화
        targetNode.updateMatrixWorld(true);

        // 카메라 방향 벡터 (카메라가 바라보는 방향)
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.normalize();

        // 모든 메쉬를 순회하며 카메라를 향하는 면들을 수집
        targetNode.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
                const geometry = child.geometry;
                const positions = geometry.attributes.position;
                const normals = geometry.attributes.normal;
                const indices = geometry.index;

                if (!normals) {
                    geometry.computeVertexNormals();
                }

                const filteredIndices: number[] = [];
                const grooveWallIndices: number[] = [];
                const faceCount = indices ? indices.count / 3 : positions.count / 3;

                // 메쉬의 월드 쿼터니언 가져오기 (법선 변환용)
                const worldQuat = new THREE.Quaternion();
                child.getWorldQuaternion(worldQuat);

                for (let i = 0; i < faceCount; i++) {
                    let idx1, idx2, idx3;
                    if (indices) {
                        idx1 = indices.getX(i * 3);
                        idx2 = indices.getX(i * 3 + 1);
                        idx3 = indices.getX(i * 3 + 2);
                    } else {
                        idx1 = i * 3;
                        idx2 = i * 3 + 1;
                        idx3 = i * 3 + 2;
                    }

                    // 평균 법선 계산
                    const avgNormal = this.calculateAverageNormal(
                        geometry.attributes.normal as THREE.BufferAttribute,
                        idx1, idx2, idx3,
                        worldQuat
                    );

                    // 카메라 방향과 법선의 내적 계산
                    // 카메라 방향(시선)과 면 법선이 반대 방향일 때(내적이 음수일 때) 카메라를 향하는 면임
                    const dotProduct = avgNormal.dot(cameraDirection);

                    // 1. 정면을 바라보는 면 (내적이 -0.5 미만) -> 지정된 색상 (기본 빨강)
                    if (dotProduct < -0.5) {
                        filteredIndices.push(idx1, idx2, idx3);
                    }
                    // 2. 그 외 모든 면 (측면 및 배면 포함) -> 노란색으로 채움
                    // 카메라를 등지는 면이라도 홈의 일부일 수 있으므로 모두 포함하여 노란색으로 색상화
                    else {
                        grooveWallIndices.push(idx1, idx2, idx3);
                    }
                }

                // 수집된 면이 있으면 하이라이트 적용
                if (filteredIndices.length > 0) {
                    this.createFilteredMeshHighlight(
                        child,
                        filteredIndices,
                        color,
                        thresholdAngle,
                        0.5 // 정면 면의 불투명도 약간 상향
                    );
                }

                // 홈의 벽면 및 나머지 영역 노란색 하이라이트 적용
                if (grooveWallIndices.length > 0) {
                    this.createFilteredMeshHighlight(
                        child,
                        grooveWallIndices,
                        0xffff00, // 노란색
                        thresholdAngle,
                        0.6 // 노란색 영역은 더 명확하게 보이도록 불투명도 상향
                    );
                }
            }
        });

        console.log('[StencilOutlineHighlight] 카메라 방향 기반 다중 면 하이라이트 완료');
    }

    /**
     * [내부 메서드] 단일 면만 하이라이트 생성
     */
    private createSingleFaceHighlight(
        originalMesh: THREE.Mesh,
        faceIndices: number[],
        color: number,
        thresholdAngle: number
    ): void {
        if (!this.sceneRoot) return;

        const positions = originalMesh.geometry.attributes.position;

        // 단일 삼각형의 위치 데이터 추출
        const facePositions = new Float32Array(9);
        for (let i = 0; i < 3; i++) {
            const idx = faceIndices[i];
            facePositions[i * 3] = positions.getX(idx);
            facePositions[i * 3 + 1] = positions.getY(idx);
            facePositions[i * 3 + 2] = positions.getZ(idx);
        }

        // 새 지오메트리 생성
        const faceGeometry = new THREE.BufferGeometry();
        faceGeometry.setAttribute('position', new THREE.BufferAttribute(facePositions, 3));
        faceGeometry.computeVertexNormals();

        // EdgesGeometry로 모서리 하이라이트
        const edgesGeometry = new THREE.EdgesGeometry(faceGeometry, thresholdAngle);
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1.0,
            depthTest: false,
            depthWrite: false
        });

        const edgesLine = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        edgesLine.applyMatrix4(originalMesh.matrixWorld);

        // 내부 채우기 하이라이트
        const fillMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        });

        const fillMesh = new THREE.Mesh(faceGeometry, fillMaterial);
        fillMesh.applyMatrix4(originalMesh.matrixWorld);

        // 씬에 추가
        this.sceneRoot.add(edgesLine);
        this.sceneRoot.add(fillMesh);
        this.activeHighlights.push(edgesLine, fillMesh);

        console.log('[StencilOutlineHighlight] 단일 면 하이라이트 완료');
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
     * EdgesGeometry를 사용하여 외곽선 하이라이트를 생성합니다
     * @param originalMesh 하이라이트할 원본 메쉬
     * @param color 하이라이트 색상 (기본값: 빨강)
     */
    public createEdgesHighlight(originalMesh: THREE.Mesh, color: number = 0xff0000): void {
        if (!this.sceneRoot) return;

        originalMesh.updateMatrixWorld(true);

        // EdgesGeometry 생성
        const edgesGeometry = new THREE.EdgesGeometry(originalMesh.geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: color,
            linewidth: 2,
            transparent: true,
            opacity: 0.8
        });

        const edgesLine = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        edgesLine.applyMatrix4(originalMesh.matrixWorld);

        this.sceneRoot.add(edgesLine);
        this.activeHighlights.push(edgesLine);

        console.log('[StencilOutlineHighlight] Edges 하이라이트 완료:', {
            color: `#${color.toString(16)}`,
            edgeCount: edgesGeometry.attributes.position.count / 2
        });
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

    /**
     * 컴포넌트를 정리합니다
     */
    public dispose(): void {
        this.clearHighlights();
        this.sceneRoot = null;
    }
}
