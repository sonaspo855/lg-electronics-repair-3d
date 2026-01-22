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
     * [LG CNS 개선안] 
     * Longest Axis Awareness + Low-angle Cinema Path
    */
    public async moveCameraCinematic(nodeName: string): Promise<void> {
        const targetNode = this.getNodeByName(nodeName);
        if (!targetNode || !this.sceneRoot) return;

        // 0. 타겟 정보 및 바운딩 박스 계산
        const targetBox = getPreciseBoundingBox(targetNode);
        const targetCenter = new THREE.Vector3();
        targetBox.getCenter(targetCenter);
        const size = new THREE.Vector3();
        targetBox.getSize(size);

        // [Longest Axis Awareness] 가로(X)와 깊이(Z)를 비교하여 정면/측면 결정
        // 비스듬한 뷰를 제거하기 위해 축 성분을 (1,0,0) 또는 (0,0,1)로 엄격히 제한합니다.
        const isWide = size.x >= size.z;
        const horizontalDir = isWide
            ? new THREE.Vector3(0, 0, 1)  // 정면(Z축)
            : new THREE.Vector3(1, 0, 0); // 측면(X축)

        // 1단계: 전체 조망 정렬 (Alignment)
        // 이전의 quarterViewDir(1, 0, 1)을 제거하고 계산된 horizontalDir를 사용합니다.
        const sceneBox = getPreciseBoundingBox(this.sceneRoot);
        const sceneSize = new THREE.Vector3();
        sceneBox.getSize(sceneSize);
        const safetyDistance = Math.max(sceneSize.x, sceneSize.y, sceneSize.z) * 2.0;

        // 타겟과 동일한 Y축 높이에서 수평 정렬 지점 계산
        const alignPos = targetCenter.clone().add(horizontalDir.clone().multiplyScalar(safetyDistance));

        const startPos1 = this.cameraControls.object.position.clone();
        const startTarget1 = this.cameraControls.target.clone();

        await animate((progress, eased) => {
            this.cameraControls.object.position.lerpVectors(startPos1, alignPos, eased);
            this.cameraControls.target.lerpVectors(startTarget1, targetCenter, eased);
            this.cameraControls.update();
        }, { duration: 1200 });

        // ---------------------------------------------------------
        // 2단계: 선형 줌인 및 하강 (Low-Angle Curve)
        // ---------------------------------------------------------
        const startPos2 = this.cameraControls.object.position.clone(); // 1단계 종료 시점 스냅샷
        const startTarget2 = this.cameraControls.target.clone();

        // 화면 꽉 참 거리 계산
        const diagonal = targetBox.min.distanceTo(targetBox.max);
        const fovRad = (this.cameraControls.object.fov * Math.PI) / 180;
        const zoomDistance = (diagonal / 2) / Math.tan(fovRad / 2);

        // 최종 목적지 (Low-Angle): 타겟보다 아래에서 위를 보도록 Y값 하강
        const finalPos = targetCenter.clone().add(horizontalDir.clone().multiplyScalar(zoomDistance));
        finalPos.y -= (size.y * 1.5); // 노드 크기에 맞춰 하강 깊이 조절

        // 제어점(controlPos): 이동 경로 중간까지는 수평(직선) 줌인을 유지하도록 설정
        const controlPos = new THREE.Vector3(
            (startPos2.x + finalPos.x) / 2,
            targetCenter.y, // 타겟 높이와 동일하게 설정하여 초반 직선 줌인 유도
            (startPos2.z + finalPos.z) / 2
        );

        const curve = new THREE.QuadraticBezierCurve3(startPos2, controlPos, finalPos);

        // Damping 일시 해제하여 곡선 궤적 정확도 확보
        const originalDamping = this.cameraControls.enableDamping;
        this.cameraControls.enableDamping = false;

        await animate((progress, eased) => {
            const point = curve.getPoint(eased);
            this.cameraControls.object.position.copy(point);

            // 시선(Target)은 항상 노드 중심에 고정하여 '올려다보는' 연출 완성
            this.cameraControls.target.lerpVectors(startTarget2, targetCenter, eased);
            this.cameraControls.update();
        }, {
            duration: 2500,
            easing: (t) => t * (2 - t)
        });

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
