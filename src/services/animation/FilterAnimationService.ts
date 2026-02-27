import * as THREE from 'three';
import gsap from 'gsap';
import { NodeNameLoader } from '../data/NodeNameLoader';
import { getMetadataLoader, FilterAnimationConfig } from '../data/MetadataLoader';
import { getNodeNameManager } from '../data/NodeNameManager';

/**
 * [Common] 드럼 세탁기 필터(내부/외부) 분리 애니메이션을 담당하는 서비스 클래스
 * PanelDrawerAnimationService 패턴을 따르는 선형 이동 애니메이션
 */
export class FilterAnimationService {
    private static instance: FilterAnimationService | null = null;
    private sceneRoot: THREE.Object3D | null = null;
    private timeline: gsap.core.Timeline | null = null;
    private originalPositions: Map<string, THREE.Vector3> = new Map();
    private isDisassembled: boolean = false;
    private loader = NodeNameLoader.getInstance();
    private metadataLoader = getMetadataLoader();
    private isMetadataInitialized: boolean = false;

    /** 노드 이름 캐싱: 중복 호출 방지 */
    private filterNodeNames: { external: string | null; internal: string | null } | null = null;

    /** 애니메이션 설정 캐싱 */
    private externalFilterConfig: FilterAnimationConfig | null = null;
    private internalFilterConfig: FilterAnimationConfig | null = null;

    private constructor() {
        this.initializeMetadata();
    }

    /**
     * 메타데이터 초기화
     */
    public initializeMetadata(): void {
        if (this.isMetadataInitialized) {
            return;
        }

        const metadataPath = '/metadata/washing-metadata.json';
        const nodeNameManager = getNodeNameManager();
        nodeNameManager.enableMetadataMode();

        this.metadataLoader.initialize(metadataPath);
        this.isMetadataInitialized = true;
    }

    /**
     * 필터 노드 이름 가져오기
     */
    public getFilterNodeNames(): { external: string | null; internal: string | null } {
        if (!this.filterNodeNames) {
            this.filterNodeNames = {
                external: this.loader.getNodeName('drumWashing.plateTopIntExtFilter.plateTopExternalFilter'),
                internal: this.loader.getNodeName('drumWashing.plateTopIntExtFilter.plateTopInternalFilter')
            };
        }
        return this.filterNodeNames;
    }

    /**
     * 외부 필터 애니메이션 설정 반환
     */
    public getExternalFilterConfig(): FilterAnimationConfig | null {
        if (!this.externalFilterConfig) {
            if (!this.isMetadataInitialized) this.initializeMetadata();
            this.externalFilterConfig = this.metadataLoader.getFilterAnimationConfig('externalFilter');
        }
        return this.externalFilterConfig;
    }

    /**
     * 내부 필터 애니메이션 설정 반환
     */
    public getInternalFilterConfig(): FilterAnimationConfig | null {
        if (!this.internalFilterConfig) {
            if (!this.isMetadataInitialized) this.initializeMetadata();
            this.internalFilterConfig = this.metadataLoader.getFilterAnimationConfig('internalFilter');
        }
        return this.internalFilterConfig;
    }

    /**
     * 싱글톤 인스턴스 가져오기
     */
    public static getInstance(): FilterAnimationService {
        if (!FilterAnimationService.instance) {
            FilterAnimationService.instance = new FilterAnimationService();
        }
        return FilterAnimationService.instance;
    }

    /**
     * 서비스 상태 초기화
     */
    public resetState(): void {
        this.filterNodeNames = null;
        this.externalFilterConfig = null;
        this.internalFilterConfig = null;
        this.originalPositions.clear();
        this.isDisassembled = false;
    }

    /**
     * Scene Root를 설정
     */
    public setSceneRoot(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
        this.resetState();
    }

    /**
     * 필터 분리 함수 (토글)
     */
    public async toggleFilters(): Promise<void> {
        if (this.isDisassembled) {
            await this.assembleFilters();
        } else {
            await this.disassembleFilters();
        }
    }

