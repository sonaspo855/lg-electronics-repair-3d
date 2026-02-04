import * as THREE from 'three';
import { getClickPointMarker } from './ClickPointMarker';
import { highlightNode } from './findNodeHeight';

export interface SelectionHandlerOptions {
    scene: THREE.Object3D;
    camera: THREE.PerspectiveCamera;
    gl: { domElement: HTMLElement };
    onNodeSelect?: (node: THREE.Object3D) => void;
}

export class SelectionHandler {
    private options: SelectionHandlerOptions;

    constructor(options: SelectionHandlerOptions) {
        this.options = options;
    }

    /**
     * R3F 이벤트 기반 클릭 핸들러
     * @param event R3F onClick 이벤트 객체
     * @param sceneRoot 씬 루트 노드
     * @param camera 카메라
     */
    public handleClick(event: any, sceneRoot?: THREE.Object3D, camera?: THREE.PerspectiveCamera): void {
        if (!event || !event.intersections || event.intersections.length === 0) {
            return;
        }

        const hit = event.intersections[0];
        const clickedObject = hit.object;
        console.log('클릭된 원본 노드: ', clickedObject.name);

        // shift + click: 기존 기능 (구 마커 생성)
        if (event.shiftKey) {
            this.handleShiftClick(hit, sceneRoot);
        }


        // ctrl + click: 클릭한 노드 하이라이트
        else if (event.ctrlKey) {
            this.handleCtrlClick(hit, sceneRoot, camera);
        }

        // this.options.onNodeSelect?.(clickedObject);
    }

    private handleShiftClick(hit: THREE.Intersection, sceneRoot?: THREE.Object3D) {
        const targetNode: THREE.Object3D = hit.object;
        console.log('handleShiftClick!!>>> ', targetNode);
        // this.options.onNodeSelect?.(targetNode);

        // 클릭한 지점에 파란색 구 마커 생성
        const clickPoint = hit.point;
        const normal = hit.face?.normal || new THREE.Vector3(0, 1, 0);
        const clickPointMarker = getClickPointMarker((sceneRoot || this.options.scene) as THREE.Scene);
        clickPointMarker.createMarker(clickPoint, normal, targetNode.name);
    }

    private handleCtrlClick(hit: THREE.Intersection, sceneRoot?: THREE.Object3D, camera?: THREE.PerspectiveCamera) {
        const clickedObject = hit.object;
        console.log('handleCtrlClick>>> ', clickedObject);

        // 1. 씬 루트 찾기
        let root = sceneRoot || clickedObject;
        while (root.parent) {
            root = root.parent;
        }

        // 2. highlightNode 함수를 사용하여 하이라이트 적용
        highlightNode(clickedObject, root, camera || this.options.camera);

        // this.options.onNodeSelect?.(clickedObject);
    }
}
