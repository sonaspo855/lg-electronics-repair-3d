import * as THREE from 'three';
import gsap from 'gsap';
import { createGrooveHighlight } from '../../shared/utils/commonUtils';
import { LEFT_DOOR_DAMPER_ASSEMBLY_NODE } from '../../shared/utils/fridgeConstants';

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
    private activeHighlights: THREE.LineSegments[] = [];
    private debugObjects: THREE.Object3D[] = [];

    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
        console.log('[DamperAssemblyService] 초기화 완료');
    }

    /**
     * 댐퍼 어셈블리 노드의 홈 부분을 식별하고 하이라이트 효과를 적용합니다.
     */
    public highlightDamperGroove(): void {
        if (!this.sceneRoot) return;

        const targetNode = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_ASSEMBLY_NODE);
        if (!(targetNode instanceof THREE.Mesh)) return;

        const mesh = targetNode;
        mesh.geometry.computeBoundingBox();
        const localBox = mesh.geometry.boundingBox!;
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        localBox.getSize(size);
        localBox.getCenter(center);

        // 1. 정면(XY 평면) 기준 홈 규격 정의
        const leftWidth = size.x * 0.15;  // 왼쪽 작은 홈 폭
        const rightWidth = size.x * 0.25; // 오른쪽 큰 홈 폭
        const grooveHeight = size.y * 0.4; // 정면에서 보이는 홈의 높이

        const createFrontBorder = (width: number, height: number, offsetX: number, offsetY: number, color: number) => {
            const geom = new THREE.PlaneGeometry(width, height);
            const edges = new THREE.EdgesGeometry(geom);
            const material = new THREE.LineBasicMaterial({
                color,
                linewidth: 2,
                depthTest: false, // 모델에 가려지더라도 항상 보이게 설정
                transparent: true,
                opacity: 0.8
            });
            const line = new THREE.LineSegments(edges, material);

            // 렌더링 순서를 높여서 다른 객체보다 위에 그림
            line.renderOrder = 999;

            // 위치 설정: localBox.max.z를 사용하여 확실한 정면에 배치
            line.position.set(
                center.x + offsetX,
                center.y + offsetY,
                localBox.max.z + 0.01 // center.z + size.z/2 보다 정확한 정면 좌표
            );

            line.applyMatrix4(mesh.matrixWorld);
            return line;
        };

        // 2. 위치 값 미세 조정 (이미지 기반: 왼쪽은 중앙에 가깝고, 오른쪽은 끝에 치우침)
        // offsetX 값을 좌우 비대칭으로 조정하여 가시성을 확보합니다.
        const leftGroove = createFrontBorder(leftWidth, grooveHeight, -size.x * 0.15, 0, 0xffff00);
        const rightGroove = createFrontBorder(rightWidth, grooveHeight, size.x * 0.15, 0, 0x00ffff);

        // 3. 씬에 추가 및 관리
        this.sceneRoot.add(leftGroove, rightGroove);
        this.debugObjects.push(leftGroove, rightGroove);

        console.log('[DamperDebug] 정면(XY) 홈 시각화 완료');
    }

    /**
     * 적용된 모든 하이라이트를 제거합니다.
     */
    public clearHighlights(): void {
        this.activeHighlights.forEach((line) => {
            gsap.killTweensOf(line.material);
            this.sceneRoot?.remove(line);
            if (line.geometry) line.geometry.dispose();
            if (line.material instanceof THREE.Material) line.material.dispose();
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
