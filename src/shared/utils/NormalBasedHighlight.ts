import * as THREE from 'three';

/**
 * 법선 벡터(Normal Vector) 기반 필터링을 사용하여 하이라이트하는 컴포넌트
 * 카메라를 향하는 면이나 특정 방향의 면만 선택하여 하이라이트 효과를 적용합니다
 */
export class NormalBasedHighlight {
    private sceneRoot: THREE.Object3D | null = null;
    private activeHighlights: THREE.Object3D[] = [];

    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
    }

    /**
     * [신규] 법선 벡터 기반 필터링 + EdgesGeometry 방식으로
     * 노드의 안쪽 홈 부분을 정밀하게 하이라이트합니다
     * @param targetNode 하이라이트할 대상 노드
     * @param color 하이라이트 색상 (기본값: 빨강)
     * @param thresholdAngle 엣지로 판정할 최소 각도 (기본값: 15도)
     * @param targetNormal 필터링할 방향 법선 벡터 (기본값: Z축 방향)
     * @param normalTolerance 법선 벡터 허용 오차 (기본값: 0.2)
     */
    public highlightFacesByNormalFilter(
        targetNode: THREE.Object3D,
        color: number = 0xff0000,
        thresholdAngle: number = 15,
        targetNormal: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
        normalTolerance: number = 0.2
    ): void {
        console.log('highlightFacesByNormalFilter!!!');
        if (!this.sceneRoot) return;

        this.clearHighlights();

        // 월드 매트릭스 최신화
        targetNode.updateMatrixWorld(true);

        targetNode.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
                this.processMeshForNormalFilterHighlight(
                    child,
                    color,
                    thresholdAngle,
                    targetNormal,
                    normalTolerance
                );
            }
        });

        console.log('[NormalBasedHighlight] 법선 필터링 홈 하이라이트 완료');
    }

    /**
     * [신규] 카메라를 기준으로 가장 먼저 보이는 면(가장 가까운 면)만
     * 정밀하게 하이라이트합니다. 카메라 방향과 노드 법선을 직접 비교합니다.
     * @param targetNode 하이라이트할 대상 노드
     * @param camera 카메라 객체
     * @param color 하이라이트 색상 (기본값: 빨강)
     * @param thresholdAngle 엣지로 판정할 최소 각도 (기본값: 15도)
     */
    public highlightFacesByCameraFilter(
        targetNode: THREE.Object3D,
        camera: THREE.Camera,
        color: number = 0xff0000,
        thresholdAngle: number = 15
    ): void {
        console.log('highlightFacesByCameraFilter - Threshold Based!!');
        if (!this.sceneRoot) return;

        this.clearHighlights();

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

        console.log('[NormalBasedHighlight] 카메라 방향 기반 다중 면 하이라이트 완료');
    }

    /**
     * [내부 메서드] 개별 메쉬를 처리하여 법선 필터링 하이라이트 생성
     */
    private processMeshForNormalFilterHighlight(
        originalMesh: THREE.Mesh,
        color: number,
        thresholdAngle: number,
        targetNormal: THREE.Vector3,
        normalTolerance: number
    ): void {
        console.log('processMeshForNormalFilterHighlight!!!');
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

        // 필터링된 영역 하이라이트
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
     * [내부 메서드] 필터링된 영역의 메쉬 클론 + 하이라이트 생성 (EdgesGeometry 사용)
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

        // 3. 내부 채우기 하이라이트
        const fillMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        });

        const fillMesh = new THREE.Mesh(filteredGeometry, fillMaterial);
        fillMesh.applyMatrix4(originalMesh.matrixWorld);

        // 4. 씬에 추가
        this.sceneRoot.add(edgesLine);
        this.sceneRoot.add(fillMesh);

        // 활성 하이라이트 목록에 추가
        this.activeHighlights.push(edgesLine, fillMesh);
    }

    /**
     * [레거시] 법선 벡터 기반 필터링을 사용하여 카메라를 향하는 면만 하이라이트합니다
     * @param targetNode 하이라이트할 타겟 노드
     * @param camera 카메라 객체
     * @param color 하이라이트 색상 (기본값: 빨강)
     */
    public highlightFacesByNormal(
        targetNode: THREE.Mesh,
        camera: THREE.Camera,
        color: number = 0xff0000
    ): void {
        if (!this.sceneRoot) return;

        this.clearHighlights();

        const geometry = targetNode.geometry;
        if (!geometry.index) return;

        const positionAttribute = geometry.getAttribute('position');
        const normalAttribute = geometry.getAttribute('normal');
        const index = geometry.index;

        const faceIndices: number[] = [];
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        // 카메라가 바라보는 방향의 반대 방향(카메라로 향하는 벡터)
        const toCameraVector = cameraDirection.clone().negate();

        const worldNormal = new THREE.Vector3();
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(targetNode.matrixWorld);

        for (let i = 0; i < index.count; i += 3) {
            const a = index.getX(i);

            // 첫 번째 정점의 법선을 해당 면의 대표 법선으로 사용 (Flat Shading 가정 또는 단순화)
            worldNormal.fromBufferAttribute(normalAttribute, a);
            worldNormal.applyMatrix3(normalMatrix).normalize();

            // 법선 벡터와 카메라로 향하는 벡터의 내적 계산
            // 내적이 0보다 크면 카메라를 향하고 있음
            const dot = worldNormal.dot(toCameraVector);

            if (dot > 0.1) { // 임계값(0.1)을 주어 정면을 향하는 면 위주로 선택
                faceIndices.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
            }
        }

        if (faceIndices.length > 0) {
            const highlightGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(faceIndices.length * 3);

            for (let i = 0; i < faceIndices.length; i++) {
                const vertexIndex = faceIndices[i];
                positions[i * 3] = positionAttribute.getX(vertexIndex);
                positions[i * 3 + 1] = positionAttribute.getY(vertexIndex);
                positions[i * 3 + 2] = positionAttribute.getZ(vertexIndex);
            }

            highlightGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const highlightMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            });

            const highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);
            highlightMesh.applyMatrix4(targetNode.matrixWorld);

            this.sceneRoot.add(highlightMesh);
            this.activeHighlights.push(highlightMesh);

            console.log('[NormalBasedHighlight] 법선 기반 하이라이트 완료:', {
                faceCount: faceIndices.length / 3,
                dotThreshold: 0.1
            });
        }
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

    /**
     * 정점 법선 벡터 분석을 통한 다중 가상 피벗(Multiple Virtual Pivots) 계산
     * 홈이 여러 개인 경우 각 홈의 중심점을 클러스터링을 통해 추출합니다.
     * @param targetNode 대상 노드
     * @param normalFilter 필터링할 방향 법선 벡터
     * @param normalTolerance 법선 허용 오차
     * @param clusterThreshold 클러스터링 거리 임계값 (기본: 0.05m)
     */
    public static calculateMultipleVirtualPivotsByNormalAnalysis(
        targetNode: THREE.Object3D,
        normalFilter: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
        normalTolerance: number = 0.2,
        clusterThreshold: number = 0.05
    ): Array<{
        position: THREE.Vector3;
        rotationAxis: THREE.Vector3;
        insertionDirection: THREE.Vector3;
        filteredVerticesCount: number;
    }> {
        try {
            targetNode.updateMatrixWorld(true);

            const filteredVertices: THREE.Vector3[] = [];
            const filteredNormals: THREE.Vector3[] = [];

            targetNode.traverse((child) => {
                if (child instanceof THREE.Mesh && child.geometry) {
                    const geometry = child.geometry;
                    if (!geometry.attributes.normal) geometry.computeVertexNormals();

                    const positions = geometry.attributes.position;
                    const normals = geometry.attributes.normal;
                    const indices = geometry.index;
                    const worldQuat = new THREE.Quaternion();
                    child.getWorldQuaternion(worldQuat);

                    const processFace = (idx1: number, idx2: number, idx3: number) => {
                        const avgNormal = NormalBasedHighlight.calculateAverageNormal(normals, idx1, idx2, idx3, worldQuat);
                        const dotProduct = Math.abs(avgNormal.dot(normalFilter));
                        if (dotProduct > (1 - normalTolerance)) {
                            const v1 = new THREE.Vector3().fromBufferAttribute(positions, idx1).applyMatrix4(child.matrixWorld);
                            const v2 = new THREE.Vector3().fromBufferAttribute(positions, idx2).applyMatrix4(child.matrixWorld);
                            const v3 = new THREE.Vector3().fromBufferAttribute(positions, idx3).applyMatrix4(child.matrixWorld);

                            // [수정] 면의 정점 3개를 모두 추가하여 Box 계산의 정확도 향상
                            filteredVertices.push(v1.clone(), v2.clone(), v3.clone());
                            filteredNormals.push(avgNormal.clone(), avgNormal.clone(), avgNormal.clone());
                        }
                    };

                    if (indices) {
                        for (let i = 0; i < indices.count; i += 3) {
                            processFace(indices.getX(i), indices.getX(i + 1), indices.getX(i + 2));
                        }
                    } else {
                        for (let i = 0; i < positions.count; i += 3) {
                            processFace(i, i + 1, i + 2);
                        }
                    }
                }
            });

            if (filteredVertices.length === 0) return [];

            // 6. 클러스터링 (간단한 거리 기반 그룹화)
            const clusters: Array<{ vertices: THREE.Vector3[], normals: THREE.Vector3[] }> = [];

            for (let i = 0; i < filteredVertices.length; i++) {
                const v = filteredVertices[i];
                const n = filteredNormals[i];
                let closestCluster = null;
                let minDistance = clusterThreshold;

                for (const cluster of clusters) {
                    // 클러스터의 '중심'과 비교하여 더 안정적인 거리 측정
                    const clusterCenter = new THREE.Vector3();
                    const sampleSize = Math.min(cluster.vertices.length, 9); // 최대 9개 샘플링하여 평균 위치 계산
                    for (let j = 0; j < sampleSize; j++) {
                        clusterCenter.add(cluster.vertices[j]);
                    }
                    clusterCenter.divideScalar(sampleSize);

                    const dist = v.distanceTo(clusterCenter);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestCluster = cluster;
                    }
                }

                if (closestCluster) {
                    closestCluster.vertices.push(v);
                    closestCluster.normals.push(n);
                } else {
                    clusters.push({ vertices: [v], normals: [n] });
                }
            }

            // 7. 각 클러스터별 피벗 정보 생성
            return clusters.map(cluster => {
                // [개선] 산술 평균 대신 클러스터 정점들의 Bounding Box 중심 사용
                const clusterBox = new THREE.Box3();
                cluster.vertices.forEach(v => clusterBox.expandByPoint(v));

                const position = new THREE.Vector3();
                clusterBox.getCenter(position);

                const avgNormal = new THREE.Vector3();
                cluster.normals.forEach(n => avgNormal.add(n));
                avgNormal.divideScalar(cluster.normals.length).normalize();

                const worldUp = new THREE.Vector3(0, 1, 0);
                let rotationAxis = new THREE.Vector3().crossVectors(avgNormal, worldUp).normalize();
                if (rotationAxis.length() < 0.01) {
                    rotationAxis = new THREE.Vector3().crossVectors(avgNormal, new THREE.Vector3(1, 0, 0)).normalize();
                }

                return {
                    position,
                    rotationAxis,
                    insertionDirection: avgNormal,
                    filteredVerticesCount: cluster.vertices.length * 3 // 면 중심점 기준이므로 대략적인 정점 수
                };
            });

        } catch (error) {
            console.error('[NormalBasedHighlight] 다중 가상 피벗 계산 실패:', error);
            return [];
        }
    }

    /**
     * 정점 법선 벡터 분석을 통한 가상 피벗(Virtual Pivot) 계산
     * 홈의 방향성을 분석하여 가상 회전축을 생성합니다.
     * @param targetNode 대상 노드 (홈이 있는 부품)
     * @param normalFilter 필터링할 방향 법선 벡터 (기본: Z축 방향)
     * @param normalTolerance 법선 허용 오차 (기본: 0.2)
     * @returns 가상 피벗 정보 (위치, 회전축, 방향 벡터) 또는 null
     */
    public static calculateVirtualPivotByNormalAnalysis(
        targetNode: THREE.Object3D,
        normalFilter: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
        normalTolerance: number = 0.2
    ): {
        position: THREE.Vector3;      // 피벗 위치 (월드 좌표)
        rotationAxis: THREE.Vector3;  // 회전축 방향
        insertionDirection: THREE.Vector3; // 삽입 방향
        filteredVerticesCount: number; // 필터링된 정점 수
    } | null {
        try {
            // 1. 월드 매트릭스 업데이트
            targetNode.updateMatrixWorld(true);

            // 2. 필터링된 정점들과 법선들을 저장할 배열
            const filteredVertices: THREE.Vector3[] = [];
            const filteredNormals: THREE.Vector3[] = [];
            let totalProcessedMeshes = 0;
            let totalProcessedFaces = 0;

            // 3. 노드의 모든 메쉬 순회
            targetNode.traverse((child) => {
                if (child instanceof THREE.Mesh && child.geometry) {
                    const geometry = child.geometry;
                    totalProcessedMeshes++;

                    // 법선 벡터가 없으면 계산
                    if (!geometry.attributes.normal) {
                        geometry.computeVertexNormals();
                    }

                    const positions = geometry.attributes.position;
                    const normals = geometry.attributes.normal;
                    const indices = geometry.index;

                    // 메쉬의 월드 쿼터니언 가져오기 (법선 변환용)
                    const worldQuat = new THREE.Quaternion();
                    child.getWorldQuaternion(worldQuat);

                    // 4. 인덱스 여부에 따라 처리
                    if (indices) {
                        const faceCount = indices.count / 3;
                        totalProcessedFaces += faceCount;

                        for (let i = 0; i < indices.count; i += 3) {
                            const idx1 = indices.getX(i);
                            const idx2 = indices.getX(i + 1);
                            const idx3 = indices.getX(i + 2);

                            // 평균 법선 계산 (월드 좌표로 변환)
                            const avgNormal = NormalBasedHighlight.calculateAverageNormal(
                                normals, idx1, idx2, idx3, worldQuat
                            );

                            // 법선 필터링 (내적값으로 비교)
                            const dotProduct = Math.abs(avgNormal.dot(normalFilter));
                            if (dotProduct > (1 - normalTolerance)) {
                                // 필터링된 면의 정점들을 월드 좌표로 변환하여 추가
                                const v1 = new THREE.Vector3().fromBufferAttribute(positions, idx1);
                                const v2 = new THREE.Vector3().fromBufferAttribute(positions, idx2);
                                const v3 = new THREE.Vector3().fromBufferAttribute(positions, idx3);

                                v1.applyMatrix4(child.matrixWorld);
                                v2.applyMatrix4(child.matrixWorld);
                                v3.applyMatrix4(child.matrixWorld);

                                filteredVertices.push(v1, v2, v3);
                                filteredNormals.push(avgNormal.clone());
                            }
                        }
                    } else {
                        const faceCount = positions.count / 3;
                        totalProcessedFaces += faceCount;

                        for (let i = 0; i < positions.count; i += 3) {
                            const idx1 = i;
                            const idx2 = i + 1;
                            const idx3 = i + 2;

                            const avgNormal = NormalBasedHighlight.calculateAverageNormal(
                                normals, idx1, idx2, idx3, worldQuat
                            );

                            const dotProduct = Math.abs(avgNormal.dot(normalFilter));
                            if (dotProduct > (1 - normalTolerance)) {
                                const v1 = new THREE.Vector3().fromBufferAttribute(positions, idx1);
                                const v2 = new THREE.Vector3().fromBufferAttribute(positions, idx2);
                                const v3 = new THREE.Vector3().fromBufferAttribute(positions, idx3);

                                v1.applyMatrix4(child.matrixWorld);
                                v2.applyMatrix4(child.matrixWorld);
                                v3.applyMatrix4(child.matrixWorld);

                                filteredVertices.push(v1, v2, v3);
                                filteredNormals.push(avgNormal.clone());
                            }
                        }
                    }
                }
            });

            // 5. 필터링된 정점이 없으면 null 반환
            if (filteredVertices.length === 0) {
                console.warn('[NormalBasedHighlight] 필터링된 면이 없습니다. 가상 피벗을 계산할 수 없습니다.', {
                    normalFilter: `(${normalFilter.x}, ${normalFilter.y}, ${normalFilter.z})`,
                    normalTolerance,
                    processedMeshes: totalProcessedMeshes,
                    processedFaces: totalProcessedFaces
                });
                return null;
            }

            // 6. 피벗 위치 계산 (필터링된 정점들의 중심점)
            const pivotPosition = new THREE.Vector3();
            filteredVertices.forEach((v) => pivotPosition.add(v));
            pivotPosition.divideScalar(filteredVertices.length);

            // 7. 평균 법선 벡터 계산 (삽입 방향)
            const avgNormal = new THREE.Vector3();
            filteredNormals.forEach((n) => avgNormal.add(n));
            avgNormal.divideScalar(filteredNormals.length).normalize();

            // 8. 회전축 계산 (법선 벡터와 수직인 방향)
            // 월드 Up 벡터(0, 1, 0)와 평균 법선의 외적으로 회전축 계산
            const worldUp = new THREE.Vector3(0, 1, 0);
            let rotationAxis = new THREE.Vector3().crossVectors(avgNormal, worldUp).normalize();

            // 외적 결과가 너무 작으면 (평행한 경우) 다른 축 사용
            if (rotationAxis.length() < 0.01) {
                const worldRight = new THREE.Vector3(1, 0, 0);
                rotationAxis = new THREE.Vector3().crossVectors(avgNormal, worldRight).normalize();
            }

            console.log('[NormalBasedHighlight] 가상 피벗 계산 완료:', {
                pivotPosition: `(${pivotPosition.x.toFixed(4)}, ${pivotPosition.y.toFixed(4)}, ${pivotPosition.z.toFixed(4)})`,
                rotationAxis: `(${rotationAxis.x.toFixed(4)}, ${rotationAxis.y.toFixed(4)}, ${rotationAxis.z.toFixed(4)})`,
                insertionDirection: `(${avgNormal.x.toFixed(4)}, ${avgNormal.y.toFixed(4)}, ${avgNormal.z.toFixed(4)})`,
                filteredVerticesCount: filteredVertices.length,
                filteredFacesCount: filteredVertices.length / 3,
                processedMeshes: totalProcessedMeshes,
                processedFaces: totalProcessedFaces
            });

            return {
                position: pivotPosition,
                rotationAxis,
                insertionDirection: avgNormal,
                filteredVerticesCount: filteredVertices.length
            };
        } catch (error) {
            console.error('[NormalBasedHighlight] 가상 피벗 계산 실패:', error);
            return null;
        }
    }

    /**
     * [정적 메서드] 평균 법선 벡터 계산
     * 외부에서도 사용할 수 있도록 정적 메서드로 제공
     */
    private static calculateAverageNormal(
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
}
