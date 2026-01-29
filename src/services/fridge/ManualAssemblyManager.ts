import * as THREE from 'three';
import gsap from 'gsap';
import { PartAssemblyService } from './PartAssemblyService';
import {
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
    DAMPER_COVER_SLOT_OFFSET
} from '../../shared/utils/fridgeConstants';
import { getDamperAssemblyService } from '../fridge/DamperAssemblyService';
import { getMetadataLoader } from '../../shared/utils/MetadataLoader';
import { GrooveDetectionUtils } from '../../shared/utils/GrooveDetectionUtils';
import { NormalBasedHighlight } from '../../shared/utils/NormalBasedHighlight';

/**
 * 수동 조립 관리자
 * 조립/분해 관련 함수를 중앙 집중식 관리
 */
export class ManualAssemblyManager {
    private partAssemblyService: PartAssemblyService | null = null;
    private sceneRoot: THREE.Object3D | null = null;
    private cameraControls: any = null;
    private assemblyProgress: number = 0;
    private isAssemblyPlaying: boolean = false;

    private debugObjects: THREE.Object3D[] = [];

    public setCameraControls(cameraControls: any): void {
        this.cameraControls = cameraControls;
    }

    public initialize(sceneRoot: THREE.Object3D, cameraControls?: any): void {
        this.sceneRoot = sceneRoot;
        this.cameraControls = cameraControls || null;
        this.partAssemblyService = new PartAssemblyService(sceneRoot);

        const damperService = getDamperAssemblyService();
        damperService.initialize(sceneRoot);

        console.log('[ManualAssemblyManager] 초기화 완료');
    }

    public async prepareManualAssembly(options?: {
        duration?: number;
        snapThreshold?: number;
        onProgress?: (progress: number) => void;
        onComplete?: () => void;
    }): Promise<void> {
        if (!this.partAssemblyService || !this.sceneRoot) {
            throw new Error('[ManualAssemblyManager] 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
        }

        console.log('[ManualAssemblyManager] 조립 준비 시작');
        this.isAssemblyPlaying = true;

        try {
            await this.partAssemblyService.animateLinearAssembly(
                LEFT_DOOR_DAMPER_COVER_BODY_NODE,
                LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
                {
                    duration: options?.duration || 2500,
                    slotOffset: DAMPER_COVER_SLOT_OFFSET,
                    onProgress: (progress) => {
                        this.assemblyProgress = progress;
                        options?.onProgress?.(progress);
                    },
                    onComplete: () => {
                        console.log('[ManualAssemblyManager] 조립 완료');
                        this.isAssemblyPlaying = false;
                        this.assemblyProgress = 1;
                        options?.onComplete?.();
                    }
                }
            );
        } catch (error) {
            console.error('[ManualAssemblyManager] 조립 실패:', error);
            this.isAssemblyPlaying = false;
            throw error;
        }
    }

    public updateManualProgress(progress: number): void {
        this.assemblyProgress = Math.max(0, Math.min(1, progress));
        console.log(`[ManualAssemblyManager] 진행률 업데이트: ${(this.assemblyProgress * 100).toFixed(1)}%`);
    }

    public async disassembleDamperCover(options?: {
        duration?: number;
        onComplete?: () => void;
    }): Promise<void> {
        if (!this.partAssemblyService) {
            throw new Error('[ManualAssemblyManager] 초기화되지 않았습니다.');
        }

        console.log('[ManualAssemblyManager] 분해 시작');
        this.isAssemblyPlaying = true;

        try {
            await this.partAssemblyService.disassemblePart(
                LEFT_DOOR_DAMPER_COVER_BODY_NODE,
                {
                    duration: options?.duration || 1500,
                    onComplete: () => {
                        console.log('[ManualAssemblyManager] 분해 완료');
                        this.isAssemblyPlaying = false;
                        this.assemblyProgress = 0;
                        options?.onComplete?.();
                    }
                }
            );
        } catch (error) {
            console.error('[ManualAssemblyManager] 분해 실패:', error);
            this.isAssemblyPlaying = false;
            throw error;
        }
    }

    public getProgress(): number {
        return this.assemblyProgress;
    }

    public isPlaying(): boolean {
        return this.isAssemblyPlaying;
    }

    public dispose(): void {
        this.partAssemblyService?.dispose();
        this.partAssemblyService = null;
        this.sceneRoot = null;
        this.assemblyProgress = 0;
        this.isAssemblyPlaying = false;
        console.log('[ManualAssemblyManager] 서비스 정리 완료');
    }

    private visualizeAssemblyPath(
        startPosition: THREE.Vector3,
        endPosition: THREE.Vector3,
        plugPosition?: THREE.Vector3,
        holePosition?: THREE.Vector3 | THREE.Vector3[]
    ): void {
        this.clearDebugObjects();

        if (!this.sceneRoot) return;
        const ellipse = 0.0005;
        const debugRenderOrder = 999;

        const startGeometry = new THREE.SphereGeometry(ellipse, 16, 16);
        const startMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            depthTest: false,
            depthWrite: false,
            transparent: true
        });
        const startPoint = new THREE.Mesh(startGeometry, startMaterial);
        startPoint.position.copy(startPosition);
        startPoint.renderOrder = debugRenderOrder;
        this.debugObjects.push(startPoint);
        this.sceneRoot.add(startPoint);