    /**
     * 필터 분리 애니메이션 (외부 → 내부 순서)
     */
    public async disassembleFilters(): Promise<void> {
        if (!this.sceneRoot || this.isDisassembled) return;

        const { external: externalName, internal: internalName } = this.getFilterNodeNames();
        const externalBaseNode = externalName ? this.sceneRoot.getObjectByName(externalName) : null;
        const internalBaseNode = internalName ? this.sceneRoot.getObjectByName(internalName) : null;

        if (!externalBaseNode || !internalBaseNode) {
            console.error('필터 노드를 찾을 수 없습니다.');
            return;
        }

        // [수정] 노드 자체가 아니라 부모(그룹)를 타겟으로 설정
        // 보통 BRep_... 노드는 메시이며, 그 부모가 전체 그룹임
        const externalNode = externalBaseNode.parent || externalBaseNode;
        const internalNode = internalBaseNode.parent || internalBaseNode;

        // 원래 위치 저장
        if (this.originalPositions.size === 0) {
            this.originalPositions.set(externalNode.name, externalNode.position.clone());
            this.originalPositions.set(internalNode.name, internalNode.position.clone());
        }

        const externalConfig = this.getExternalFilterConfig();
        const internalConfig = this.getInternalFilterConfig();

        this.timeline = gsap.timeline({
            onComplete: () => {
                this.isDisassembled = true;
            }
        });

        // 1. 외부 필터 분리
        if (externalConfig) {
            this.animateNode(externalNode, externalConfig, 0);
        }

        // 2. 내부 필터 분리 (약간의 간격 후)
        if (internalConfig) {
            this.animateNode(internalNode, internalConfig, 0.3);
        }
    }

    /**
     * 필터 조립 애니메이션 (내부 → 외부 역순)
     */
    public async assembleFilters(): Promise<void> {
        if (!this.sceneRoot || !this.isDisassembled) return;

        const { external: externalName, internal: internalName } = this.getFilterNodeNames();
        const externalBaseNode = externalName ? this.sceneRoot.getObjectByName(externalName) : null;
        const internalBaseNode = internalName ? this.sceneRoot.getObjectByName(internalName) : null;

        if (!externalBaseNode || !internalBaseNode) return;

        // [수정] 부모(그룹)를 타겟으로 설정
        const externalNode = externalBaseNode.parent || externalBaseNode;
        const internalNode = internalBaseNode.parent || internalBaseNode;

        this.timeline = gsap.timeline({
            onComplete: () => {
                this.isDisassembled = false;
            }
        });

        // 1. 내부 필터 조립
        const internalPos = this.originalPositions.get(internalNode.name);
        if (internalPos) {
            const config = this.getInternalFilterConfig();
            this.timeline.to(internalNode.position, {
                x: internalPos.x,
                y: internalPos.y,
                z: internalPos.z,
                duration: (config?.duration ?? 1000) / 1000,
                ease: config?.easing ?? 'power2.out'
            }, 0);
        }

        // 2. 외부 필터 조립 (약간의 간격 후)
        const externalPos = this.originalPositions.get(externalNode.name);
        if (externalPos) {
            const config = this.getExternalFilterConfig();
            this.timeline.to(externalNode.position, {
                x: externalPos.x,
                y: externalPos.y,
                z: externalPos.z,
                duration: (config?.duration ?? 1000) / 1000,
                ease: config?.easing ?? 'power2.out'
            }, 0.3);
        }
    }

    /**
     * 노드 애니메이션 수행 유틸리티
     */
    private animateNode(node: THREE.Object3D, config: FilterAnimationConfig, startTime: number): void {
        const direction = config.direction 
            ? new THREE.Vector3(config.direction.x, config.direction.y, config.direction.z)
            : new THREE.Vector3(0, 0, 1);
        const offset = direction.multiplyScalar(config.pullDistance);

        node.updateMatrixWorld();
        const worldTargetPosition = node.localToWorld(offset.clone());
        const localTargetPosition = worldTargetPosition.clone();
        if (node.parent) {
            node.parent.updateMatrixWorld();
            node.parent.worldToLocal(localTargetPosition);
        }

        this.timeline!.to(node.position, {
            x: localTargetPosition.x,
            y: localTargetPosition.y,
            z: localTargetPosition.z,
            duration: config.duration / 1000,
            ease: config.easing
        }, startTime);
    }
}

/**
 * 편의를 위한 싱글톤 인스턴스 가져오기 헬퍼 함수
 */
export function getFilterAnimationService(): FilterAnimationService {
    return FilterAnimationService.getInstance();
}
