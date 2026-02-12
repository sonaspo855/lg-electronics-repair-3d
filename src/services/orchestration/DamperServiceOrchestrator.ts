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

    async execute(commandsArray: AnimationCommand[]): Promise<void> {
        const screw1NodeName = this.nodeNameManager.getNodeName('fridge.leftDoorDamper.screw1Customized');
        const screw2NodeName = this.nodeNameManager.getNodeName('fridge.leftDoorDamper.screw2Customized');
        const screw1NodePath = 'fridge.leftDoorDamper.screw1Customized';
        const screw2NodePath = 'fridge.leftDoorDamper.screw2Customized';

        try {
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
        await this.cameraMovementService.moveCameraToLeftDoorDamper();

        // 카메라 이동 히스토리 기록
        const cameraMoveCommand: AnimationCommand = {
            door: DoorType.TOP_LEFT,
            action: AnimationAction.CAMERA_MOVE,
            degrees: 0,
            speed: 1
        };
        const cameraMessage = 'Camera moved to damper position';
        this.animationHistoryService.addAnimationHistory(cameraMoveCommand, cameraMessage);
        console.log('Animation history after camera move:', this.animationHistoryService.getAllHistory());
    }

    private async assembleDamperCover(door: DoorType): Promise<any> {
        console.log('Assembling damper cover');
        const assemblyResult = await this.manualAssemblyManager.assembleDamperCover({ duration: 1500 });
        console.log('Damper cover assembly completed');

        // 댐퍼 커버 조립 히스토리 기록
        if (assemblyResult) {
            const assemblyCommand: AnimationCommand = {
                door,
                action: AnimationAction.DAMPER_COVER_BODY,
                degrees: 0,
                speed: 1,
                targetPosition: assemblyResult.targetPosition,
                originalPosition: assemblyResult.originalPosition,
                easing: assemblyResult.easing,
                duration: assemblyResult.duration,
                translationDistance: assemblyResult.translationDistance,
                extractDirection: assemblyResult.extractDirection
            };
            const assemblyMessage = '댐퍼 커버 조립 완료';
            this.animationHistoryService.addAnimationHistory(assemblyCommand, assemblyMessage);
            console.log('Animation history after damper cover assembly:', this.animationHistoryService.getAllHistory());
        } else {
            console.warn('Damper cover assembly returned null, skipping history logging');
        }

        return assemblyResult;
    }

    private async loosenScrews(
        screw1NodeName: string | null,
        screw2NodeName: string | null,
        screw1NodePath: string,
        screw2NodePath: string
    ): Promise<void> {
        console.log('Loosening screws');

        // 왼쪽 스크류 1 분리
        if (screw1NodeName) {
            console.log(`${screw1NodeName} Screw1를 돌려서 빼는 애니메이션을 실행!`);
            const metadataKey1 = extractMetadataKey(screw1NodePath);
            const config1 = this.metadataLoader.getScrewAnimationConfig(metadataKey1);
            await this.manualAssemblyManager.loosenScrew(screw1NodePath, config1 || {});
            console.log('Left screw 1 loosened');
        }

        // 왼쪽 스크류 2 분리
        if (screw2NodeName) {
            const metadataKey2 = extractMetadataKey(screw2NodePath);
            const config2 = this.metadataLoader.getScrewAnimationConfig(metadataKey2);
            await this.manualAssemblyManager.loosenScrew(screw2NodePath, config2 || {});
            console.log('Left screw 2 loosened');
        }
    }

    private async moveDamperCaseBody(door: DoorType): Promise<any> {
        console.log('Moving damper case body');

        const animationResult = await this.damperCaseBodyAnimationService.animateDamperCaseBodyLinearMove({
            duration: 1000,
            easing: 'power2.inOut',
            onComplete: () => {
                console.log('damperCaseBody 힌지 반대 방향으로 선형이동 완료!!!');
            }
        });

        // 애니메이션 히스토리 기록
        if (animationResult) {
            const animationCommand = {
                door,
                action: AnimationAction.DAMPER_CASE_BODY_MOVE,
                degrees: 0,
                speed: 1,
                position: animationResult.position,
                easing: animationResult.easing,
                duration: animationResult.duration
            };
            const animationMessage = 'damperCaseBody 힌지 반대 방향으로 선형이동 완료';
            this.animationHistoryService.addAnimationHistory(animationCommand, animationMessage);
        } else {
            console.warn('Damper case body animation returned null, skipping history logging');
        }

        return animationResult;
    }

    private async moveScrew2(screw2NodePath: string, door: DoorType): Promise<any> {
        console.log('Moving screw2 to damper case body');

        const animationResult = await this.manualAssemblyManager.moveScrewLinearToDamperCaseBody(screw2NodePath, {
            duration: 1000,
            easing: 'power2.inOut',
            onComplete: () => {
                console.log('스크류2 damperCaseBody 방향 선형 이동 완료!!!');
            }
        });

        // 애니메이션 히스토리 기록
        if (animationResult) {
            const animationCommand = {
                door,
                action: AnimationAction.SCREW_LOOSEN,
                degrees: 0,
                speed: 1,
                position: animationResult.position,
                easing: animationResult.easing,
                duration: animationResult.duration
            };
            const animationMessage = '스크류2 오른쪽 방향 선형 이동 완료';
            this.animationHistoryService.addAnimationHistory(animationCommand, animationMessage);
            console.log('Animation history after screw2 linear move:', this.animationHistoryService.getAllHistory());
        } else {
            console.warn('스크류2 선형 이동 애니메이션이 null을 반환했습니다.');
        }

        return animationResult;
    }

    private async tightenScrews(
        screw1NodeName: string | null,
        screw2NodeName: string | null,
        screw1NodePath: string,
        screw2NodePath: string
    ): Promise<void> {
        console.log('Tightening screws');

        // 왼쪽 스크류 1 조립 (회전+이동 역방향)
        if (screw1NodeName) {
            const metadataKey1 = extractMetadataKey(screw1NodePath);
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

        // 애니메이션 히스토리 기록
        if (removeResult) {
            const removeCommand: AnimationCommand = {
                door,
                action: AnimationAction.DAMPER_HOLDER_REMOVAL,
                degrees: 0,
                speed: 1,
                targetPosition: removeResult.targetPosition,
                originalPosition: removeResult.originalPosition,
                easing: removeResult.easing,
                duration: removeResult.duration,
                rotationAngle: removeResult.rotationAngle,
                rotationAxis: removeResult.rotationAxis,
                translationDistance: removeResult.translationDistance,
                extractDirection: removeResult.extractDirection
            };
            const removeMessage = '댐퍼 홀더 제거 완료';
            this.animationHistoryService.addAnimationHistory(removeCommand, removeMessage);
            console.log('Animation history after damper holder removal:', this.animationHistoryService.getAllHistory());
        }

        console.log('댐퍼 홀더 제거 애니메이션 완료!!!');
        return removeResult;
    }

    private async restoreDamperCover(originalPosition: any, door: DoorType): Promise<any> {
        console.log('Restoring damper cover');
        const restoreResult = await this.manualAssemblyManager.restoreDamperCover(
            originalPosition,
            { duration: 1500 }
        );

        // 애니메이션 히스토리 기록
        if (restoreResult) {
            const restoreCommand: AnimationCommand = {
                door,
                action: AnimationAction.DAMPER_COVER_RESTORE,
                degrees: 0,
                speed: 1,
                targetPosition: restoreResult.targetPosition,
                duration: restoreResult.duration,
                easing: restoreResult.easing
            };
            const restoreMessage = '댐퍼 커버 복구 완료';
            this.animationHistoryService.addAnimationHistory(restoreCommand, restoreMessage);
            console.log('Animation history after damper cover restoration:', this.animationHistoryService.getAllHistory());
        }
        console.log('댐퍼 커버 복구 애니메이션 완료!!!');
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
