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

    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
        console.log('[DamperAssemblyService] 초기화 완료');
    }

    /**
     * 댐퍼 어셈블리 노드의 홈 부분을 식별하고 하이라이트 효과를 적용합니다.
     */
    public highlightDamperGroove(): void {
        if (!this.sceneRoot) return;

        // 1. 대상 노드 및 하위 Mesh 확보
        let damperMesh: THREE.Mesh | null = null;
        const damperNode = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_ASSEMBLY_NODE);
        damperNode?.traverse((child) => {
            if (child instanceof THREE.Mesh) damperMesh = child;
        });

        if (!damperMesh) return;
        const mesh = damperMesh as THREE.Mesh;
        const geometry = mesh.geometry;
        if (!geometry) return;

        this.clearHighlights();

        // 2. 바운딩 박스를 통해 부품의 '중앙 영역' 계산
        geometry.computeBoundingBox();
        const localBox = geometry.boundingBox;
        if (!localBox) return;

        const size = new THREE.Vector3();
        localBox.getSize(size);
        const center = new THREE.Vector3();
        localBox.getCenter(center);

        // [수정] 안쪽 홈을 결정하는 로직: 
        // X, Z축 기준 전체 너비의 중앙 30% 영역 안에 있고, Y축 기준 상단에 위치한 엣지만 추출
        const innerBoundX = size.x * 0.15; // 중앙으로부터 좌우 15% (총 30%)
        const innerBoundZ = size.z * 0.15; // 중앙으로부터 앞뒤 15% (총 30%)

        const edgesGeom = new THREE.EdgesGeometry(geometry, 25);
        const posAttr = edgesGeom.attributes.position;
        const filteredPositions: number[] = [];

        for (let i = 0; i < posAttr.count; i += 2) {
            const v1 = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            const v2 = new THREE.Vector3(posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1));

            // [핵심 필터] 정점이 중앙 구역(Inner)에 포함되는지 확인
            const isInsideX = Math.abs(v1.x - center.x) < innerBoundX;
            const isInsideZ = Math.abs(v1.z - center.z) < innerBoundZ;
            const isUpperHalf = v1.y > center.y; // 부품의 상단 절반 영역

            if (isInsideX && isInsideZ && isUpperHalf) {
                filteredPositions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
            }
        }

        // 3. 필터링된 결과가 있을 때만 메쉬 생성
        if (filteredPositions.length > 0) {
            const filteredGeom = new THREE.BufferGeometry();
            filteredGeom.setAttribute('position', new THREE.Float32BufferAttribute(filteredPositions, 3));
            const lineMat = new THREE.LineBasicMaterial({
                color: 0xff0000,
                transparent: true,
                depthTest: false, // 안쪽 홈이 겉면에 가려지지 않게 함
                opacity: 0.8
            });
            const line = new THREE.LineSegments(filteredGeom, lineMat);

            // mesh의 월드 매트릭스를 line에 적용
            line.position.copy(mesh.position);
            line.rotation.copy(mesh.rotation);
            line.scale.copy(mesh.scale);
            line.updateMatrixWorld(true);

            this.activeHighlights = [line];
            this.sceneRoot!.add(line);

            gsap.to(lineMat, { opacity: 0.1, duration: 0.8, repeat: -1, yoyo: true });
        } else {
            console.warn("안쪽 홈 영역에서 엣지를 찾지 못했습니다. 범위를 조정하십시오.");
        }
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
    }

    public dispose(): void {
        this.clearHighlights();
        this.sceneRoot = null;
        console.log('[DamperAssemblyService] 서비스 정리 완료');
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
