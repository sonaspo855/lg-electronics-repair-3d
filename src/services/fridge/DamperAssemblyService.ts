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
        if (!this.sceneRoot) {
            console.error('[DamperDebug] sceneRoot가 초기화되지 않았습니다.');
            return;
        }

        // 1. 노드 탐색 및 디버깅 로그
        const targetNode = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_ASSEMBLY_NODE);

        if (!targetNode) {
            console.warn(`[DamperDebug] 노드를 찾을 수 없음: ${LEFT_DOOR_DAMPER_ASSEMBLY_NODE}`);
            // 현재 씬의 모든 노드 이름을 출력하여 실제 이름을 확인해봅니다.
            this.sceneRoot.traverse(n => { if (n.name.includes('DAMPER')) console.log('검색된 유사 노드:', n.name); });
            return;
        }

        console.log(`[DamperDebug] 노드 발견: ${targetNode.name}`, targetNode);

        // 2. 로컬 바운딩 박스 계산 (sample.ts 방식 적용)
        const mesh = targetNode as THREE.Mesh;
        if (!mesh.geometry) return;

        mesh.geometry.computeBoundingBox();
        const localBox = mesh.geometry.boundingBox!;
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        localBox.getCenter(center);
        localBox.getSize(size);

        console.log(`[DamperDebug] 로컬 좌표 정보 - Center:`, center, `Size:`, size);

        // 3. 디버그 시각화 생성 (녹색 박스: 선택된 노드 전체 영역)
        const debugBoxGeom = new THREE.BoxGeometry(size.x, size.y, size.z);
        const debugBox = new THREE.Mesh(debugBoxGeom, new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.3 }));

        // 4. 홈(Groove) 테두리 생성 (노란색)
        const innerWidth = size.x * 0.3;
        const innerDepth = size.z * 0.3;
        const grooveGeom = new THREE.PlaneGeometry(innerWidth, innerDepth);
        const grooveBorder = new THREE.LineSegments(
            new THREE.EdgesGeometry(grooveGeom),
            new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 })
        );

        // 5. 중심점 표시 (빨간색 구)
        const centerMarker = new THREE.Mesh(new THREE.SphereGeometry(size.x * 0.05), new THREE.MeshBasicMaterial({ color: 0xff0000 }));

        // 6. 모든 객체에 월드 좌표계 적용 (가장 중요)
        [debugBox, grooveBorder, centerMarker].forEach(obj => {
            obj.position.copy(center);
            if (obj === grooveBorder) {
                obj.rotation.x = -Math.PI / 2;
                obj.position.y += size.y / 2 + 0.001; // 상단 표면 배치
            }
            obj.applyMatrix4(mesh.matrixWorld); // 부모의 변환 정보를 그대로 적용
            this.sceneRoot?.add(obj);
            this.debugObjects.push(obj);
        });

        console.log('[DamperDebug] 시각화 객체 3종(박스, 테두리, 점)이 씬에 추가되었습니다.');
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
