import * as THREE from 'three';

/**
 * 나사/볼트 노드를 식별하는 유틸리티 함수
 * NodeHierarchy.tsx 및 ScrewAnimationService.ts에서 공통으로 사용
 */

/**
 * 노드 이름으로 나사/볼트인지 확인합니다.
 * @param nodeName 노드 이름
 * @returns 나사/볼트이면 true
 */
export function isFastenerNodeName(nodeName: string): boolean {
    return /screw|bolt/i.test(nodeName);
}

/**
 * THREE.Object3D 노드가 나사/볼트인지 확인합니다.
 * @param node THREE.Object3D 노드
 * @returns 나사/볼트이면 true
 */
export function isFastenerNode(node: THREE.Object3D): boolean {
    return isFastenerNodeName(node.name || '');
}
