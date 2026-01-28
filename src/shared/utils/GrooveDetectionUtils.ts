import * as THREE from 'three';
import { getPreciseBoundingBox } from './commonUtils';

/**
 * 홈(Groove) 영역 식별 유틸리티
 * Bounding Box 기반으로 홈의 중심점을 계산합니다.
 */
export class GrooveDetectionUtils {
    /**
     * Bounding Box 기반 홈 중심점 계산
     * 전체 바운딩 박스의 중앙 영역(기본 30%)을 홈으로 간주합니다.
     * @param targetNode 대상 노드
     * @param innerBoundRatio 내부 바운딩 비율 (기본: 0.3)
     * @returns 홈 중심점 (월드 좌표) 또는 null
     */
    public static calculateGrooveCenterByBoundingBox(
        targetNode: THREE.Object3D,
        innerBoundRatio: number = 0.3
    ): THREE.Vector3 | null {
        try {
            // 1. 월드 매트릭스 업데이트 (정확한 좌표 추출을 위해 필수)
            targetNode.updateMatrixWorld(true);

            // 2. 정밀 바운딩 박스 계산
            const box = getPreciseBoundingBox(targetNode);

            if (box.isEmpty()) {
                console.warn('[GrooveDetectionUtils] 바운딩 박스가 비어있습니다.');
                return null;
            }

            // 3. 바운딩 박스 크기 계산
            const size = new THREE.Vector3();
            box.getSize(size);

            // 4. 바운딩 박스 중심점 계산
            const center = new THREE.Vector3();
            box.getCenter(center);

            // 6. 내부 영역의 중심점 (바운딩 박스 중심과 동일)
            // const grooveCenter = center.clone();

            // [수정 1] localToWorld 제거 및 World 좌표 그대로 반환
            // 이유: getPreciseBoundingBox가 World AABB를 반환하므로 center는 이미 World 좌표임
            const worldGrooveCenter = center.clone();

            // [참고] innerBoundRatio는 현재 로직상 '중심점'만 구하므로 
            // 박스 크기를 줄여서 계산해도 중심점은 변하지 않아 로직에 영향이 없으므로 생략해도 무방하나,
            // 추후 랜덤 위치 샘플링 등을 위해 남겨둔다면 유지.

            console.log('[GrooveDetectionUtils] 홈 중심점 계산 완료:', {
                center: `(${worldGrooveCenter.x.toFixed(2)}, ${worldGrooveCenter.y.toFixed(2)}, ${worldGrooveCenter.z.toFixed(2)})`,
                boxSize: `(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`,
                innerBoundRatio
            });

            return worldGrooveCenter;
        } catch (error) {
            console.error('[GrooveDetectionUtils] 홈 중심점 계산 실패:', error);
            return null;
        }
    }

