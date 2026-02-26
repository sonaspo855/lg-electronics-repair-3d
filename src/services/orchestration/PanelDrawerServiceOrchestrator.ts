import * as THREE from 'three';
import { getPanelDrawerAnimationService } from '../animation/PanelDrawerAnimationService';
import { getMetadataLoader } from '../data/MetadataLoader';
import { getNodeNameManager } from '../data/NodeNameManager';

/**
 * Panel Drawer 선택 및 애니메이션 오케스트레이션을 담당하는 서비스 클래스
 * 
 * SelectionHandler에서 분리된 세제함(Panel Drawer) 체크 로직을 담당
 */
export class PanelDrawerServiceOrchestrator {
    private panelDrawerAnimationService = getPanelDrawerAnimationService();
    private metadataLoader = getMetadataLoader();

    constructor() {
        // 메타데이터 전역 초기화
        this.initializeMetadata();
    }

    /**
     * 메타데이터 전역 초기화
     */
    private initializeMetadata(): void {
        // 기본 메타데이터 경로 설정
        let metadataPath = '/metadata/assembly-offsets.json';

        // NodeName 메타데이터 미리 로드 (DamperAssemblyService 참고)
        const nodeNameManager = getNodeNameManager();
        nodeNameManager.enableMetadataMode();

        // 메타데이터 초기화
        this.metadataLoader.initialize(metadataPath);
        console.log('메타데이터 전역 초기화 완료');
    }

    /**
     * 클릭된 객체가 세제함(Panel Drawer)인지 확인하고 토글 애니메이션 실행
     * @param clickedObject 클릭된 Three.js 객체
     * @returns 세제함 토글 애니메이션이 실행된 경우 true, 否则 false
     */
    public handleDrawerClick(clickedObject: THREE.Object3D): boolean {
        // 세제함 노드 이름 추출
        const { assembly: drawerAssemblyName, drawer: drawerName } = this.panelDrawerAnimationService.getDrawerNodeNames();

        if (!drawerName && !drawerAssemblyName) {
            console.warn('세제함 노드 이름이 메타데이터에 없습니다.');
            return false;
        }

        // 클릭된 객체 또는 부모 중에 drawerName이나 drawerAssemblyName이 있는지 확인
        let current: THREE.Object3D | null = clickedObject;

        let isDrawer = false;
        while (current) {
            if ((drawerName && current.name === drawerName) || (drawerAssemblyName && current.name === drawerAssemblyName)) {
                isDrawer = true;
                break;
            }
            current = current.parent;
        }

        if (isDrawer) {
            console.log('세제함 클릭됨 - 토글 애니메이션 실행');
            this.panelDrawerAnimationService.toggleDrawer();
            return true;
        }

        return false;
    }

}

// 싱글톤 인스턴스
let panelDrawerServiceOrchestrator: PanelDrawerServiceOrchestrator | null = null;

/**
 * PanelDrawerServiceOrchestrator singleton 인스턴스 반환
 */
export const getPanelDrawerServiceOrchestrator = (): PanelDrawerServiceOrchestrator => {
    if (!panelDrawerServiceOrchestrator) {
        panelDrawerServiceOrchestrator = new PanelDrawerServiceOrchestrator();
    }
    return panelDrawerServiceOrchestrator;
};
