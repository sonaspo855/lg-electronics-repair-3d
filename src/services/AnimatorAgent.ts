// Browser-compatible Ollama client
class OllamaClient {
  private host: string;

  constructor(host: string = 'http://localhost:11434') {
    this.host = host;
  }

  async list() {
    try {
      const response = await fetch(`${this.host}/api/tags`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to connect to Ollama: ${error}`);
    }
  }

  async chat(options: { model: string; messages: Array<{ role: string; content: string }> }) {
    try {
      const response = await fetch(`${this.host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          stream: false
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { message: { content: result.message.content } };
    } catch (error) {
      throw new Error(`Failed to chat with Ollama: ${error}`);
    }
  }
}

import { getFridgeDamperAnimationCommands, isFridgeDamperCommand, areFridgeDamperCommands } from './fridge/DamperAnimationService';
import { CameraMovementService } from './fridge/CameraMovementService';
import { AnimationHistoryService } from './AnimationHistoryService';
import { getManualAssemblyManager } from './fridge/ManualAssemblyManager';

// Door types and their identifiers
export const DoorType = {
  TOP_LEFT: 'top_left',
  TOP_RIGHT: 'top_right',
  BOTTOM_LEFT: 'bottom_left',
  BOTTOM_RIGHT: 'bottom_right'
} as const;

export type DoorType = typeof DoorType[keyof typeof DoorType];

// Door mapping for natural language understanding
export const DOOR_MAPPING = {
  // Top doors (refrigerator)
  'top left': DoorType.TOP_LEFT,
  'top left door': DoorType.TOP_LEFT,
  'left door': DoorType.TOP_LEFT,
  'refrigerator left': DoorType.TOP_LEFT,
  'main left': DoorType.TOP_LEFT,
  'upper left': DoorType.TOP_LEFT,
  'fridge left': DoorType.TOP_LEFT,
  'main refrigerator left': DoorType.TOP_LEFT,
  'top left refrigerator': DoorType.TOP_LEFT,
  'left refrigerator': DoorType.TOP_LEFT,

  'top right': DoorType.TOP_RIGHT,
  'top right door': DoorType.TOP_RIGHT,
  'right door': DoorType.TOP_RIGHT,
  'refrigerator right': DoorType.TOP_RIGHT,
  'main right': DoorType.TOP_RIGHT,
  'upper right': DoorType.TOP_RIGHT,
  'fridge right': DoorType.TOP_RIGHT,
  'main refrigerator right': DoorType.TOP_RIGHT,
  'top right refrigerator': DoorType.TOP_RIGHT,
  'right refrigerator': DoorType.TOP_RIGHT,

  // Top doors (refrigerator) - Korean
  '상단 왼쪽': DoorType.TOP_LEFT,
  '상단 왼쪽 문': DoorType.TOP_LEFT,
  '왼쪽 문': DoorType.TOP_LEFT,
  '냉장고 왼쪽': DoorType.TOP_LEFT,
  '메인 왼쪽': DoorType.TOP_LEFT,
  '상부 왼쪽': DoorType.TOP_LEFT,
  '냉장칸 왼쪽': DoorType.TOP_LEFT,
  '메인 냉장고 왼쪽': DoorType.TOP_LEFT,
  '냉장고 상단 왼쪽': DoorType.TOP_LEFT,
  '왼쪽 냉장고': DoorType.TOP_LEFT,

  '상단 오른쪽': DoorType.TOP_RIGHT,
  '상단 오른쪽 문': DoorType.TOP_RIGHT,
  '오른쪽 문': DoorType.TOP_RIGHT,
  '냉장고 오른쪽': DoorType.TOP_RIGHT,
  '메인 오른쪽': DoorType.TOP_RIGHT,
  '상부 오른쪽': DoorType.TOP_RIGHT,
  '냉장칸 오른쪽': DoorType.TOP_RIGHT,
  '메인 냉장고 오른쪽': DoorType.TOP_RIGHT,
  '냉장고 상단 오른쪽': DoorType.TOP_RIGHT,
  '오른쪽 냉장고': DoorType.TOP_RIGHT,

  // Bottom doors (freezer)
  'bottom left': DoorType.BOTTOM_LEFT,
  'bottom left door': DoorType.BOTTOM_LEFT,
  'freezer left': DoorType.BOTTOM_LEFT,
  'lower left': DoorType.BOTTOM_LEFT,
  'freezer left door': DoorType.BOTTOM_LEFT,
  'bottom freezer left': DoorType.BOTTOM_LEFT,
  'lower freezer left': DoorType.BOTTOM_LEFT,
  'left freezer': DoorType.BOTTOM_LEFT,

  'bottom right': DoorType.BOTTOM_RIGHT,
  'bottom right door': DoorType.BOTTOM_RIGHT,
  'freezer right': DoorType.BOTTOM_RIGHT,
  'lower right': DoorType.BOTTOM_RIGHT,
  'freezer right door': DoorType.BOTTOM_RIGHT,
  'bottom freezer right': DoorType.BOTTOM_RIGHT,
  'lower freezer right': DoorType.BOTTOM_RIGHT,
  'right freezer': DoorType.BOTTOM_RIGHT,
  'bottom right freezer': DoorType.BOTTOM_RIGHT,
  'lower right freezer': DoorType.BOTTOM_RIGHT,

  // Bottom doors (freezer) - Korean
  '하단 왼쪽': DoorType.BOTTOM_LEFT,
  '하단 왼쪽 문': DoorType.BOTTOM_LEFT,
  '냉동고 왼쪽': DoorType.BOTTOM_LEFT,
  '하부 왼쪽': DoorType.BOTTOM_LEFT,
  '냉동고 왼쪽 문': DoorType.BOTTOM_LEFT,
  '냉동고 하단 왼쪽': DoorType.BOTTOM_LEFT,
  '하부 냉동고 왼쪽': DoorType.BOTTOM_LEFT,
  '왼쪽 냉동고': DoorType.BOTTOM_LEFT,

  '하단 오른쪽': DoorType.BOTTOM_RIGHT,
  '하단 오른쪽 문': DoorType.BOTTOM_RIGHT,
  '냉동고 오른쪽': DoorType.BOTTOM_RIGHT,
  '하부 오른쪽': DoorType.BOTTOM_RIGHT,
  '냉동고 오른쪽 문': DoorType.BOTTOM_RIGHT,
  '냉동고 하단 오른쪽': DoorType.BOTTOM_RIGHT,
  '하부 냉동고 오른쪽': DoorType.BOTTOM_RIGHT,
  '오른쪽 냉동고': DoorType.BOTTOM_RIGHT,
  '하단 오른쪽 냉동고': DoorType.BOTTOM_RIGHT,
  '하부 오른쪽 냉동고': DoorType.BOTTOM_RIGHT,
};

// Animation action types
export const AnimationAction = {
  OPEN: 'open',
  CLOSE: 'close',
  SET_DEGREES: 'set_degrees',
  SET_SPEED: 'set_speed',
  CAMERA_MOVE: 'camera_move'
} as const;

export type AnimationAction = typeof AnimationAction[keyof typeof AnimationAction];

// Conversation state
export interface ConversationState {
  currentDoor?: DoorType;
  currentDegrees?: number;
  currentSpeed?: number;
  awaitingDoor?: boolean;
  awaitingDegrees?: boolean;
  awaitingSpeed?: boolean;
}

// Animation command
export interface AnimationCommand {
  door: DoorType;
  action: AnimationAction;
  degrees?: number;
  speed?: number;
}

// LLM Response types
export interface LLMResponse {
  type: 'question' | 'action' | 'error' | 'info';
  message: string;
  command?: AnimationCommand;
  awaitingInput?: boolean;
}

export class AnimatorAgent {
  private static executionCounter = 0; // [DEBUG] Track total executions
  private ollama: OllamaClient;
  private conversationState: ConversationState = {};
  private doorControls: any;
  private cameraMovementService: CameraMovementService | null = null;
  private lastInputLocale: 'en' | 'ko' = 'en';
  private lastUserInput = '';
  private onActionCompleted?: (message: string) => void;
  private actionVerbResolver?: (
    input: string,
    action: AnimationAction,
    locale: 'en' | 'ko'
  ) => Promise<string> | string;
  private serviceStatus: {
    isRunning: boolean;
    status: 'online' | 'offline' | 'checking';
    message: string;
    lastChecked?: Date;
  } = {
      isRunning: false,
      status: 'offline',
      message: 'Service status not checked yet.'
    };
  private availableModels: string[] = [];
  private animationHistoryService: AnimationHistoryService | null = null;

  constructor() {
    this.ollama = new OllamaClient('http://localhost:11434');
  }

  // Set door controls reference from ModelViewer
  setDoorControls(controls: any) {
    this.doorControls = controls;
  }

  // Set camera controls reference
  setCameraControls(cameraControls: any, sceneRoot?: any) {
    this.cameraMovementService = new CameraMovementService(cameraControls, sceneRoot);
  }

  setOnActionCompleted(callback?: (message: string) => void) {
    this.onActionCompleted = callback;
  }

  setAnimationHistoryService(service: AnimationHistoryService) {
    this.animationHistoryService = service;
  }

  setActionVerbResolver(
    resolver?: (
      input: string,
      action: AnimationAction,
      locale: 'en' | 'ko'
    ) => Promise<string> | string
  ) {
    this.actionVerbResolver = resolver;
  }

  // Check if Ollama is available
  private async isOllamaAvailable(): Promise<boolean> {
    try {
      await this.ollama.list();
      return true;
    } catch (error) {
      console.warn('Ollama not available, falling back to rule-based system:', error);
      return false;
    }
  }

  // Check service status
  async checkServiceStatus(): Promise<void> {
    try {
      this.serviceStatus.status = 'checking';
      this.serviceStatus.message = 'Checking Ollama service...';

      const isAvailable = await this.isOllamaAvailable();

      if (isAvailable) {
        this.serviceStatus.isRunning = true;
        this.serviceStatus.status = 'online';
        this.serviceStatus.message = 'Ollama service is running and accessible.';

        // Get available models
        try {
          const models = await this.ollama.list();
          this.availableModels = models.models?.map((m: any) => m.name) || [];
        } catch (error) {
          console.warn('Could not fetch models:', error);
          this.availableModels = [];
        }
      } else {
        this.serviceStatus.isRunning = false;
        this.serviceStatus.status = 'offline';
        this.serviceStatus.message = 'Ollama service is not accessible. Please ensure Ollama is running on localhost:11434';
        this.availableModels = [];
      }

      this.serviceStatus.lastChecked = new Date();
    } catch (error) {
      console.error('Error checking service status:', error);
      this.serviceStatus.isRunning = false;
      this.serviceStatus.status = 'offline';
      this.serviceStatus.message = `Error checking service: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.serviceStatus.lastChecked = new Date();
    }
  }

  // Get current service status
  getServiceStatus() {
    return { ...this.serviceStatus };
  }

  // Get available models
  getAvailableModels(): string[] {
    return [...this.availableModels];
  }

  // Refresh service status
  async refreshServiceStatus(): Promise<void> {
    await this.checkServiceStatus();
  }

  // Process input with LLM
  private async processWithLLM(input: string): Promise<LLMResponse | null> {
    try {
      if (!(await this.isOllamaAvailable())) {
        return null;
      }

      console.log('Processing with LLM:', input);

      // Create context-aware prompt
      const prompt = this.createLLMPrompt(input);

      // Get LLM response
      const response = await this.ollama.chat({
        model: 'phi3', // Using phi3 model for better performance
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      console.log('LLM Response:', response.message.content);

      // Parse LLM response
      return await this.parseLLMResponse(input, response.message.content);

    } catch (error) {
      console.error('Error processing with LLM:', error);
      return null; // Fall back to rule-based system
    }
  }

  // Create context-aware prompt for LLM
  private createLLMPrompt(input: string): string {
    const context = this.conversationState.currentDoor
      ? `Current context: User is controlling the ${this.getDoorDisplayName(this.conversationState.currentDoor)} door. `
      : '';

    const awaiting = this.conversationState.awaitingDegrees
      ? 'User needs to specify degrees (1-180). '
      : this.conversationState.awaitingSpeed
        ? 'User needs to specify speed (in seconds or words like fast/slow). '
        : '';

    return `You are Sabby, an AI Animator Agent that controls refrigerator doors. 

CRITICAL: You MUST respond with ONLY valid JSON. NO explanations, NO additional text, NO comments.

${context}${awaiting}

User input: "${input}"

Available doors:
- Top Left (Refrigerator Left) -> "top_left"
- Top Right (Refrigerator Right) -> "top_right"
- Bottom Left (Freezer Left) -> "bottom_left"
- Bottom Right (Freezer Right) -> "bottom_right"

Available actions: open, close, set degrees, set speed

SPECIAL CASE: For "close all doors" use action "close_all" with door "all"

DEFAULTS: If degrees not specified, use 90. If speed not specified, use 1 second.

SPEED: Accept descriptive (fast=0.5s, slow=3s, medium=1.5s) or numeric (0.1-10 seconds).

RESPOND WITH ONLY THIS JSON FORMAT:
{
  "action": "open|close|close_all|question|status|help",
  "door": "top_left|top_right|bottom_left|bottom_right|all",
  "degrees": number (1-180),
  "speed": number (0.1-10),
  "message": "Your response message",
  "needsInput": boolean
}

EXAMPLES:
"open top left 45 degrees 2 seconds" ??{"action":"open","door":"top_left","degrees":45,"speed":2,"message":"Opening Top Left door to 45 degrees at 2 seconds speed","needsInput":false}
"open top left door fast" ??{"action":"open","door":"top_left","degrees":90,"speed":0.5,"message":"Opening Top Left door to 90 degrees at fast speed","needsInput":false}
"open top left door slow" ??{"action":"open","door":"top_left","degrees":90,"speed":3,"message":"Opening Top Left door to 90 degrees at slow speed","needsInput":false}
"open door" ??{"action":"question","door":"","degrees":0,"speed":0,"message":"Which door would you like to open? Top Left, Top Right, Bottom Left, or Bottom Right?","needsInput":true}
"close all doors" ??{"action":"close_all","door":"all","degrees":0,"speed":1,"message":"Closing all doors","needsInput":false}

REMEMBER: ONLY JSON, NO OTHER TEXT!`;
  }

  // Parse LLM response
  private async parseLLMResponse(originalInput: string, llmResponse: string): Promise<LLMResponse | null> {
    try {
      // Try to extract JSON from response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('No JSON found in LLM response, using fallback parsing');
        return this.fallbackLLMParsing(originalInput, llmResponse);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Parsed LLM response:', parsed);

      // Validate and create response with defaults
      if (parsed.action === 'open' && parsed.door) {
        // Apply defaults if not specified
        const degrees = parsed.degrees || 90; // Default to 90 degrees
        let speed = parsed.speed || 1; // Default to 1 second

        // Convert descriptive speed to numeric if needed
        if (typeof speed === 'string') {
          const convertedSpeed = this.extractSpeed(speed);
          if (convertedSpeed !== null) {
            speed = convertedSpeed;
          }
        }

        const doorType = this.parseDoorType(parsed.door);
        if (doorType) {
          this.resetConversation();
          const result = await this.executeAnimationCommand({
            door: doorType,
            action: AnimationAction.OPEN,
            degrees: degrees,
            speed: speed
          });
          return result;
        }
      } else if (parsed.action === 'close' && parsed.door) {
        // Close command
        const doorType = this.parseDoorType(parsed.door);
        if (doorType) {
          this.resetConversation();
          const result = await this.executeAnimationCommand({
            door: doorType,
            action: AnimationAction.CLOSE,
            degrees: 0,
            speed: parsed.speed || 1
          });
          return result;
        }
      } else if (parsed.action === 'close_all' && parsed.door === 'all') {
        // Close all doors command
        this.resetConversation();
        const result = await this.closeAllDoors();
        return result;
      } else if (parsed.action === 'question') {
        // Question/confirmation needed
        return {
          type: 'question',
          message: parsed.message || 'I need more information. What would you like to do?',
          awaitingInput: true
        };
      } else if (parsed.action === 'status') {
        return this.handleStatusRequest();
      } else if (parsed.action === 'help') {
        return this.handleHelpRequest();
      }

      // If we can't parse the action, use fallback
      return await this.fallbackLLMParsing(originalInput, llmResponse);

    } catch (error) {
      console.error('Error parsing LLM response:', error);
      return this.fallbackLLMParsing(originalInput, llmResponse);
    }
  }

  // Fallback parsing when LLM response isn't in expected format
  private async fallbackLLMParsing(originalInput: string, llmResponse: string): Promise<LLMResponse> {
    // Extract door information from LLM response
    const doorType = this.identifyDoor(llmResponse) || this.identifyDoor(originalInput);

    if (doorType && !this.conversationState.currentDoor) {
      this.conversationState.currentDoor = doorType;
      this.conversationState.awaitingDegrees = true;
      return {
        type: 'question',
        message: `Great! I understand you want to control the ${this.getDoorDisplayName(doorType)} door. How many degrees should it open?`,
        awaitingInput: true
      };
    }

    // Extract degrees if we have a door
    if (this.conversationState.currentDoor && this.conversationState.awaitingDegrees) {
      const degrees = this.extractDegrees(llmResponse) || this.extractDegrees(originalInput);
      if (degrees !== null) {
        this.conversationState.currentDegrees = degrees;
        this.conversationState.awaitingDegrees = false;
        this.conversationState.awaitingSpeed = true;
        return {
          type: 'question',
          message: `Perfect! The ${this.getDoorDisplayName(this.conversationState.currentDoor)} door will open ${degrees} degrees. Now, what speed should the animation be?`,
          awaitingInput: true
        };
      } else {
        // Apply default degrees if none specified
        this.conversationState.currentDegrees = 90;
        this.conversationState.awaitingDegrees = false;
        this.conversationState.awaitingSpeed = true;
        return {
          type: 'question',
          message: `I'll use the default of 90 degrees for the ${this.getDoorDisplayName(this.conversationState.currentDoor)} door. Now, what speed should the animation be?`,
          awaitingInput: true
        };
      }
    }

    // Extract speed if we have door and degrees
    if (this.conversationState.currentDoor && this.conversationState.awaitingSpeed) {
      const speed = this.extractSpeed(llmResponse) || this.extractSpeed(originalInput);
      if (speed !== null) {
        this.conversationState.currentSpeed = speed;
        this.conversationState.awaitingSpeed = false;

        const command: AnimationCommand = {
          door: this.conversationState.currentDoor,
          action: AnimationAction.OPEN,
          degrees: this.conversationState.currentDegrees,
          speed: this.conversationState.currentSpeed
        };

        this.resetConversation();
        return this.executeAnimationCommand(command);
      } else {
        // Apply default speed if none specified
        this.conversationState.currentSpeed = 1;
        this.conversationState.awaitingSpeed = false;

        const command: AnimationCommand = {
          door: this.conversationState.currentDoor,
          action: AnimationAction.OPEN,
          degrees: this.conversationState.currentDegrees,
          speed: this.conversationState.currentSpeed
        };

        this.resetConversation();
        return this.executeAnimationCommand(command);
      }
    }

    // If we can't extract anything useful, ask for clarification
    return {
      type: 'question',
      message: llmResponse || 'I need more information. Which door would you like to control?',
      awaitingInput: true
    };
  }

