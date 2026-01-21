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
    SET_SPEED: 'set_speed'
} as const;

export type AnimationAction = typeof AnimationAction[keyof typeof AnimationAction];

export interface AnimationCommand {
    door: DoorType;
    action: AnimationAction;
    degrees?: number;
    speed?: number;
}

// Damper animation commands configuration (separated by side)
const LEFT_DAMPER_COMMANDS: AnimationCommand[] = [
    { door: DoorType.TOP_LEFT, action: AnimationAction.OPEN, degrees: 45, speed: 3 },
    { door: DoorType.BOTTOM_LEFT, action: AnimationAction.OPEN, degrees: 180, speed: 3 }
];

const RIGHT_DAMPER_COMMANDS: AnimationCommand[] = [
    { door: DoorType.TOP_RIGHT, action: AnimationAction.OPEN, degrees: 45, speed: 3 },
    { door: DoorType.BOTTOM_RIGHT, action: AnimationAction.OPEN, degrees: 180, speed: 3 }
];

// Get damper animation commands based on input direction
export const getFridgeDamperAnimationCommands = (input: string): AnimationCommand[] => {
    console.log('Detected damper service command:', input);

    // Detect left/right direction before damper keyword
    const lowerInput = input.toLowerCase().trim();
    const damperIndex = lowerInput.indexOf('damper');
    const textBeforeDamper = lowerInput.slice(0, damperIndex);

    if (textBeforeDamper.includes('left')) {
        console.log('Left damper detected, returning left commands');
        return LEFT_DAMPER_COMMANDS;
    } else if (textBeforeDamper.includes('right')) {
        console.log('Right damper detected, returning right commands');
        return RIGHT_DAMPER_COMMANDS;
    }

    // Default to left if direction not specified
    console.log('No direction specified, defaulting to left commands');
    return LEFT_DAMPER_COMMANDS;
};

// Check if commands are damper commands (for special handling in execution)
export const areFridgeDamperCommands = (commands: AnimationCommand[]): boolean => {
    // Check if commands match the predefined damper command patterns
    const isLeftDamper = commands.length === 2 &&
        commands.some(cmd => cmd.door === DoorType.TOP_LEFT && cmd.action === AnimationAction.OPEN && cmd.degrees === 45 && cmd.speed === 3) &&
        commands.some(cmd => cmd.door === DoorType.BOTTOM_LEFT && cmd.action === AnimationAction.OPEN && cmd.degrees === 180 && cmd.speed === 3);

    const isRightDamper = commands.length === 2 &&
        commands.some(cmd => cmd.door === DoorType.TOP_RIGHT && cmd.action === AnimationAction.OPEN && cmd.degrees === 45 && cmd.speed === 3) &&
        commands.some(cmd => cmd.door === DoorType.BOTTOM_RIGHT && cmd.action === AnimationAction.OPEN && cmd.degrees === 180 && cmd.speed === 3);

    return isLeftDamper || isRightDamper;
};

// Check if input contains damper keyword
export const isFridgeDamperCommand = (input: string): boolean => {
    return input.includes('damper');
};
