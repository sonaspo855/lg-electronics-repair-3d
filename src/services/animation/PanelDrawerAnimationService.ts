import * as THREE from 'three';
import gsap from 'gsap';
import { NodeNameLoader } from '../data/NodeNameLoader';
import { getMetadataLoader, PanelDrawerAnimationConfig } from '../data/MetadataLoader';

/**
 * 드럼 세탁기 세제함(Panel Drawer) 분리 애니메이션을 담당하는 서비스 클래스
 */
export class PanelDrawerAnimationService {
    private static instance: PanelDrawerAnimationService | null = null;
    private sceneRoot: THREE.Object3D | null = null;
    private timeline: gsap.core.Timeline | null = null;
    private originalPositions: Map<string, THREE.Vector3> = new Map();
    private isDisassembled: boolean = false;
    private loader = NodeNameLoader.getInstance();
    private metadataLoader = getMetadataLoader();

    /** 노드 이름 캐싱: 중복 호출 방지 */
    private drawerNodeNames: { assembly: string | null; drawer: string | null } | null = null;

    /** 애니메이션 설정 캐싱 */
    private animationConfig: PanelDrawerAnimationConfig | null = null;

    private constructor() { }

    /**
     * 캐싱된 노드 이름 반환
     * 최초 1회만 NodeNameLoader를 호출하고 이후에는 캐싱된 값을 사용
     */
    public getDrawerNodeNames(): { assembly: string | null; drawer: string | null } {
        if (!this.drawerNodeNames) {
            this.drawerNodeNames = {
                assembly: this.loader.getNodeName('drumWashing.detergentStorageParts.drawerAssembly'),
                drawer: this.loader.getNodeName('drumWashing.detergentStorageParts.drawer')
            };
        }
        return this.drawerNodeNames;
    }

    /**
     * 캐싱된 애니메이션 설정 반환
     * 최초 1회만 MetadataLoader를 호출하고 이후에는 캐싱된 값을 사용
     */
    public getAnimationConfig(): PanelDrawerAnimationConfig | null {
        if (!this.animationConfig) {
            this.animationConfig = this.metadataLoader.getPanelDrawerAnimationConfig('drawerPullOut');
        }
        return this.animationConfig;
    }

    /**
     * 싱글톤 인스턴스 가져오기
     */
    public static getInstance(): PanelDrawerAnimationService {
        if (!PanelDrawerAnimationService.instance) {
            PanelDrawerAnimationService.instance = new PanelDrawerAnimationService();
        }
        return PanelDrawerAnimationService.instance;
    }

    /**
     * Scene Root를 설정
     * @param sceneRoot Three.js Scene Root 객체
     */
    public setSceneRoot(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
    }

    /**
     * 세제함 분리 함수
     */
    public async toggleDrawer(): Promise<void> {
        if (this.isDisassembled) {
            await this.assembleDrawer();  // 세제함을 원래 위치로 복구
        } else {
            await this.disassembleDrawer();  // 세제함을 당겨서 분리
        }
    }