  // Parse door type from string
  private parseDoorType(doorString: string): DoorType | null {
    const doorMap: Record<string, DoorType> = {
      'top_left': DoorType.TOP_LEFT,
      'top_right': DoorType.TOP_RIGHT,
      'bottom_left': DoorType.BOTTOM_LEFT,
      'bottom_right': DoorType.BOTTOM_RIGHT
    };

    return doorMap[doorString] || null;
  }

  // Initialize conversation state
  resetConversation() {
    this.conversationState = {};
  }

  // Main method to process user input and generate LLM response
  async processUserInput(userInput: string): Promise<LLMResponse> {
    try {
      this.lastUserInput = userInput;
      this.lastInputLocale = this.detectInputLocale(userInput);
      const input = userInput.toLowerCase().trim();

      // Debug logging
      console.log('Processing input:', input);
      console.log('Current conversation state:', this.conversationState);

      // Try LLM first, fall back to rule-based if not available
      const llmResponse = await this.processWithLLM(input);
      if (llmResponse) {
        return llmResponse;
      }

      // Fall back to rule-based system
      console.log('LLM not available, using rule-based system');
      if (this.isDoorCommand(input)) {
        console.log('Input recognized as door command');
        return await this.handleDoorCommand(input);
      }

      console.log('Input not recognized as door command');
      return {
        type: 'error',
        message: "Sabby has not integrated this functionality. I can only help with door operations (open, close, set degrees, set speed)."
      };
    } catch (error) {
      console.error('Error processing user input:', error);
      return {
        type: 'error',
        message: "I encountered an error processing your request. Please try again."
      };
    }
  }

