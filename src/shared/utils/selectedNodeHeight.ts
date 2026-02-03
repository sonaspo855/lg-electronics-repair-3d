import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { invalidate } from '@react-three/fiber';
import { getNodeNameManager } from './NodeNameManager';

import { getPreciseBoundingBox, debugFocusCamera, createHighlightMaterial } from './commonUtils';

const HighlightNode = 'AKC73369920_Bucket_Assembly,Ice';

/**
 * 노드에 하이라이트를 적용하는 공통 함수
 * @param targetNode - 하이라이트할 타겟 노드
 * @param sceneRoot - 씬 루트 노드
 * @param camera - 카메라 (선택 사항, 카메라 이동 시 필요)
 */
export const highlightNode = (
    targetNode: THREE.Object3D,
    sceneRoot: THREE.Object3D,
    camera?: THREE.PerspectiveCamera
): THREE.Box3 => {
    console.log('highlightNode!!!');

    // 1. 월드 좌표 정보 추출
    targetNode.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    targetNode.matrixWorld.decompose(worldPos, worldQuat, worldScale);

    // 2. 오리지널 노드에 직접 붉은색 적용
    targetNode.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            // 원본 머티리얼 저장 (나중에 복원용)
            if (!child.userData.originalMaterial) {
                child.userData.originalMaterial = child.material;
            }
            // 빛의 영향을 받지 않는 BasicMaterial 사용 -> 무조건 빨갛게 보임
            child.material = createHighlightMaterial(0xff0000, 0.8);
            child.renderOrder = 99999; // 맨 위에 그리기
        }
    });

    // 기존 하이라이트 제거 (Box3Helper만 제거)
    const toRemove: THREE.Object3D[] = [];
    sceneRoot.traverse((child) => {
        if (child.type === "Box3Helper") {
            toRemove.push(child);
        }
    });
    toRemove.forEach(c => c.parent?.remove(c));

    console.log("빨간색 하이라이트가 오리지널 노드에 적용되었습니다.");

    // 3. [노란색 박스 하이라이트 - 노드를 따라 움직임]
    const preciseBox = getPreciseBoundingBox(targetNode);

    // Box3Helper는 월드 좌표 기준으로 생성되므로 sceneRoot에 추가
    const boxHelper = new THREE.Box3Helper(preciseBox, 0xffff00); // 노란색
    sceneRoot.add(boxHelper);

    // 박스 헬퍼를 타겟 노드와 연결하여 업데이트 함수 생성
    const updateBoxHelper = () => {
        const currentBox = getPreciseBoundingBox(targetNode);
        boxHelper.box.copy(currentBox);
        // Box3Helper는 update 메서드가 없으므로 invalidate()로 리렌더링 유도
        invalidate();
    };

    // 타이머로 주기적으로 업데이트 (노드 움직임 추적)
    const updateInterval = setInterval(updateBoxHelper, 16); // 60fps

    // 메모리 누수 방지를 위해 interval 저장
    if (!targetNode.userData.boxUpdateInterval) {
        targetNode.userData.boxUpdateInterval = [];
    }
    targetNode.userData.boxUpdateInterval.push(updateInterval);

    console.log("빨간색 하이라이트와 노란색 박스가 제자리에 적용되었습니다.");

    // 4. 카메라 이동 (오리지널 노드 기준) - 비활성화
    // if (camera) {
    //     debugFocusCamera(camera, preciseBox, undefined, 1.0);
    // }

    invalidate();

    return preciseBox;
};

/**
 * 선택된 노드의 높이를 찾아 하이라이트하는 함수
 * @param event - 마우스 이벤트
 */
export const selectedNodeHeight = (event: ThreeEvent<MouseEvent>) => {
    console.log('selectedNodeHeight!!');
    event.stopPropagation();
    if (!event.intersections || event.intersections.length === 0) return;

    const clickedObject = event.intersections[0].object;

    // NodeNameManager를 사용하여 도어 노드 이름 가져오기
    const nodeNameManager = getNodeNameManager();
    const doorNodeNames = [
        nodeNameManager.getNodeName('fridge.Door.DOOR_NODE_NAME'),
        nodeNameManager.getNodeName('fridge.Door.RIGHT_DOOR_NODE_NAME'),
        nodeNameManager.getNodeName('fridge.Door.LOWER_LEFT_DOOR_NODE_NAME'),
        nodeNameManager.getNodeName('fridge.Door.LOWER_RIGHT_DOOR_NODE_NAME')
    ].filter((name): name is string => name !== null);

    const doorConfig: { [key: string]: THREE.Vector3 } = {};
    doorNodeNames.forEach(name => {
        doorConfig[name] = new THREE.Vector3(0, 0, 0);
    });

    const targetNodeNames = Object.keys(doorConfig);
    let currentNode: THREE.Object3D | null = clickedObject;
    let targetAncestor: THREE.Object3D | null = null;

    while (currentNode) {
        if (targetNodeNames.includes(currentNode.name)) {
            targetAncestor = currentNode;

            let damperChild: THREE.Object3D | undefined;
            targetAncestor.traverse((child) => {
                if (child.name.includes(HighlightNode)) {
                    damperChild = child as THREE.Object3D;
                    return true;
                }
            });

            if (damperChild) {
                console.log(`타겟 발견: ${damperChild.name}`);

                // 1. 씬 루트 찾기
                let sceneRoot = damperChild;
                while (sceneRoot.parent) {
                    sceneRoot = sceneRoot.parent;
                }

                // 공통 하이라이트 함수 호출
                highlightNode(damperChild, sceneRoot, event.camera as THREE.PerspectiveCamera);
            } else {
                console.log('타겟 노드를 찾을 수 없습니다.');
            }
            break;
        }
        if (!currentNode.parent) break;
        currentNode = currentNode.parent;
    }
};