    /**
     * 세제함을 당겨서 분리하는 애니메이션 실행
     * @param options 애니메이션 옵션 (duration: ms, pullDistance: 단위 이동거리)
     */
    public async disassembleDrawer(): Promise<void> {
        console.log('disassembleDrawer!!!');

        return new Promise<void>((resolve, reject) => {
            if (!this.sceneRoot) {
                console.error('Scene Root가 설정되지 않았습니다. setSceneRoot()를 먼저 호출해주세요.');
                reject(new Error('Scene Root is not set'));
                return;
            }

            if (this.isDisassembled) {
                console.warn('세제함이 이미 분리되어 있습니다.');
                resolve();
                return;
            }

            // 메타데이터에서 애니메이션 설정 로드
            const config = this.getAnimationConfig();

            const metadataDuration = config?.duration ?? 0;
            const metadataPullDistance = config?.pullDistance ?? 0;
            const metadataEasing = config?.easing ?? 'power2.out';
            const metadataDirection = config?.direction
                ? new THREE.Vector3(config.direction.x, config.direction.y, config.direction.z)
                : new THREE.Vector3(0, -1, 0);

            // 사용자 옵션이 있으면 메타데이터 값을 덮어씀
            const duration = metadataDuration;
            const pullDistance = metadataPullDistance;

            const { assembly: drawerAssemblyName, drawer: drawerName } = this.getDrawerNodeNames();

            const targetNodeNames = [drawerAssemblyName, drawerName].filter(Boolean) as string[];

            if (targetNodeNames.length === 0) {
                console.error('세제함 노드 이름들을 가져오지 못했습니다.');
                reject(new Error('Drawer node names not found in metadata'));
                return;
            }

            const targetNodes: THREE.Object3D[] = [];
            targetNodeNames.forEach(name => {
                const node = this.sceneRoot!.getObjectByName(name);
                if (node) targetNodes.push(node);
            });

            if (targetNodes.length === 0) {
                console.error(`세제함 노드들을 씬에서 찾을 수 없습니다: ${targetNodeNames.join(', ')}`);
                reject(new Error('Drawer nodes not found in scene'));
                return;
            }

            // 1. 원래 위치 저장
            if (this.originalPositions.size === 0) {
                targetNodes.forEach(node => {
                    this.originalPositions.set(node.name, node.position.clone());
                });
            }

            // 3. GSAP 애니메이션 실행
            this.timeline = gsap.timeline({
                onStart: () => {
                    console.log('세제함 분리 애니메이션 시작');
                },
                onComplete: () => {
                    console.log('세제함 분리 완료');
                    this.isDisassembled = true;
                    resolve();
                }
            });

            targetNodes.forEach(node => {
                const direction = metadataDirection.clone();
                const offset = direction.multiplyScalar(pullDistance);  // drawerAssembly 노드 뒤로 빼내는 방향

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
                    duration: duration / 1000,
                    ease: metadataEasing
                }, 0);
            });
        });
    }

    /**
     * 세제함을 원래 위치로 조립(복구)하는 애니메이션 실행
     * @param options 애니메이션 옵션 (duration: ms)
     */
    public async assembleDrawer(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.sceneRoot) {
                console.error('[Assembly] Scene Root가 설정되지 않았습니다.');
                reject(new Error('Scene Root is not set'));
                return;
            }

            if (!this.isDisassembled) {
                console.warn('[Assembly] 세제함이 이미 조립되어 있습니다.');
                resolve();
                return;
            }

            // 메타데이터에서 애니메이션 설정 로드
            const config = this.getAnimationConfig();
            const metadataDuration = config?.duration ?? 1500;
            const metadataEasing = config?.easing ?? 'power2.out';

            // 사용자 옵션이 있으면 메타데이터 값을 덮어씀
            const duration = metadataDuration;

            // 캐싱된 노드 이름 사용
            const { assembly: drawerAssemblyName, drawer: drawerName } = this.getDrawerNodeNames();

            const targetNodeNames = [drawerAssemblyName, drawerName].filter(Boolean) as string[];
            const targetNodes: THREE.Object3D[] = [];
            targetNodeNames.forEach(name => {
                const node = this.sceneRoot!.getObjectByName(name);
                if (node) targetNodes.push(node);
            });

            if (targetNodes.length === 0) {
                console.warn('[Assembly] 조립할 세제함 노드를 찾을 수 없습니다.');
                this.isDisassembled = false;
                resolve();
                return;
            }

            this.timeline = gsap.timeline({
                onStart: () => {
                    console.log('세제함 조립 애니메이션 시작');
                },
                onComplete: () => {
                    console.log('세제함 조립 완료');
                    this.isDisassembled = false;
                    resolve();
                }
            });

            targetNodes.forEach(node => {
                const originalPos = this.originalPositions.get(node.name);
                if (originalPos) {
                    this.timeline!.to(node.position, {
                        x: originalPos.x,
                        y: originalPos.y,
                        z: originalPos.z,
                        duration: duration / 1000,
                        ease: metadataEasing
                    }, 0);
                }
            });
        });
    }
}

/**
 * 편의를 위한 싱글톤 인스턴스 가져오기 헬퍼 함수
 */
export function getPanelDrawerAnimationService(): PanelDrawerAnimationService {
    return PanelDrawerAnimationService.getInstance();
}