    /**
     * 법선 벡터 기반으로 홈 영역을 필터링하여 중심점 계산
     * @param targetNode 대상 노드
     * @param normalFilter 필터링할 방향 법선 벡터 (기본: Z축 방향)
     * @param normalTolerance 법선 허용 오차 (기본: 0.2)
     * @returns 필터링된 면들의 중심점 (월드 좌표) 또는 null
     */
    public static calculateGrooveCenterByNormalFilter(
        targetNode: THREE.Object3D,
        normalFilter: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
        normalTolerance: number = 0.2
    ): THREE.Vector3 | null {
        try {
            // 1. 월드 매트릭스 업데이트 (정확한 좌표 추출을 위해 필수)
            targetNode.updateMatrixWorld(true);

            // 2. 필터링된 정점들을 저장할 배열
            const filteredVertices: THREE.Vector3[] = [];
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
                        // === Indexed Geometry 처리 ===
                        const faceCount = indices.count / 3;
                        totalProcessedFaces += faceCount;

                        for (let i = 0; i < indices.count; i += 3) {
                            const idx1 = indices.getX(i);
                            const idx2 = indices.getX(i + 1);
                            const idx3 = indices.getX(i + 2);

                            // 평균 법선 계산 (월드 좌표로 변환)
                            const avgNormal = this.calculateAverageNormal(
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
                            }
                        }
                    } else {
                        // === Non-indexed Geometry 처리 ===
                        // 인덱스가 없는 경우, 정점 배열을 직접 순회 (3개씩 하나의 면)
                        const faceCount = positions.count / 3;
                        totalProcessedFaces += faceCount;

                        for (let i = 0; i < positions.count; i += 3) {
                            const idx1 = i;
                            const idx2 = i + 1;
                            const idx3 = i + 2;

                            // 평균 법선 계산 (월드 좌표로 변환)
                            const avgNormal = this.calculateAverageNormal(
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
                            }
                        }
                    }
                }
            });

            // 5. 필터링된 정점들의 중심점 계산
            if (filteredVertices.length === 0) {
                console.warn('[GrooveDetectionUtils] 필터링된 면이 없습니다. 필터 조건을 확인하세요.', {
                    normalFilter: `(${normalFilter.x}, ${normalFilter.y}, ${normalFilter.z})`,
                    normalTolerance,
                    processedMeshes: totalProcessedMeshes,
                    processedFaces: totalProcessedFaces
                });
                return null;
            }

            // 산술 평균 계산
            const center = new THREE.Vector3();
            filteredVertices.forEach((v) => center.add(v));
            center.divideScalar(filteredVertices.length);

            console.log('[GrooveDetectionUtils] 법선 필터링 기반 홈 중심점 계산 완료:', {
                center: `(${center.x.toFixed(4)}, ${center.y.toFixed(4)}, ${center.z.toFixed(4)})`,
                filteredVerticesCount: filteredVertices.length,
                filteredFacesCount: filteredVertices.length / 3,
                processedMeshes: totalProcessedMeshes,
                processedFaces: totalProcessedFaces,
                normalFilter: `(${normalFilter.x}, ${normalFilter.y}, ${normalFilter.z})`,
                normalTolerance
            });

            return center;
        } catch (error) {
            console.error('[GrooveDetectionUtils] 법선 필터링 기반 홈 중심점 계산 실패:', error);
            return null;
        }
    }

    /**
     * 평균 법선 벡터 계산 (낮부 메서드)
     * @param normals 법선 속성 버퍼
     * @param idx1 첫 번째 정점 인덱스
     * @param idx2 두 번째 정점 인덱스
     * @param idx3 세 번째 정점 인덱스
     * @param worldQuat 월드 쿼터니언 (법선 변환용)
     * @returns 월드 좌표계 기준 평균 법선 벡터
     */
    private static calculateAverageNormal(
        normals: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
        idx1: number,
        idx2: number,
        idx3: number,
        worldQuat: THREE.Quaternion
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

        // 로컬 법선을 월드 좌표계로 변환
        normal1.applyQuaternion(worldQuat);
        normal2.applyQuaternion(worldQuat);
        normal3.applyQuaternion(worldQuat);

        // 평균 법선 계산
        return new THREE.Vector3()
            .addVectors(normal1, normal2)
            .add(normal3)
            .normalize();
    }

    /**
     * 바운딩 박스의 특정 축을 기준으로 홈 중심점 계산
     * @param targetNode 대상 노드
     * @param axis 계산할 축 ('x', 'y', 또는 'z')
     * @param innerBoundRatio 내부 바운딩 비율
     * @returns 홈 중심점 (월드 좌표) 또는 null
     */
    public static calculateGrooveCenterByAxis(
        targetNode: THREE.Object3D,
        axis: 'x' | 'y' | 'z' = 'z',
        innerBoundRatio: number = 0.3
    ): THREE.Vector3 | null {
        try {
            targetNode.updateMatrixWorld(true);
            const box = getPreciseBoundingBox(targetNode);

            if (box.isEmpty()) {
                return null;
            }

            const size = new THREE.Vector3();
            box.getSize(size);

            const center = new THREE.Vector3();
            box.getCenter(center);

            // 지정된 축의 내부 범위 계산
            const axisSize = size.getComponent(axis === 'x' ? 0 : axis === 'y' ? 1 : 2);
            const halfInnerBound = (axisSize * innerBoundRatio) / 2;

            // 지정된 축을 기준으로 중심점 조정
            const grooveCenter = center.clone();
            const min = box.min.getComponent(axis === 'x' ? 0 : axis === 'y' ? 1 : 2);
            const max = box.max.getComponent(axis === 'x' ? 0 : axis === 'y' ? 1 : 2);
            const midpoint = (min + max) / 2;

            grooveCenter.setComponent(axis === 'x' ? 0 : axis === 'y' ? 1 : 2, midpoint + halfInnerBound);

            return grooveCenter;
        } catch (error) {
            console.error('[GrooveDetectionUtils] 축 기준 홈 중심점 계산 실패:', error);
            return null;
        }
    }

    /**
     * 노드의 바운딩 박스 정보를 반환합니다.
     * @param targetNode 대상 노드
     * @returns 바운딩 박스 정보 객체
     */
    public static getBoundingBoxInfo(targetNode: THREE.Object3D): {
        center: THREE.Vector3;
        size: THREE.Vector3;
        min: THREE.Vector3;
        max: THREE.Vector3;
        isEmpty: boolean;
    } | null {
        try {
            targetNode.updateMatrixWorld(true);
            const box = getPreciseBoundingBox(targetNode);

            if (box.isEmpty()) {
                return null;
            }

            const center = new THREE.Vector3();
            const size = new THREE.Vector3();

            box.getCenter(center);
            box.getSize(size);

            return {
                center,
                size,
                min: box.min.clone(),
                max: box.max.clone(),
                isEmpty: false
            };
        } catch (error) {
            console.error('[GrooveDetectionUtils] 바운딩 박스 정보 조회 실패:', error);
            return null;
        }
    }
}
