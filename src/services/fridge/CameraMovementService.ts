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
        return this.moveCameraCinematic(nodeName);
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

    /**
     * [LG CNS 개선안] 시네마틱 카메라 워킹
     * 1) 직선 접근 -> 2) 막바지 급격한 하강(Drop) -> 3) 로우 앵글(Low Angle)
     */
    public async moveCameraCinematic(nodeName: string): Promise<void> {
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

        // 1. 목표 지점(End Pos) 설정: 로우 앵글을 위해 부품 중심보다 낮게 설정
        const fovRad = (camera.fov * Math.PI) / 180;
        const zoomDistance = (size.y) / Math.tan(fovRad / 2) * 1.5; // 거리는 부품 크기에 맞춰 자동 계산

        // 대상의 정면(Z+)에서 아래쪽(-Y)에 카메라 위치
        const endPos = targetCenter.clone().add(new THREE.Vector3(0, -size.y * 0.8, zoomDistance));
        // const endPos = targetCenter.clone().add(new THREE.Vector3(0, size.y * 0.8, zoomDistance));

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
        // 1단계: 도어 커버 집중 (정면 사선)
        await this.moveCameraToNode("Door_Cover", { duration: 1200, zoomRatio: 2 });

        // 2단계: 레버 분리 시점에 맞춰 상단으로 이동
        await new Promise(resolve => setTimeout(resolve, 500)); // 애니메이션 타이밍 동기화
        await this.moveCameraToNode("Lever_Part", { duration: 1000, direction: new THREE.Vector3(0, 1, 0.5) });

        // 3단계: 힌지 분리 시점에 맞춰 측면 집중
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
        await this.moveCameraToNode(LEFT_DOOR_DAMPER_NODE_NAME, {
            duration: options.duration || CameraMovementService.DEFAULT_DAMPER_DURATION,
            // Ensure horizontal direction for front view
            direction: new THREE.Vector3(1, 0, 0).normalize(),
            ...options
        });
    }
}
