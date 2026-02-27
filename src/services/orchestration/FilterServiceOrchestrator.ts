import * as THREE from 'three';
import { getFilterAnimationService } from '../animation/FilterAnimationService';

/**
 * [Common] 필터 클릭 이벤트 처리를 담당하는 오케스트레이터
 * PanelDrawerServiceOrchestrator 패턴을 따름
 */
export class FilterServiceOrchestrator {
    private filterAnimationService = getFilterAnimationService();

    /**
     * 클릭된 객체가 필터 관련 노드인지 확인하고 토글 애니메이션 실행
     * @param clickedObject 클릭된 Three.js 객체
     * @returns 필터 토글 애니메이션이 실행된 경우 true, 아니면 false
     */
    public handleFilterClick(clickedObject: THREE.Object3D): boolean {
        const { handle: handleName, coverAssembly: assemblyName, coverFilter: filterName } = this.filterAnimationService.getFilterNodeNames();
        
        if (!handleName && !assemblyName && !filterName) {
            return false;
        }

        const targetNames = [handleName, assemblyName, filterName].filter(Boolean) as string[];

        // 부모 노드까지 순회하며 필터 관련 노드 확인
        let current: THREE.Object3D | null = clickedObject;
        while (current) {
            if (targetNames.includes(current.name)) {
                this.filterAnimationService.toggleFilters();
                return true;
            }
            current = current.parent;
        }
        return false;
    }
}

// 싱글톤 인스턴스
let filterServiceOrchestrator: FilterServiceOrchestrator | null = null;

/**
 * FilterServiceOrchestrator singleton 인스턴스 반환
 */
export const getFilterServiceOrchestrator = (): FilterServiceOrchestrator => {
    if (!filterServiceOrchestrator) {
        filterServiceOrchestrator = new FilterServiceOrchestrator();
    }
    return filterServiceOrchestrator;
};
