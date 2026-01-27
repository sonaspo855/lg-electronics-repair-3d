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
        const geometry = originalMesh.geometry;

        // 법선 벡터가 없으면 계산
        if (!geometry.attributes.normal) {
            geometry.computeVertexNormals();
        }

        const positions = geometry.attributes.position;
        const normals = geometry.attributes.normal;
        const indices = geometry.index;

        // 필터링된 인덱스를 저장할 배열
        const filteredIndices: number[] = [];

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
                }
            }
        }

        // 필터링된 면이 있는 경우에만 클론 및 Stencil 하이라이트 생성
        if (filteredIndices.length > 0) {
            this.createFilteredMeshHighlight(
                originalMesh,
                filteredIndices,
                color,
                thresholdAngle
            );
        }
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
        thresholdAngle: number
    ): void {
        if (!this.sceneRoot) return;

        // 1. 필터링된 인덱스로 새로운 지오메트리 생성
        const filteredGeometry = new THREE.BufferGeometry();
        const positions = originalMesh.geometry.attributes.position;
        const filteredPositions = new Float32Array(filteredIndices.length * 3);

        for (let i = 0; i < filteredIndices.length; i++) {
            const idx = filteredIndices[i];
            filteredPositions[i * 3] = positions.getX(idx);
            filteredPositions[i * 3 + 1] = positions.getY(idx);
            filteredPositions[i * 3 + 2] = positions.getZ(idx);
        }

        filteredGeometry.setAttribute('position', new THREE.BufferAttribute(filteredPositions, 3));

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
            opacity: 0.4,
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
     * 정밀하게 하이라이트합니다. Raycaster를 사용하여 교차점을 계산합니다.
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
        console.log('createGrooveMeshHighlightWithCameraFilter!!');
        if (!this.sceneRoot) return;

        // 월드 매트릭스 최신화
        targetNode.updateMatrixWorld(true);

        // 노드의 바운딩 박스 중심 계산
        const box = new THREE.Box3().setFromObject(targetNode);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Raycaster를 사용하여 교차점 찾기
        const raycaster = new THREE.Raycaster();

        // 노드 중심을 화면 좌표로 변환
        const screenPosition = center.clone().project(camera);
        const ndc = new THREE.Vector2(screenPosition.x, screenPosition.y);

        // 카메라에서 나가는 광선 설정 (노드 중심 방향)
        raycaster.setFromCamera(ndc, camera);

        // 가장 가까운 교차점 정보를 저장
        let closestIntersection: {
            distance: number;
            face: THREE.Face;
            faceIndex: number;
            object: THREE.Mesh;
        } | null = null;

        // 대상 노드의 모든 메쉬에 대해 교차점 계산
        const meshes: THREE.Mesh[] = [];
        targetNode.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                meshes.push(child);
            }
        });

        // 모든 메쉬에 대해 Raycaster 적용
        for (const mesh of meshes) {
            const intersects = raycaster.intersectObject(mesh, false);

            for (const intersection of intersects) {
                if (!closestIntersection || intersection.distance < closestIntersection.distance) {
                    closestIntersection = {
                        distance: intersection.distance,
                        face: intersection.face!,
                        faceIndex: intersection.faceIndex!,
                        object: mesh
                    };
                }
            }
        }

        console.log('[StencilOutlineHighlight] 교차점 검사 결과:', closestIntersection);
        // 가장 가까운 교차점이 있으면 해당 면만 하이라이트
        if (closestIntersection) {
            console.log('[StencilOutlineHighlight] 가장 가까운 면 발견:', {
                distance: closestIntersection.distance.toFixed(2),
                faceNormal: `(${closestIntersection.face.normal.x.toFixed(2)}, ${closestIntersection.face.normal.y.toFixed(2)}, ${closestIntersection.face.normal.z.toFixed(2)})`
            });

            // 해당 메쉬에서 가장 가까운 면의 삼각형 인덱스만 추출
            const targetMesh = closestIntersection.object;

            if (targetMesh.geometry.index) {
                // 인덱스 버퍼가 있는 경우
                const faceIndex = Math.floor(closestIntersection.faceIndex / 3) * 3;
                const indices = targetMesh.geometry.index;
                const idx1 = indices.getX(faceIndex);
                const idx2 = indices.getX(faceIndex + 1);
                const idx3 = indices.getX(faceIndex + 2);

                this.createSingleFaceHighlight(
                    targetMesh,
                    [idx1, idx2, idx3],
                    color,
                    thresholdAngle
                );
            } else {
                // 인덱스 버퍼가 없는 경우 (비인덱스 지오메트리)
                const faceIndex = Math.floor(closestIntersection.faceIndex / 3) * 3;
                this.createSingleFaceHighlight(
                    targetMesh,
                    [faceIndex, faceIndex + 1, faceIndex + 2],
                    color,
                    thresholdAngle
                );
            }
        } else {
            console.log('[StencilOutlineHighlight] 교차점을 찾지 못함 - 노드 중심 기준으로 폴백 하이라이트');
            // 폴백: 노드의 중심을 기준으로 법선 필터링 방식 사용
            this.createGrooveMeshHighlightWithNormalFilter(
                targetNode,
                color,
                thresholdAngle,
                new THREE.Vector3(0, 0, 1),  // Z축 방향 (일반적으로 전면)
                0.3  // normalTolerance를 더 넓게 설정
            );
        }
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
