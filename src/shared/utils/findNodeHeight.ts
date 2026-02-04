import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { invalidate } from '@react-three/fiber';
import { getPreciseBoundingBox, debugFocusCamera, createHighlightMaterial } from './commonUtils';
import { getNodeNameManager } from './NodeNameManager';

/**
 * 노드 하이라이트 상태 타입
 */
type NodeHighlightState = {
    helper?: THREE.Box3Helper;
    intervalId?: number;
    meshes?: THREE.Mesh[];
};

/**
 * 노드의 하이라이트 상태를 정리하는 공통 함수
 * - 하이라이트된 메쉬의 원본 머티리얼 복원
 * - Box3Helper 제거
 * - 업데이트 인터벌 정리
 *
 * @param target - 정리할 타겟 오브젝트 (루트 또는 타겟 노드)
 * @param stateKey - userData에 저장된 상태 키 (기본값: '__findNodeHeight')
 */
const clearHighlightState = (
    target: THREE.Object3D,
    stateKey: string = '__findNodeHeight'
): void => {
    const state = target.userData[stateKey] as NodeHighlightState | undefined;

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

    delete target.userData[stateKey];
};

/**
 * 씬 루트에서 모든 Box3Helper를 제거하는 함수
 * - 씬 트리를 순회하며 모든 Box3Helper 타입의 객체를 찾아 제거
 *
 * @param sceneRoot - 씬 루트 노드
 */
const clearAllBoxHelpers = (sceneRoot: THREE.Object3D): void => {
    const toRemove: THREE.Object3D[] = [];
    sceneRoot.traverse((child) => {
        if (child.type === "Box3Helper") {
            toRemove.push(child);
        }
    });
    toRemove.forEach(c => c.parent?.remove(c));
};

/**
 * 노드에 하이라이트를 적용하는 공통 함수
 * - 타겟 노드의 모든 자식 메쉬에 하이라이트 머티리얼 적용
 * - 바운딩 박스 시각화 (Box3Helper)
 * - 노드 움직임 추적을 위한 주기적 업데이트 (60fps)
 * - 선택적으로 카메라 포커스 이동
 *
 * @param targetNode - 하이라이트할 타겟 노드
 * @param sceneRoot - 씬 루트 노드 (Box3Helper 추가용)
 * @param options - 하이라이트 옵션
 * @param options.highlightColor - 하이라이트 색상 (기본값: 0xff0000)
 * @param options.highlightOpacity - 하이라이트 투명도 (기본값: 0.2)
 * @param options.boxColor - 바운딩 박스 색상 (기본값: 0xffff00)
 * @param options.camera - 카메라 오브젝트 (포커스 이동 시 필요)
 * @param options.controls - 카메라 컨트롤러 (포커스 이동 시 필요)
 * @param options.duration - 카메라 이동 시간 (초, 기본값: 1.0)
 * @returns 하이라이트된 노드의 바운딩 박스
 */
export const highlightNode = (
    targetNode: THREE.Object3D,
    sceneRoot: THREE.Object3D,
    options?: {
        highlightColor?: number;
        highlightOpacity?: number;
        boxColor?: number;
        camera?: THREE.PerspectiveCamera;
        controls?: { target: THREE.Vector3; update: () => void };
        duration?: number;
    }
): THREE.Box3 => {
    const {
        highlightColor = 0xff0000,
        highlightOpacity = 0.2,
        boxColor = 0xffff00,
        camera,
        controls,
        duration = 1.0
    } = options || {};

    // 1. 월드 좌표 정보 추출
    targetNode.updateMatrixWorld(true);

    // 2. 오리지널 노드에 하이라이트 적용
    const highlightMaterial = createHighlightMaterial(highlightColor, highlightOpacity);
    const meshes: THREE.Mesh[] = [];

    targetNode.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            // 원본 머티리얼 저장 (나중에 복원용)
            if (!child.userData.originalMaterial) {
                child.userData.originalMaterial = child.material;
            }
            child.material = highlightMaterial;
            child.renderOrder = 99999; // 맨 위에 그리기
            meshes.push(child);
        }
    });

    // 3. 기존 Box3Helper 제거
    clearAllBoxHelpers(sceneRoot);

    // 4. 바운딩 박스 하이라이트 (노드를 따라 움직임)
    const preciseBox = getPreciseBoundingBox(targetNode);

    // Box3Helper는 월드 좌표 기준으로 생성되므로 sceneRoot에 추가
    const boxHelper = new THREE.Box3Helper(preciseBox, boxColor);
    sceneRoot.add(boxHelper);

    // 박스 헬퍼를 타겟 노드와 연결하여 업데이트 함수 생성
    const updateBoxHelper = () => {
        const currentBox = getPreciseBoundingBox(targetNode);
        boxHelper.box.copy(currentBox);
        invalidate();
    };

    // 타이머로 주기적으로 업데이트 (노드 움직임 추적)
    const updateInterval = setInterval(updateBoxHelper, 16); // 60fps

    // 메모리 누수 방지를 위해 interval 저장
    if (!targetNode.userData.boxUpdateInterval) {
        targetNode.userData.boxUpdateInterval = [];
    }
    targetNode.userData.boxUpdateInterval.push(updateInterval);

    // 상태 저장 (정리 함수에서 사용)
    targetNode.userData.__findNodeHeight = { helper: boxHelper, intervalId: updateInterval, meshes };

    // 5. 카메라 이동 (선택 사항)
    if (camera && controls) {
        debugFocusCamera(camera, preciseBox, controls, duration);
    }

    invalidate();

    return preciseBox;
};

