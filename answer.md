댐퍼 커버를 본래 위치로 복구하는 애니메이션 기능을 구현하였습니다. 이를 위해 `DamperCoverAssemblyService`와 `ManualAssemblyManager`에 관련 메서드를 추가하고, `AnimatorAgent.ts`에서 해당 기능을 호출하도록 수정하였습니다.

구현 방식은 `assembleDamperCover` 실행 시 반환된 `originalPosition` 좌표를 활용하여 GSAP 선형 이동 애니메이션을 실행하는 방식을 사용했습니다.

수정된 주요 코드 부분은 다음과 같습니다.

### 1. `DamperCoverAssemblyService.ts` 수정
댐퍼 커버를 지정된 위치로 이동시키는 `restoreDamperCover` 메서드를 추가했습니다.

```typescript
// src/services/fridge/DamperCoverAssemblyService.ts

    /**
     * 댐퍼 커버를 원래 위치로 복구 (조립용 역방향 선형 이동)
     */
    public async restoreDamperCover(
        originalPosition: { x: number; y: number; z: number },
        options?: {
            duration?: number;
            onComplete?: () => void;
        }
    ): Promise<{
        targetPosition: { x: number; y: number; z: number };
        duration: number;
        easing: string;
    } | null> {
        if (!this.sceneRoot) {
            console.error('Scene root not initialized.');
            return null;
        }

        const coverNode = this.sceneRoot.getObjectByName(this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody')!) as THREE.Mesh;

        if (!coverNode) {
            console.error('Target node not found for restoration:', {
                coverName: this.nodeNameManager.getNodeName('fridge.leftDoorDamper.damperCoverBody')
            });
            return null;
        }

        const duration = options?.duration || 1500;
        const easing = 'power2.inOut';

        await new Promise<void>((resolve) => {
            gsap.to(coverNode.position, {
                x: originalPosition.x,
                y: originalPosition.y,
                z: originalPosition.z,
                duration: duration / 1000,
                ease: easing,
                onComplete: () => {
                    console.log('커버 노드 복구 완료');
                    if (options?.onComplete) options.onComplete();
                    resolve();
                }
            });
        });

        return {
            targetPosition: originalPosition,
            duration,
            easing
        };
    }
```

### 2. `ManualAssemblyManager.ts` 수정
서비스의 기능을 외부에서 호출할 수 있도록 래퍼 메서드를 추가했습니다.

```typescript
// src/services/fridge/ManualAssemblyManager.ts

    /**
     * 댐퍼 커버를 본래 위치로 복구
     */
    public async restoreDamperCover(
        originalPosition: { x: number; y: number; z: number },
        options?: {
            duration?: number;
            onComplete?: () => void;
        }
    ): Promise<{
        targetPosition: { x: number; y: number; z: number };
        duration: number;
        easing: string;
    } | null> {
        return await this.damperCoverAssemblyService.restoreDamperCover(originalPosition, options);
    }
```

### 3. `AnimatorAgent.ts` 수정
`assemblyResult`를 하위 블록에서 사용할 수 있도록 선언 위치를 변경하고, 요청하신 위치에 복구 애니메이션 실행 및 히스토리 기록 코드를 추가했습니다.

```typescript
// src/services/AnimatorAgent.ts

          // 댐퍼 돌출부/홈 결합 애니메이션 실행
          let assemblyResult: any = null; // 선언 위치 변경
          try {
            assemblyResult = await this.manualAssemblyManager.assembleDamperCover({ duration: 1500 });
            // ... (히스토리 기록 로직)
          } catch (error) { ... }

          // ... (스크류 분리, 케이스 이동, 홀더 제거 등 중간 과정)

          // coverNode 노드의 본래 위치로 복구하는 애니메이션
          if (assemblyResult && assemblyResult.originalPosition) {
            try {
              console.log('댐퍼 커버 복구 애니메이션 시작!!!');
              const restoreResult = await this.manualAssemblyManager.restoreDamperCover(
                assemblyResult.originalPosition,
                { duration: 1500 }
              );

              // 애니메이션 히스토리 기록
              if (restoreResult && this.animationHistoryService) {
                const restoreCommand: AnimationCommand = {
                  door: commandsArray[0].door,
                  action: AnimationAction.DAMPER_COVER_RESTORE,
                  degrees: 0,
                  speed: 1,
                  targetPosition: restoreResult.targetPosition,
                  duration: restoreResult.duration,
                  easing: restoreResult.easing
                };
                const restoreMessage = '댐퍼 커버 복구 완료';
                this.animationHistoryService.addAnimationHistory(restoreCommand, restoreMessage);
                console.log('666_Animation history after damper cover restoration:', this.animationHistoryService.getAllHistory());
              }
              console.log('댐퍼 커버 복구 애니메이션 완료!!!');
            } catch (error) {
              console.error('댐퍼 커버 복구 애니메이션 실행 중 에러:', error);
            }
          }
```

그 외에도 `AnimationAction` 타입 정의 및 `AnimationHistoryService`의 액션 이름 매핑에 새로운 액션(`DAMPER_COVER_RESTORE`)과 누락되었던 액션들을 추가하여 타입 오류를 해결하였습니다.
