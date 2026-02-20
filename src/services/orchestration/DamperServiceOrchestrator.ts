import * as THREE from 'three';
import { CameraMovementService } from '../camera/CameraMovementService';
import { AnimationHistoryService } from '../core/AnimationHistoryService';
import { DamperCaseBodyAnimationService } from '../animation/DamperCaseBodyAnimationService';
import { getManualAssemblyManager } from '../assembly/ManualAssemblyManager';
import { getNodeNameManager } from '../data/NodeNameManager';
import { getMetadataLoader } from '../data/MetadataLoader';
import { extractMetadataKey } from '@/shared/utils/commonUtils';
import { AnimationCommand, AnimationAction, DoorType } from '../core/AnimatorAgent';

export class DamperServiceOrchestrator {
    private manualAssemblyManager = getManualAssemblyManager();
    private nodeNameManager = getNodeNameManager();
    private metadataLoader = getMetadataLoader();

    constructor(
        private cameraMovementService: CameraMovementService,
        private animationHistoryService: AnimationHistoryService,
        private damperCaseBodyAnimationService: DamperCaseBodyAnimationService
    ) { }

    /**
     * 애니메이션 히스토리 기록을 위한 공통 메서드
     * @param action 애니메이션 액션 타입
     * @param door 도어 타입
     * @param result 애니메이션 실행 결과 (옵션)
     * @param message 히스토리 메시지
     */
    private recordAnimationHistory(
        action: AnimationAction,
        door: DoorType,
        result?: any,
        message?: string
    ): void {
        const animationCommand: AnimationCommand = {
            door,
            action,
            degrees: result?.degrees !== undefined ? result.degrees : 0,
            duration: result?.duration !== undefined ? result.duration : 0,
            easing: result?.easing !== undefined ? result.easing : '',
            targetPosition: result?.targetPosition || { x: 0, y: 0, z: 0 },
            originalPosition: result?.originalPosition || { x: 0, y: 0, z: 0 },
            position: result?.position || { x: 0, y: 0, z: 0 },
            rotationAngle: result?.rotationAngle !== undefined ? result.rotationAngle : 0,
            rotationAxis: result?.rotationAxis || 'x',
            extractDirection: result?.extractDirection || [0, 0, 0],
            translationDistance: result?.translationDistance !== undefined ? result.translationDistance : 0
        };

        const historyMessage = message || this.getDefaultMessage(action);
        this.animationHistoryService.addAnimationHistory(animationCommand, historyMessage);
        console.log(`Animation history after ${action}:`, this.animationHistoryService.getAllHistory());
    }

    /**
     * 애니메이션 액션에 대한 기본 메시지 반환
     */
    private getDefaultMessage(action: AnimationAction): string {
        const messageMap: Record<AnimationAction, string> = {
            [AnimationAction.OPEN]: '도어 열림 완료',
            [AnimationAction.CLOSE]: '도어 닫힘 완료',
            [AnimationAction.SET_DEGREES]: '도어 각도 설정 완료',
            [AnimationAction.SET_SPEED]: '도어 속도 설정 완료',
            [AnimationAction.CAMERA_MOVE]: '카메라 이동 완료',
            [AnimationAction.DAMPER_COVER_BODY]: '댐퍼 커버 조립 완료',
            [AnimationAction.DAMPER_CASE_BODY_MOVE]: 'damperCaseBody 힌지 반대 방향으로 선형이동 완료',
            [AnimationAction.SCREW_LOOSEN]: '스크류 분리 완료',
            [AnimationAction.SCREW_TIGHTEN]: '스크류 조립 완료',
            [AnimationAction.DAMPER_HOLDER_REMOVAL]: '댐퍼 홀더 제거 완료',
            [AnimationAction.DAMPER_COVER_RESTORE]: '댐퍼 커버 복구 완료'
        };

        return messageMap[action] || '애니메이션 완료';
    }

