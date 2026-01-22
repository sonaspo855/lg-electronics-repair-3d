import { LEFT_DOOR_DAMPER_NODE_NAME } from '../../shared/utils/fridgeConstants';
import * as THREE from 'three';
import { getPreciseBoundingBox } from '../../shared/utils/commonUtils';
import { animate, calculateCameraTargetPosition, NodeCache } from '../../shared/utils/animationUtils';

// Camera movement options
export interface CameraMoveOptions {
    duration?: number; // milliseconds
    zoomRatio?: number; // Custom zoom ratio
    direction?: THREE.Vector3; // Custom camera direction
    onProgress?: (progress: number) => void; // Progress callback
}

// Camera movement service for fridge animations
export class CameraMovementService {
    private cameraControls: any;
    private sceneRoot: THREE.Object3D | null = null;
    private nodeCache: NodeCache = new NodeCache();

    constructor(cameraControls: any, sceneRoot?: THREE.Object3D) {
        this.cameraControls = cameraControls;
        this.sceneRoot = sceneRoot || null;
    }

    // Set scene root reference for node lookup
    public setSceneRoot(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
        this.nodeCache.clear(); // Clear cache when scene root changes
    }

    public async moveCameraToNode(nodeName: string, options: CameraMoveOptions = {}): Promise<void> {
        // 단순히 시네마틱 로직을 실행하도록 연결
        return this.moveCameraCinematic(nodeName, options);
    }

    private drawCameraPath(points: THREE.Vector3[]): void {
        if (!this.sceneRoot) return;

        // 1. 점을 연결하는 곡선 생성
        const curve = new THREE.CatmullRomCurve3(points);
        const curvePoints = curve.getPoints(100); // 100개의 세밀한 점 추출

        // 2. 지오메트리 생성 및 점선 패턴 계산
        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);

        // 3. 두꺼운 선 재질 설정 (빨간색 실선)
        const material = new THREE.LineBasicMaterial({
            color: 0xff0000,
            linewidth: 15, // 두꺼운 선
        });

        const line = new THREE.Line(geometry, material);

        // 4. 씬에 추가 (디버깅용 객체임을 식별하기 위해 이름 부여)
        line.name = "DEBUG_CAMERA_PATH";
        this.sceneRoot.add(line);

