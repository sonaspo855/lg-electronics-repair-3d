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
export const getDamperAnimationCommands = (input: string): AnimationCommand[] => {
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

// Check if input contains damper keyword
export const isDamperCommand = (input: string): boolean => {
    return input.includes('damper');
};
