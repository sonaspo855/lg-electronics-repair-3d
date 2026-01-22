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
     * 2단계 시네마틱 이동: 
     * 1단계 - 타겟 정면 수평 정렬 (Alignment)
     * 2단계 - 타겟 중심 lerp를 통한 접근 및 회전 (Zoom & Orbit)
     */
    public async moveCameraCinematic(nodeName: string): Promise<void> {
        const targetNode = this.getNodeByName(nodeName);
        if (!targetNode || !this.sceneRoot) return;

        const sceneBox = getPreciseBoundingBox(this.sceneRoot);
        const targetBox = getPreciseBoundingBox(targetNode);
        const sceneCenter = new THREE.Vector3();
        sceneBox.getCenter(sceneCenter);
        const targetCenter = new THREE.Vector3();
        targetBox.getCenter(targetCenter);
        const sceneSize = new THREE.Vector3();
        sceneBox.getSize(sceneSize);

        // 1단계 목표 위치 계산
        const safetyDistance = Math.max(sceneSize.x, sceneSize.y, sceneSize.z) * 2.5;
        const quarterViewDir = new THREE.Vector3(1, 0, 1).normalize();
        const alignPos = sceneCenter.clone().add(quarterViewDir.clone().multiplyScalar(safetyDistance));
        alignPos.y = targetCenter.y; // 타겟 높이 고정

        const startPos1 = this.cameraControls.object.position.clone();
        const startTarget1 = this.cameraControls.target.clone();

        console.log("1단계 시작: 전체 조망 이동");

        // [개선] new Promise 대신 animate의 자체 반환 Promise를 await 합니다.
        await animate((progress: number, eased: number) => {
            this.cameraControls.object.position.lerpVectors(startPos1, alignPos, eased);
            this.cameraControls.target.lerpVectors(startTarget1, targetCenter, eased * 0.1); // 서서히 주시
            this.cameraControls.update();
        }, { duration: 1500 }); // ms 단위

        // ---------------------------------------------------------
        // 2, 3, 4단계 진입 (여기서부터 96번 라인 이후 로직)
        // ---------------------------------------------------------
        console.log('Phase 2, 3, 4: 곡선 궤적 진입 및 타겟 포커싱!!');

        // [4단계] 화면 꽉 참 보장: 바운딩 박스 기반 동적 거리 계산
        const diagonal = targetBox.min.distanceTo(targetBox.max);
        const fovRad = (this.cameraControls.object.fov * Math.PI) / 180;
        let zoomDistance = (diagonal / 2) / Math.tan(fovRad / 2);
        zoomDistance *= 1.3; // 여유 계수

        // [2단계] 최종 위치 설정 (로우 앵글)
        // 1. 방향 벡터 수정: 정면(Z)과 측면(X)뿐만 아니라 아래에서 위를 보는 방향(Y)을 정의합니다.
        // const lowAngleDir = new THREE.Vector3(1, -0.6, 1).normalize(); // Y값을 마이너스로 설정하여 아래쪽 배치
        const lowAngleDir = new THREE.Vector3(3, -3, 3).normalize(); // Y값을 마이너스로 설정하여 아래쪽 배치

        // 2. 최종 위치 계산: 계산된 lowAngleDir 방향으로 zoomDistance만큼 이동
        const finalPos = targetCenter.clone().add(lowAngleDir.clone().multiplyScalar(zoomDistance));

        // 3. 웅장함 극대화: 타겟의 크기에 비례하여 Y축 높이를 추가적으로 낮춤
        finalPos.y -= (diagonal * 3.0); // 기존 0.4에서 0.8로 하강폭 증대

        const startPos2 = this.cameraControls.object.position.clone();
        const startTarget2 = this.cameraControls.target.clone();

        // 1. 제어점(Control Point) 하강폭 계수를 상향하여 더 급격한 곡선 유도
        const controlPos = new THREE.Vector3(
            (startPos2.x + finalPos.x) / 2,
            Math.min(startPos2.y, finalPos.y) - (diagonal * 40), // <--- 곡률 강화
            (startPos2.z + finalPos.z) / 2
        );

        // 2. [중요] 이동에 사용하는 곡선을 시각화와 동일하게 또는 정밀하게 맞춤
        const curve = new THREE.QuadraticBezierCurve3(startPos2, controlPos, finalPos);

        // [수정] 3. 시각화 데이터와 실제 이동 경로의 완전한 동기화
        // drawCameraPath에 들어가는 pathPoints도 Bezier 곡선에서 샘플링한 포인트를 전달해야 일치함
        const visualPoints = curve.getPoints(50);
        this.drawCameraPath(visualPoints);

        // 문제 원인: Controls의 Damping(관성)이 프레임별 위치 강제 할당을 방해하여 곡선 궤적을 이탈함.
        // 해결 방안: 시네마틱 이동 구간 동안만 Damping을 비활성화(False)하여 궤적 정밀 추적 보장.

        // 1. 기존 Damping 설정 저장 (OrbitControls 기준 'enableDamping', 일부 라이브러리는 'dampingEnabled'일 수 있음)
        const originalDamping = this.cameraControls.enableDamping;

        // 2. Damping 비활성화: 입력된 좌표 그대로 렌더링하도록 설정
        if (this.cameraControls.hasOwnProperty('enableDamping')) {
            this.cameraControls.enableDamping = false;
        }

        // 애니메이션 실행
        await animate((progress: number, eased: number) => {
            // Bezier 곡선 위의 정확한 좌표를 프레임 단위로 강제 주입
            const point = curve.getPoint(eased);

            // 카메라 위치 강제 설정
            this.cameraControls.object.position.copy(point);

            // [개선] 타겟(주시점)도 고정이 아닌, 시작 타겟에서 최종 타겟으로 부드럽게 보간(Lerp)
            // 위치는 곡선을 타되, 시선은 부드럽게 회전해야 선형적인 느낌이 사라짐
            this.cameraControls.target.lerpVectors(startTarget2, targetCenter, eased);

            // Damping이 비활성화된 상태에서 정밀 업데이트
            this.cameraControls.update();
        }, {
            duration: 5000,
            easing: (t) => t * (2 - t) // EaseOut 효과로 도착 시 감속 강화
        });

        // 3. 애니메이션 종료 후 Damping 설정 원복 (사용자 제어감 복구)
        if (this.cameraControls.hasOwnProperty('enableDamping')) {
            this.cameraControls.enableDamping = originalDamping;
            this.cameraControls.update();
        }

        console.log("[CameraMovementService] 모든 시네마틱 단계 완료");
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
