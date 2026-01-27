import * as THREE from 'three';
import gsap from 'gsap';
import { LEFT_DOOR_DAMPER_ASSEMBLY_NODE } from '../../shared/utils/fridgeConstants';
import { NormalBasedHighlight } from '../../shared/utils/NormalBasedHighlight';
import { StencilOutlineHighlight } from '../../shared/utils/StencilOutlineHighlight';

/**
 * 댐퍼 조립 서비스 (轻型版 - 조립 기능은 ManualAssemblyManager로 이동됨)
 * 이 파일은 단일 getter 함수만 유지
 */

// 싱글톤 인스턴스 (전역에서 사용 가능)
let damperAssemblyServiceInstance: DamperAssemblyService | null = null;

/**
 * 댐퍼 조립 서비스 클래스
 * 조립/분해 기능은 ManualAssemblyManager.ts로 이동됨
 */
export class DamperAssemblyService {
    // 조립 관련 기능은 ManualAssemblyManager로 이동됨
    // 이 클래스는 간단한 상태 관리만 담당
    private sceneRoot: THREE.Object3D | null = null;
    private activeHighlights: THREE.Object3D[] = [];
    private debugObjects: THREE.Object3D[] = [];

    // 하이라이트 컴포넌트들
    private normalHighlight: NormalBasedHighlight | null = null;
    private stencilHighlight: StencilOutlineHighlight | null = null;

    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;

        // 하이라이트 컴포넌트들 초기화
        this.normalHighlight = new NormalBasedHighlight();
        this.normalHighlight.initialize(sceneRoot);

        this.stencilHighlight = new StencilOutlineHighlight();
        this.stencilHighlight.initialize(sceneRoot);

