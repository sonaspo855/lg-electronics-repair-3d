import { LEFT_DOOR_DAMPER_NODE_NAME } from '../../shared/utils/fridgeConstants';
import * as THREE from 'three';
import { getPreciseBoundingBox } from '../../shared/utils/commonUtils';
// import { animate, calculateCameraTargetPosition, NodeCache } from '../../shared/utils/animationUtils';
import { animate, calculateCameraTargetPosition, NodeCache, createHighlightMaterial } from '../../shared/utils/animationUtils';

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

    /**
     * 특정 노드와 그 자식 메쉬들을 하이라이트 처리합니다.
     * @param nodeName 하이라이트할 노드 이름
     * @param color 하이라이트 색상 (기본값: 노란색 0xffff00)
     */
    public applyHighlight(nodeName: string, color: number = 0xffff00): void {
        const targetNode = this.getNodeByName(nodeName);
        if (!targetNode) {
            console.warn(`Highlight failed: Node "${nodeName}" not found.`);
            return;
        }

        console.log('Applying highlight to node:', targetNode.name);
        console.log('Node children count:', targetNode.children.length);

        // 유틸리티 함수를 사용하여 하이라이트용 재질 생성
        const highlightMat = createHighlightMaterial(color);

        let meshCount = 0;
        targetNode.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                meshCount++;
                console.log('Found mesh:', child.name);
                // 나중에 원래대로 복구하기 위해 기존 재질을 userData에 저장
                if (!child.userData.originalMaterial) {
                    child.userData.originalMaterial = child.material;
                }
                child.material = highlightMat;
            }
        });

        console.log(`Applied highlight to ${meshCount} meshes`);
    }

    /**
     * 노드에 적용된 하이라이트를 제거하고 원래 재질로 복구합니다.
     * @param nodeName 복구할 노드 이름
     */
    public resetHighlight(nodeName: string): void {
        const targetNode = this.getNodeByName(nodeName);
        if (!targetNode) return;

        targetNode.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData.originalMaterial) {
                // 저장해둔 원본 재질로 복구
                child.material = child.userData.originalMaterial;
                // 관리용 데이터 삭제
                delete child.userData.originalMaterial;
            }
        });
    }

    public async moveCameraToUpwardView(nodeName: string, options: CameraMoveOptions = {}): Promise<void> {
        // X를 0으로 설정하여 노드가 가로로 바르게 정렬되도록 하고, 
        // Z를 0으로 설정하여 정면(Front)에서 바라보도록 합니다.
        // Y를 -1로 설정하여 아래에서 위를 바라보는 시점을 유지합니다.
        const upwardDirection = new THREE.Vector3(0, -1, 0).normalize();

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

        if (targetNode) {
            const worldQuaternion = new THREE.Quaternion();
            targetNode.getWorldQuaternion(worldQuaternion);
            const worldEuler = new THREE.Euler().setFromQuaternion(worldQuaternion);
            console.log(`[DEBUG] Node: ${nodeName}`);
            console.log(`[DEBUG] World Rotation (Euler): x=${worldEuler.x}, y=${worldEuler.y}, z=${worldEuler.z}`);

            // 노드의 로컬 축 확인 (디버깅용)
            const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(worldQuaternion);
            console.log(`[DEBUG] World X-Axis of Node:`, localX);
        }

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

        // 2. 제어점(Control Point) 설정: '직선 접근 후 낙하'를 위해 목적지 바로 위(고도 유지)에 배치
        const startPos = camera.position.clone();
        const startTarget = this.cameraControls.target.clone();

        // 1. 목표 지점(End Pos) 및 제어점(Control Pos) 재설정
        const fovRad = (camera.fov * Math.PI) / 180;
        const maxDim = Math.max(size.x, size.y, size.z);
        const zoomDistance = (maxDim / 2) / Math.tan(fovRad / 2) * (options.zoomRatio || 1.2);

        // 목적지 계산: options.direction(0, -1, 0) 반영
        const endPos = targetCenter.clone().add(
            (options.direction || new THREE.Vector3(0, -1, 0)).clone().multiplyScalar(zoomDistance)
        );

        // 안전하게 Bezier 곡선 생성 - 모든 점 검증
        // 시작점과 끝점이 유효한지 확인
        if (!startPos || !endPos || !startPos.isVector3 || !endPos.isVector3) {
            console.error("Invalid camera position or target");
            camera.position.copy(endPos);
            this.cameraControls.target.copy(targetCenter);
            this.cameraControls.update();
            return;
        }

        const distSq = startPos.distanceToSquared(endPos);
        if (distSq < 0.0001) {
            // 직선 이동 fallback
            camera.position.copy(endPos);
            this.cameraControls.target.copy(targetCenter);
            this.cameraControls.update();
            return;
        }

        // [수정] 부드러운 L자형 경로를 위한 제어점 - 완만한 곡선
        // 시작점의 높이를 유지하되, 목적지와의 거리의 1/2 지점을 제어점으로
        const controlPos = new THREE.Vector3(
            (startPos.x + endPos.x) / 2,  // X: 중간 지점
            Math.max(startPos.y, endPos.y) + Math.max(size.y, maxDim) * 0.3, // Y: 약간 올린 위치
            (startPos.z + endPos.z) / 2   // Z: 중간 지점
        );

        // 모든 점이 유효한지 최종 확인
        if (!controlPos.isVector3) {
            console.error("Invalid control point");
            camera.position.copy(endPos);
            this.cameraControls.target.copy(targetCenter);
            this.cameraControls.update();
            return;
        }

        const cinematicCurve = new THREE.QuadraticBezierCurve3(
            startPos.clone(),
            controlPos.clone(),
            endPos.clone()
        );

        // [수정] 애니메이션 시작 전 UP 벡터 리셋 - Orbit 회전 방지
        camera.up.set(0, 1, 0);

        // 2. 애니메이션 실행
        const originalDamping = this.cameraControls.enableDamping;
        const originalSmoothTime = this.cameraControls.smoothTime;
        this.cameraControls.enableDamping = false; // 보간 충돌 방지를 위해 댐핑 일시 중지
        this.cameraControls.smoothTime = 0; // smoothTime도 0으로 설정하여 즉시 반응

        // [수정] 노드의 월드 회전 상태를 한 번만 계산 (성능 최적화)
        const nodeQuat = new THREE.Quaternion();
        if (targetNode) {
            targetNode.getWorldQuaternion(nodeQuat);
        }
        // 노드의 로컬 Y축을 월드 좌표로 변환 (카메라가 노드를 가로로 보도록 정렬)
        const nodeY = new THREE.Vector3(0, 1, 0).applyQuaternion(nodeQuat);

        await animate(
            (progress: number, eased: number) => {
                // [수정] 동일한 이징 적용 - 불일치 문제 해결
                // smoothstep 이징 (3t^2 - 2t^3) 사용 - Quintic보다 부드럽고 자연스러움
                const smoothProgress = eased; // animate에서 이미 이징된 값 사용
                const point = cinematicCurve.getPoint(smoothProgress);

                // 카메라 위치 이동
                camera.position.copy(point);

                /**
                 * [수정] UP 벡터 전환 - 초기에 자연스럽게 전환, 급격한 변화 방지
                 * - 초기부터 점진적으로 전환하여 마지막 순간 급격한 회전 방지
                 * - 완전한 직각은 애니메이션 종료 후에만 설정
                 */
                if (options.direction && Math.abs(options.direction.y) > 0.8 && targetNode) {
                    // 실제 시선 방향 계산 (타겟 중심 - 현재 카메라 위치)
                    const lookDir = new THREE.Vector3()
                        .subVectors(targetCenter, camera.position)
                        .normalize();

                    // [수정] UP 벡터 = 시선방향 × 노드Y (순서 변경으로 올바른 방향 설정)
                    // 노드가 가로로 바르게 보이도록 방향 조정
                    let calculatedUp = new THREE.Vector3()
                        .crossVectors(lookDir, nodeY)
                        .normalize();

                    // 방향 검증: UP 벡터가 아래를 향하면 반전
                    if (calculatedUp.y < 0) {
                        calculatedUp.negate();
                    }

                    // [핵심] 초기부터 점진적 UP 벡터 전환 (0% ~ 100% 전체 구간)
                    // 마지막 순간 급격한 회전을 피하고 자연스럽게 전환
                    const easeTransition = 1 - Math.pow(1 - smoothProgress, 3); // Cubic ease-out
                    const finalUp = new THREE.Vector3(0, 1, 0).lerp(calculatedUp, easeTransition);

                    camera.up.copy(finalUp);
                } else {
                    camera.up.set(0, 1, 0);
                }

                // 시선은 타겟 중심에 동일한 이징으로 고정
                this.cameraControls.target.lerpVectors(startTarget, targetCenter, smoothProgress);

                // camera-controls 라이브러리에 변경사항 반영
                this.cameraControls.update();
            },
            {},
            {
                duration: options.duration || 2500,
                easing: (t: number) => t // 내부에서 dropProgress로 직접 조절하므로 linear 유지
            }
        );

        // [수정] 애니메이션 종료 후 최종 UP 벡터 강제 설정
        // 애니메이션 중에는 자연스럽게 전환하고, 종료 시점에 완전한 로우 앵글 적용
        if (options.direction && Math.abs(options.direction.y) > 0.8 && targetNode) {
            const lookDir = new THREE.Vector3()
                .subVectors(targetCenter, camera.position)
                .normalize();

            // [수정] UP 벡터 = 시선방향 × 노드Y (순서 변경으로 올바른 방향 설정)
            let calculatedUp = new THREE.Vector3()
                .crossVectors(lookDir, nodeY)
                .normalize();

            if (calculatedUp.y < 0) {
                calculatedUp.negate();
            }

            // 종료 시점에 완전한 UP 벡터 적용 (시각적 피드백을 위해)
            camera.up.copy(calculatedUp);
            this.cameraControls.target.copy(targetCenter); // 타겟도 정확히 중앙으로 설정
            this.cameraControls.update();
        }

        this.cameraControls.enableDamping = originalDamping;
        this.cameraControls.smoothTime = originalSmoothTime;
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
        // 대상 노드를 하이라이트 처리
        this.applyHighlight(LEFT_DOOR_DAMPER_NODE_NAME);
    }
}
