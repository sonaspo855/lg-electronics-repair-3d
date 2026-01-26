import * as THREE from 'three';
import { invalidate } from '@react-three/fiber';
import { getPreciseBoundingBox, debugFocusCamera, createHighlightMaterial } from './commonUtils';
const HighlightNode = 'ACV74674704_Damper_Assembly_10813';

const highlightMaterial = createHighlightMaterial(0xff0000, 0.3);

type FindNodeHeightState = {
    helper?: THREE.Box3Helper;
    intervalId?: number;
    meshes?: THREE.Mesh[];
};

/**
 * 이전 하이라이트 상태를 정리하는 함수
 * @param root - 정리할 루트 오브젝트
 */
const clearPrevious = (root: THREE.Object3D) => {
    const state = root.userData.__findNodeHeight as FindNodeHeightState | undefined;

    if (state?.intervalId) {
        clearInterval(state.intervalId);
    }

    if (state?.helper?.parent) {
        state.helper.parent.remove(state.helper);
    }

    if (state?.meshes) {
        state.meshes.forEach((mesh) => {
            if (mesh.userData.originalMaterial) {
                mesh.material = mesh.userData.originalMaterial;
                delete mesh.userData.originalMaterial;
            }
        });
    }

    delete root.userData.__findNodeHeight;
};

/**
 * 노드의 높이를 찾고 하이라이트하는 함수
 * @param root - 루트 오브젝트
 * @param camera - 카메라 오브젝트
 * @param controls - 카메라 컨트롤 옵션
 * @param options - 하이라이트 옵션 설정
 * @returns 하이라이트된 노드들과 정리 함수
 */
export const findNodeHeight = (
    root: THREE.Object3D,
    camera: THREE.PerspectiveCamera,
    controls?: { target: THREE.Vector3; update: () => void },
    options?: {
        highlightNodeName?: string;
        matchMode?: 'includes' | 'equals';
        duration?: number;
        boxColor?: number;
        append?: boolean;
    }
) => {
    const highlightNodeName = options?.highlightNodeName ?? HighlightNode;
    const matchMode = options?.matchMode ?? 'includes';
    const duration = options?.duration ?? 1.0;
    const boxColor = options?.boxColor ?? 0xffff00;
    const append = options?.append ?? false;

    if (!append) {
        clearPrevious(root);
    }

    const matched: THREE.Object3D[] = [];
    root.traverse((node) => {
        if (!node.name) return;

        const ok =
            matchMode === 'equals'
                ? node.name === highlightNodeName
                : node.name.includes(highlightNodeName);

        if (ok) matched.push(node);
    });

    if (matched.length === 0) {
        return { matchedNodes: [] as THREE.Object3D[], clear: () => clearPrevious(root) };
    }

    const meshes: THREE.Mesh[] = [];
    matched.forEach((node) => {
        node.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (!child.userData.originalMaterial) {
                    child.userData.originalMaterial = child.material;
                }
                child.material = highlightMaterial;
                child.renderOrder = 99999;
                meshes.push(child);
            }
        });
    });

    const unionBox = new THREE.Box3();
    matched.forEach((node) => {
        unionBox.union(getPreciseBoundingBox(node));
    });

    const helper = new THREE.Box3Helper(unionBox, boxColor);
    root.add(helper);

    const intervalId = window.setInterval(() => {
        const nextBox = new THREE.Box3();
        matched.forEach((node) => nextBox.union(getPreciseBoundingBox(node)));
        helper.box.copy(nextBox);
        invalidate();
    }, 16);

    root.userData.__findNodeHeight = { helper, intervalId, meshes } satisfies FindNodeHeightState;

    // debugFocusCamera(camera, unionBox, controls, duration); // 카메라 이동 주석 처리

    return { matchedNodes: matched, clear: () => clearPrevious(root) };
};