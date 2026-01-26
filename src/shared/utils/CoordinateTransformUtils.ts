import * as THREE from 'three';

/**
 * 좌표계 변환 유틸리티 클래스
 * Three.js의 월드 좌표계와 로컬 좌표계 간 변환을 담당
 */
export class CoordinateTransformUtils {
    /**
     * 월드 좌표를 특정 부모의 로컬 좌표로 변환
     * 
     * @param worldPosition 월드 좌표
     * @param parentObject 부모 객체
     * @returns 로컬 좌표
     * 
     * @example
     * const worldPos = new THREE.Vector3(10, 5, 3);
     * const localPos = CoordinateTransformUtils.worldToLocal(worldPos, parentNode);
     */
    static worldToLocal(
        worldPosition: THREE.Vector3,
        parentObject: THREE.Object3D
    ): THREE.Vector3 {
        // 부모의 월드 매트릭스 최신화
        parentObject.updateMatrixWorld(true);

        // 역행렬 계산
        const inverseMatrix = new THREE.Matrix4()
            .copy(parentObject.matrixWorld)
            .invert();

        // 변환 적용
        return worldPosition.clone().applyMatrix4(inverseMatrix);
    }

    /**
     * 로컬 좌표를 월드 좌표로 변환
     * 
     * @param localPosition 로컬 좌표
     * @param object 객체
     * @returns 월드 좌표
     * 
     * @example
     * const localPos = new THREE.Vector3(5, 5, 5);
     * const worldPos = CoordinateTransformUtils.localToWorld(localPos, object);
     */
    static localToWorld(
        localPosition: THREE.Vector3,
        object: THREE.Object3D
    ): THREE.Vector3 {
        object.updateMatrixWorld(true);
        return localPosition.clone().applyMatrix4(object.matrixWorld);
    }

    /**
     * 객체의 정확한 월드 중심점 계산
     * getPreciseBoundingBox를 활용하여 정밀한 중심점 추출
     * 
     * @param object 대상 객체
     * @returns 월드 중심점
     * 
     * @example
     * const center = CoordinateTransformUtils.getWorldCenter(targetNode);
     */
    static getWorldCenter(object: THREE.Object3D): THREE.Vector3 {
        const bbox = this.getPreciseBoundingBox(object);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        return center;
    }

    /**
     * 두 객체 간 로컬 오프셋 계산
     * source를 target 위치로 이동시키기 위한 로컬 좌표 반환
     * 
     * @param source 이동할 객체
     * @param target 목표 객체
     * @returns source의 부모 기준 로컬 좌표
     * 
     * @example
     * const offset = CoordinateTransformUtils.getLocalOffset(coverBody, assembly);
     * coverBody.position.copy(offset);
     */
    static getLocalOffset(
        source: THREE.Object3D,
        target: THREE.Object3D
    ): THREE.Vector3 {
        // 타겟의 월드 중심점
        const targetWorldCenter = this.getWorldCenter(target);

        // source의 부모 기준 로컬 좌표로 변환
        if (source.parent) {
            return this.worldToLocal(targetWorldCenter, source.parent);
        }

        return targetWorldCenter;
    }

    /**
     * 정밀 바운딩 박스 계산
     * 모든 자식 메쉬를 순회하며 월드 좌표 기준 바운딩 박스 계산
     * 
     * @param targetNode 대상 노드
     * @returns 계산된 바운딩 박스
     * 
     * @private
     */
    private static getPreciseBoundingBox(targetNode: THREE.Object3D): THREE.Box3 {
        const box = new THREE.Box3();
        let hasMesh = false;

        // 월드 매트릭스 최신화
        targetNode.updateMatrixWorld(true);

        targetNode.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
                child.geometry.computeBoundingBox();
                const geomBox = child.geometry.boundingBox;
                if (geomBox && !geomBox.isEmpty()) {
                    const worldBox = geomBox.clone();
                    worldBox.applyMatrix4(child.matrixWorld);
                    box.union(worldBox);
                    hasMesh = true;
                }
            }
        });

        // 메쉬가 없으면 위치 기준으로라도 잡음
        if (!hasMesh || box.isEmpty()) {
            const pos = new THREE.Vector3();
            targetNode.getWorldPosition(pos);
            box.setFromCenterAndSize(pos, new THREE.Vector3(1, 1, 1));
        }

        return box;
    }

    /**
     * 두 객체 간 월드 거리 계산
     * 
     * @param obj1 첫 번째 객체
     * @param obj2 두 번째 객체
     * @returns 거리
     * 
     * @example
     * const distance = CoordinateTransformUtils.getWorldDistance(coverBody, assembly);
     */
    static getWorldDistance(
        obj1: THREE.Object3D,
        obj2: THREE.Object3D
    ): number {
        const center1 = this.getWorldCenter(obj1);
        const center2 = this.getWorldCenter(obj2);
        return center1.distanceTo(center2);
    }

    /**
     * 객체의 바운딩 박스 크기 가져오기
     * 
     * @param object 대상 객체
     * @returns 크기 벡터 (width, height, depth)
     * 
     * @example
     * const size = CoordinateTransformUtils.getBoundingBoxSize(targetNode);
     * console.log(`Width: ${size.x}, Height: ${size.y}, Depth: ${size.z}`);
     */
    static getBoundingBoxSize(object: THREE.Object3D): THREE.Vector3 {
        const bbox = this.getPreciseBoundingBox(object);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        return size;
    }
}