  // Check if input is a door-related command
  private isDoorCommand(input: string): boolean {
    // If we're in an active conversation, accept any input
    if (this.conversationState.currentDoor ||
      this.conversationState.awaitingDegrees ||
      this.conversationState.awaitingSpeed) {
      return true;
    }

    // Otherwise, check for door-related keywords
    const doorKeywords = ['door', 'open', 'close', 'degree', 'speed', 'left', 'right', 'top', 'bottom', 'freezer', 'refrigerator'];
    return doorKeywords.some(keyword => input.toLowerCase().includes(keyword));
  }

  // Handle door-related commands
  private async handleDoorCommand(input: string): Promise<LLMResponse> {
    // Check for complete commands (all parameters provided)
    const completeCommand = await this.parseCompleteCommand(input);
    if (completeCommand) {
      return await this.executeAnimationCommand(completeCommand);
    }

    // Handle confirmation responses (yes, no, correct, etc.)
    if (this.isConfirmation(input)) {
      return this.handleConfirmation(input);
    }

    // Handle negation responses (no, not that, wrong, etc.)
    if (this.isNegation(input)) {
      return this.handleNegation(input);
    }

    // Handle help requests
    if (this.isHelpRequest(input)) {
      return this.handleHelpRequest();
    }

    // Handle status requests
    if (this.isStatusRequest(input)) {
      return this.handleStatusRequest();
    }

    // Check for door specification
    const doorType = this.identifyDoor(input);
    if (doorType && !this.conversationState.currentDoor) {
      this.conversationState.currentDoor = doorType;
      this.conversationState.awaitingDegrees = true;
      return {
        type: 'question',
        message: `Great! I understand you want to control the ${this.getDoorDisplayName(doorType)} door. How many degrees should it open? (e.g., 45, 90, 180 degrees)`,
        awaitingInput: true
      };
    }

    // Check for degrees specification
    const degrees = this.extractDegrees(input);
    if (degrees !== null && this.conversationState.currentDoor && this.conversationState.awaitingDegrees) {
      this.conversationState.currentDegrees = degrees;
      this.conversationState.awaitingDegrees = false;
      this.conversationState.awaitingSpeed = true;
      return {
        type: 'question',
        message: `Perfect! The ${this.getDoorDisplayName(this.conversationState.currentDoor)} door will open ${degrees} degrees. Now, what speed should the animation be? (Enter time in seconds, e.g., 1 second, 2 seconds, fast, slow)`,
        awaitingInput: true
      };
    }

    // Check for speed specification
    const speed = this.extractSpeed(input);
    if (speed !== null && this.conversationState.currentDoor && this.conversationState.awaitingSpeed) {
      this.conversationState.currentSpeed = speed;
      this.conversationState.awaitingSpeed = false;

      // Execute the complete command
      const command: AnimationCommand = {
        door: this.conversationState.currentDoor,
        action: AnimationAction.OPEN,
        degrees: this.conversationState.currentDegrees,
        speed: this.conversationState.currentSpeed
      };

      this.resetConversation();
      return await this.executeAnimationCommand(command);
    }

    // Handle open/close commands with context
    if (input.includes('open') || input.includes('close')) {
      // Check for "close all doors" command
      if (input.includes('close') && (input.includes('all') || input.includes('every') || input.includes('both'))) {
        return await this.closeAllDoors();
      }

      if (!this.conversationState.currentDoor) {
        return {
          type: 'question',
          message: "Which door would you like to open/close? Please specify: Top Left, Top Right, Bottom Left, or Bottom Right.",
          awaitingInput: true
        };
      }

      const action = input.includes('open') ? AnimationAction.OPEN : AnimationAction.CLOSE;
      const command: AnimationCommand = {
        door: this.conversationState.currentDoor,
        action: action,
        degrees: action === AnimationAction.OPEN ? (this.conversationState.currentDegrees || 90) : 0,
        speed: this.conversationState.currentSpeed || 1
      };

      this.resetConversation();
      return await this.executeAnimationCommand(command);
    }

    // If we have a door but need more information
    if (this.conversationState.currentDoor && this.conversationState.awaitingDegrees) {
      return {
        type: 'question',
        message: `How many degrees should the ${this.getDoorDisplayName(this.conversationState.currentDoor)} door open? (e.g., 45, 90, 180 degrees)`,
        awaitingInput: true
      };
    }

    if (this.conversationState.currentDoor && this.conversationState.awaitingSpeed) {
      return {
        type: 'question',
        message: `What speed should the animation be? (Enter time in seconds, e.g., 1 second, 2 seconds, fast, slow)`,
        awaitingInput: true
      };
    }

    // Handle partial door identification
    if (this.isPartialDoorReference(input)) {
      return this.handlePartialDoorReference(input);
    }

    // Default response for incomplete commands
    return {
      type: 'question',
      message: "I need more information. Which door would you like to control? You can say:\n??Top Left, Top Right, Bottom Left, Bottom Right\n??Refrigerator left/right, Freezer left/right\n??Left door, Right door, Upper door, Lower door",
      awaitingInput: true
    };
  }

