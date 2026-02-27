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
    private filterNodeNames: { handle: string | null; coverAssembly: string | null; coverFilter: string | null } | null = null;

    /** 애니메이션 설정 캐싱 */
    private handleConfig: FilterAnimationConfig | null = null;
    private coverConfig: FilterAnimationConfig | null = null;

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
     * 필터 관련 노드 이름 가져오기
     */
    public getFilterNodeNames(): { handle: string | null; coverAssembly: string | null; coverFilter: string | null } {
        if (!this.filterNodeNames) {
            this.filterNodeNames = {
                handle: this.loader.getNodeName('drumWashing.plateTopIntExtFilter.HandleAssembly'),
                coverAssembly: this.loader.getNodeName('drumWashing.plateTopIntExtFilter.CoverAssembly'),
                coverFilter: this.loader.getNodeName('drumWashing.plateTopIntExtFilter.CoverFilter')
            };
        }
        return this.filterNodeNames;
    }

    /**
     * 핸들 누르기 애니메이션 설정 반환
     */
    public getHandleConfig(): FilterAnimationConfig | null {
        if (!this.handleConfig) {
            if (!this.isMetadataInitialized) this.initializeMetadata();
            this.handleConfig = this.metadataLoader.getFilterAnimationConfig('handlePress');
        }
        return this.handleConfig;
    }

    /**
     * 커버 분리 애니메이션 설정 반환
     */
    public getCoverConfig(): FilterAnimationConfig | null {
        if (!this.coverConfig) {
            if (!this.isMetadataInitialized) this.initializeMetadata();
            this.coverConfig = this.metadataLoader.getFilterAnimationConfig('coverDisassembly');
        }
        return this.coverConfig;
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
        this.handleConfig = null;
        this.coverConfig = null;
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
     * 필터 분리 애니메이션
     * 1. HandleAssembly 누르기 (Press)
     * 2. CoverAssembly 및 CoverFilter 그룹화하여 분리
     */
    public async disassembleFilters(): Promise<void> {
        if (!this.sceneRoot || this.isDisassembled) return;

        const { handle: handleName, coverAssembly: assemblyName, coverFilter: filterName } = this.getFilterNodeNames();

        const handleNode = handleName ? this.sceneRoot.getObjectByName(handleName) : null;
        const assemblyNode = assemblyName ? this.sceneRoot.getObjectByName(assemblyName) : null;
        const filterNode = filterName ? this.sceneRoot.getObjectByName(filterName) : null;

        if (!handleNode || !assemblyNode || !filterNode) {
            console.error('필터 관련 노드를 찾을 수 없습니다.');
            return;
        }

        // 원래 위치 저장
        if (this.originalPositions.size === 0) {
            this.originalPositions.set(handleNode.name, handleNode.position.clone());
            this.originalPositions.set(assemblyNode.name, assemblyNode.position.clone());
            this.originalPositions.set(filterNode.name, filterNode.position.clone());
        }

        const handleConfig = this.getHandleConfig();
        const coverConfig = this.getCoverConfig();

        this.timeline = gsap.timeline({
            onComplete: () => {
                this.isDisassembled = true;
            }
        });

        // 1. HandleAssembly 누르기 (들어갔다 나옴)
        if (handleConfig) {
            const pressDirection = new THREE.Vector3(handleConfig.direction?.x, handleConfig.direction?.y, handleConfig.direction?.z);
            const pressOffset = pressDirection.multiplyScalar(handleConfig.pullDistance);

            const originalPos = this.originalPositions.get(handleNode.name)!;
            const pressedPos = originalPos.clone().add(pressOffset);

            this.timeline.to(handleNode.position, {
                x: pressedPos.x,
                y: pressedPos.y,
                z: pressedPos.z,
                duration: (handleConfig.duration / 2) / 1000,
                ease: "power2.in"
            });

            this.timeline.to(handleNode.position, {
                x: originalPos.x,
                y: originalPos.y,
                z: originalPos.z,
                duration: (handleConfig.duration / 2) / 1000,
                ease: "power2.out"
            });
        }

        // 2. CoverAssembly 및 CoverFilter 분리 (그룹화하여 동시 이동)
        if (coverConfig) {
            const nodes = [assemblyNode, filterNode];
            const startTime = ">"; // 핸들 애니메이션 종료 후 즉시 시작

            nodes.forEach(node => {
                const direction = new THREE.Vector3(coverConfig.direction?.x, coverConfig.direction?.y, coverConfig.direction?.z);
                const offset = direction.multiplyScalar(coverConfig.pullDistance);

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
                    duration: coverConfig.duration / 1000,
                    ease: coverConfig.easing
                }, startTime);
            });
        }
    }

    /**
     * 필터 조립 애니메이션 (역순)
     */
    public async assembleFilters(): Promise<void> {
        if (!this.sceneRoot || !this.isDisassembled) return;

        const { handle: handleName, coverAssembly: assemblyName, coverFilter: filterName } = this.getFilterNodeNames();
        const handleNode = handleName ? this.sceneRoot.getObjectByName(handleName) : null;
        const assemblyNode = assemblyName ? this.sceneRoot.getObjectByName(assemblyName) : null;
        const filterNode = filterName ? this.sceneRoot.getObjectByName(filterName) : null;

        if (!handleNode || !assemblyNode || !filterNode) return;

        const handleConfig = this.getHandleConfig();
        const coverConfig = this.getCoverConfig();

        this.timeline = gsap.timeline({
            onComplete: () => {
                this.isDisassembled = false;
            }
        });

        // 1. 커버들 조립 (먼저 복귀)
        const nodes = [assemblyNode, filterNode];
        nodes.forEach(node => {
            const originalPos = this.originalPositions.get(node.name);
            if (originalPos) {
                this.timeline!.to(node.position, {
                    x: originalPos.x,
                    y: originalPos.y,
                    z: originalPos.z,
                    duration: (coverConfig?.duration ?? 1000) / 1000,
                    ease: coverConfig?.easing ?? "power2.inOut"
                }, 0);
            }
        });

        // 2. HandleAssembly 누르기 피드백 (조립 완료 후)
        if (handleConfig) {
            const pressDirection = new THREE.Vector3(handleConfig.direction?.x, handleConfig.direction?.y, handleConfig.direction?.z);
            const pressOffset = pressDirection.multiplyScalar(handleConfig.pullDistance);

            const originalPos = this.originalPositions.get(handleNode.name)!;
            const pressedPos = originalPos.clone().add(pressOffset);

            this.timeline.to(handleNode.position, {
                x: pressedPos.x,
                y: pressedPos.y,
                z: pressedPos.z,
                duration: (handleConfig.duration / 2) / 1000,
                ease: "power2.in"
            }, ">");

            this.timeline.to(handleNode.position, {
                x: originalPos.x,
                y: originalPos.y,
                z: originalPos.z,
                duration: (handleConfig.duration / 2) / 1000,
                ease: "power2.out"
            });
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
