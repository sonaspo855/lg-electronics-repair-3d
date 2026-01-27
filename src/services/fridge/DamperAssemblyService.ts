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
    private activeHighlights: THREE.Object3D[] = [];
    private debugObjects: THREE.Object3D[] = [];

    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
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
        if (!this.sceneRoot) return;

        // 1. 원본 메쉬의 월드 매트릭스 업데이트
        originalMesh.updateMatrixWorld(true);

        // 2. 메쉬 클론 (안쪽 홈 부분 하이라이트용)
        const highlightMesh = originalMesh.clone();

        // 월드 좌표를 유지하기 위해 matrixWorld 적용
        highlightMesh.applyMatrix4(originalMesh.matrixWorld);

        // 3. 안쪽 홈 하이라이트용 재질 설정 (Stencil Buffer 사용)
        const highlightMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
            stencilWrite: true,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilRef: 1,
            stencilZPass: THREE.ReplaceStencilOp
        });

        highlightMesh.material = highlightMaterial;

        // 4. Outline 메쉬 생성 (BackSide 렌더링으로 외곽선 효과)
        const outlineMesh = originalMesh.clone();
        outlineMesh.applyMatrix4(originalMesh.matrixWorld);

        // 스케일을 약간 확대하여 외곽선 효과 생성
        outlineMesh.scale.multiplyScalar(1.03);

        // Outline용 재질 설정 (BackSide만 렌더링)
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            side: THREE.BackSide,
            depthTest: false,
            depthWrite: false,
            stencilWrite: true,
            stencilFunc: THREE.EqualStencilFunc,
            stencilRef: 1,
            stencilFail: THREE.KeepStencilOp,
            stencilZFail: THREE.KeepStencilOp,
            stencilZPass: THREE.KeepStencilOp
        });

        outlineMesh.material = outlineMaterial;

        // 5. 렌더링 순서 보장
        highlightMesh.renderOrder = 998;
        outlineMesh.renderOrder = 999;

        // 6. 애니메이션 추가 (하이라이트와 아웃라인 동시에)
        gsap.to(highlightMaterial, {
            opacity: 0.3,
            duration: 1.0,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });

        gsap.to(outlineMaterial, {
            opacity: 0.4,
            duration: 1.0,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });

        this.activeHighlights.push(highlightMesh, outlineMesh);

        // sceneRoot에 추가
        this.sceneRoot.add(highlightMesh);
        this.sceneRoot.add(outlineMesh);

        // [디버그] 추가 여부 확인
        console.log('[DamperAssemblyService] Stencil/Outline 하이라이트 추가됨:', {
            highlightMesh: highlightMesh.name,
            outlineMesh: outlineMesh.name,
            position: highlightMesh.position,
            scale: highlightMesh.scale
        });
    }

    /**
     * 댐퍼 어셈블리의 정면(XY) 홈 영역을 분석하여 시각화합니다.
     * EdgesGeometry를 사용하여 홈 부분(급격한 각도 변화가 있는 모서리)만 하이라이트합니다.
     */
    public highlightDamperGroove(): void {
        console.log('highlightDamperGroove!!!');
        if (!this.sceneRoot) return;

        const targetNode = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_ASSEMBLY_NODE);
        if (!targetNode) return;

        this.clearHighlights();

        // EdgesGeometry를 사용하여 홈 부분만 하이라이트
        const grooveHighlights = createGrooveHighlight(targetNode, 0xffff00, 15);

        // 하이라이트 라인들을 씬에 추가
        grooveHighlights.forEach((lineSegments) => {
            this.activeHighlights.push(lineSegments);
            this.sceneRoot!.add(lineSegments);

            // GSAP 애니메이션 추가 (맥동 효과)
            gsap.to(lineSegments.material, {
                opacity: 0.3,
                duration: 1.0,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
            });
        });

        console.log('[LG CNS] EdgesGeometry 기반 홈 하이라이트 완료:', {
            highlightCount: grooveHighlights.length
        });
    }

    /**
     * 적용된 모든 하이라이트를 제거합니다.
     */
    public clearHighlights(): void {
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