  // Parse complete commands (all parameters in one input)
  private async parseCompleteCommand(input: string): Promise<AnimationCommand | AnimationCommand[] | null> {

    // Damper service command detection
    // Open the refrigerator door to service the left damper.
    // Open the refrigerator door to service the right damper.
    if (isFridgeDamperCommand(input)) {
      return await getFridgeDamperAnimationCommands(input);
    }


    const doorType = this.identifyDoor(input);
    if (!doorType) return null;

    const degrees = this.extractDegrees(input);
    const speed = this.extractSpeed(input);
    const isOpen = input.includes('open');
    const isClose = input.includes('close');

    if (doorType && (isOpen || isClose) && degrees !== null && speed !== null) {
      return {
        door: doorType,
        action: isOpen ? AnimationAction.OPEN : AnimationAction.CLOSE,
        degrees: isOpen ? degrees : 0,
        speed: speed
      };
    }

    return null;
  }

  // Identify door type from natural language
  private identifyDoor(input: string): DoorType | null {
    console.log('Identifying door from input:', input);
    // Sort keys by length in descending order to prioritize more specific matches
    const sortedEntries = Object.entries(DOOR_MAPPING).sort((a, b) => b[0].length - a[0].length);

    for (const [key, value] of sortedEntries) {
      if (input.includes(key)) {
        console.log('Found door match:', key, '->', value);
        return value;
      }
    }
    console.log('No door match found');
    return null;
  }

