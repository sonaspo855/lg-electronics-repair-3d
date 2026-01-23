import { useEffect, useMemo, useRef, useState } from "react";
import type { Object3D } from "three";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { ModelViewer } from "@/components/shared/viewer";
import { animatorAgent, type LLMResponse } from "@/services/AnimatorAgent";
import { AnimationHistoryService } from "@/services/AnimationHistoryService";
import { ManualEditorSidebar } from "@/components/pages/manual-editor";
import { AnimationHistoryPanel, type AnimationHistoryItem } from "@/components/pages/manual-editor";
import "./ManualEditorPage.css";

type ManualEditorPageProps = {
  modelPath?: string;
  onBack?: () => void;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

type DoorLabel = {
  title: string;
  detail: string;
};

type DoorExportConfig = {
  pivotName: string;
  direction: 1 | -1;
};

const DOOR_EXPORT: Record<string, DoorExportConfig> = {
  top_left: { pivotName: "DoorHingePivot_Left", direction: -1 },
  top_right: { pivotName: "DoorHingePivot_Right", direction: 1 },
  bottom_left: { pivotName: "DoorHingePivot_LowerLeft", direction: -1 },
  bottom_right: { pivotName: "DoorHingePivot_LowerRight", direction: 1 },
};

const formatDoorLabel = (door?: string): DoorLabel => {
  switch (door) {
    case "top_left":
      return { title: "Top Left Door", detail: "Refrigerator" };
    case "top_right":
      return { title: "Top Right Door", detail: "Refrigerator" };
    case "bottom_left":
      return { title: "Bottom Left Door", detail: "Freezer" };
    case "bottom_right":
      return { title: "Bottom Right Door", detail: "Freezer" };
    default:
      return { title: "Door Action", detail: "All Doors" };
  }
};

const sanitizeText = (value: string) =>
  value.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();

const buildHistoryItem = (
  response: LLMResponse,
  nextOrder: number
): AnimationHistoryItem | null => {
  if (response.type !== "action") {
    return null;
  }

  const command = response.command;
  const doorLabel = formatDoorLabel(command?.door);
  const actionLabel = command?.action ?? "action";
  const categoryLabel = (() => {
    switch (actionLabel) {
      case "open":
        return "Open";
      case "close":
        return "Close";
      case "detach":
        return "Detach";
      case "attach":
        return "Attach";
      default:
        return actionLabel.replace(/_/g, " ");
    }
  })();
  const detailParts = [doorLabel.title, doorLabel.detail];

  if (command?.degrees) {
    detailParts.push(`${command.degrees} deg`);
  }
  if (command?.speed) {
    detailParts.push(`${command.speed}s`);
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: categoryLabel,
    detail: sanitizeText(doorLabel.title),
    info: sanitizeText(detailParts.join(" · ")),
    checked: true,
    order: nextOrder,
    command: command,
  };
};

const getNextOrder = (items: AnimationHistoryItem[]) => {
  let maxOrder = 0;
  items.forEach((item) => {
    if (item.order && item.order > maxOrder) {
      maxOrder = item.order;
    }
  });
  return maxOrder + 1;
};

const buildAnimationClip = (
  scene: THREE.Object3D,
  items: AnimationHistoryItem[]
): THREE.AnimationClip | null => {
  const orderedItems = items
    .filter((item) => item.checked && item.order !== undefined)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const tracks = new Map<string, { times: number[]; values: number[] }>();
  const currentRotation: Record<string, number> = {};
  let currentTime = 0;

  const pushQuaternion = (
    track: { times: number[]; values: number[] },
    time: number,
    rotationZ: number
  ) => {
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, 0, rotationZ)
    );
    const lastIndex = track.times.length - 1;
    if (lastIndex >= 0 && track.times[lastIndex] === time) {
      track.values.splice(lastIndex * 4, 4, quaternion.x, quaternion.y, quaternion.z, quaternion.w);
      return;
    }
    track.times.push(time);
    track.values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  };

  orderedItems.forEach((item) => {
    const command = item.command;
    if (!command?.door || !command.action) {
      return;
    }
    const config = DOOR_EXPORT[command.door];
    if (!config) {
      return;
    }
    const pivot = scene.getObjectByName(config.pivotName);
    if (!pivot) {
      return;
    }

    const isClose = command.action === "close";
    const degrees = isClose ? 0 : command.degrees ?? 90;
    const targetRotation = config.direction * THREE.MathUtils.degToRad(degrees);
    const duration = Math.max(command.speed ?? 1, 0.1);

    let track = tracks.get(config.pivotName);
    if (!track) {
      track = { times: [], values: [] };
      tracks.set(config.pivotName, track);
    }

    const startRotation = currentRotation[command.door] ?? 0;
    const startTime = currentTime;
    const endTime = currentTime + duration;

    pushQuaternion(track, startTime, startRotation);
    pushQuaternion(track, endTime, targetRotation);

    currentRotation[command.door] = targetRotation;
    currentTime = endTime;
  });

  const tracksArray: THREE.KeyframeTrack[] = [];
  tracks.forEach((track, pivotName) => {
    if (track.times.length > 1) {
      tracksArray.push(
        new THREE.QuaternionKeyframeTrack(
          `${pivotName}.quaternion`,
          track.times,
          track.values
        )
      );
    }
  });

  if (tracksArray.length === 0) {
    return null;
  }

  return new THREE.AnimationClip("ActionSequence", -1, tracksArray);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function ManualEditorPage({ modelPath, onBack }: ManualEditorPageProps) {
  const activeModel = modelPath ? modelPath.split("/").pop() ?? modelPath : "W825AAA482.AKOR";
  const [sceneRoot, setSceneRoot] = useState<Object3D | null>(null);
  const [selectedNode, setSelectedNode] = useState<Object3D | null>(null);
  const [historyItems, setHistoryItems] = useState<AnimationHistoryItem[]>([]);
  const [timelineDuration, setTimelineDuration] = useState(0);
  const [timelineTime, setTimelineTime] = useState(0);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "system",
      content: "명령어를 입력해보세요,: \"왼쪽 냉장고 문을 45도 열어.\"",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const animationHistoryService = useMemo(() => new AnimationHistoryService(), []);

  useEffect(() => {
    const handleCompletion = (message: string) => {
      if (!message) {
        return;
      }
      const completionMessage: ChatMessage = {
        id: `${Date.now()}-complete-${Math.random().toString(36).slice(2, 8)}`,
        role: "assistant",
        content: message,
      };
      setMessages((prev) => [...prev, completionMessage]);
    };

    animatorAgent.setOnActionCompleted(handleCompletion);
    animatorAgent.setAnimationHistoryService(animationHistoryService);
    console.log('AnimationHistoryService initialized and set to AnimatorAgent');

    return () => {
      animatorAgent.setOnActionCompleted();
    };
  }, [animationHistoryService]);

  const orderedHistory = useMemo(
    () =>
      historyItems
        .filter((item) => item.checked && item.order !== undefined)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [historyItems]
  );

  const timelineClip = useMemo(() => {
    if (!sceneRoot) {
      return null;
    }
    return buildAnimationClip(sceneRoot, historyItems);
  }, [sceneRoot, historyItems]);

  useEffect(() => {
    if (timelineClip) {
      setTimelineDuration(timelineClip.duration);
      if (!isTimelinePlaying) {
        setTimelineTime((prev) =>
          prev >= timelineClip.duration ? timelineClip.duration : 0
        );
      }
    } else {
      setTimelineDuration(0);
      setTimelineTime(0);
    }
  }, [timelineClip, isTimelinePlaying]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const handleSendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isProcessing) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsProcessing(true);

    try {
      const response = await animatorAgent.processUserInput(trimmed);
      if (response.type !== "action") {
        const assistantMessage: ChatMessage = {
          id: `${Date.now()}-assistant`,
          role: response.type === "error" ? "system" : "assistant",
          content: response.message,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }

      setHistoryItems((prev) => {
        const nextOrder = getNextOrder(prev);
        const historyItem = buildHistoryItem(response, nextOrder);
        return historyItem ? [historyItem, ...prev] : prev;
      });
    } catch (error) {
      const fallback: ChatMessage = {
        id: `${Date.now()}-error`,
        role: "system",
        content: "Something went wrong. Please try again.",
      };
      setMessages((prev) => [...prev, fallback]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveHistory = (id: string) => {
    setHistoryItems((prev) => prev.filter((item) => item.id !== id));
    animationHistoryService.removeHistoryItem(id);
    console.log('Removed history item:', id);
  };

  const handleClearHistory = () => {
    setHistoryItems([]);
    animationHistoryService.clearHistory();
    console.log('Animation history cleared');
  };

  const stopTimelineLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameRef.current = null;
  };

  const handlePauseTimeline = () => {
    if (actionRef.current) {
      actionRef.current.paused = true;
    }
    stopTimelineLoop();
    setIsTimelinePlaying(false);
  };

  const resetTimelinePose = (root: THREE.Object3D) => {
    Object.values(DOOR_EXPORT).forEach((config) => {
      const pivot = root.getObjectByName(config.pivotName);
      if (pivot) {
        pivot.rotation.set(0, 0, 0);
        pivot.updateMatrix();
        pivot.updateMatrixWorld(true);
      }
    });
  };

  const ensureTimelineAction = () => {
    if (!sceneRoot || !timelineClip) {
      return null;
    }
    if (!mixerRef.current || mixerRef.current.getRoot() !== sceneRoot) {
      mixerRef.current = new THREE.AnimationMixer(sceneRoot);
    }
    if (!actionRef.current || actionRef.current.getClip() !== timelineClip) {
      const action = mixerRef.current.clipAction(timelineClip);
      action.reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.paused = true;
      action.play();
      actionRef.current = action;
    }
    return actionRef.current;
  };

  const seekTimeline = (seconds: number) => {
    if (!sceneRoot || !timelineClip) {
      return;
    }
    resetTimelinePose(sceneRoot);
    const action = ensureTimelineAction();
    if (!action || !mixerRef.current) {
      return;
    }
    mixerRef.current.setTime(Math.max(0, Math.min(seconds, timelineClip.duration)));
    action.paused = true;
    setTimelineTime(action.time);
  };

  const handlePlayTimeline = () => {
    if (!sceneRoot || !timelineClip) {
      return;
    }
    if (isTimelinePlaying && actionRef.current && !actionRef.current.paused) {
      return;
    }

    if (actionRef.current && timelineTime > 0 && timelineTime < timelineDuration) {
      actionRef.current.paused = false;
      setIsTimelinePlaying(true);
      lastFrameRef.current = performance.now();
    } else {
      resetTimelinePose(sceneRoot);
      const action = ensureTimelineAction();
      if (!action) {
        return;
      }
      action.reset();
      action.play();
      action.paused = false;
      setTimelineTime(0);
      setTimelineDuration(timelineClip.duration);
      setIsTimelinePlaying(true);
      lastFrameRef.current = performance.now();
    }

    const step = (now: number) => {
      if (!actionRef.current || !mixerRef.current) {
        stopTimelineLoop();
        setIsTimelinePlaying(false);
        return;
      }
      if (lastFrameRef.current === null) {
        lastFrameRef.current = now;
      }
      const delta = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      if (!actionRef.current.paused) {
        mixerRef.current.update(delta);
        setTimelineTime(actionRef.current.time);
        if (timelineClip && actionRef.current.time >= timelineClip.duration) {
          actionRef.current.paused = true;
          mixerRef.current.setTime(timelineClip.duration);
          setTimelineTime(timelineClip.duration);
          stopTimelineLoop();
          setIsTimelinePlaying(false);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };

    stopTimelineLoop();
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    handlePauseTimeline();
    actionRef.current = null;
    mixerRef.current = null;
  }, [sceneRoot]);

  useEffect(() => {
    handlePauseTimeline();
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
    }
    actionRef.current = null;
    setTimelineTime(0);
  }, [timelineClip]);

  const handlePrevTimeline = () => {
    if (orderedHistory.length === 0) {
      return;
    }
    handlePauseTimeline();
    const steps = orderedHistory.map((item) => Math.max(item.command?.speed ?? 1, 0.1));
    let cursor = 0;
    let target = 0;
    for (let i = 0; i < steps.length; i += 1) {
      const next = cursor + steps[i];
      if (timelineTime <= next + 0.0001) {
        target = Math.max(0, cursor);
        break;
      }
      cursor = next;
      target = cursor;
    }
    seekTimeline(target);
  };

  const handleNextTimeline = () => {
    if (orderedHistory.length === 0) {
      return;
    }
    handlePauseTimeline();
    const steps = orderedHistory.map((item) => Math.max(item.command?.speed ?? 1, 0.1));
    let cursor = 0;
    let target = timelineDuration;
    for (let i = 0; i < steps.length; i += 1) {
      const next = cursor + steps[i];
      if (timelineTime < next - 0.0001) {
        target = next;
        break;
      }
      cursor = next;
    }
    seekTimeline(target);
  };

  const handleReorderHistory = (orderedIds: string[]) => {
    setHistoryItems((prev) =>
      prev.map((item) => {
        const nextIndex = orderedIds.indexOf(item.id);
        if (nextIndex >= 0) {
          return { ...item, checked: true, order: nextIndex + 1 };
        }
        return item;
      })
    );
    animationHistoryService.reorderHistory(orderedIds);
    console.log('Reordered history:', orderedIds);
  };

  const handleResetViewer = () => {
    const didReset = animatorAgent.resetDoors(0.5);
    if (didReset) {
      setSelectedNode(null);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleExportHistory = () => {
    if (!sceneRoot) {
      return;
    }

    const ordered = historyItems
      .filter((item) => item.checked && item.order !== undefined && item.command)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (ordered.length === 0) {
      return;
    }

    const exportScene = sceneRoot.clone(true);
    const clip = buildAnimationClip(exportScene, ordered);
    if (!clip) {
      return;
    }

    exportScene.updateMatrixWorld(true);
    const exporter = new GLTFExporter();
    exporter.parse(
      exportScene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          const blob = new Blob([result], { type: "model/gltf-binary" });
          downloadBlob(blob, "animation.glb");
        } else {
          const blob = new Blob([JSON.stringify(result)], { type: "application/json" });
          downloadBlob(blob, "animation.gltf");
        }
      },
      (error) => {
        console.error("GLB export failed:", error);
      },
      { binary: true, animations: [clip], onlyVisible: false }
    );
  };

  const handleExportHistoryJson = () => {
    const json = animationHistoryService.exportToJson();
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, 'animation_history.json');
    console.log('Exported animation history JSON:', json.length, 'bytes');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <section className="page editor-page">
      <div className="editor-layout">
        <ManualEditorSidebar
          activeModel={activeModel}
          sceneRoot={sceneRoot}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
          onBack={onBack}
        />

        <div className="viewer-column">
          <div className="viewer">
            <div className="viewer-tag">{activeModel}</div>
            <ModelViewer
              modelPath={modelPath}
              onSceneReady={setSceneRoot}
              focusTarget={selectedNode}
              onDoorControlsReady={(controls) => animatorAgent.setDoorControls(controls)}
              onNodeSelect={setSelectedNode}
              allowDefaultModel={false}
              overlay={
                <button
                  className="viewer-reset-btn"
                  type="button"
                  onClick={handleResetViewer}
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                >
                  Reset
                </button>
              }
            />
          </div>
          <div className="timeline-panel">
            <AnimationHistoryPanel
              items={historyItems}
              onClear={handleClearHistory}
              onRemove={handleRemoveHistory}
              onExport={handleExportHistoryJson}
              onReorder={handleReorderHistory}
              isPlaying={isTimelinePlaying}
              currentTime={timelineTime}
              duration={timelineDuration}
              onPlay={handlePlayTimeline}
              onPause={handlePauseTimeline}
              onPrev={handlePrevTimeline}
              onNext={handleNextTimeline}
            />
          </div>
        </div>

        <div className="chat">
          <div className="chat-header">AI Chat</div>
          <div className="chat-body">
            {messages.map((message) => (
              <div key={message.id} className={`chat-bubble ${message.role}`}>
                {message.content}
              </div>
            ))}
            {isProcessing && (
              <div className="chat-bubble loading" role="status" aria-label="Loading response">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
              </div>
            )}
          </div>
          <div className="chat-input">
            <input
              className="search"
              placeholder="Type a message"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing}
            />
            <button className="btn" onClick={handleSendMessage} disabled={isProcessing}>
              {isProcessing ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

