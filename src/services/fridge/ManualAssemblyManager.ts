import * as THREE from 'three';
import gsap from 'gsap';
import { PartAssemblyService } from './PartAssemblyService';
import {
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
    DAMPER_COVER_SLOT_OFFSET
} from '../../shared/utils/fridgeConstants';
import { getDamperAssemblyService } from '../fridge/DamperAssemblyService';
import { StencilOutlineHighlight } from '../../shared/utils/StencilOutlineHighlight';
import { getMetadataLoader } from '../../shared/utils/MetadataLoader';
import { GrooveDetectionUtils } from '../../shared/utils/GrooveDetectionUtils';

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

    /**
     * 카메라 컨트롤 설정
     * @param cameraControls OrbitControls 또는 CameraControls 객체
     */
    public setCameraControls(cameraControls: any): void {
        this.cameraControls = cameraControls;
    }

    /**
     * 서비스 초기화
     * @param sceneRoot 3D 씬의 루트 노드
     */
    public initialize(sceneRoot: THREE.Object3D, cameraControls?: any): void {
        this.sceneRoot = sceneRoot;
        this.cameraControls = cameraControls || null;
        this.partAssemblyService = new PartAssemblyService(sceneRoot);

        // DamperAssemblyService도 초기화해야 함
        const damperService = getDamperAssemblyService();
        damperService.initialize(sceneRoot);

        console.log('[ManualAssemblyManager] 초기화 완료');
    }

    /**
     * 조립 준비
     * 대상 노드를 목표 위치로 이동시킵니다.
     */
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
                    slotOffset: DAMPER_COVER_SLOT_OFFSET, // 슬롯 오프셋 적용
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

    /**
     * 조립 진행률 업데이트
     * 애니메이션 진행 중 상태를 업데이트합니다.
     */
    public updateManualProgress(progress: number): void {
        this.assemblyProgress = Math.max(0, Math.min(1, progress));
        console.log(`[ManualAssemblyManager] 진행률 업데이트: ${(this.assemblyProgress * 100).toFixed(1)}%`);
    }

    /**
     * 분해 (원래 위치로 복귀)
     */
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

    /**
     * 현재 진행률 반환
     */
    public getProgress(): number {
        return this.assemblyProgress;
    }

    /**
     * 애니메이션 재생 중인지 확인
     */
    public isPlaying(): boolean {
        return this.isAssemblyPlaying;
    }

    /**
     * 서비스 정리
     */
    public dispose(): void {
        this.partAssemblyService?.dispose();
        this.partAssemblyService = null;
        this.sceneRoot = null;
        this.assemblyProgress = 0;
        this.isAssemblyPlaying = false;
        console.log('[ManualAssemblyManager] 서비스 정리 완료');
    }

    /**
     * 댐퍼 커버 조립 (Bounding Box & Offset + Metadata Mapping 방식)
     * 더미 노드가 없는 경우, Bounding Box 기반으로 홈을 식별하고 Metadata의 오프셋을 적용합니다.
     * @param options 조립 옵션
     * @param _camera 카메라 객체 (선택사항, 제공되지 않으면 자동 탐색) - 현재 미사용
     */
    public async assembleDamperCover(
        options?: {
            duration?: number;
            onComplete?: () => void;
        },
        _camera?: THREE.Camera
    ): Promise<void> {
        if (!this.sceneRoot) return;

        console.log('[ManualAssemblyManager] 댐퍼 커버 조립 시작');

        try {
            // 1. 노드 확보
            const damperAssembly = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_ASSEMBLY_NODE); // 분홍색 (Target)
            const damperCover = this.sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_COVER_BODY_NODE);   // 녹색 (Moving Part)

            if (!damperAssembly || !damperCover) {
                console.error('[Error] 필수 노드를 찾을 수 없습니다.');
                return;
            }

            // 2. 메타데이터 및 설정 로드
            const metadataLoader = getMetadataLoader();
            const config = await metadataLoader.loadAssemblyConfig('damper_cover_assembly');

            // [중요] 초기 오프셋을 0으로 설정하여 정확한 위치로 가는지 먼저 확인 권장
            // Z값이 크면 부품이 타겟의 로컬 축 방향(아래일 수 있음)으로 날아갑니다.
            const insertionOffset = config?.insertion.offset || new THREE.Vector3(0, 0, 0);
            console.log('[ManualAssemblyManager] 적용된 오프셋:', insertionOffset);

            // 3. 바운딩 박스의 중심점을 기준점으로 계산 (세부 위치는 오프셋으로 조정)
            const grooveCenter = GrooveDetectionUtils.calculateGrooveCenterByBoundingBox(
                damperAssembly,
                config?.grooveDetection.innerBoundRatio || 0.3
            );
            console.log('grooveCenter>> ', grooveCenter);
            if (!grooveCenter) {
                console.error('홈 중심점을 계산할 수 없습니다.');
                return;
            }

            // --- [시각적 디버깅용 붉은 구체 생성] ---
            // 이 구체가 분홍색 노드 중앙에 생기는지 확인하세요. 엉뚱한 곳에 있다면 GrooveUtils 문제.

            const debugRadius = 0.0005; // 모델 크기에 맞춰 0.01 ~ 0.05 사이로 조정해 보세요.
            const debugGeom = new THREE.SphereGeometry(debugRadius, 16, 16);

            const debugMat = new THREE.MeshBasicMaterial({
                color: 0x800080,
                depthTest: false,
                transparent: true,
                opacity: 0.8
            });

            const debugSphere = new THREE.Mesh(debugGeom, debugMat);
            debugSphere.position.copy(grooveCenter);
            debugSphere.renderOrder = 999;

            this.sceneRoot.add(debugSphere);
            console.log('디버깅용 붉은 구체 생성됨:', grooveCenter);

            // ------------------------------------

            // 4. 타겟 위치 계산 (World Space)
            // 타겟(분홍색)의 회전값을 가져와 오프셋에 적용
            const targetWorldQuat = new THREE.Quaternion();
            damperAssembly.getWorldQuaternion(targetWorldQuat);

            const rotatedOffset = insertionOffset.clone().applyQuaternion(targetWorldQuat);
            const targetWorldPos = grooveCenter.clone().add(rotatedOffset);

            // 5. 로컬 좌표 변환 (World -> Local)
            const targetLocalPos = targetWorldPos.clone();

            if (damperCover.parent) {
                // [보정] 부모의 월드 행렬을 최신화한 후 좌표 변환 수행
                damperCover.parent.updateMatrixWorld(true);

                // 위치 변환: Three.js 내장 메서드 사용 (가장 안전)
                damperCover.parent.worldToLocal(targetLocalPos);
            }

            // 6. 애니메이션 실행 (GSAP)
            const duration = options?.duration || 1500;

            await new Promise<void>((resolve) => {
                // 위치 이동만 수행 (회전 애니메이션 제거)
                gsap.to(damperCover.position, {
                    x: targetLocalPos.x,
                    y: targetLocalPos.y,
                    // z: targetLocalPos.z,
                    duration: duration / 1000,
                    ease: "power2.inOut",
                    onComplete: () => {
                        console.log('[ManualAssemblyManager] 조립 완료');
                        options?.onComplete?.();
                        resolve();
                    }
                });
            });

        } catch (error) {
            console.error('[Error] 조립 로직 실패:', error);
        }
    }
}

// 싱글톤 인스턴스 (전역에서 사용 가능)
let manualAssemblyManagerInstance: ManualAssemblyManager | null = null;

/**
 * 싱글톤 인스턴스 가져오기
 */
export function getManualAssemblyManager(): ManualAssemblyManager {
    if (!manualAssemblyManagerInstance) {
        manualAssemblyManagerInstance = new ManualAssemblyManager();
    }
    return manualAssemblyManagerInstance;
}

/**
 * 조립 준비 함수 (간편 호출용)
 */
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

/**
 * 진행률 업데이트 함수 (간편 호출용)
 */
export function updateManualProgress(progress: number): void {
    const manager = getManualAssemblyManager();
    manager.updateManualProgress(progress);
}

/**
 * 분해 함수 (간편 호출용)
 */
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

/**
 * [New] 외부에서 호출 가능한 조립 함수 export
 * @param duration 애니메이션 지속 시간
 * @param camera 카메라 객체 (선택사항)
 */
export async function runDamperAssembly(duration: number = 1500, camera?: THREE.Camera): Promise<void> {
    const manager = getManualAssemblyManager();
    await manager.assembleDamperCover({ duration }, camera);
}
