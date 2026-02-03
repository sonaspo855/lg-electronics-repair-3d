// Damper animation types (duplicated to avoid circular dependency)
export const DoorType = {
    TOP_LEFT: 'top_left',
    TOP_RIGHT: 'top_right',
    BOTTOM_LEFT: 'bottom_left',
    BOTTOM_RIGHT: 'bottom_right'
} as const;

export type DoorType = typeof DoorType[keyof typeof DoorType];

export const AnimationAction = {
    OPEN: 'open',
    CLOSE: 'close',
    SET_DEGREES: 'set_degrees',
    SET_SPEED: 'set_speed',
    CAMERA_MOVE: 'camera_move'
} as const;

export type AnimationAction = typeof AnimationAction[keyof typeof AnimationAction];

export interface AnimationCommand {
    door: DoorType;
    action: AnimationAction;
    degrees?: number;
    speed?: number;
}

// Type for damper animations JSON structure
interface DamperAnimationConfig {
    damperAnimations: {
        left: {
            commands: AnimationCommand[];
        };
        right: {
            commands: AnimationCommand[];
        };
    };
}

// Cache for loaded damper commands
let LEFT_DAMPER_COMMANDS: AnimationCommand[] | null = null;
let RIGHT_DAMPER_COMMANDS: AnimationCommand[] | null = null;
let damperAnimationsLoaded = false;

// Load damper animation configuration from JSON
async function loadDamperAnimations(): Promise<void> {
    if (damperAnimationsLoaded) {
        return; // Already loaded
    }

    try {
        const response = await fetch('/metadata/damper-animations.json');
        if (!response.ok) {
            throw new Error('Failed to load damper-animations.json');
        }
        const data: DamperAnimationConfig = await response.json();
        LEFT_DAMPER_COMMANDS = data.damperAnimations.left.commands;
        RIGHT_DAMPER_COMMANDS = data.damperAnimations.right.commands;
        damperAnimationsLoaded = true;
        console.log('Damper animations loaded from JSON:', { LEFT_DAMPER_COMMANDS, RIGHT_DAMPER_COMMANDS });
    } catch (error) {
        console.error('Error loading damper animations:', error);
        // Fallback to default values
        LEFT_DAMPER_COMMANDS = [
            { door: DoorType.TOP_LEFT, action: AnimationAction.OPEN, degrees: 45, speed: 3 },
            { door: DoorType.BOTTOM_LEFT, action: AnimationAction.OPEN, degrees: 180, speed: 3 }
        ];
        RIGHT_DAMPER_COMMANDS = [
            { door: DoorType.TOP_RIGHT, action: AnimationAction.OPEN, degrees: 45, speed: 3 },
            { door: DoorType.BOTTOM_RIGHT, action: AnimationAction.OPEN, degrees: 180, speed: 3 }
        ];
        damperAnimationsLoaded = true;
    }
}

// 두 애니메이션 배열 비교
const commandsMatch = (cmd1: AnimationCommand, cmd2: AnimationCommand): boolean => {
    return cmd1.door === cmd2.door &&
        cmd1.action === cmd2.action &&
        cmd1.degrees === cmd2.degrees &&
        cmd1.speed === cmd2.speed;
};

// Get damper animation commands based on input direction
export const getFridgeDamperAnimationCommands = async (input: string): Promise<AnimationCommand[]> => {
    await loadDamperAnimations();

    console.log('Detected damper service command:', input);

    // Detect left/right direction before damper keyword
    const lowerInput = input.toLowerCase().trim();
    const damperIndex = lowerInput.indexOf('damper');
    const textBeforeDamper = lowerInput.slice(0, damperIndex);

    if (textBeforeDamper.includes('left')) {
        console.log('Left damper detected, returning left commands');
        return LEFT_DAMPER_COMMANDS || [];
    } else if (textBeforeDamper.includes('right')) {
        console.log('Right damper detected, returning right commands');
        return RIGHT_DAMPER_COMMANDS || [];
    }

    // Default to left if direction not specified
    console.log('No direction specified, defaulting to left commands');
    return LEFT_DAMPER_COMMANDS || [];
};

// Check if commands are damper commands (for special handling in execution)
export const areFridgeDamperCommands = async (commands: AnimationCommand[]): Promise<boolean> => {
    await loadDamperAnimations();

    if (!LEFT_DAMPER_COMMANDS || !RIGHT_DAMPER_COMMANDS) {
        return false;
    }

    // Check if commands match the predefined damper command patterns from JSON
    const leftCommands = LEFT_DAMPER_COMMANDS;
    const rightCommands = RIGHT_DAMPER_COMMANDS;

    const isLeftDamper = leftCommands && commands.length === 2 &&
        commands.some(cmd => commandsMatch(cmd, leftCommands[0])) &&
        commands.some(cmd => commandsMatch(cmd, leftCommands[1]));

    const isRightDamper = rightCommands && commands.length === 2 &&
        commands.some(cmd => commandsMatch(cmd, rightCommands[0])) &&
        commands.some(cmd => commandsMatch(cmd, rightCommands[1]));

    return isLeftDamper || isRightDamper;
};

// Check if input contains damper keyword
export const isFridgeDamperCommand = (input: string): boolean => {
    return input.includes('damper');
};
