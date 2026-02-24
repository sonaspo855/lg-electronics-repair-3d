import * as THREE from 'three';
import { getAssemblyPathVisualizer } from '@/services/visualization/AssemblyPathVisualizer';

/**
 * 스크류 관련 유틸리티 함수들을 모아둔 파일
 * - 스크류 머리 중심 좌표 계산
 * - 스크류 머리 중심 시각화
 */

/**
 * 스크류 머리 중심 좌표를 계산합니다 (시각화 없이 좌표만 반환).
 * @param screwNode 스크류 노드
 * @param targetWorldPosition 타겟 월드 위치
 * @param extractDirection 추출 방향 (로컬 좌표계)
 * @param headOffset 머리 오프셋 거리 (기본값: 0.02)
 * @returns 머리 중심 좌표
 */
export const calculateScrewHeadCenter = (
    screwNode: THREE.Object3D,
    targetWorldPosition: THREE.Vector3,
    extractDirection: THREE.Vector3,
    headOffset: number = 0.02
): THREE.Vector3 => {
    const worldQuaternion = new THREE.Quaternion();
    screwNode.getWorldQuaternion(worldQuaternion);
    const worldExtractDir = extractDirection.clone().applyQuaternion(worldQuaternion);
    return targetWorldPosition.clone().add(worldExtractDir.clone().multiplyScalar(headOffset));
};

/**
 * 스크류 머리 중심을 시각화
 * @param sceneRoot 씬 루트 노드
 * @param screwNode 스크류 노드
 * @param targetWorldPosition 타겟 월드 위치
 * @param extractDirection 추출 방향 (로컬 좌표계)
 * @param options 옵션 (headOffset: 머리 오프셋 거리, downwardOffset: 아래 방향 오프셋 거리)
 */
export const visualizeScrewHeadCenter = (
    sceneRoot: THREE.Object3D,
    screwNode: THREE.Object3D,
    targetWorldPosition: THREE.Vector3,
    extractDirection: THREE.Vector3,
    options: {
        headOffset?: number;
        downwardOffset?: number;
    } = {}
): void => {
    const { headOffset = 0.02, downwardOffset = 0.07 } = options;

    // 스크류의 월드 회전을 반영하여 추출 방향을 월드 좌표계로 변환
    const worldQuaternion = new THREE.Quaternion();
    screwNode.getWorldQuaternion(worldQuaternion);
    const worldExtractDir = extractDirection.clone().applyQuaternion(worldQuaternion);

    // 이동된 위치에서 추출 방향의 끝점(머리) 계산
    const headCenter = targetWorldPosition.clone().add(worldExtractDir.clone().multiplyScalar(headOffset));

    const visualizer = getAssemblyPathVisualizer();
    visualizer.initialize(sceneRoot);

    // "아래로" 선 그리기 (월드 Y축 양의 방향으로 오프셋)
    const downwardPoint = headCenter.clone().add(new THREE.Vector3(0, downwardOffset, 0));
    console.log('downwardPoint>>> ', downwardPoint);
    visualizer.visualizeAssemblyPath(headCenter, downwardPoint);
};
