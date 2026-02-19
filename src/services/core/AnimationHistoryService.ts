import { AnimationCommand, AnimationAction, DoorType } from './AnimatorAgent';

export interface AnimationHistoryItem {
    id: string;
    title: string;
    detail: string;
    info?: string;
    checked: boolean;
    order?: number;
    timestamp: Date;
    command: {
        door: DoorType;
        action: AnimationAction;
        degrees?: number;
        speed?: number;
        // 좌표 정보 (댐퍼 커버 조립 등에서 사용)
        targetPosition?: {
            x: number;
            y: number;
            z: number;
        };
        originalPosition?: {
            x: number;
            y: number;
            z: number;
        };
        position?: {
            x: number;
            y: number;
            z: number;
        };
        easing?: string;
        duration?: number;
        // 스크류 애니메이션 관련 속성 추가
        rotationAngle?: number;        // 회전 각도 (도)
        rotationAxis?: 'x' | 'y' | 'z'; // 회전축
        extractDirection?: [number, number, number]; // 추출 방향
        translationDistance?: number;  // 이동 거리
    };
}

export class AnimationHistoryService {
    private history: AnimationHistoryItem[] = [];
    private nextId = 1;

    constructor() {
        this.loadFromLocalStorage();
    }

    private loadFromLocalStorage(): void {
        try {
            const saved = localStorage.getItem('animationHistory');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.history = parsed.map((item: any) => ({
                    ...item,
                    timestamp: new Date(item.timestamp)
                }));
                this.nextId = this.history.length > 0
                    ? Math.max(...this.history.map(item => parseInt(item.id.replace('anim-', '')))) + 1
                    : 1;
            } else {
                console.log('No saved animation history found');
            }
        } catch (error) {
            console.error('Failed to load animation history:', error);
        }
    }

    private saveToLocalStorage(): void {
        try {
            const json = JSON.stringify(this.history);
            localStorage.setItem('animationHistory', json);
        } catch (error) {
            console.error('Failed to save animation history:', error);
        }
    }

    addAnimationHistory(command: AnimationCommand, message: string): AnimationHistoryItem {
        const item: AnimationHistoryItem = {
            id: `anim-${this.nextId++}`,
            title: this.createTitle(command),
            detail: this.createDetail(command),
            info: message,
            checked: true,
            timestamp: new Date(),
            command: {
                door: command.door,
                action: command.action,
                degrees: command.degrees,
                targetPosition: command.targetPosition,
                originalPosition: command.originalPosition,
                position: command.position,
                easing: command.easing,
                duration: command.duration,
                rotationAngle: command.rotationAngle,
                rotationAxis: command.rotationAxis,
                extractDirection: command.extractDirection,
                translationDistance: command.translationDistance
            }
        };

        this.history.push(item);
        this.saveToLocalStorage();

        return item;
    }

    private createTitle(command: AnimationCommand): string {
        const doorNames: Record<DoorType, string> = {
            [DoorType.TOP_LEFT]: 'Top Left Door',
            [DoorType.TOP_RIGHT]: 'Top Right Door',
            [DoorType.BOTTOM_LEFT]: 'Bottom Left Door',
            [DoorType.BOTTOM_RIGHT]: 'Bottom Right Door'
        };

        const actionNames: Record<AnimationAction, string> = {
            [AnimationAction.OPEN]: 'Open',
            [AnimationAction.CLOSE]: 'Close',
            [AnimationAction.SET_DEGREES]: 'Set Degrees',
            [AnimationAction.SET_SPEED]: 'Set Speed',
            [AnimationAction.CAMERA_MOVE]: 'Camera Move',
            [AnimationAction.SCREW_LOOSEN]: 'Screw Loosen',
            [AnimationAction.SCREW_TIGHTEN]: 'Screw Tighten',
            [AnimationAction.DAMPER_COVER_BODY]: 'Damper Cover Body',
            [AnimationAction.DAMPER_COVER_RESTORE]: 'Damper Cover Restore',
            [AnimationAction.DAMPER_CASE_BODY_MOVE]: 'Damper Case Body Move',
            [AnimationAction.DAMPER_HOLDER_REMOVAL]: 'Damper Holder Removal'
        };

        return `${actionNames[command.action]} ${doorNames[command.door]}`;
    }

    private createDetail(command: AnimationCommand): string {
        const parts = [];

        if (command.action === AnimationAction.OPEN && command.degrees !== undefined) {
            parts.push(`${command.degrees}°`);
        }

        if (command.speed !== undefined) {
            parts.push(`${command.speed}s`);
        }

        if (command.position) {
            parts.push(`pos(${command.position.x.toFixed(3)}, ${command.position.y.toFixed(3)}, ${command.position.z.toFixed(3)})`);
        }

        if (command.targetPosition) {
            parts.push(`target(${command.targetPosition.x.toFixed(3)}, ${command.targetPosition.y.toFixed(3)}, ${command.targetPosition.z.toFixed(3)})`);
        }

        if (command.originalPosition) {
            parts.push(`orig(${command.originalPosition.x.toFixed(3)}, ${command.originalPosition.y.toFixed(3)}, ${command.originalPosition.z.toFixed(3)})`);
        }

        if (command.duration !== undefined) {
            parts.push(`${command.duration}ms`);
        }

        if (command.easing) {
            parts.push(`easing:${command.easing}`);
        }

        // 스크류 애니메이션 관련 속성 표시
        if (command.action === AnimationAction.SCREW_LOOSEN) {
            if (command.rotationAngle !== undefined) {
                parts.push(`${command.rotationAngle}°`);
            }
            if (command.rotationAxis) {
                parts.push(`axis:${command.rotationAxis}`);
            }
            if (command.extractDirection) {
                parts.push(`dir(${command.extractDirection.join(',')})`);
            }
            if (command.translationDistance !== undefined) {
                parts.push(`dist:${command.translationDistance.toFixed(3)}m`);
            }
        }

        // 댐퍼 케이스 바디 이동 애니메이션 속성 표시 (DAMPER_CASE_BODY_MOVE도 position, duration, easing 표시)
        if (command.action === AnimationAction.DAMPER_CASE_BODY_MOVE) {
            // position, duration, easing은 위에서 already added
        }

        return parts.join(' ');
    }

    getAllHistory(): AnimationHistoryItem[] {
        return [...this.history].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    clearHistory(): void {
        this.history = [];
        this.nextId = 1;
        this.saveToLocalStorage();
    }

    removeHistoryItem(id: string): void {
        this.history = this.history.filter(item => item.id !== id);
        this.saveToLocalStorage();
    }

    reorderHistory(orderedIds: string[]): void {
        const newHistory: AnimationHistoryItem[] = [];
        const remainingItems: AnimationHistoryItem[] = [...this.history];

        orderedIds.forEach((id, index) => {
            const itemIndex = remainingItems.findIndex(item => item.id === id);
            if (itemIndex !== -1) {
                const [item] = remainingItems.splice(itemIndex, 1);
                newHistory.push({ ...item, order: index + 1 });
            }
        });

        this.history = [...newHistory, ...remainingItems];
        this.saveToLocalStorage();
    }

    exportToJson(): string {
        return JSON.stringify(this.history, null, 2);
    }

    importFromJson(json: string): void {
        try {
            const parsed = JSON.parse(json);
            this.history = parsed.map((item: any) => ({
                ...item,
                timestamp: new Date(item.timestamp)
            }));
            this.nextId = this.history.length > 0
                ? Math.max(...this.history.map(item => parseInt(item.id.replace('anim-', '')))) + 1
                : 1;
            this.saveToLocalStorage();
        } catch (error) {
            console.error('Failed to import animation history:', error);
            throw new Error('Invalid JSON format');
        }
    }
}