        console.log('[DamperAssemblyService] 초기화 완료');
    }

    // DamperAssemblyService.ts 내 highlightDamperGroove 또는 addDebugPlane 수정 부분

    private addDebugPlane(
        center: THREE.Vector3, // 이 center는 localBox 기반의 로컬 좌표입니다.
        width: number,
        height: number,
        faceColor: number,
        edgeOpacity: number,
        isSmallGroove: boolean,
        targetMesh: THREE.Mesh // [수정] 부모 메쉬의 MatrixWorld를 적용하기 위해 추가
    ): void {
        if (!this.sceneRoot) return;

        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
            color: faceColor,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthTest: false // 다른 물체에 가려지지 않게 설정
        });

        const planeMesh = new THREE.Mesh(geometry, material);

        // [중요 1] 로컬 좌표를 월드 좌표로 변환
        // 단순히 position.copy(center)만 하면 안 되고, 부모의 matrixWorld를 곱해야 합니다.
        planeMesh.position.copy(center);

        // [중요 2] Z-축 오프셋 추가
        // 모델의 면과 겹쳐서 깜빡이는 현상(Z-fighting)을 방지하기 위해 정면으로 살짝 밀어줍니다.
        planeMesh.position.z += 0.005;

        // 부모 메쉬의 월드 행렬을 적용하여 정확한 위치와 회전값 설정
        planeMesh.applyMatrix4(targetMesh.matrixWorld);

        // 2. 테두리 (EdgesGeometry)
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: faceColor,
            transparent: true,
            opacity: edgeOpacity,
            depthTest: false
        });
        const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);

        // 테두리도 면과 동일한 위치/회전 적용
        edges.position.copy(planeMesh.position);
        edges.quaternion.copy(planeMesh.quaternion);
        edges.scale.copy(planeMesh.scale);

        // [애니메이션 로직은 기존과 동일]
        if (isSmallGroove) {
            gsap.to([material, edgesMaterial], {
                opacity: 0.8,
                duration: 0.6,
                repeat: -1,
                yoyo: true,
                ease: "power2.inOut"
            });
        }

        this.debugObjects.push(planeMesh, edges);
        this.sceneRoot.add(planeMesh);
        this.sceneRoot.add(edges);
    }

    /**
     * [핵심 로직] 메쉬를 클론하고 Outline Shader/Stencil Buffer 방식을 사용하여
     * 노드의 안쪽 홈 부분을 하이라이트합니다.
     */
    private createGrooveMeshHighlight(originalMesh: THREE.Mesh, color: number): void {
        if (!this.sceneRoot || !this.stencilHighlight) return;

        this.stencilHighlight.createSingleMeshCloneHighlight(originalMesh, color);
    }

    /**
     * [신규] 카메라를 기준으로 가장 먼저 보이는 면(가장 가까운 면)만
     * 정밀하게 하이라이트합니다. Raycaster를 사용하여 교차점을 계산합니다.
     * @param camera 카메라 객체
     */
    public highlightClosestFace(camera: THREE.Camera): void {
        console.log('highlightClosestFace - 카메라 기준 가장 가까운 면');
        if (!this.sceneRoot || !this.stencilHighlight) return;

        const targetNode = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_ASSEMBLY_NODE);
        if (!targetNode) return;

        this.clearHighlights();

        // 카메라 필터링 + 메쉬 클론 + Stencil Buffer 방식 사용
        this.stencilHighlight.createGrooveMeshHighlightWithCameraFilter(
            targetNode,
            camera,
            0xff6600,  // 주황색
            15         // thresholdAngle: 15도
        );

        console.log('[LG CNS] 가장 가까운 면 하이라이트 완료');
    }

    /**
     * [신규] 메쉬 클론 + Outline Shader/Stencil Buffer 방식으로
     * 댐퍼 어셈블리의 정면(XY) 홈 영역을 정밀하게 하이라이트합니다.
     * 법선 벡터 기반 필터링으로 홈 내부 굴곡을 따라 정밀하게 하이라이트합니다.
     */
    public highlightDamperGroove(): void {
        console.log('highlightDamperGroove - Mesh Clone + Stencil Buffer 방식');
        if (!this.sceneRoot || !this.stencilHighlight) return;

        const targetNode = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_ASSEMBLY_NODE);
        if (!targetNode) return;

        this.clearHighlights();

        // [신규] 법선 필터링 + 메쉬 클론 + Stencil Buffer 방식 사용
        this.stencilHighlight.createGrooveMeshHighlightWithNormalFilter(
            targetNode,
            0xff00ff,  // 마젠타 색상
            15,        // thresholdAngle: 15도 이상 각도 변화가 있는 모서리
            new THREE.Vector3(0, 0, 1),  // Z축 방향 법선 필터링
            0.2        // normalTolerance: 20% 허용 오차
        );

        console.log('[LG CNS] 메쉬 클론 + Stencil Buffer 기반 홈 하이라이트 완료');
    }

    /**
     * 법선 벡터(Normal Vector) 기반 필터링을 사용하여 카메라를 향하는 면만 하이라이트합니다.
     */
    public highlightDamperFacesByNormal(camera: THREE.Camera, color: number = 0xff0000): void {
        if (!this.sceneRoot || !this.normalHighlight) return;

        const targetNode = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_ASSEMBLY_NODE);
        if (!(targetNode instanceof THREE.Mesh)) return;

        this.clearHighlights();
        this.normalHighlight.highlightFacesByNormal(targetNode, camera, color);
    }

    /**
     * 적용된 모든 하이라이트를 제거합니다.
     */
    public clearHighlights(): void {
        // 컴포넌트들의 하이라이트 정리
        this.normalHighlight?.clearHighlights();
        this.stencilHighlight?.clearHighlights();

        // 기존 하이라이트들 정리 (하위 호환성)
        this.activeHighlights.forEach((obj) => {
            if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
                gsap.killTweensOf(obj.material);
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material instanceof THREE.Material) obj.material.dispose();
            }
            this.sceneRoot?.remove(obj);
        });
        this.activeHighlights = [];

        // 디버그 객체들도 제거
        this.debugObjects.forEach((obj) => {
            this.sceneRoot?.remove(obj);
            if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material instanceof THREE.Material) obj.material.dispose();
            }
        });
        this.debugObjects = [];
    }

    /**
     * [시각화] 바운딩 박스 중앙 영역 및 innerBound 범위를 디버그용으로 시각화
     * PlaneGeometry와 EdgesGeometry를 조합하여 노드의 안쪽 홈 테두리 시각화
     */
    private createDebugVisualizations(
        mesh: THREE.Mesh,
        localBox: THREE.Box3,
        center: THREE.Vector3,
        size: THREE.Vector3,
        innerBoundX: number,
        innerBoundZ: number,
        grooveCenter?: THREE.Vector3
    ): void {
        // 디버그 객체 먼저 정리
        this.debugObjects.forEach((obj) => this.sceneRoot?.remove(obj));
        this.debugObjects = [];

        // mesh의 월드 매트릭스 업데이트
        mesh.updateMatrixWorld(true);

        // 1. 전체 바운딩 박스 (BoxGeometry + EdgesGeometry)
        const boxGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        this.createPlaneWithEdges(boxGeometry, 0x00ff00, 0.1, 0.5, center, mesh);

        // 2. innerBound 영역 (XZ 평면 중앙 30%) - PlaneGeometry 사용
        const innerWidth = innerBoundX * 2;
        const innerDepth = innerBoundZ * 2;
        const innerHeight = size.y;

        const innerBoxGeometry = new THREE.BoxGeometry(innerWidth, innerHeight, innerDepth);
        this.createPlaneWithEdges(innerBoxGeometry, 0x0088ff, 0.15, 0.8, center, mesh);

        // 3. 안쪽 홈 중심점 (구 형태) - 월드 좌표로 변환
        const centerRadius = Math.min(size.x, size.y, size.z) * 0.02;
        const centerGeometry = new THREE.SphereGeometry(centerRadius, 16, 16);
        const centerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const centerPoint = new THREE.Mesh(centerGeometry, centerMaterial);

        // targetCenter를 월드 좌표로 변환
        const targetCenterWorld = new THREE.Vector3();
        mesh.localToWorld(targetCenterWorld.copy(grooveCenter || center));
        centerPoint.position.copy(targetCenterWorld);
        centerPoint.updateMatrixWorld(true);

        this.debugObjects.push(centerPoint);
        this.sceneRoot?.add(centerPoint);

        // 4. innerBound 경계면 (PlaneGeometry + EdgesGeometry) - XZ 평면
        const boundaryPlaneGeometry = new THREE.PlaneGeometry(innerWidth, innerDepth);
        this.createPlaneWithEdges(boundaryPlaneGeometry, 0xffff00, 0.0, 0.8,
            new THREE.Vector3(center.x, center.y + size.y / 2, center.z), mesh);

        console.log('[DamperAssemblyService] 디버그 시각화 생성:', {
            전체박스: { size: `(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})` },
            중심점: `(${targetCenterWorld.x.toFixed(2)}, ${targetCenterWorld.y.toFixed(2)}, ${targetCenterWorld.z.toFixed(2)})`,
            innerBoundX: innerBoundX.toFixed(2),
            innerBoundZ: innerBoundZ.toFixed(2)
        });
    }

    /**
     * 지오메트리의 면과 테두리를 시각화하는 헬퍼 메서드
     * PlaneGeometry와 EdgesGeometry를 조합하여 테두리가 있는 평면 생성
     */
    private createPlaneWithEdges(
        geometry: THREE.BufferGeometry,
        faceColor: number,
        faceOpacity: number,
        edgeOpacity: number,
        position: THREE.Vector3,
        mesh: THREE.Mesh
    ): void {
        // 1. 면 (Mesh)
        const material = new THREE.MeshBasicMaterial({
            color: faceColor,
            transparent: true,
            opacity: faceOpacity,
            side: THREE.DoubleSide
        });
        const planeMesh = new THREE.Mesh(geometry, material);
        planeMesh.position.copy(position);
        planeMesh.position.applyMatrix4(mesh.matrixWorld);
        planeMesh.quaternion.copy(mesh.quaternion);
        planeMesh.scale.copy(mesh.scale);
        planeMesh.updateMatrixWorld(true);

        // 2. 테두리 (EdgesGeometry)
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: faceColor,
            transparent: true,
            opacity: edgeOpacity
        });
        const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        edges.position.copy(planeMesh.position);
        edges.quaternion.copy(planeMesh.quaternion);
        edges.scale.copy(planeMesh.scale);
        edges.updateMatrixWorld(true);

        // 씬에 추가
        this.debugObjects.push(planeMesh, edges);
        this.sceneRoot?.add(planeMesh);
        this.sceneRoot?.add(edges);
    }

    public dispose(): void {
        this.clearHighlights();
        this.sceneRoot = null;
        console.log('[DamperAssemblyService] 서비스 정리 완료');
    }

    /**
     * 배열의 중앙값을 계산합니다.
     */
    private getMedian(values: number[]): number {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
}

/**
 * 싱글톤 인스턴스 가져오기
 */
export function getDamperAssemblyService(): DamperAssemblyService {
    if (!damperAssemblyServiceInstance) {
        damperAssemblyServiceInstance = new DamperAssemblyService();
    }
    return damperAssemblyServiceInstance;
}