    async execute(commandsArray: AnimationCommand[]): Promise<void> {
        const screw1NodeName = this.nodeNameManager.getNodeName('fridge.leftDoorDamper.screw1Customized');
        const screw2NodeName = this.nodeNameManager.getNodeName('fridge.leftDoorDamper.screw2Customized');
        const screw1NodePath = 'fridge.leftDoorDamper.screw1Customized';
        const screw2NodePath = 'fridge.leftDoorDamper.screw2Customized';

        try {
            // 메타데이터 선행 로드 보장
            await this.metadataLoader.loadMetadata();

            // 도어 열림 후 댐퍼로 카메라 이동
            await this.moveCamera();

            // 댐퍼 돌출부/홈 결합 애니메이션 실행
            const assemblyResult = await this.assembleDamperCover(commandsArray[0].door);

            // 스크류 분리 애니매이션 실행
            await this.loosenScrews(screw1NodeName, screw2NodeName, screw1NodePath, screw2NodePath);

            // damperCaseBody 힌지 반대 방향으로 선형이동 실행
            await this.moveDamperCaseBody(commandsArray[0].door);

            // 분리된 왼쪽 스크류2 노드의 위치에서 damperCaseBody 방향으로 선형이동
            await this.moveScrew2(screw2NodePath, commandsArray[0].door);

            // 스크류 노드(1,2)를 다시 조이는 코드
            await this.tightenScrews(screw1NodeName, screw2NodeName, screw1NodePath, screw2NodePath);

            return;

            // 댐퍼를 고정했던 홀더를 제거
            await this.removeHolder(commandsArray[0].door);

            // coverNode 댐퍼 커버 노드의 원래 복구 애니메이션
            if (assemblyResult && assemblyResult.originalPosition) {
                await this.restoreDamperCover(assemblyResult.originalPosition, commandsArray[0].door);
            }
        } catch (error) {
            console.error('Error executing damper service orchestrator:', error);
            throw error;
        }
    }

    private async moveCamera(): Promise<void> {
        console.log('Moving camera to left door damper');
        const cameraSettings = this.metadataLoader.getCameraSettings('damperService');

        const cameraOptions: any = {
            duration: cameraSettings?.duration,
            easing: cameraSettings?.easing,
            distance: cameraSettings?.distance
        };

        // direction 설정이 있으면 Vector3로 변환
        if (cameraSettings?.direction) {
            cameraOptions.direction = new THREE.Vector3(
                cameraSettings.direction.x,
                cameraSettings.direction.y,
                cameraSettings.direction.z
            ).normalize();
        }

        await this.cameraMovementService.moveCameraToLeftDoorDamper(cameraOptions);

        this.recordAnimationHistory(
            AnimationAction.CAMERA_MOVE,
            DoorType.TOP_LEFT,
            cameraOptions,
            'Camera moved to damper position'
        );
        console.log('댐퍼 카메라 이동 히스토리:', this.animationHistoryService.getAllHistory());
    }

    private async assembleDamperCover(door: DoorType): Promise<any> {
        // console.log('assembleDamperCover!!!');
        const assemblyResult = await this.manualAssemblyManager.assembleDamperCover();
        console.log('댐퍼 노드 결합 완료!!!');

        if (assemblyResult) {
            this.recordAnimationHistory(
                AnimationAction.DAMPER_COVER_BODY,
                door,
                assemblyResult,
                '댐퍼 노드 결합 완료'
            );
        } else {
            console.warn('Damper cover assembly returned null, skipping history logging');
        }
        console.log('댐퍼 노드 결합 히스토리:', this.animationHistoryService.getAllHistory());
        return assemblyResult;
    }

    private async loosenScrews(
        screw1NodeName: string | null,
        screw2NodeName: string | null,
        screw1NodePath: string,
        screw2NodePath: string
    ): Promise<void> {
        // console.log('loosenScrews!!!');

        // 스크류 1 분리
        if (screw1NodeName) {
            const metadataKey1 = extractMetadataKey(screw1NodePath);
            const config1 = this.metadataLoader.getScrewAnimationConfig(metadataKey1);
            await this.manualAssemblyManager.loosenScrew(screw1NodePath, config1 || {});
            console.log('스크류1 분리 완료!!!');
        }

        // 스크류 2 분리
        if (screw2NodeName) {
            const metadataKey2 = extractMetadataKey(screw2NodePath);
            const config2 = this.metadataLoader.getScrewAnimationConfig(metadataKey2);
            await this.manualAssemblyManager.loosenScrew(screw2NodePath, config2 || {});
            console.log('스크류2 분리 완료!!!');
        }
    }