        // 5. 10초 후 자동 제거 (화면 유지 시간 조절 가능)
        /* setTimeout(() => {
            if (this.sceneRoot) this.sceneRoot.remove(line);
        }, 10000); */
    }

    public async moveCameraToUpwardView(nodeName: string, options: CameraMoveOptions = {}): Promise<void> {
        // X를 0으로 설정하여 노드가 가로로 바르게 정렬되도록 하고, 
        // Z를 아주 미세하게(0.01) 주어 완전 수직 시의 짐벌락(Gimbal Lock) 현상을 방지합니다.
        const upwardDirection = new THREE.Vector3(0, -1, 0.01).normalize();

        return this.moveCameraToNode(nodeName, {
            ...options,
            direction: options.direction || upwardDirection,
            zoomRatio: options.zoomRatio || 3 // 정중앙에 꽉 차게 보이도록 배율 최적화
        });
    }

    /**
     * [LG CNS 개선안] 시네마틱 카메라 워킹
     * 1) 직선 접근 -> 2) 막바지 급격한 하강(Drop) -> 3) 로우 앵글(Low Angle)
     */
    public async moveCameraCinematic(nodeName: string, options: CameraMoveOptions = {}): Promise<void> {
        console.log('moveCameraCinematic!!!');

        const targetNode = this.getNodeByName(nodeName);
        console.log('targetNode>> ', targetNode);
        // 에러 방지: camera-controls는 .camera를 사용하며, 존재 여부를 체크합니다.
        // if (!targetNode || !this.cameraControls?.camera) return;

        // const camera = this.cameraControls.camera;
        const camera = this.cameraControls.camera || this.cameraControls.object;
        console.log('camera>> ', camera);
        if (!targetNode || !camera) {
            console.error("Target node or Camera not found");
            return;
        }

        const targetBox = getPreciseBoundingBox(targetNode);
        const targetCenter = new THREE.Vector3();
        targetBox.getCenter(targetCenter);
        const size = new THREE.Vector3();
        targetBox.getSize(size);

        // moveCameraCinematic 함수 내부 1번 항목(End Pos 설정) 수정
        const fovRad = (camera.fov * Math.PI) / 180;

        // [개선] 객체의 전체 크기(Max Dimension)를 기준으로 거리를 계산하여 정중앙 배치 보장
        const maxDim = Math.max(size.x, size.y, size.z);
        const zoomDistance = (maxDim / 2) / Math.tan(fovRad / 2) * (options.zoomRatio || 1.2);

        let endPos: THREE.Vector3;

        console.log('options>> ', options);
        if (options.direction) {
            console.log('options.direction>> ', options.direction);
            // 방향 벡터를 타겟 중심에 더해 카메라의 최종 목적지 계산 (options 전달이 되어야 작동함)
            endPos = targetCenter.clone().add(options.direction.clone().multiplyScalar(zoomDistance));
        } else {
            console.log('bbb');
            // 기본값: 타겟과 X축을 일치시켜 가로 정렬 유지
            endPos = targetCenter.clone().add(new THREE.Vector3(0, -size.y * 0.5, zoomDistance));
        }

        // 2. 제어점(Control Point) 설정: '직선 접근 후 낙하'를 위해 목적지 바로 위(고도 유지)에 배치
        const startPos = camera.position.clone();
        const controlPos = new THREE.Vector3(
            endPos.x,      // 목적지와 수평 위치 동일
            startPos.y,    // 시작 고도 유지 (직선 접근 느낌)
            endPos.z       // 목적지와 깊이 동일
        );
        console.log('startPos>> ', startPos);
        console.log('controlPos>> ', controlPos);
        console.log('endPos>> ', endPos);
        // 3. 2차 베지에 곡선 생성
        const cinematicCurve = new THREE.QuadraticBezierCurve3(startPos, controlPos, endPos);
        console.log('cinematicCurve>> ', cinematicCurve);
        // ---------------------------------------------------------
        // 애니메이션 실행: 비대칭 이징(Quintic) 적용
        // ---------------------------------------------------------
        const startTarget = this.cameraControls.target.clone();
        const originalDamping = this.cameraControls.enableDamping;
        console.log('originalDamping>> ', originalDamping);
        this.cameraControls.enableDamping = false;

        await animate(
            (progress: number, eased: number) => {
                // progress는 선형(0~1), 여기에 5제곱을 적용하여 후반부에 이동이 몰리도록 함 (Drop 연출)
                const dropProgress = Math.pow(progress, 5);

                // 곡선을 따라 카메라 위치 이동
                const point = cinematicCurve.getPoint(dropProgress);
                camera.position.copy(point);

                // 시선(Target)은 항상 부품의 중심을 고정하여 자연스럽게 올려다보게 함
                this.cameraControls.target.lerpVectors(startTarget, targetCenter, eased);
                this.cameraControls.update();
            },
            {},
            {
                duration: 2500,
                easing: (t: number) => t // 내부에서 pow(5)를 직접 제어하므로 선형 전달
            }
        );

        this.cameraControls.enableDamping = originalDamping;
    }

    /**
     * [추가] webp 시나리오: 커버 -> 레버 -> 힌지 순으로 카메라가 추적하는 시퀀스
     */
    public async playDisassemblyCameraSequence(): Promise<void> {
        // 1단계: 도어 커버 집중
        await this.moveCameraToNode("Door_Cover", { duration: 1200, zoomRatio: 2 });

        // [수정 포인트] 2단계: 레버 분리 시, 위에서 보는 대신 '완전히 올려다보는' 시점 적용
        await new Promise(resolve => setTimeout(resolve, 500));
        // 기존: await this.moveCameraToNode("Lever_Part", { ... });
        await this.moveCameraToUpwardView("Lever_Part", { duration: 1500, zoomRatio: 1.5 });

        // 3단계: 힌지 분리 시점
        await this.moveCameraToNode("Hinge_Assembly", { duration: 1000, zoomRatio: 1.2 });
    }

    // Find a node by name in the scene (with caching)
    private getNodeByName(nodeName: string): THREE.Object3D | null {
        if (!this.sceneRoot) {
            console.error('Scene root not available for node lookup');
            return null;
        }

        return this.nodeCache.findNodeByName(this.sceneRoot, nodeName);
    }


    // Default camera movement parameters
    private static readonly DEFAULT_DAMPER_DURATION = 1000;

    // Move camera to the left door damper node (Promise-based)
    public async moveCameraToLeftDoorDamper(options: CameraMoveOptions = {}): Promise<void> {
        console.log('moveCameraToLeftDoorDamper!!');
        // 기존 moveCameraToNode 대신 새로 만든 UpwardView 호출
        await this.moveCameraToUpwardView(LEFT_DOOR_DAMPER_NODE_NAME, {
            duration: options.duration || 1000,
            ...options
        });
    }
}