        const endGeometry = new THREE.SphereGeometry(ellipse, 16, 16);
        const endMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            depthTest: false,
            depthWrite: false,
            transparent: true
        });
        const endPoint = new THREE.Mesh(endGeometry, endMaterial);
        endPoint.position.copy(endPosition);
        endPoint.renderOrder = debugRenderOrder;
        this.debugObjects.push(endPoint);
        this.sceneRoot.add(endPoint);

        const pathPoints = [startPosition.clone(), endPosition.clone()];
        const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
        const pathMaterial = new THREE.LineDashedMaterial({
            color: 0xffff00,
            dashSize: 0.05,
            gapSize: 0.02,
            linewidth: 2,
            depthTest: false,
            depthWrite: false,
            transparent: true
        });
        const pathLine = new THREE.Line(pathGeometry, pathMaterial);
        pathLine.computeLineDistances();
        pathLine.renderOrder = debugRenderOrder;
        this.debugObjects.push(pathLine);
        this.sceneRoot.add(pathLine);

        if (plugPosition) {
            const plugGeometry = new THREE.SphereGeometry(ellipse, 16, 16);
            const plugMaterial = new THREE.MeshBasicMaterial({
                color: 0x0088ff,
                depthTest: false,
                depthWrite: false,
                transparent: true
            });
            const plugPoint = new THREE.Mesh(plugGeometry, plugMaterial);
            plugPoint.position.copy(plugPosition);
            plugPoint.renderOrder = debugRenderOrder;
            this.debugObjects.push(plugPoint);
            this.sceneRoot.add(plugPoint);

            const plugToStart = new THREE.BufferGeometry().setFromPoints([plugPosition, startPosition]);
            const plugToStartLine = new THREE.Line(
                plugToStart,
                new THREE.LineBasicMaterial({
                    color: 0x0088ff,
                    transparent: true,
                    opacity: 0.5,
                    depthTest: false,
                    depthWrite: false
                })
            );
            plugToStartLine.renderOrder = debugRenderOrder;
            this.debugObjects.push(plugToStartLine);
            this.sceneRoot.add(plugToStartLine);
        }

        if (holePosition && this.sceneRoot) {
            const holePositions = Array.isArray(holePosition) ? holePosition : [holePosition];
            const root = this.sceneRoot;

            holePositions.forEach((hPos) => {
                const holeGeometry = new THREE.SphereGeometry(ellipse, 16, 16);
                const holeMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff00ff,
                    depthTest: false,
                    depthWrite: false,
                    transparent: true
                });
                const holePoint = new THREE.Mesh(holeGeometry, holeMaterial);
                holePoint.position.copy(hPos);
                holePoint.renderOrder = debugRenderOrder;
                this.debugObjects.push(holePoint);
                root.add(holePoint);

                const holeToEnd = new THREE.BufferGeometry().setFromPoints([hPos, endPosition]);
                const holeToEndLine = new THREE.Line(
                    holeToEnd,
                    new THREE.LineBasicMaterial({
                        color: 0xff00ff,
                        transparent: true,
                        opacity: 0.5,
                        depthTest: false,
                        depthWrite: false
                    })
                );
                holeToEndLine.renderOrder = debugRenderOrder;
                this.debugObjects.push(holeToEndLine);
                root.add(holeToEndLine);
            });
        }

        const direction = new THREE.Vector3().subVectors(endPosition, startPosition);
        if (direction.length() > 0.0001 && this.sceneRoot) {
            const arrowHelper = new THREE.ArrowHelper(
                direction.clone().normalize(),
                startPosition,
                direction.length(),
                0xffff00
            );

            arrowHelper.renderOrder = debugRenderOrder;
            const arrowMaterials = [arrowHelper.line.material, arrowHelper.cone.material].flat();
            arrowMaterials.forEach(mat => {
                if (mat instanceof THREE.Material) {
                    mat.depthTest = false;
                    mat.depthWrite = false;
                    mat.transparent = true;
                }
            });

            this.debugObjects.push(arrowHelper);
            this.sceneRoot.add(arrowHelper);
        }

        console.log('[Assembly Debug] 경로 시각화 생성:', {
            시작위치: `(${startPosition.x.toFixed(3)}, ${startPosition.y.toFixed(3)}, ${startPosition.z.toFixed(3)})`,
            종료위치: `(${endPosition.x.toFixed(3)}, ${endPosition.y.toFixed(3)}, ${endPosition.z.toFixed(3)})`,
            돌출부: plugPosition ? `(${plugPosition.x.toFixed(3)}, ${plugPosition.y.toFixed(3)}, ${plugPosition.z.toFixed(3)})` : '없음',
            홈: Array.isArray(holePosition)
                ? `${holePosition.length}개 탐지`
                : (holePosition ? `(${holePosition.x.toFixed(3)}, ${holePosition.y.toFixed(3)}, ${holePosition.z.toFixed(3)})` : '없음'),
            이동거리: direction.length().toFixed(4)
        });
    }

    private clearDebugObjects(): void {
        this.debugObjects.forEach((obj) => {
            this.sceneRoot?.remove(obj);
            if (obj instanceof THREE.Mesh) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material instanceof THREE.Material) obj.material.dispose();
            } else if (obj instanceof THREE.Line || obj instanceof THREE.LineSegments) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material instanceof THREE.Material) obj.material.dispose();
            }
        });
        this.debugObjects = [];
    }

    /**
     * 댐퍼 커버 조립 (메타데이터 기반)
     * 메타데이터가 항상 존재한다고 가정하여 메타데이터 정보로 동작합니다.
     */
    public async assembleDamperCover(
        options?: {
            duration?: number;
            onComplete?: () => void;
        }
    ): Promise<void> {
        console.log('[Assembly] Starting Metadata-based Assembly...');

        if (!this.sceneRoot) {
            console.error('[ManualAssemblyManager] Scene root not initialized.');
            return;
        }

        const coverNode = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_COVER_BODY_NODE) as THREE.Mesh;
        const assemblyNode = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_ASSEMBLY_NODE) as THREE.Mesh;

        if (!coverNode || !assemblyNode) {
            console.error('[ManualAssemblyManager] Target nodes not found for assembly:', {
                coverName: LEFT_DOOR_DAMPER_COVER_BODY_NODE,
                assemblyName: LEFT_DOOR_DAMPER_ASSEMBLY_NODE
            });
            return;
        }

        let targetPosition = new THREE.Vector3();
        let plugWorldPos: THREE.Vector3 | null = null;
        let holeWorldPositions: THREE.Vector3[] = [];

        // 메타데이터 로드
        const metadataLoader = getMetadataLoader();
        const assemblyKey = 'damper_cover_assembly';

        if (!metadataLoader.isLoaded()) {
            try {
                console.log('[Assembly] Loading metadata from /metadata/assembly-offsets.json...');
                await metadataLoader.loadMetadata('/metadata/assembly-offsets.json');
                console.log('[Assembly] Metadata loaded successfully');
            } catch (error) {
                console.error('[Assembly] Metadata loading failed:', error);
                throw new Error('[Assembly] Failed to load metadata');
            }
        }

        const config = metadataLoader.getAssemblyConfig(assemblyKey);
        if (!config) {
            throw new Error(`[Assembly] Config not found for key: ${assemblyKey}`);
        }

        console.log('[Assembly] Applying metadata-based assembly with grooveDetection parameters.');

        const grooveParams = config.grooveDetection;

        // [Cover 분석] 결합 돌출부(Plug) 탐지
        const plugAnalyses = GrooveDetectionUtils.calculatePlugByEdgeAnalysis(
            coverNode,
            grooveParams.plugSearchDirection
                ? new THREE.Vector3(
                    grooveParams.plugSearchDirection.x,
                    grooveParams.plugSearchDirection.y,
                    grooveParams.plugSearchDirection.z
                )
                : new THREE.Vector3(0, -1, 0),
            grooveParams.edgeAngleThreshold ?? 60,
            grooveParams.plugClusteringDistance ?? 0.005
        );

        // [NormalBasedHighlight] 법선 벡터 기반 다중 홈 탐지
        const normalBasedHoleAnalyses = NormalBasedHighlight.calculateMultipleVirtualPivotsByNormalAnalysis(
            assemblyNode,
            grooveParams.normalFilter
                ? new THREE.Vector3(
                    grooveParams.normalFilter.x,
                    grooveParams.normalFilter.y,
                    grooveParams.normalFilter.z
                )
                : new THREE.Vector3(0, 0, 1),
            grooveParams.normalTolerance ?? 0.2,
            grooveParams.holeClusteringDistance ?? 0.005
        );
        console.log('[NormalBasedHighlight] 다중 홈 탐지 결과:', normalBasedHoleAnalyses);

        return;



        // [Assembly 분석] 결합 홈(Hole) 탐지
        const holeAnalysesRaw = GrooveDetectionUtils.calculateMultipleVirtualPivotsByNormalAnalysis(
            assemblyNode,
            grooveParams.normalFilter
                ? new THREE.Vector3(
                    grooveParams.normalFilter.x,
                    grooveParams.normalFilter.y,
                    grooveParams.normalFilter.z
                )
                : new THREE.Vector3(0, 0, 1),
            grooveParams.normalTolerance ?? 0.2,
            grooveParams.holeClusteringDistance ?? 0.005
        );
        console.log('holeAnalysesRaw000>> ', holeAnalysesRaw);

        const holeAnalyses = holeAnalysesRaw.filter(analysis =>
            analysis.filteredVerticesCount < (grooveParams.maxVerticesThreshold ?? 2000)
        );
        console.log('holeAnalyses111>>> ', holeAnalyses);


        if (plugAnalyses.length > 0 && holeAnalyses.length > 0) {
            console.log(`[Assembly] Vertex Analysis success. Plug: ${plugAnalyses.length}, Hole: ${holeAnalyses.length}`);

            const validPlugs = plugAnalyses.filter(p => p.filteredVerticesCount < 2000);
            const primaryPlug = validPlugs.length > 0
                ? validPlugs.sort((a, b) => b.position.y - a.position.y)[0]
                : plugAnalyses[0];

            plugWorldPos = primaryPlug.position;
            holeWorldPositions = holeAnalyses.map(a => a.position);

            const primaryHoleWorldPos = holeWorldPositions.sort((a, b) => {
                const distA = a.distanceTo(plugWorldPos!);
                const distB = b.distanceTo(plugWorldPos!);
                return distA - distB;
            })[0];

            const moveDelta = new THREE.Vector3().subVectors(primaryHoleWorldPos, plugWorldPos);
            const currentCoverPos = coverNode.position.clone();
            targetPosition.addVectors(currentCoverPos, moveDelta);
        } else {
            throw new Error('[Assembly] Vertex analysis failed. No plug or hole detected.');
        }

        const currentCoverWorldPos = new THREE.Vector3();
        coverNode.getWorldPosition(currentCoverWorldPos);

        const targetWorldPos = new THREE.Vector3();
        if (coverNode.parent) {
            coverNode.parent.localToWorld(targetWorldPos.copy(targetPosition));
        } else {
            targetWorldPos.copy(targetPosition);
        }

        this.visualizeAssemblyPath(
            currentCoverWorldPos,
            targetWorldPos,
            plugWorldPos || undefined,
            holeWorldPositions.length > 0 ? holeWorldPositions : undefined
        );

        return new Promise((resolve) => {
            this.isAssemblyPlaying = true;

            gsap.to(coverNode.position, {
                x: targetPosition.x,
                y: targetPosition.y,
                z: targetPosition.z,
                duration: options?.duration || (config.animation?.duration ? config.animation.duration / 1000 : 1.5),
                ease: config.animation?.easing || 'power2.inOut',
                onComplete: () => {
                    this.clearDebugObjects();
                    this.isAssemblyPlaying = false;
                    console.log('[Assembly] Completed using metadata');
                    if (options?.onComplete) options.onComplete();
                    resolve();
                }
            });
        });
    }
}