    private async moveDamperCaseBody(door: DoorType): Promise<any> {
        // console.log('moveDamperCaseBody!!!');

        const animationResult = await this.damperCaseBodyAnimationService.animateDamperCaseBodyLinearMove({
            onComplete: () => {
                console.log('damperCaseBody 힌지 반대 방향으로 선형이동 완료!!!');
            }
        });

        if (animationResult) {
            this.recordAnimationHistory(
                AnimationAction.DAMPER_CASE_BODY_MOVE,
                door,
                animationResult
            );
        } else {
            console.warn('Damper case body animation returned null, skipping history logging');
        }

        console.log('damperCaseBody 힌지 반대 방향으로 선형이동 히스토리:', this.animationHistoryService.getAllHistory());
        return animationResult;
    }

    private async moveScrew2(screw2NodePath: string, door: DoorType): Promise<any> {
        // console.log('moveScrew2!!!');

        const animationResult = await this.manualAssemblyManager.moveScrewLinearToDamperCaseBody(screw2NodePath, {
            onComplete: () => {
                console.log('스크류2 damperCaseBody 방향 선형 이동 완료!!!');
            }
        });

        // console.log('animationResult>>> ', animationResult);

        if (animationResult) {
            this.recordAnimationHistory(
                AnimationAction.SCREW_LOOSEN,
                door,
                animationResult,
                '스크류2 오른쪽 방향 선형 이동 완료'
            );
        } else {
            console.warn('스크류2 선형 이동 애니메이션이 null을 반환했습니다.');
        }

        console.log('스크류2 오른쪽 방향 선형 이동 히스토리:', this.animationHistoryService.getAllHistory());
        return animationResult;
    }

    private async tightenScrews(
        screw1NodeName: string | null,
        screw2NodeName: string | null,
        screw1NodePath: string,
        screw2NodePath: string
    ): Promise<void> {
        console.log('tightenScrews!!!');

        // 왼쪽 스크류 1 조립 (회전+이동 역방향)
        if (screw1NodeName) {
            const metadataKey1 = extractMetadataKey(screw1NodePath);
            console.log('metadataKey1>>> ', metadataKey1);
            const config1 = this.metadataLoader.getScrewAnimationConfig(metadataKey1);
            await this.manualAssemblyManager.tightenScrew(screw1NodePath, config1 || {});
            console.log('Left screw 1 tightened');
        }

        // 왼쪽 스크류 2 조립 (회전+이동 역방향) - 선형 이동한 위치에서 조립
        if (screw2NodeName) {
            const metadataKey2 = extractMetadataKey(screw2NodePath);
            const config2 = this.metadataLoader.getScrewAnimationConfig(metadataKey2);
            await this.manualAssemblyManager.tightenScrew(screw2NodePath, config2 || {});
            console.log('Left screw 2 tightened');
        }

        console.log('스크류 조립 애니메이션 완료!!!');
    }

    private async removeHolder(door: DoorType): Promise<any> {
        console.log('Removing damper holder');

        const removeResult = await this.manualAssemblyManager.removeAssemblyNode();

        if (removeResult) {
            this.recordAnimationHistory(
                AnimationAction.DAMPER_HOLDER_REMOVAL,
                door,
                removeResult,
                '댐퍼 홀더 제거 완료'
            );
        }
        console.log('Animation history after holder removal:', this.animationHistoryService.getAllHistory());
        console.log('댐퍼 홀더 제거 애니메이션 완료!!!');
        return removeResult;
    }

    private async restoreDamperCover(originalPosition: any, door: DoorType): Promise<any> {
        console.log('Restoring damper cover');
        const restoreResult = await this.manualAssemblyManager.restoreDamperCover(
            originalPosition,
            { duration: 1500 }
        );

        if (restoreResult) {
            this.recordAnimationHistory(
                AnimationAction.DAMPER_COVER_RESTORE,
                door,
                restoreResult,
                '댐퍼 커버 복구 완료'
            );
        }
        console.log('Animation history after damper cover restore:', this.animationHistoryService.getAllHistory());
        return restoreResult;
    }
}

// Export singleton or factory method
let damperServiceOrchestrator: DamperServiceOrchestrator | null = null;

export const getDamperServiceOrchestrator = (
    cameraMovementService: CameraMovementService,
    animationHistoryService: AnimationHistoryService,
    damperCaseBodyAnimationService: DamperCaseBodyAnimationService
): DamperServiceOrchestrator => {
    if (!damperServiceOrchestrator) {
        damperServiceOrchestrator = new DamperServiceOrchestrator(
            cameraMovementService,
            animationHistoryService,
            damperCaseBodyAnimationService
        );
    }
    return damperServiceOrchestrator;
};
