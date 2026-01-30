/**
 * 조립 상태 관리자
 * 조립 진행률 및 재생 상태를 관리합니다.
 */
export class AssemblyStateManager {
    private assemblyProgress: number = 0;
    private isAssemblyPlaying: boolean = false;

    /**
     * 조립 진행률을 업데이트합니다.
     * @param progress 진행률 (0 ~ 1)
     */
    public updateProgress(progress: number): void {
        this.assemblyProgress = Math.max(0, Math.min(1, progress));
        console.log(`진행률 업데이트: ${(this.assemblyProgress * 100).toFixed(1)}%`);
    }

    /**
     * 조립 진행률을 반환합니다.
     * @returns 진행률 (0 ~ 1)
     */
    public getProgress(): number {
        return this.assemblyProgress;
    }

    /**
     * 조립 재생 상태를 설정합니다.
     * @param playing 재생 여부
     */
    public setPlaying(playing: boolean): void {
        this.isAssemblyPlaying = playing;
        console.log(`재생 상태 설정: ${playing ? '재생 중' : '정지'}`);
    }

    /**
     * 조립 재생 중인지 확인합니다.
     * @returns 재생 여부
     */
    public isPlaying(): boolean {
        return this.isAssemblyPlaying;
    }

    /**
     * 조립을 시작합니다.
     */
    public startAssembly(): void {
        this.setPlaying(true);
        this.updateProgress(0);
    }

    /**
     * 조립을 완료합니다.
     */
    public completeAssembly(): void {
        this.setPlaying(false);
        this.updateProgress(1);
    }

    /**
     * 조립을 중지합니다.
     */
    public stopAssembly(): void {
        this.setPlaying(false);
    }

    /**
     * 조립을 초기화합니다.
     */
    public reset(): void {
        this.assemblyProgress = 0;
        this.isAssemblyPlaying = false;
    }

    /**
     * 현재 상태 정보를 반환합니다.
     * @returns 상태 정보 객체
     */
    public getState(): {
        progress: number;
        isPlaying: boolean;
    } {
        return {
            progress: this.assemblyProgress,
            isPlaying: this.isAssemblyPlaying
        };
    }
}

// 싱글톤 인스턴스 관리
let assemblyStateManagerInstance: AssemblyStateManager | null = null;

/**
 * 조립 상태 관리자 인스턴스를 반환합니다.
 * @returns AssemblyStateManager 인스턴스
 */
export function getAssemblyStateManager(): AssemblyStateManager {
    if (!assemblyStateManagerInstance) {
        assemblyStateManagerInstance = new AssemblyStateManager();
    }
    return assemblyStateManagerInstance;
}