  // Extract degrees from input
  private extractDegrees(input: string): number | null {
    // First check for explicit degree format
    const degreeMatch = input.match(/(\d+)\s*degrees?/i);
    if (degreeMatch) {
      const degrees = parseInt(degreeMatch[1]);
      return Math.min(Math.max(degrees, 1), 180); // Clamp between 1 and 180
    }

    // Check for simple numbers (common case)
    const numberMatch = input.match(/(\d+)/);
    if (numberMatch) {
      const degrees = parseInt(numberMatch[1]);
      if (degrees >= 1 && degrees <= 180) {
        return degrees;
      }
    }

    // Check for common degree values
    if (input.includes('90') || input.includes('ninety') || input.includes('90\u00b0')) return 90;
    if (input.includes('45') || input.includes('forty-five') || input.includes('45\u00b0')) return 45;
    if (input.includes('180') || input.includes('one eighty') || input.includes('180\u00b0')) return 180;
    if (input.includes('30') || input.includes('thirty') || input.includes('30\u00b0')) return 30;
    if (input.includes('60') || input.includes('sixty') || input.includes('60\u00b0')) return 60;
    if (input.includes('120') || input.includes('one twenty') || input.includes('120\u00b0')) return 120;
    // Common door positions
    if (input.includes('half') || input.includes('halfway') || input.includes('mid')) return 90;
    if (input.includes('quarter') || input.includes('quarter way')) return 45;
    if (input.includes('fully') || input.includes('completely') || input.includes('all the way')) return 180;
    if (input.includes('slightly') || input.includes('little bit') || input.includes('small')) return 30;

    return null;
  }

  // Extract speed from input
  private extractSpeed(input: string): number | null {
    const speedMatch = input.match(/(\d+(?:\.\d+)?)\s*seconds?/i);
    if (speedMatch) {
      const speed = parseFloat(speedMatch[1]);
      return Math.min(Math.max(speed, 0.1), 10); // Clamp between 0.1 and 10 seconds
    }

    // Check for common speed values
    if (input.includes('1 second') || input.includes('one second') || input.includes('1 sec')) return 1;
    if (input.includes('2 seconds') || input.includes('two seconds') || input.includes('2 secs')) return 2;
    if (input.includes('3 seconds') || input.includes('three seconds') || input.includes('3 secs')) return 3;
    if (input.includes('0.5 seconds') || input.includes('half second') || input.includes('0.5 sec')) return 0.5;

    // Speed adjectives
    if (input.includes('fast') || input.includes('quick') || input.includes('rapid') || input.includes('speed')) return 0.5;
    if (input.includes('slow') || input.includes('gentle') || input.includes('gradual')) return 3;
    if (input.includes('medium') || input.includes('normal') || input.includes('standard')) return 1.5;
    if (input.includes('very fast') || input.includes('instant') || input.includes('immediate')) return 0.2;
    if (input.includes('very slow') || input.includes('very gentle')) return 5;

    return null;
  }