/**
 * 노드의 높이를 찾고 하이라이트하는 함수 (이름 기반 검색)
 * - 루트 노드에서 이름으로 노드를 검색
 * - 매칭된 노드 중 첫 번째 노드에 하이라이트 적용
 * - NodeNameManager를 통해 노드 이름 관리
 *
 * @param root - 루트 오브젝트 (검색 시작점)
 * @param camera - 카메라 오브젝트 (포커스 이동 시 필요)
 * @param controls - 카메라 컨트롤러 (포커스 이동 시 필요)
 * @param options - 하이라이트 옵션 설정
 * @param options.highlightNodeName - 검색할 노드 이름 (기본값: NodeNameManager에서 가져온 댐퍼 커버 이름)
 * @param options.matchMode - 이름 매칭 모드 (기본값: 'includes')
 * @param options.duration - 카메라 이동 시간 (초, 기본값: 1.0)
 * @param options.boxColor - 바운딩 박스 색상 (기본값: 0xffff00)
 * @param options.append - 기존 하이라이트 유지 여부 (기본값: false)
 * @returns 하이라이트된 노드들과 정리 함수를 포함한 객체
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
    const nodeNameManager = getNodeNameManager();
    const highlightNodeName = options?.highlightNodeName ?? (nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody') || 'MCK71751101_Cover,Body_3117001');
    const matchMode = options?.matchMode ?? 'includes';
    const duration = options?.duration ?? 1.0;
    const boxColor = options?.boxColor ?? 0xffff00;
    const append = options?.append ?? false;

    if (!append) {
        clearHighlightState(root);
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
        return { matchedNodes: [] as THREE.Object3D[], clear: () => clearHighlightState(root) };
    }

    // 첫 번째 매치된 노드에 하이라이트 적용
    const firstMatched = matched[0];
    highlightNode(firstMatched, root, {
        boxColor,
        camera,
        controls,
        duration
    });

    return { matchedNodes: matched, clear: () => clearHighlightState(root) };
};

/**
 * 선택된 노드의 높이를 찾아 하이라이트하는 함수 (클릭 이벤트 기반)
 * - 클릭된 객체의 조상 노드를 순회하며 댐퍼 커버 노드 검색
 * - NodeNameManager를 사용하여 댐퍼 커버 이름 가져오기
 * - 찾은 노드에 하이라이트 적용
 *
 * @param event - Three.js 마우스 이벤트 객체
 * @param event.intersections - 교차된 객체 정보 배열
 * @param event.camera - 이벤트 발생 시점의 카메라
 */
export const selectedNodeHeight = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!event.intersections || event.intersections.length === 0) return;

    const clickedObject = event.intersections[0].object;

    // NodeNameManager를 사용하여 도어 노드 이름 가져오기
    const nodeNameManager = getNodeNameManager();
    const highlightNodeName = nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody') || 'MCK71751101_Cover,Body_3117001';

    let currentNode: THREE.Object3D | null = clickedObject;
    let targetAncestor: THREE.Object3D | null = null;

    while (currentNode) {
        targetAncestor = currentNode;

        let damperChild: THREE.Object3D | undefined;
        targetAncestor.traverse((child) => {
            if (child.name.includes(highlightNodeName)) {
                damperChild = child as THREE.Object3D;
                return true;
            }
        });

        if (damperChild) {
            // 1. 씬 루트 찾기
            let sceneRoot = damperChild;
            while (sceneRoot.parent) {
                sceneRoot = sceneRoot.parent;
            }

            // 공통 하이라이트 함수 호출
            highlightNode(damperChild, sceneRoot, {
                camera: event.camera as THREE.PerspectiveCamera
            });
        }
        if (!currentNode.parent) break;
        currentNode = currentNode.parent;
    }
};
