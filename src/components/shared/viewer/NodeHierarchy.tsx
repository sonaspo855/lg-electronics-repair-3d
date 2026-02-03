import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { animatorAgent } from "@/services/AnimatorAgent";

// Types
interface Message {
  id: number;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

interface ServiceStatus {
  isRunning: boolean;
  status: 'online' | 'offline' | 'checking';
  message: string;
  lastChecked?: Date;
}

interface NodeHierarchyProps {
  scene: THREE.Object3D;
  onNodeSelect: (node: THREE.Object3D) => void;
  selectedNode?: THREE.Object3D | null;
  onSelectedNodeChange?: (node: THREE.Object3D | null) => void;
}

type NodeState = 'attached' | 'loosened' | 'detached';

interface DetachedInfo {
  parent: THREE.Object3D;
  index: number;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  offset: THREE.Vector3;
  lastState: NodeState;
}

// TreeNode Component - Renders individual nodes in the hierarchy
const TreeNode = React.memo<{
  node: THREE.Object3D;
  depth: number;
  onNodeSelect: (node: THREE.Object3D) => void;
  getChildren: (node: THREE.Object3D) => THREE.Object3D[];
  getFastenersForNode: (node: THREE.Object3D) => { screw: string; path: string }[];
  getNodeState: (node: THREE.Object3D) => NodeState;
  isSelected: (node: THREE.Object3D) => boolean;
  isForcedExpanded: (node: THREE.Object3D) => boolean;
  isFastener: (node: THREE.Object3D) => boolean;
  canLoosen: (node: THREE.Object3D) => boolean;
  canDetach: (node: THREE.Object3D) => boolean;
  canAttach: (node: THREE.Object3D) => boolean;
  isAnimating: (node: THREE.Object3D) => boolean;
  onLoosen: (node: THREE.Object3D) => void;
  onDetach: (node: THREE.Object3D) => void;
  onAttach: (node: THREE.Object3D) => void;
}>(({ node, depth, onNodeSelect, getChildren, getFastenersForNode, getNodeState, isSelected, isForcedExpanded, isFastener, canLoosen, canDetach, canAttach, isAnimating, onLoosen, onDetach, onAttach }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const children = getChildren(node);
  const hasChildren = children.length > 0;

  const handleToggle = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleClick = () => {
    onNodeSelect(node);
  };

  const nodeState = getNodeState(node);
  const selected = isSelected(node);
  const fastener = isFastener(node);
  const canLoosenNode = canLoosen(node);
  const canDetachNode = canDetach(node);
  const canAttachNode = canAttach(node);
  const animating = isAnimating(node);
  const fasteners = getFastenersForNode(node);
  const forcedExpanded = isForcedExpanded(node);

  useEffect(() => {
    if (forcedExpanded) {
      setIsExpanded(true);
    }
  }, [forcedExpanded]);

  useEffect(() => {
    if (selected) {
      setIsExpanded(true);
      nodeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [selected]);

  return (
    <div ref={nodeRef}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 8px',
        paddingLeft: `${depth * 16 + 8}px`,
        cursor: 'pointer',
        borderRadius: '4px',
        transition: 'background-color 0.2s ease',
        fontSize: '12px',
        color: '#fff',
        width: '100%',
        boxSizing: 'border-box',
        background: selected ? 'rgba(78, 205, 196, 0.15)' : 'transparent',
        border: selected ? '1px solid rgba(78, 205, 196, 0.4)' : '1px solid transparent'
      }}
        onMouseEnter={(e) => {
          if (!selected) {
            (e.currentTarget as HTMLDivElement).style.background = 'rgba(255, 255, 255, 0.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (!selected) {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          }
        }}
      >
        {/* Expand/Collapse Button */}
        {hasChildren && (
          <button
            onClick={handleToggle}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#4ecdc4',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '0',
              width: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}

        {/* Node Icon */}
        <span style={{ fontSize: '14px' }}>
          {hasChildren ? '📁' : '📄'}
        </span>

        {/* Node Name */}
        <span
          onClick={handleClick}
          style={{
            flex: 1,
            cursor: 'pointer',
            fontWeight: hasChildren ? 'bold' : 'normal'
          }}
        >
          {node.name || `Node_${node.id}`}
        </span>

        {/* Node State */}
        <span style={{
          fontSize: '9px',
          color: nodeState === 'attached' ? '#8bc34a' : nodeState === 'loosened' ? '#ffc107' : '#ff6b6b',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '4px',
          padding: '1px 4px',
          textTransform: 'uppercase'
        }}>
          {nodeState === 'loosened' ? 'pulled out' : nodeState}
        </span>

        {fastener && (
          <span style={{
            fontSize: '9px',
            color: '#4ecdc4',
            border: '1px solid rgba(78, 205, 196, 0.4)',
            borderRadius: '4px',
            padding: '1px 4px',
            textTransform: 'uppercase'
          }}>
            fastener
          </span>
        )}

        {/* Node Type */}
        <span style={{
          fontSize: '10px',
          color: '#aaa',
          fontFamily: 'monospace'
        }}>
          {node.type}
        </span>
      </div>

      {selected && (
        <div style={{
          display: 'flex',
          gap: '6px',
          margin: '4px 0 6px 24px'
        }}>
          {nodeState === 'detached' ? (
            <button
              onClick={() => onAttach(node)}
              disabled={!canAttachNode || animating}
              style={{
                background: (!canAttachNode || animating) ? 'rgba(255, 255, 255, 0.1)' : 'rgba(78, 205, 196, 0.9)',
                color: (!canAttachNode || animating) ? '#666' : '#000',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 6px',
                cursor: (!canAttachNode || animating) ? 'not-allowed' : 'pointer',
                fontSize: '10px',
                fontWeight: 'bold'
              }}
              title={animating ? 'Animation in progress' : (canAttachNode ? 'Attach to parent' : 'Attach parent first')}
            >
              Attach
            </button>
          ) : (
            <>
              <button
                onClick={() => onLoosen(node)}
                disabled={!canLoosenNode || nodeState === 'detached' || animating}
                style={{
                  background: (!canLoosenNode || nodeState === 'detached' || animating) ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 193, 7, 0.8)',
                  color: (!canLoosenNode || nodeState === 'detached' || animating) ? '#666' : '#000',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  cursor: (!canLoosenNode || nodeState === 'detached' || animating) ? 'not-allowed' : 'pointer',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}
                title={animating ? 'Animation in progress' : (canLoosenNode ? 'Loosen this part' : 'Loosen parent first')}
              >
                {nodeState === 'loosened' ? 'Return' : 'Pull Out'}
              </button>
              <button
                onClick={() => onDetach(node)}
                disabled={!canDetachNode || nodeState === 'detached' || animating}
                style={{
                  background: (!canDetachNode || nodeState === 'detached' || animating) ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 107, 107, 0.9)',
                  color: (!canDetachNode || nodeState === 'detached' || animating) ? '#666' : '#000',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  cursor: (!canDetachNode || nodeState === 'detached' || animating) ? 'not-allowed' : 'pointer',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}
                title={animating ? 'Animation in progress' : (canDetachNode ? 'Detach this part' : 'Detach is unavailable')}
              >
                Detach
              </button>
            </>
          )}
        </div>
      )}

      {selected && fasteners.length > 0 && (
        <div style={{
          margin: '4px 0 8px 24px',
          padding: '6px 8px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.04)'
        }}>
          <div style={{
            fontSize: '10px',
            color: '#4ecdc4',
            fontWeight: 'bold',
            marginBottom: '4px'
          }}>
            Fasteners ({fasteners.length})
          </div>
          {fasteners.slice(0, 6).map((item) => (
            <div key={item.path} style={{
              fontSize: '9px',
              color: '#bbb',
              marginBottom: '2px',
              wordBreak: 'break-all'
            }}>
              {item.screw}
            </div>
          ))}
          {fasteners.length > 6 && (
            <div style={{ fontSize: '9px', color: '#777' }}>
              +{fasteners.length - 6} more
            </div>
          )}
        </div>
      )}

      {/* Children */}
      {isExpanded && hasChildren && (
        <div style={{ marginTop: '4px' }}>
          {children.map((child: THREE.Object3D, index: number) => (
            <TreeNode
              key={`${child.id}-${index}`}
              node={child}
              depth={depth + 1}
              onNodeSelect={onNodeSelect}
              getChildren={getChildren}
              getFastenersForNode={getFastenersForNode}
              getNodeState={getNodeState}
              isSelected={isSelected}
              isForcedExpanded={isForcedExpanded}
              isFastener={isFastener}
              canLoosen={canLoosen}
              canDetach={canDetach}
              canAttach={canAttach}
              isAnimating={isAnimating}
              onLoosen={onLoosen}
              onDetach={onDetach}
              onAttach={onAttach}
            />
          ))}
        </div>
      )}
    </div>
  );
});

TreeNode.displayName = 'TreeNode';

// ChatBox Component - Handles AI agent interactions
const ChatBox = React.memo(() => {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    isRunning: false,
    status: 'offline',
    message: 'Service status not checked yet.'
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Initialize chat and check service status
  useEffect(() => {
    const welcomeMessage: Message = {
      id: Date.now() + Math.random(),
      type: 'system',
      content: 'Hello! I\'m Sabby, your Animator Agent. I can help you control the refrigerator doors. Try saying "Open the top left door" or "Close all doors" to get started!',
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);

    // Check service status on mount
    checkServiceStatus();
  }, []);

  // Service status checking
  const checkServiceStatus = async () => {
    try {
      await animatorAgent.refreshServiceStatus();
      const status = animatorAgent.getServiceStatus();
      setServiceStatus(status);

      if (status.isRunning) {
        const models = await animatorAgent.getAvailableModels();
        setAvailableModels(models);
      }
    } catch (error) {
      console.error('Error checking service status:', error);
    }
  };

  // Message handling
  const addMessage = (content: string, type: Message['type']) => {
    const newMessage: Message = {
      id: Date.now() + Math.random(),
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);

    // Auto-scroll to bottom
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 100);
  };

  const addTypingIndicator = () => {
    const typingMessage: Message = {
      id: Date.now() + Math.random(),
      type: 'assistant',
      content: '...',
      timestamp: new Date(),
      isTyping: true
    };
    setMessages(prev => [...prev, typingMessage]);
    return typingMessage.id;
  };

  const removeTypingIndicator = (id: number) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  };

  // Message sending
  const handleSendMessage = async () => {
    if (inputValue.trim() && !isTyping) {
      const userInput = inputValue.trim();
      addMessage(userInput, 'user');
      setInputValue('');

      // Check for service status command
      if (userInput.toLowerCase().includes('check service') ||
        userInput.toLowerCase().includes('service status') ||
        userInput.toLowerCase().includes('llama status') ||
        userInput.toLowerCase().includes('ollama status')) {

        addMessage('Checking Llama/Ollama service status...', 'assistant');
        await checkServiceStatus();

        const statusMessage = serviceStatus.isRunning
          ? `✅ Llama service is ONLINE! Available models: ${availableModels.join(', ') || 'None detected'}`
          : `❌ Llama service is OFFLINE. Please ensure Ollama is running on localhost:11434`;

        addMessage(statusMessage, 'assistant');
        return;
      }

      // Process with AnimatorAgent
      setIsTyping(true);
      const typingId = addTypingIndicator();

      try {
        const response = await animatorAgent.processUserInput(userInput);
        removeTypingIndicator(typingId);
        addMessage(response.message, 'assistant');

        if (response.type === 'action') {
          setTimeout(() => {
            addMessage('Animation completed successfully! 🎉', 'system');
          }, 1000);
        }
      } catch (error) {
        removeTypingIndicator(typingId);
        addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
        console.error('Error processing message:', error);
      } finally {
        setIsTyping(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Message styling
  const getMessageStyle = (message: Message) => {
    const baseStyle = {
      padding: '6px 10px',
      borderRadius: '12px',
      fontSize: '11px',
      lineHeight: '1.3',
      color: '#fff',
      border: '1px solid'
    };

    switch (message.type) {
      case 'user':
        return {
          ...baseStyle,
          background: 'rgba(74, 205, 196, 0.3)',
          borderColor: 'rgba(74, 205, 196, 0.4)'
        };
      case 'assistant':
        return {
          ...baseStyle,
          background: 'rgba(255, 255, 255, 0.1)',
          borderColor: 'rgba(255, 255, 255, 0.2)'
        };
      case 'system':
        return {
          ...baseStyle,
          background: 'rgba(255, 193, 7, 0.2)',
          borderColor: 'rgba(255, 193, 7, 0.4)',
          color: '#ffc107'
        };
      default:
        return baseStyle;
    }
  };

  return (
    <div className="chatbox-container" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(0, 0, 0, 0.95)',
      borderTop: '1px solid rgba(255, 255, 255, 0.2)',
      overflow: 'hidden',
      minHeight: '280px'
    }}>
      {/* Chat Header */}
      <div style={{
        background: 'rgba(74, 205, 196, 0.2)',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(74, 205, 196, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          background: '#4ecdc4',
          borderRadius: '50%',
          animation: 'pulse 2s infinite'
        }} />
        <span style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#4ecdc4'
        }}>
          🤖 Sabby - Animator Agent
        </span>

        {/* Service Status Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginLeft: 'auto'
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            background: serviceStatus.status === 'online' ? '#4CAF50' :
              serviceStatus.status === 'checking' ? '#FF9800' : '#F44336',
            borderRadius: '50%',
            animation: serviceStatus.status === 'checking' ? 'pulse 1s infinite' : 'none'
          }} />
          <span style={{
            fontSize: '10px',
            color: serviceStatus.status === 'online' ? '#4CAF50' :
              serviceStatus.status === 'checking' ? '#FF9800' : '#F44336',
            fontWeight: 'bold'
          }}>
            {serviceStatus.status === 'online' ? 'Llama Online' :
              serviceStatus.status === 'checking' ? 'Checking...' : 'Llama Offline'}
          </span>
          <button
            onClick={checkServiceStatus}
            disabled={serviceStatus.status === 'checking'}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '4px',
              padding: '2px 6px',
              cursor: serviceStatus.status === 'checking' ? 'not-allowed' : 'pointer',
              fontSize: '8px',
              color: 'rgba(255, 255, 255, 0.7)',
              transition: 'all 0.2s ease'
            }}
            title="Refresh service status"
          >
            🔄
          </button>
        </div>

        <span style={{
          fontSize: '10px',
          color: '#aaa',
          marginLeft: '8px'
        }}>
          {isTyping ? 'Typing...' : 'Online'}
        </span>
      </div>

      {/* Service Status Details */}
      {serviceStatus.status !== 'checking' && (
        <div style={{
          background: serviceStatus.isRunning ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
          padding: '6px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '10px',
          color: serviceStatus.isRunning ? '#4CAF50' : '#F44336',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              {serviceStatus.message}
              {serviceStatus.isRunning && availableModels.length > 0 && (
                <span style={{ marginLeft: '8px', opacity: 0.8 }}>
                  Models: {availableModels.join(', ')}
                </span>
              )}
            </span>
            {serviceStatus.lastChecked && (
              <span style={{ opacity: 0.7, fontSize: '9px' }}>
                Last checked: {serviceStatus.lastChecked.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="messages-container" style={{
        flex: '1 1 auto',
        overflow: 'auto',
        padding: '8px 8px 12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: 0
      }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: message.type === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%'
            }}
          >
            <div style={getMessageStyle(message)}>
              {message.isTyping ? (
                <span style={{ animation: 'blink 1s infinite' }}>...</span>
              ) : (
                message.content
              )}
            </div>
            <span style={{
              fontSize: '9px',
              color: '#666',
              marginTop: '2px',
              marginLeft: message.type === 'user' ? '0' : '8px',
              marginRight: message.type === 'user' ? '8px' : '0'
            }}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div style={{
        padding: '8px 8px 8px 8px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(0, 0, 0, 0.3)',
        flexShrink: 0,
        marginTop: 'auto'
      }}>
        <div style={{
          display: 'flex',
          gap: '6px',
          alignItems: 'flex-end'
        }}>
          <textarea
            className="chat-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Try: 'Open top left door 45 degrees in 2 seconds' or 'Check service status'..."
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              padding: '6px 8px',
              color: '#fff',
              fontSize: '11px',
              resize: 'none',
              minHeight: '32px',
              maxHeight: '60px',
              fontFamily: 'inherit',
              overflow: 'auto'
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping}
            style={{
              background: (inputValue.trim() && !isTyping) ? '#4ecdc4' : 'rgba(255, 255, 255, 0.2)',
              color: (inputValue.trim() && !isTyping) ? '#000' : '#666',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: (inputValue.trim() && !isTyping) ? 'pointer' : 'not-allowed',
              fontSize: '11px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
          >
            {isTyping ? '...' : 'Send'}
          </button>
        </div>

        {/* Help text */}
        <div style={{
          fontSize: '9px',
          color: '#666',
          marginTop: '6px',
          marginBottom: '0px',
          textAlign: 'center',
          fontStyle: 'italic'
        }}>
          💡 Tip: You can say "Open top left door 45 degrees in 2 seconds" or "Check service status"
        </div>
      </div>
    </div>
  );
});

ChatBox.displayName = 'ChatBox';

// Main NodeHierarchy Component
const NodeHierarchy = React.memo<NodeHierarchyProps>(({ scene, onNodeSelect, selectedNode: selectedNodeProp, onSelectedNodeChange }) => {
  const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>({});
  const [selectedNodeState, setSelectedNodeState] = useState<THREE.Object3D | null>(null);
  const [sceneVersion, setSceneVersion] = useState(0);
  const [animatingNodes, setAnimatingNodes] = useState<Record<string, boolean>>({});
  const [fastenerMap, setFastenerMap] = useState<Record<string, { screw: string; path: string }[]>>({});
  const [pullOutDistanceOverride, setPullOutDistanceOverride] = useState(1.2);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const detachInfoRef = useRef<Map<string, DetachedInfo>>(new Map());
  const originalPositionRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const animationRef = useRef<Map<string, number>>(new Map());
  const rootNodesRef = useRef<THREE.Object3D[]>([]);
  const childrenSnapshotRef = useRef<Map<string, THREE.Object3D[]>>(new Map());
  const parentSnapshotRef = useRef<Map<string, string>>(new Map());
  const nodeSnapshotRef = useRef<Map<string, THREE.Object3D>>(new Map());

  const isSelectionControlled = selectedNodeProp !== undefined;
  const selectedNode = isSelectionControlled ? selectedNodeProp : selectedNodeState;

  useEffect(() => {
    setNodeStates({});
    if (isSelectionControlled) {
      onSelectedNodeChange?.(null);
    } else {
      setSelectedNodeState(null);
    }
    setAnimatingNodes({});
    detachInfoRef.current = new Map();
    originalPositionRef.current = new Map();
    setFastenerMap({});
    setExpandedIds([]);
    rootNodesRef.current = scene ? [...scene.children] : [];
    const nextChildren = new Map<string, THREE.Object3D[]>();
    const nextParents = new Map<string, string>();
    const nextNodes = new Map<string, THREE.Object3D>();
    if (scene) {
      scene.traverse((child) => {
        nextChildren.set(child.uuid, [...child.children]);
        nextNodes.set(child.uuid, child);
        child.children.forEach((kid) => {
          nextParents.set(kid.uuid, child.uuid);
        });
      });
    }
    childrenSnapshotRef.current = nextChildren;
    parentSnapshotRef.current = nextParents;
    nodeSnapshotRef.current = nextNodes;
    setSceneVersion((prev) => prev + 1);
  }, [scene, isSelectionControlled, onSelectedNodeChange]);

  useEffect(() => {
    if (isSelectionControlled) {
      setSelectedNodeState(selectedNodeProp ?? null);
    }
  }, [isSelectionControlled, selectedNodeProp]);

  useEffect(() => {
    if (!selectedNode) {
      setExpandedIds([]);
      return;
    }
    const ancestors = new Set<string>();
    let current: THREE.Object3D | null = selectedNode;
    while (current) {
      ancestors.add(current.uuid);
      const parentUuid = parentSnapshotRef.current.get(current.uuid);
      current = parentUuid ? (nodeSnapshotRef.current.get(parentUuid) || null) : null;
    }
    setExpandedIds(Array.from(ancestors));
  }, [selectedNode]);

  useEffect(() => {
    let isMounted = true;
    fetch('/data/fastener-map.json')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data && typeof data === 'object') {
          setFastenerMap(data);
        }
      })
      .catch((error) => {
        console.error('Failed to load fastener map:', error);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      animationRef.current.forEach((id) => cancelAnimationFrame(id));
      animationRef.current.clear();
    };
  }, []);

  // Loading state
  if (!scene) {
    return (
      <div style={{
        textAlign: 'center',
        color: '#ccc',
        padding: '20px',
        fontSize: '14px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Loading model hierarchy...
        </div>
        <ChatBox />
      </div>
    );
  }

  const getNodeState = useCallback((node: THREE.Object3D): NodeState => {
    return nodeStates[node.uuid] || 'attached';
  }, [nodeStates]);

  const isFastener = useCallback((node: THREE.Object3D): boolean => {
    return /screw|bolt/i.test(node.name || '');
  }, []);

  const isSelected = useCallback((node: THREE.Object3D): boolean => {
    return selectedNode?.uuid === node.uuid;
  }, [selectedNode]);

  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds]);

  const isForcedExpanded = useCallback((node: THREE.Object3D): boolean => {
    return expandedSet.has(node.uuid);
  }, [expandedSet]);

  const updateNodeState = useCallback((node: THREE.Object3D, state: NodeState) => {
    setNodeStates((prev) => ({
      ...prev,
      [node.uuid]: state
    }));
  }, []);

  const canLoosen = useCallback((node: THREE.Object3D): boolean => {
    if (getNodeState(node) === 'detached') {
      return false;
    }
    return true;
  }, [getNodeState]);

  const canDetach = useCallback((node: THREE.Object3D): boolean => {
    if (getNodeState(node) === 'detached') {
      return false;
    }
    return true;
  }, [getNodeState]);

  const handleNodeSelect = useCallback((node: THREE.Object3D) => {
    if (isSelectionControlled) {
      onSelectedNodeChange?.(node);
    } else {
      setSelectedNodeState(node);
    }
    onNodeSelect(node);
  }, [isSelectionControlled, onSelectedNodeChange, onNodeSelect]);

  const getChildren = useCallback((node: THREE.Object3D): THREE.Object3D[] => {
    return childrenSnapshotRef.current.get(node.uuid) || [];
  }, []);

  const getFastenersForNode = useCallback((node: THREE.Object3D) => {
    return fastenerMap[node.name] || [];
  }, [fastenerMap]);

  const isAnimating = useCallback((node: THREE.Object3D): boolean => {
    return Boolean(animatingNodes[node.uuid]);
  }, [animatingNodes]);

  const setAnimating = useCallback((node: THREE.Object3D, active: boolean) => {
    setAnimatingNodes((prev) => {
      if (prev[node.uuid] === active) {
        return prev;
      }
      return { ...prev, [node.uuid]: active };
    });
  }, []);

  const animateLocalPosition = useCallback((
    node: THREE.Object3D,
    from: THREE.Vector3,
    to: THREE.Vector3,
    durationMs: number,
    onComplete?: () => void
  ) => {
    const startTime = performance.now();
    const start = from.clone();
    const end = to.clone();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      node.position.lerpVectors(start, end, eased);
      node.updateMatrix();
      node.updateMatrixWorld(true);

      if (t < 1) {
        const id = requestAnimationFrame(step);
        animationRef.current.set(node.uuid, id);
      } else {
        animationRef.current.delete(node.uuid);
        onComplete?.();
      }
    };

    const id = requestAnimationFrame(step);
    animationRef.current.set(node.uuid, id);
  }, []);

  const getDetachOffset = useCallback((node: THREE.Object3D): THREE.Vector3 => {
    const box = new THREE.Box3().setFromObject(node);
    const size = new THREE.Vector3();
    box.getSize(size);
    const distance = Math.max(size.length() * 0.25, 0.1);
    return new THREE.Vector3(0, 0, distance);
  }, []);

  const getPullOutDistance = useCallback((node: THREE.Object3D): number => {
    const box = new THREE.Box3().setFromObject(node);
    const size = new THREE.Vector3();
    box.getSize(size);
    const minDistance = Math.max(size.length() * 0.25, 0.5);
    return Math.max(minDistance, pullOutDistanceOverride);
  }, [pullOutDistanceOverride]);

  const handleLoosen = useCallback((node: THREE.Object3D) => {
    if (!canLoosen(node) || getNodeState(node) === 'detached' || isAnimating(node)) {
      return;
    }
    const currentState = getNodeState(node);
    if (!originalPositionRef.current.has(node.uuid)) {
      originalPositionRef.current.set(node.uuid, node.position.clone());
    }
    const original = originalPositionRef.current.get(node.uuid)!.clone();
    const start = node.position.clone();
    const distance = getPullOutDistance(node);
    const worldPos = new THREE.Vector3();
    node.getWorldPosition(worldPos);
    const targetWorld = worldPos.clone().add(new THREE.Vector3(0, 0, 1).multiplyScalar(distance));
    const targetLocal = node.parent ? node.parent.worldToLocal(targetWorld.clone()) : targetWorld;
    const target = currentState === 'loosened' ? original : targetLocal;
    setAnimating(node, true);
    animateLocalPosition(node, start, target, 350, () => {
      setNodeStates((prev) => ({
        ...prev,
        [node.uuid]: currentState === 'loosened' ? 'attached' : 'loosened'
      }));
      setAnimating(node, false);
      setSceneVersion((prev) => prev + 1);
    });
  }, [canLoosen, getNodeState, isAnimating, animateLocalPosition, setAnimating, getPullOutDistance]);

  const handleDetach = useCallback((node: THREE.Object3D) => {
    if (!canDetach(node) || isAnimating(node)) {
      return;
    }

    if (node.parent) {
      const parent = node.parent;
      const index = parent.children.indexOf(node);
      if (!detachInfoRef.current.has(node.uuid)) {
        detachInfoRef.current.set(node.uuid, {
          parent,
          index,
          position: node.position.clone(),
          quaternion: node.quaternion.clone(),
          offset: getDetachOffset(node),
          lastState: getNodeState(node)
        });
      }
    }

    const info = detachInfoRef.current.get(node.uuid);
    if (!info) {
      return;
    }

    setAnimating(node, true);
    const start = node.position.clone();
    const target = start.clone().add(info.offset);
    animateLocalPosition(node, start, target, 200, () => {
      if (node.parent) {
        node.parent.remove(node);
      }
      updateNodeState(node, 'detached');
      setAnimating(node, false);
      setSceneVersion((prev) => prev + 1);
    });
  }, [canDetach, updateNodeState, animateLocalPosition, getDetachOffset, setAnimating, isAnimating]);

  const isInScene = useCallback((node: THREE.Object3D): boolean => {
    let current: THREE.Object3D | null = node;
    while (current) {
      if (current === scene) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }, [scene]);

  const canAttach = useCallback((node: THREE.Object3D): boolean => {
    const info = detachInfoRef.current.get(node.uuid);
    if (!info) {
      return false;
    }
    return isInScene(info.parent);
  }, [isInScene]);

  const handleAttach = useCallback((node: THREE.Object3D) => {
    const info = detachInfoRef.current.get(node.uuid);
    if (!info || !isInScene(info.parent)) {
      return;
    }
    if (isAnimating(node)) {
      return;
    }
    info.parent.add(node);
    node.position.copy(info.position.clone().add(info.offset));
    node.quaternion.copy(info.quaternion);
    node.updateMatrixWorld(true);
    setAnimating(node, true);
    animateLocalPosition(node, node.position.clone(), info.position, 350, () => {
      detachInfoRef.current.delete(node.uuid);
      updateNodeState(node, info.lastState === 'loosened' ? 'loosened' : 'attached');
      setAnimating(node, false);
      setSceneVersion((prev) => prev + 1);
    });
  }, [updateNodeState, isInScene, isAnimating, animateLocalPosition, setAnimating]);

  // Generate root nodes
  const rootNodes = useMemo(() =>
    rootNodesRef.current.map((child: THREE.Object3D, index: number) => (
      <TreeNode
        key={`root-${child.id}-${index}`}
        node={child}
        depth={0}
        onNodeSelect={handleNodeSelect}
        getChildren={getChildren}
        getFastenersForNode={getFastenersForNode}
        getNodeState={getNodeState}
        isSelected={isSelected}
        isForcedExpanded={isForcedExpanded}
        isFastener={isFastener}
        canLoosen={canLoosen}
        canDetach={canDetach}
        canAttach={canAttach}
        isAnimating={isAnimating}
        onLoosen={handleLoosen}
        onDetach={handleDetach}
        onAttach={handleAttach}
      />
    )), [handleNodeSelect, getChildren, getFastenersForNode, getNodeState, isSelected, isForcedExpanded, isFastener, canLoosen, canDetach, canAttach, isAnimating, handleLoosen, handleDetach, handleAttach, sceneVersion]);

  return (
    <div className="hierarchy-container" style={{
      width: '100%',
      height: '100%',
      background: 'transparent',
      color: '#fff',
      fontFamily: 'monospace',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '8px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(0, 0, 0, 0.6)'
      }}>
        <div style={{
          padding: '8px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.04)'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 'bold',
            color: '#4ecdc4',
            marginBottom: '6px'
          }}>
            Pull Out Distance (m)
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <input
              type="range"
              min={0.1}
              max={3.0}
              step={0.1}
              value={pullOutDistanceOverride}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isNaN(next)) {
                  setPullOutDistanceOverride(next);
                }
              }}
              style={{
                flex: 1
              }}
            />
            <span style={{
              minWidth: '40px',
              textAlign: 'right',
              fontSize: '11px',
              color: '#fff',
              fontFamily: 'monospace'
            }}>
              {pullOutDistanceOverride.toFixed(1)}m
            </span>
          </div>
        </div>
      </div>

      {/* Node Hierarchy Section */}
      <div style={{
        flex: '1 1 0',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'auto',
        padding: '8px'
      }}>
        <div style={{
          marginBottom: '12px',
        }} />
        {rootNodes}
      </div>

      {/* ChatBox Section */}
      <div className="chatbox-section" style={{
        flex: '0 0 auto',
        minHeight: '280px',
        maxHeight: '320px',
        height: 'auto',
        overflow: 'hidden'
      }}>
        <ChatBox />
      </div>
    </div>
  );
});

NodeHierarchy.displayName = 'NodeHierarchy';

export default NodeHierarchy;
