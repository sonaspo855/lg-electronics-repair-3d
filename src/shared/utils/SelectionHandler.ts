import * as THREE from 'three';
import { getClickPointMarker } from './ClickPointMarker';
import { createHighlightMaterial } from './commonUtils';

export interface SelectionHandlerOptions {
    scene: THREE.Object3D;
    camera: THREE.PerspectiveCamera;
    gl: { domElement: HTMLElement };
    onNodeSelect?: (node: THREE.Object3D) => void;
}

export class SelectionHandler {
    private raycaster: THREE.Raycaster;
    private pointer: THREE.Vector2;
    private options: SelectionHandlerOptions;
    private handlePointerDown: (event: PointerEvent) => void;

    constructor(options: SelectionHandlerOptions) {
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.options = options;

        this.handlePointerDown = this.createHandlePointerDown();
    }

    private createHandlePointerDown(): (event: PointerEvent) => void {
        return (event: PointerEvent) => {
            if (event.button !== 0) {
                return;
            }
            const rect = this.options.gl.domElement.getBoundingClientRect();
            this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.pointer, this.options.camera);
            const hits = this.raycaster.intersectObjects(this.options.scene.children, true);
            if (hits.length > 0) {
                // shift + click: 기존 기능 (구 마커 생성)
                if (event.shiftKey) {
                    this.handleShiftClick(hits[0]);
                }
                // ctrl + click: 클릭한 노드 하이라이트
                else if (event.ctrlKey) {
                    this.handleCtrlClick(hits[0]);
                }
            }
        };
    }

    private handleShiftClick(hit: THREE.Intersection) {
        const targetNode: THREE.Object3D = hit.object;
        console.log('클릭된 원본 노드: ', targetNode);
        this.options.onNodeSelect?.(targetNode);

        // 클릭한 지점에 파란색 구 마커 생성
        const clickPoint = hit.point;
        const normal = hit.face?.normal || new THREE.Vector3(0, 1, 0);
        const clickPointMarker = getClickPointMarker(this.options.scene as THREE.Scene);
        clickPointMarker.createMarker(clickPoint, normal, targetNode.name);
    }

    private handleCtrlClick(hit: THREE.Intersection) {
        const clickedObject = hit.object;
        console.log('클릭된 원본 노드: ', clickedObject);

        // 1. 씬 루트 찾기
        let sceneRoot = clickedObject;
        while (sceneRoot.parent) {
            sceneRoot = sceneRoot.parent;
        }

        // 2. 월드 좌표 정보 추출
        clickedObject.updateMatrixWorld(true);
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        clickedObject.matrixWorld.decompose(worldPos, worldQuat, worldScale);

        // 3. 오리지널 노드에 직접 붉은색 적용
        clickedObject.traverse((child) => {
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

        // 4. [노란색 박스 하이라이트 - 노드를 따라 움직임]
        const preciseBox = new THREE.Box3().setFromObject(clickedObject);

        // Box3Helper는 월드 좌표 기준으로 생성되므로 sceneRoot에 추가
        const boxHelper = new THREE.Box3Helper(preciseBox, 0xffff00); // 노란색
        sceneRoot.add(boxHelper);

        // 박스 헬퍼를 타겟 노드와 연결하여 업데이트 함수 생성
        const updateBoxHelper = () => {
            const currentBox = new THREE.Box3().setFromObject(clickedObject);
            boxHelper.box.copy(currentBox);
        };

        // 타이머로 주기적으로 업데이트 (노드 움직임 추적)
        const updateInterval = setInterval(updateBoxHelper, 16); // 60fps

        // 메모리 누수 방지를 위해 interval 저장
        if (!clickedObject.userData.boxUpdateInterval) {
            clickedObject.userData.boxUpdateInterval = [];
        }
        clickedObject.userData.boxUpdateInterval.push(updateInterval);

        console.log("빨간색 하이라이트와 노란색 박스가 제자리에 적용되었습니다.");

        // 5. 카메라 이동 (오리지널 노드 기준)
        const box = new THREE.Box3().setFromObject(clickedObject);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z, 1);

        const fov = THREE.MathUtils.degToRad(this.options.camera.fov);
        const distance = maxSize / (2 * Math.tan(fov / 2));
        const direction = new THREE.Vector3(1, 1, 1).normalize();

        this.options.camera.position.copy(center.clone().add(direction.multiplyScalar(distance * 1.0)));
        this.options.camera.near = distance / 100;
        this.options.camera.far = distance * 100;
        this.options.camera.updateProjectionMatrix();

        this.options.onNodeSelect?.(clickedObject);
    }

    public attach(): void {
        this.options.gl.domElement.addEventListener("pointerdown", this.handlePointerDown);
    }

    public detach(): void {
        this.options.gl.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    }
}
