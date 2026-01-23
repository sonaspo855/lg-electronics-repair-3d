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
            console.log('Loading animation history from localStorage:', saved ? saved.length + ' bytes' : 'empty');
            if (saved) {
                const parsed = JSON.parse(saved);
                console.log('Parsed history items:', parsed.length);
                this.history = parsed.map((item: any) => ({
                    ...item,
                    timestamp: new Date(item.timestamp)
                }));
                this.nextId = this.history.length > 0
                    ? Math.max(...this.history.map(item => parseInt(item.id.replace('anim-', '')))) + 1
                    : 1;
                console.log('Loaded history count:', this.history.length, 'Next ID:', this.nextId);
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
            console.log('Saved animation history to localStorage:', json.length, 'bytes');
        } catch (error) {
            console.error('Failed to save animation history:', error);
        }
    }

    addAnimationHistory(command: AnimationCommand, message: string): AnimationHistoryItem {
        console.log('[DEBUG-HISTORY] addAnimationHistory called:', command.door, command.action);
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
                speed: command.speed
            }
        };

        console.log('[DEBUG-HISTORY] Created item:', { id: item.id, title: item.title });

        this.history.push(item);
        this.saveToLocalStorage();

        console.log('[DEBUG-HISTORY] History count after push:', this.history.length);
        console.log('Last items:', this.history.slice(-3).map(i => ({ id: i.id, title: i.title })));

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
            [AnimationAction.SET_SPEED]: 'Set Speed'
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