  // Execute animation command
  private async executeAnimationCommand(commands: AnimationCommand | AnimationCommand[]): Promise<LLMResponse> {
    if (!this.doorControls) {
      return {
        type: 'error',
        message: "Door controls are not available. Please wait for the 3D model to load completely."
      };
    }

    try {
      AnimatorAgent.executionCounter++;
      const totalExecutions = AnimatorAgent.executionCounter;

      // Check if commands are damper commands (need simultaneous execution)
      const commandsArray = Array.isArray(commands) ? commands : [commands];
      console.log('commandsArray>> ', JSON.stringify(commandsArray.map(c => ({ door: c.door, action: c.action, degrees: c.degrees }))));
      const isDamperCommands = await areFridgeDamperCommands(commandsArray);

      if (isDamperCommands) {
        const locale = this.lastInputLocale;
        const responseVerbPromise = this.resolveActionVerb(this.lastUserInput, AnimationAction.OPEN, locale);
        let remaining = commandsArray.length;
        let isCompleted = false;

        const handleCompletion = () => {
          if (isCompleted) {
            return;
          }

          if (remaining <= 0) return;
          remaining -= 1;

          if (remaining <= 0) {
            isCompleted = true;

            void responseVerbPromise.then((responseVerb) => {
              const completionMessage = locale === 'ko'
                ? `${responseVerb} 댐퍼 서비스를 위한 문 열기 완료`
                : `Completed: ${responseVerb} doors opened for damper service`;
              console.log('responseVerb>> ', responseVerb);
              this.onActionCompleted?.(completionMessage);
              // Add to animation history
              if (this.animationHistoryService) {
                commandsArray.forEach(command => {
                  this.animationHistoryService?.addAnimationHistory(command, completionMessage);
                });
              } else {
                console.warn('Animation history service not available');
              }
            });
          }
        };

        // Execute all damper commands simultaneously
        commandsArray.forEach(command => {
          const degrees = command.degrees || 90;
          const speed = command.speed || 1;

          if (command.action === AnimationAction.OPEN) {
            if (command.door === DoorType.TOP_LEFT) {
              this.doorControls.openByDegrees(degrees, speed, handleCompletion);
            } else if (command.door === DoorType.TOP_RIGHT) {
              this.doorControls.openRightByDegrees(degrees, speed, handleCompletion);
            } else if (command.door === DoorType.BOTTOM_LEFT) {
              this.doorControls.openLowerLeftByDegrees(degrees, speed, handleCompletion);
            } else if (command.door === DoorType.BOTTOM_RIGHT) {
              this.doorControls.openLowerRightByDegrees(degrees, speed, handleCompletion);
            }
          } else if (command.action === AnimationAction.CLOSE) {
            if (command.door === DoorType.TOP_LEFT) {
              this.doorControls.close(speed, handleCompletion);
            } else if (command.door === DoorType.TOP_RIGHT) {
              this.doorControls.closeRight(speed, handleCompletion);
            } else if (command.door === DoorType.BOTTOM_LEFT) {
              this.doorControls.closeLowerLeft(speed, handleCompletion);
            } else if (command.door === DoorType.BOTTOM_RIGHT) {
              this.doorControls.closeLowerRight(speed, handleCompletion);
            }
          }
        });

        const responseVerb = await responseVerbPromise;
        console.log('Damper service response verb:', responseVerb);
        const message = 'Opening doors for damper service';

        // Calculate max speed to determine animation duration
        const maxSpeed = Math.max(...commandsArray.map(cmd => cmd.speed || 1));
        console.log('Waiting for damper animation completion, max speed:', maxSpeed, 'seconds');

        // Wait for the longest animation to complete
        await new Promise(resolve => setTimeout(resolve, maxSpeed * 1000));
        console.log('Damper animation wait completed');

        // Move camera to the left door damper node after damper animation
        if (this.cameraMovementService) {
          await this.cameraMovementService.moveCameraToLeftDoorDamper();

          // 카메라 이동 히스토리 기록
          const cameraMoveCommand: AnimationCommand = {
            door: DoorType.TOP_LEFT,
            action: AnimationAction.CAMERA_MOVE,
            degrees: 0,
            speed: 1
          };
          const cameraMessage = 'Camera moved to damper position';
          if (this.animationHistoryService) {
            this.animationHistoryService.addAnimationHistory(cameraMoveCommand, cameraMessage);
          } else {
            console.warn('Animation history service not available');
          }

          // 댐퍼 커버 조립 애니메이션 실행
          try {
            const manualAssemblyManager = getManualAssemblyManager();
            await manualAssemblyManager.assembleDamperCover({ duration: 1500 });
            console.log('Damper cover assembly completed');
          } catch (error) {
            console.error('Error during damper cover assembly:', error);
          }
        } else {
          console.log('CameraMovementService is not initialized');
        }

        return {
          type: 'action',
          message,
          command: commandsArray[0] // Return first command as representative
        };
      }

      // Handle single command case
      const command = commandsArray[0];
      const degrees = command.degrees || 90;
      const speed = command.speed || 1;
      const locale = this.lastInputLocale;
      const doorLabel = this.getDoorDisplayNameForLocale(command.door, locale);
      const responseVerbPromise = this.resolveActionVerb(this.lastUserInput, command.action, locale);
      let isCompleted = false;
      const handleCompletion = () => {
        console.log('handleCompletion111');
        if (isCompleted) return;
        isCompleted = true;
        void responseVerbPromise.then((responseVerb) => {
          const completionMessage = this.buildCompletionMessage(
            doorLabel,
            degrees,
            command.action,
            responseVerb,
            locale
          );
          console.log('Single command completed:', command.action, doorLabel);
          this.onActionCompleted?.(completionMessage);
          // Add to animation history
          if (this.animationHistoryService) {
            console.log('Adding to animation history:', command);
            this.animationHistoryService.addAnimationHistory(command, completionMessage);
          } else {
            console.warn('Animation history service not available for single command');
          }
        });
      };

      if (command.action === AnimationAction.OPEN) {
        if (command.door === DoorType.TOP_LEFT) {
          this.doorControls.openByDegrees(degrees, speed, handleCompletion);
        } else if (command.door === DoorType.TOP_RIGHT) {
          this.doorControls.openRightByDegrees(degrees, speed, handleCompletion);
        } else if (command.door === DoorType.BOTTOM_LEFT) {
          this.doorControls.openLowerLeftByDegrees(degrees, speed, handleCompletion);
        } else if (command.door === DoorType.BOTTOM_RIGHT) {
          this.doorControls.openLowerRightByDegrees(degrees, speed, handleCompletion);
        }
      } else if (command.action === AnimationAction.CLOSE) {
        if (command.door === DoorType.TOP_LEFT) {
          this.doorControls.close(speed, handleCompletion);
        } else if (command.door === DoorType.TOP_RIGHT) {
          this.doorControls.closeRight(speed, handleCompletion);
        } else if (command.door === DoorType.BOTTOM_LEFT) {
          this.doorControls.closeLowerLeft(speed, handleCompletion);
        } else if (command.door === DoorType.BOTTOM_RIGHT) {
          this.doorControls.closeLowerRight(speed, handleCompletion);
        }
      }

      const responseVerb = await responseVerbPromise;
      const message = this.buildActionMessage(
        doorLabel,
        degrees,
        command.action,
        responseVerb,
        locale
      );

      console.log('Returning action response:', {
        type: 'action',
        message,
        command
      });

      return {
        type: 'action',
        message,
        command: command
      };
    } catch (error) {
      console.error('Error executing animation command:', error);
      return {
        type: 'error',
        message: `Failed to execute the animation command: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Get door function name for door controls (unused for now)
  // private getDoorFunctionName(doorType: DoorType): string {
  //   switch (doorType) {
  //     case DoorType.TOP_LEFT: return 'leftDoor';
  //     case DoorType.TOP_RIGHT: return 'rightDoor';
  //     case DoorType.BOTTOM_LEFT: return 'lowerLeftDoor';
  //     case DoorType.BOTTOM_RIGHT: return 'lowerRightDoor';
  //     default: return 'leftDoor';
  //   }
  // }

  // Get display name for door
  private getDoorDisplayName(doorType: DoorType): string {
    switch (doorType) {
      case DoorType.TOP_LEFT: return 'Top Left (Refrigerator Left)';
      case DoorType.TOP_RIGHT: return 'Top Right (Refrigerator Right)';
      case DoorType.BOTTOM_LEFT: return 'Bottom Left (Freezer Left)';
      case DoorType.BOTTOM_RIGHT: return 'Bottom Right (Freezer Right)';
      default: return 'Unknown Door';
    }
  }

  private getDoorDisplayNameForLocale(doorType: DoorType, locale: 'en' | 'ko'): string {
    if (locale === 'ko') {
      switch (doorType) {
        case DoorType.TOP_LEFT: return '상단 왼쪽(냉장고)';
        case DoorType.TOP_RIGHT: return '상단 오른쪽(냉장고)';
        case DoorType.BOTTOM_LEFT: return '하단 왼쪽(냉동고)';
        case DoorType.BOTTOM_RIGHT: return '하단 오른쪽(냉동고)';
        default: return '알 수 없는 도어';
      }
    }
    return this.getDoorDisplayName(doorType);
  }

  private buildActionMessage(
    doorLabel: string,
    degrees: number,
    action: AnimationAction,
    responseVerb: string,
    locale: 'en' | 'ko'
  ): string {
    if (locale === 'ko') {
      if (action === AnimationAction.OPEN) {
        return `${doorLabel} 문을 ${degrees}도 ${responseVerb}`;
      }
      return `${doorLabel} 문을 ${responseVerb}`;
    }
    if (action === AnimationAction.OPEN) {
      return `${doorLabel} door ${responseVerb} to ${degrees} degrees.`;
    }
    return `${doorLabel} door ${responseVerb}.`;
  }

  private buildCompletionMessage(
    doorLabel: string,
    degrees: number,
    action: AnimationAction,
    responseVerb: string,
    locale: 'en' | 'ko'
  ): string {
    if (locale === 'ko') {
      if (action === AnimationAction.OPEN) {
        return `${doorLabel} 문을 ${degrees}도 ${responseVerb}`;
      }
      return `${doorLabel} 문을 ${responseVerb}`;
    }
    if (action === AnimationAction.OPEN) {
      return `Completed: ${doorLabel} door ${responseVerb} to ${degrees} degrees.`;
    }
    return `Completed: ${doorLabel} door ${responseVerb}.`;
  }

  private async resolveActionVerb(
    input: string,
    action: AnimationAction,
    locale: 'en' | 'ko'
  ): Promise<string> {
    if (this.actionVerbResolver) {
      try {
        const resolved = await this.actionVerbResolver(input, action, locale);
        if (resolved && typeof resolved === 'string') {
          return resolved;
        }
      } catch (error) {
        console.warn('Action verb resolver failed:', error);
      }
    }
    return this.getDefaultActionVerb(input, action, locale);
  }

  private getDefaultActionVerb(
    _input: string,
    action: AnimationAction,
    locale: 'en' | 'ko'
  ): string {
    if (locale === 'ko') {
      if (action === AnimationAction.OPEN) return '열었습니다';
      if (action === AnimationAction.CLOSE) return '닫았습니다';
      return '완료했습니다';
    }
    if (action === AnimationAction.OPEN) return 'opened';
    if (action === AnimationAction.CLOSE) return 'closed';
    return 'completed';
  }

  private getCompletionMessage(
    command: AnimationCommand,
    degrees: number,
    locale: 'en' | 'ko'
  ): string {
    const doorLabel = this.getDoorDisplayNameForLocale(command.door, locale);
    const responseVerb = this.getDefaultActionVerb('', command.action, locale);
    return this.buildCompletionMessage(doorLabel, degrees, command.action, responseVerb, locale);
  }

  private detectInputLocale(input: string): 'en' | 'ko' {
    if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(input)) return 'ko';
    if (/[A-Za-z]/.test(input)) return 'en';
    return this.lastInputLocale;
  }

  private detectInputLocaleLegacy(input: string): 'en' | 'ko' {
    return this.detectInputLocale(input);
  }

  // Get conversation state for debugging
  getConversationState(): ConversationState {
    return { ...this.conversationState };
  }

  // Reset all door states back to closed
  resetDoors(speedSeconds: number = 0.5): boolean {
    if (!this.doorControls) {
      return false;
    }

    try {
      const speed = Math.min(Math.max(speedSeconds, 0.1), 10);
      this.doorControls.close(speed);
      this.doorControls.closeRight(speed);
      this.doorControls.closeLowerLeft(speed);
      this.doorControls.closeLowerRight(speed);
      this.resetConversation();
      return true;
    } catch (error) {
      console.error('Error resetting doors:', error);
      return false;
    }
  }

  // Check if input is a confirmation
  private isConfirmation(input: string): boolean {
    const confirmWords = ['yes', 'yeah', 'yep', 'correct', 'right', 'that\'s right', 'exactly', 'sure', 'ok', 'okay', 'fine', 'good', 'perfect'];
    return confirmWords.some(word => input.toLowerCase().includes(word));
  }

  // Handle confirmation responses
  private handleConfirmation(_input: string): LLMResponse {
    if (this.conversationState.awaitingDegrees) {
      return {
        type: 'question',
        message: `Great! Now how many degrees should the ${this.getDoorDisplayName(this.conversationState.currentDoor!)} door open? (e.g., 45, 90, 180 degrees)`,
        awaitingInput: true
      };
    }

    if (this.conversationState.awaitingSpeed) {
      return {
        type: 'question',
        message: `Perfect! What speed should the animation be? (Enter time in seconds, e.g., 1 second, 2 seconds, fast, slow)`,
        awaitingInput: true
      };
    }

    return {
      type: 'question',
      message: "I'm ready to help! Which door would you like to control?",
      awaitingInput: true
    };
  }

  // Check if input is a negation
  private isNegation(input: string): boolean {
    const negateWords = ['no', 'not', 'wrong', 'incorrect', 'that\'s not right', 'nope', 'nah', 'different', 'other'];
    return negateWords.some(word => input.toLowerCase().includes(word));
  }

  // Handle negation responses
  private handleNegation(_input: string): LLMResponse {
    this.resetConversation();
    return {
      type: 'question',
      message: "No problem! Let me start over. Which door would you like to control? (Top Left, Top Right, Bottom Left, Bottom Right)",
      awaitingInput: true
    };
  }

  // Check if input is a help request
  private isHelpRequest(input: string): boolean {
    const helpWords = ['help', 'what can you do', 'how does this work', 'show me', 'explain', 'guide', 'assist', 'support'];
    return helpWords.some(word => input.toLowerCase().includes(word));
  }

  // Handle help requests
  private handleHelpRequest(): LLMResponse {
    return {
      type: 'info',
      message: `I'm Sabby, your Animator Agent! I can help you control the refrigerator doors. Here's what I can do:

Door Types:
- Top Left/Right (Refrigerator doors)
- Bottom Left/Right (Freezer doors)

Commands:
- "Open the top left door" - Start a conversation
- "Close the freezer door" - Close specific doors
- "Close all doors" - Close all doors at once
- "Open left door 45 degrees in 2 seconds" - Complete command

Tips:
- You can specify degrees (1-180)
- Speed can be in seconds or words like "fast", "slow"
- I'll guide you through each step if needed

Try saying: "Open the top left door" or "Close all doors" to get started!`,
      awaitingInput: true
    };
  }

  // Check if input is a status request
  private isStatusRequest(input: string): boolean {
    const statusWords = ['status', 'state', 'what\'s open', 'which doors', 'current', 'now', 'show me', 'tell me'];
    return statusWords.some(word => input.toLowerCase().includes(word));
  }

  // Handle status requests
  private handleStatusRequest(): LLMResponse {
    if (!this.doorControls) {
      return {
        type: 'error',
        message: "Door controls are not available. Please wait for the 3D model to load completely."
      };
    }

    try {
      const leftState = this.doorControls.getState();
      const rightState = this.doorControls.getRightState();
      const lowerLeftState = this.doorControls.getLowerLeftState();
      const lowerRightState = this.doorControls.getLowerRightState();

      return {
        type: 'info',
        message: `Current Door Status:

- Top Left (Refrigerator): ${leftState.isOpen ? 'OPEN' : 'CLOSED'}${leftState.isOpen ? ` (${leftState.degrees.toFixed(0)} deg)` : ''}
- Top Right (Refrigerator): ${rightState.isOpen ? 'OPEN' : 'CLOSED'}${rightState.isOpen ? ` (${rightState.degrees.toFixed(0)} deg)` : ''}
- Bottom Left (Freezer): ${lowerLeftState.isOpen ? 'OPEN' : 'CLOSED'}${lowerLeftState.isOpen ? ` (${lowerLeftState.degrees.toFixed(0)} deg)` : ''}
- Bottom Right (Freezer): ${lowerRightState.isOpen ? 'OPEN' : 'CLOSED'}${lowerRightState.isOpen ? ` (${lowerRightState.degrees.toFixed(0)} deg)` : ''}

What would you like to do next?`,
        awaitingInput: true
      };
    } catch (error) {
      return {
        type: 'error',
        message: "Unable to get door status. Please try again."
      };
    }
  }

  // Check if input is a partial door reference
  private isPartialDoorReference(input: string): boolean {
    const partialWords = ['left', 'right', 'top', 'bottom', 'upper', 'lower', 'freezer', 'refrigerator'];
    return partialWords.some(word => input.toLowerCase().includes(word)) && !this.conversationState.currentDoor;
  }

  // Close all doors
  private async closeAllDoors(): Promise<LLMResponse> {
    if (!this.doorControls) {
      return {
        type: 'error',
        message: "Door controls are not available. Please wait for the 3D model to load completely."
      };
    }

    try {
      // Close all doors with default speed
      const locale = this.lastInputLocale;
      const completionMessage = locale === 'ko'
        ? '모든 문이 닫혔습니다.'
        : 'Completed: all doors are closed.';
      let remaining = 4;
      const handleCompletion = () => {
        console.log('handleCompletion222');
        remaining -= 1;
        if (remaining <= 0) {
          console.log('All doors closed, adding to history');
          this.onActionCompleted?.(completionMessage);
          // Add to animation history for each door
          if (this.animationHistoryService) {
            console.log('Adding close all doors to history');
            [DoorType.TOP_LEFT, DoorType.TOP_RIGHT, DoorType.BOTTOM_LEFT, DoorType.BOTTOM_RIGHT].forEach(door => {
              this.animationHistoryService?.addAnimationHistory(
                { door, action: AnimationAction.CLOSE, degrees: 0, speed: 1 },
                completionMessage
              );
            });
          } else {
            console.warn('Animation history service not available for close all');
          }
        }
      };

      this.doorControls.close(1, handleCompletion);
      this.doorControls.closeRight(1, handleCompletion);
      this.doorControls.closeLowerLeft(1, handleCompletion);
      this.doorControls.closeLowerRight(1, handleCompletion);

      this.resetConversation();
      return {
        type: 'action',
        message: "Closing all doors: Top Left, Top Right, Bottom Left, and Bottom Right doors are now closing.",
        command: {
          door: DoorType.TOP_LEFT, // Dummy door type for the command
          action: AnimationAction.CLOSE,
          degrees: 0,
          speed: 1
        }
      };
    } catch (error) {
      console.error('Error closing all doors:', error);
      return {
        type: 'error',
        message: `Failed to close all doors: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Handle partial door references
  private handlePartialDoorReference(input: string): LLMResponse {
    if (input.includes('left') && input.includes('top')) {
      this.conversationState.currentDoor = DoorType.TOP_LEFT;
      this.conversationState.awaitingDegrees = true;
      return {
        type: 'question',
        message: `I think you mean the Top Left (Refrigerator Left) door. Is that correct? How many degrees should it open?`,
        awaitingInput: true
      };
    }

    if (input.includes('right') && input.includes('top')) {
      this.conversationState.currentDoor = DoorType.TOP_RIGHT;
      this.conversationState.awaitingDegrees = true;
      return {
        type: 'question',
        message: `I think you mean the Top Right (Refrigerator Right) door. Is that correct? How many degrees should it open?`,
        awaitingInput: true
      };
    }

    if (input.includes('left') && (input.includes('bottom') || input.includes('freezer'))) {
      this.conversationState.currentDoor = DoorType.BOTTOM_LEFT;
      this.conversationState.awaitingDegrees = true;
      return {
        type: 'question',
        message: `I think you mean the Bottom Left (Freezer Left) door. Is that correct? How many degrees should it open?`,
        awaitingInput: true
      };
    }

    if (input.includes('right') && (input.includes('bottom') || input.includes('freezer'))) {
      this.conversationState.currentDoor = DoorType.BOTTOM_RIGHT;
      this.conversationState.awaitingDegrees = true;
      return {
        type: 'question',
        message: `I think you mean the Bottom Right (Freezer Right) door. Is that correct? How many degrees should it open?`,
        awaitingInput: true
      };
    }

    return {
      type: 'question',
      message: "I'm not sure which door you mean. Could you be more specific? (e.g., Top Left, Bottom Right, Refrigerator Left, Freezer Right)",
      awaitingInput: true
    };
  }
}

// Export singleton instance
export const animatorAgent = new AnimatorAgent();