let manualAssemblyManagerInstance: ManualAssemblyManager | null = null;

export function getManualAssemblyManager(): ManualAssemblyManager {
    if (!manualAssemblyManagerInstance) {
        manualAssemblyManagerInstance = new ManualAssemblyManager();
    }
    return manualAssemblyManagerInstance;
}

export async function prepareManualAssembly(
    sceneRoot: THREE.Object3D,
    options?: {
        duration?: number;
        snapThreshold?: number;
        onProgress?: (progress: number) => void;
        onComplete?: () => void;
    }
): Promise<void> {
    const manager = getManualAssemblyManager();
    manager.initialize(sceneRoot);
    await manager.prepareManualAssembly(options);
}

export function updateManualProgress(progress: number): void {
    const manager = getManualAssemblyManager();
    manager.updateManualProgress(progress);
}

export async function disassembleDamperCover(
    sceneRoot: THREE.Object3D,
    options?: {
        duration?: number;
        onComplete?: () => void;
    }
): Promise<void> {
    const manager = getManualAssemblyManager();
    manager.initialize(sceneRoot);
    await manager.disassembleDamperCover(options);
}

export async function runDamperAssembly(duration: number = 1500): Promise<void> {
    const manager = getManualAssemblyManager();
    await manager.assembleDamperCover({ duration });
}
