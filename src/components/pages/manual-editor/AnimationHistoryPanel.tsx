import { useRef, useState, type DragEvent } from "react";
import "./AnimationHistoryPanel.css";

export type AnimationHistoryItem = {
  id: string;
  title: string;
  detail: string;
  info?: string;
  checked: boolean;
  order?: number;
  command?: {
    door?: string;
    action?: string;
    degrees?: number;
    speed?: number;
  };
};

type AnimationHistoryPanelProps = {
  items: AnimationHistoryItem[];
  onClear: () => void;
  onRemove: (id: string) => void;
  onExport: () => void;
  onReorder?: (orderedIds: string[]) => void;
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

export default function AnimationHistoryPanel({
  items,
  onClear,
  onRemove,
  onExport,
  onReorder,
  isPlaying = false,
  currentTime = 0,
  duration = 0,
  onPlay,
  onPause,
  onPrev,
  onNext,
}: AnimationHistoryPanelProps) {
  const dragIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const ordered = [...items]
    .filter((item) => item.checked && item.order !== undefined)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const orderMap = new Map<string, number>();
  ordered.forEach((item, index) => {
    orderMap.set(item.id, index + 1);
  });
  const displayItems = [...ordered, ...items.filter((item) => !orderMap.has(item.id))];
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) * 100 : 0;
  const pixelsPerSecond = 48;
  const itemGap = 10;
  const itemWidths = displayItems.map((item) => {
    const itemSeconds = item.command?.speed ?? 1;
    return Math.max(140, itemSeconds * pixelsPerSecond);
  });
  const totalWidth =
    itemWidths.reduce((sum, width) => sum + width, 0) +
    Math.max(displayItems.length - 1, 0) * itemGap;
  const sequenceWidth = displayItems.length > 0 ? totalWidth : 240;
  const tickCount = duration > 0 ? Math.floor(duration) : 0;

  const handleDragStart = (id: string) => (event: DragEvent<HTMLDivElement>) => {
    if (!onReorder || !orderMap.has(id)) {
      return;
    }
    dragIdRef.current = id;
    setDraggingId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (id: string) => (event: DragEvent<HTMLDivElement>) => {
    if (!onReorder || !orderMap.has(id)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (targetId: string) => (event: DragEvent<HTMLDivElement>) => {
    if (!onReorder) {
      return;
    }
    event.preventDefault();
    const fromId = dragIdRef.current || event.dataTransfer.getData("text/plain");
    if (!fromId || fromId === targetId) {
      return;
    }
    const orderedIds = ordered.map((item) => item.id);
    const fromIndex = orderedIds.indexOf(fromId);
    const toIndex = orderedIds.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    const nextOrder = [...orderedIds];
    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, fromId);
    onReorder(nextOrder);
  };

  const handleDragEnd = () => {
    dragIdRef.current = null;
    setDraggingId(null);
  };

  return (
    <div className="panel editor-section history-panel timeline-panel">
      <div className="editor-section-header">
        <div className="editor-section-title">Animation History</div>
      </div>
      <div className="history-actions-row">
        <div className="history-actions">
          <button className="history-export" type="button" onClick={onExport}>
            Export GLB
          </button>
          <button className="history-clear" type="button" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>
      <div className="timeline-controls">
        <button
          className="timeline-btn"
          type="button"
          onClick={onPrev}
          disabled={!onPrev}
          aria-label="Previous action"
        >
          <svg viewBox="0 0 24 24" className="timeline-icon" aria-hidden="true">
            <rect x="4" y="5" width="2.5" height="14" rx="0.8" />
            <polygon points="20,5 8,12 20,19" />
          </svg>
        </button>
        <button
          className={`timeline-btn ${isPlaying ? "active" : ""}`}
          type="button"
          onClick={isPlaying ? onPause : onPlay}
          disabled={isPlaying ? !onPause : !onPlay}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" className="timeline-icon" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="timeline-icon" aria-hidden="true">
              <polygon points="7,5 19,12 7,19" />
            </svg>
          )}
        </button>
        <button
          className="timeline-btn"
          type="button"
          onClick={onNext}
          disabled={!onNext}
          aria-label="Next action"
        >
          <svg viewBox="0 0 24 24" className="timeline-icon" aria-hidden="true">
            <polygon points="4,5 16,12 4,19" />
            <rect x="17.5" y="5" width="2.5" height="14" rx="0.8" />
          </svg>
        </button>
        <div className="timeline-time">
          {duration > 0 ? `${currentTime.toFixed(1)}s / ${duration.toFixed(1)}s` : "0.0s"}
        </div>
      </div>
      <div className="editor-section-body timeline-body">
        {items.length === 0 && (
          <div className="history-empty">No actions yet.</div>
        )}
        {items.length > 0 && (
          <>
            <div className="timeline-scroll">
              <div className="timeline-sequence" style={{ width: `${sequenceWidth}px` }}>
                <div className="timeline-items">
                  {displayItems.map((item, index) => {
                    const itemWidth = itemWidths[index];
                    return (
                      <div
                        key={item.id}
                        className={`history-item ${orderMap.has(item.id) ? "is-draggable" : ""
                          } ${draggingId === item.id ? "is-dragging" : ""}`}
                        style={{ width: `${itemWidth}px` }}
                        draggable={Boolean(onReorder && orderMap.has(item.id))}
                        onDragStart={handleDragStart(item.id)}
                        onDragOver={handleDragOver(item.id)}
                        onDrop={handleDrop(item.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="history-content">
                          <div className="history-title">{item.title}</div>
                          <div className="history-detail">{item.detail}</div>
                        </div>
                        <div className="history-item-actions">
                          <button
                            className="history-remove"
                            type="button"
                            onClick={() => onRemove(item.id)}
                            aria-label="Remove from history"
                          >
                            -
                          </button>
                          <div className="history-info" aria-label="View action details">
                            i
                            {item.info && <span className="history-tooltip">{item.info}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="timeline-track" aria-hidden="true">
                  <div className="timeline-progress" style={{ width: `${progress}%` }} />
                  <div className="timeline-marker" style={{ left: `${progress}%` }} />
                </div>
                {duration > 0 && (
                  <div className="timeline-ticks">
                    {Array.from({ length: tickCount + 1 }, (_, index) => {
                      const left = duration > 0 ? (index / duration) * 100 : 0;
                      return (
                        <div key={index} className="timeline-tick" style={{ left: `${left}%` }}>
                          {index}s
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
