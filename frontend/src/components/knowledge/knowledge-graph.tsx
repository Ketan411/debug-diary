import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Network,
  RotateCcw,
  Sparkles,
  Move,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Lock,
  Unlock,
} from "lucide-react";
import { Incident } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

export interface SimilarityEdge {
  sourceIncidentId: string;
  targetIncidentId: string;
  similarityScore: number;
}

export interface GraphNode {
  id: string;
  incident: Incident;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isDragging?: boolean;
}

const CATEGORY_COLORS: Record<
  string,
  { bg: string; border: string; text: string; dot: string }
> = {
  Authentication: {
    bg: "rgba(168, 85, 247, 0.15)",
    border: "#A855F7",
    text: "#C084FC",
    dot: "#A855F7",
  },
  Database: {
    bg: "rgba(59, 130, 246, 0.15)",
    border: "#3B82F6",
    text: "#60A5FA",
    dot: "#3B82F6",
  },
  API: {
    bg: "rgba(245, 158, 11, 0.15)",
    border: "#F59E0B",
    text: "#FBBF24",
    dot: "#F59E0B",
  },
  "CI/CD": {
    bg: "rgba(239, 68, 68, 0.15)",
    border: "#EF4444",
    text: "#F87171",
    dot: "#EF4444",
  },
  Frontend: {
    bg: "rgba(16, 185, 129, 0.15)",
    border: "#10B981",
    text: "#34D399",
    dot: "#10B981",
  },
  Infrastructure: {
    bg: "rgba(148, 163, 184, 0.15)",
    border: "#94A3B8",
    text: "#CBD5E1",
    dot: "#94A3B8",
  },
};

// Spatial Territory Centers for Clean Categorical Islands
const CATEGORY_HUBS: Record<string, { x: number; y: number }> = {
  Authentication: { x: 210, y: 160 },
  Infrastructure: { x: 480, y: 130 },
  Database: { x: 740, y: 160 },
  Frontend: { x: 210, y: 420 },
  "CI/CD": { x: 480, y: 440 },
  API: { x: 740, y: 420 },
};

interface KnowledgeGraphProps {
  incidents: Incident[];
  selectedRepo?: string;
}

export function KnowledgeGraph({
  incidents,
  selectedRepo = "All",
}: KnowledgeGraphProps) {
  const [edges, setEdges] = useState<SimilarityEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("All");
  const [isPhysicsLocked, setIsPhysicsLocked] = useState<boolean>(true);

  // Pan and Zoom Transformation State
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<SimilarityEdge[]>([]);
  const draggedNodeIdRef = useRef<string | null>(null);
  const animFrameRef = useRef<number | null>(null);

  nodesRef.current = nodes;
  edgesRef.current = edges;

  // 1. Fetch similarity mesh from backend or construct sparse, high-value constellations
  useEffect(() => {
    if (incidents.length === 0) {
      setEdges([]);
      return;
    }

    const repoParam =
      selectedRepo && selectedRepo !== "All"
        ? `&repository=${encodeURIComponent(selectedRepo)}`
        : "";

    apiFetch<{ edges: SimilarityEdge[] }>(
      `/incidents/similarity-mesh?threshold=0.50${repoParam}`
    )
      .then((res) => {
        if (res.edges && res.edges.length > 0) {
          // Prune edges so each incident connects to at most 2 nearest neighbors to prevent congestion
          setEdges(pruneExcessEdges(res.edges, 2));
        } else {
          buildSparseConstellation();
        }
      })
      .catch((err) => {
        console.warn("Backend mesh unavailable, using clean constellation fallback:", err);
        buildSparseConstellation();
      });

    // Prunes edges so no single node has an overwhelming number of connections
    function pruneExcessEdges(rawEdges: SimilarityEdge[], maxPerNode = 2): SimilarityEdge[] {
      const degreeCount: Record<string, number> = {};
      const sorted = [...rawEdges].sort((a, b) => b.similarityScore - a.similarityScore);
      const kept: SimilarityEdge[] = [];

      for (const e of sorted) {
        const dSrc = degreeCount[e.sourceIncidentId] || 0;
        const dTgt = degreeCount[e.targetIncidentId] || 0;
        if (dSrc < maxPerNode || dTgt < maxPerNode) {
          kept.push(e);
          degreeCount[e.sourceIncidentId] = dSrc + 1;
          degreeCount[e.targetIncidentId] = dTgt + 1;
        }
      }
      return kept;
    }

    // Constructs a clean, readable constellation without tangled balls of yarn
    function buildSparseConstellation() {
      const cleanEdges: SimilarityEdge[] = [];
      const edgeSet = new Set<string>();

      // Group incidents by category
      const byCategory: Record<string, Incident[]> = {};
      incidents.forEach((inc) => {
        if (!byCategory[inc.category]) byCategory[inc.category] = [];
        byCategory[inc.category].push(inc);
      });

      // In each category, connect nodes in a sequential tree / star, NOT all-to-all K_n
      Object.values(byCategory).forEach((catIncidents) => {
        if (catIncidents.length <= 1) return;
        for (let i = 0; i < catIncidents.length - 1; i++) {
          const a = catIncidents[i];
          const b = catIncidents[i + 1];
          const key = `${a.id}-${b.id}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            cleanEdges.push({
              sourceIncidentId: a.id,
              targetIncidentId: b.id,
              similarityScore: 0.85,
            });
          }
        }
      });

      // Cross-category semantic bridge for incidents with shared tags (max 1 per pair)
      for (let i = 0; i < incidents.length; i++) {
        for (let j = i + 1; j < incidents.length; j++) {
          const a = incidents[i];
          const b = incidents[j];
          if (a.category !== b.category) {
            const sharedTags = (a.tags || []).filter((t) =>
              (b.tags || []).includes(t)
            );
            if (sharedTags.length >= 2) {
              const key = `${a.id}-${b.id}`;
              if (!edgeSet.has(key)) {
                edgeSet.add(key);
                cleanEdges.push({
                  sourceIncidentId: a.id,
                  targetIncidentId: b.id,
                  similarityScore: 0.72,
                });
                break; // Limit to 1 bridge to keep canvas pristine
              }
            }
          }
        }
      }

      setEdges(cleanEdges);
    }
  }, [incidents, selectedRepo]);

  // 2. Pre-compute a stationary, relaxed layout organized into category territories
  const resetLayout = useCallback(() => {
    const width = 960;
    const height = 580;

    // Place nodes near their respective Category Hubs
    const initialNodes: GraphNode[] = incidents.map((inc, i) => {
      const hub = CATEGORY_HUBS[inc.category] || { x: width / 2, y: height / 2 };

      // Spoke angle around the hub
      const angle = (i * 1.35) % (2 * Math.PI);
      const dist = 35 + ((i * 19) % 55);

      const colorScheme =
        CATEGORY_COLORS[inc.category] || CATEGORY_COLORS.API;

      return {
        id: inc.id,
        incident: inc,
        x: Math.max(50, Math.min(width - 50, hub.x + Math.cos(angle) * dist)),
        y: Math.max(50, Math.min(height - 50, hub.y + Math.sin(angle) * dist)),
        vx: 0,
        vy: 0,
        radius: 17,
        color: colorScheme.border,
        isDragging: false,
      };
    });

    // Run 50 offline physics relaxation steps in memory so the graph mounts completely still
    for (let step = 0; step < 50; step++) {
      const n = initialNodes.length;
      for (let i = 0; i < n; i++) {
        const nodeA = initialNodes[i];
        const hub = CATEGORY_HUBS[nodeA.incident.category] || { x: width / 2, y: height / 2 };

        // Pull gently toward category hub
        nodeA.x += (hub.x - nodeA.x) * 0.04;
        nodeA.y += (hub.y - nodeA.y) * 0.04;

        // Repel neighbors to prevent overlap
        for (let j = i + 1; j < n; j++) {
          const nodeB = initialNodes[j];
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distSq = dx * dx + dy * dy || 1;
          const minDist = nodeA.radius + nodeB.radius + 18;

          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq);
            const overlap = (minDist - dist) * 0.5;
            const fx = (dx / dist) * overlap;
            const fy = (dy / dist) * overlap;

            nodeA.x -= fx;
            nodeA.y -= fy;
            nodeB.x += fx;
            nodeB.y += fy;
          }
        }
      }
    }

    setNodes(initialNodes);
    nodesRef.current = initialNodes;
    setPan({ x: 0, y: 0 });
    setZoom(1.0);

    if (initialNodes.length > 0 && !selectedNodeId) {
      setSelectedNodeId(initialNodes[0].id);
    }
  }, [incidents, selectedNodeId]);

  useEffect(() => {
    resetLayout();
  }, [resetLayout]);

  // 3. Gentle Physics Update Loop: Active ONLY while dragging a node
  const runPhysicsStep = useCallback(() => {
    if (!draggedNodeIdRef.current) return;

    const currentNodes = [...nodesRef.current];
    const currentEdges = edgesRef.current;
    const n = currentNodes.length;

    // Spring attraction along connected edges
    for (const edge of currentEdges) {
      const src = currentNodes.find((nd) => nd.id === edge.sourceIncidentId);
      const tgt = currentNodes.find((nd) => nd.id === edge.targetIncidentId);
      if (!src || !tgt) continue;

      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const desiredLength = 65;
      const force = (dist - desiredLength) * 0.04;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (src.id !== draggedNodeIdRef.current) {
        src.x += fx * 0.3;
        src.y += fy * 0.3;
      }
      if (tgt.id !== draggedNodeIdRef.current) {
        tgt.x -= fx * 0.3;
        tgt.y -= fy * 0.3;
      }
    }

    // Local collision separation for nearby nodes
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = currentNodes[i];
        const b = currentNodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy || 1;
        const minDist = 38;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const push = (minDist - dist) * 0.2;
          const fx = (dx / dist) * push;
          const fy = (dy / dist) * push;

          if (a.id !== draggedNodeIdRef.current) {
            a.x -= fx;
            a.y -= fy;
          }
          if (b.id !== draggedNodeIdRef.current) {
            b.x += fx;
            b.y += fy;
          }
        }
      }
    }

    nodesRef.current = currentNodes;
    setNodes(currentNodes);
  }, []);

  // 4. Mouse / Touch Handlers for Dragging Nodes and Panning Background
  const handleNodePointerDown = (nodeId: string, event: React.PointerEvent) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggedNodeIdRef.current = nodeId;
    setSelectedNodeId(nodeId);

    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, isDragging: true } : n))
    );
  };

  const handleSvgPointerDown = (event: React.PointerEvent) => {
    // Background click initiates canvas panning
    if (event.target === svgRef.current || (event.target as HTMLElement).tagName === "rect") {
      setIsPanning(true);
      panStartRef.current = { x: event.clientX - pan.x, y: event.clientY - pan.y };
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    // Case 1: Panning the background canvas
    if (isPanning) {
      setPan({
        x: event.clientX - panStartRef.current.x,
        y: event.clientY - panStartRef.current.y,
      });
      return;
    }

    // Case 2: Dragging a specific incident node
    if (!draggedNodeIdRef.current || !svgRef.current) return;

    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const screenCTM = svg.getScreenCTM();
    if (!screenCTM) return;
    const svgPoint = pt.matrixTransform(screenCTM.inverse());

    // Account for current pan and zoom
    const targetX = (svgPoint.x - pan.x) / zoom;
    const targetY = (svgPoint.y - pan.y) / zoom;

    nodesRef.current = nodesRef.current.map((n) => {
      if (n.id === draggedNodeIdRef.current) {
        return {
          ...n,
          x: targetX,
          y: targetY,
          vx: 0,
          vy: 0,
        };
      }
      return n;
    });

    if (!isPhysicsLocked) {
      runPhysicsStep();
    } else {
      setNodes([...nodesRef.current]);
    }
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    if (draggedNodeIdRef.current) {
      const releasedId = draggedNodeIdRef.current;
      draggedNodeIdRef.current = null;
      setNodes((prev) =>
        prev.map((n) => (n.id === releasedId ? { ...n, isDragging: false } : n))
      );
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))));
  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // 5. Lookups for Selected and Connected Incidents
  const selectedIncident = useMemo(() => {
    return (
      incidents.find((inc) => inc.id === selectedNodeId) ||
      incidents[0] ||
      null
    );
  }, [incidents, selectedNodeId]);

  // Set of connected incident IDs for focused highlighting
  const connectedNodeIds = useMemo(() => {
    const activeId = hoveredNodeId || selectedNodeId;
    if (!activeId) return new Set<string>();
    const ids = new Set<string>([activeId]);
    edges.forEach((e) => {
      if (e.sourceIncidentId === activeId) ids.add(e.targetIncidentId);
      if (e.targetIncidentId === activeId) ids.add(e.sourceIncidentId);
    });
    return ids;
  }, [edges, hoveredNodeId, selectedNodeId]);

  // Filtered nodes based on active Category Island
  const visibleNodes = useMemo(() => {
    if (activeCategoryFilter === "All") return nodes;
    return nodes.filter((n) => n.incident.category === activeCategoryFilter);
  }, [nodes, activeCategoryFilter]);

  const visibleNodeIdSet = useMemo(() => {
    return new Set(visibleNodes.map((n) => n.id));
  }, [visibleNodes]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Interactive SVG Network Canvas */}
      <div className="relative col-span-2 overflow-hidden rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
        {/* Top Controls Bar */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Knowledge Mesh ({visibleNodes.length} Nodes, {edges.length} Links)
            </span>
            {selectedRepo !== "All" && (
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                {selectedRepo}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPhysicsLocked(!isPhysicsLocked)}
              className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              title={isPhysicsLocked ? "Physics locked (stationary)" : "Physics dynamic (elastic)"}
            >
              {isPhysicsLocked ? (
                <>
                  <Lock className="h-3 w-3 text-emerald-400" />
                  Fixed
                </>
              ) : (
                <>
                  <Unlock className="h-3 w-3 text-amber-400" />
                  Elastic
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetView}
              className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              title="Reset View"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>

        {/* User Interaction Guidance */}
        <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Move className="h-3 w-3 text-primary" />
            Click an incident to highlight its connections. Drag nodes to customize your layout.
          </span>
          <span className="text-[10px] text-muted-foreground/80 font-mono">
            Zoom: {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* SVG Viewport */}
        <svg
          ref={svgRef}
          viewBox="0 0 960 580"
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="h-[490px] w-full cursor-grab select-none active:cursor-grabbing rounded-lg bg-background/50 border border-border/40"
        >
          <defs>
            <radialGradient id="meshCenterGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22C55E" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
            </radialGradient>
            <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Canvas Pan/Zoom Layer */}
          <rect width="960" height="580" fill="url(#meshCenterGlow)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Territory Watermark Labels in Background */}
            {activeCategoryFilter === "All" &&
              Object.entries(CATEGORY_HUBS).map(([category, hub]) => (
                <text
                  key={`hub-${category}`}
                  x={hub.x}
                  y={hub.y - 75}
                  fontSize="12"
                  fontWeight="700"
                  letterSpacing="0.08em"
                  fill="rgba(148, 163, 184, 0.16)"
                  textAnchor="middle"
                  className="uppercase pointer-events-none select-none font-mono"
                >
                  {category}
                </text>
              ))}

            {/* Render Sparse Similarity Mesh Edges */}
            {edges.map((edge, idx) => {
              if (
                !visibleNodeIdSet.has(edge.sourceIncidentId) ||
                !visibleNodeIdSet.has(edge.targetIncidentId)
              ) {
                return null;
              }

              const src = nodes.find((n) => n.id === edge.sourceIncidentId);
              const tgt = nodes.find((n) => n.id === edge.targetIncidentId);
              if (!src || !tgt) return null;

              const isDirectlyActive =
                (selectedNodeId === src.id && connectedNodeIds.has(tgt.id)) ||
                (selectedNodeId === tgt.id && connectedNodeIds.has(src.id)) ||
                (hoveredNodeId === src.id && connectedNodeIds.has(tgt.id)) ||
                (hoveredNodeId === tgt.id && connectedNodeIds.has(src.id));

              // Clean edge styling: faint by default, vibrant neon on focus
              const strokeColor = isDirectlyActive
                ? "#22C55E"
                : "rgba(148, 163, 184, 0.20)";
              const strokeWidth = isDirectlyActive ? 2.5 : 1.2;
              const opacity = isDirectlyActive ? 1.0 : connectedNodeIds.size > 0 ? 0.2 : 0.7;

              return (
                <g key={`edge-${idx}`} style={{ opacity, transition: "opacity 0.2s ease" }}>
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isDirectlyActive ? "none" : "3 3"}
                    filter={isDirectlyActive ? "url(#softGlow)" : undefined}
                  />

                  {/* Percentage badge on active connections */}
                  {isDirectlyActive && (
                    <g
                      transform={`translate(${(src.x + tgt.x) / 2}, ${
                        (src.y + tgt.y) / 2
                      })`}
                    >
                      <rect
                        x="-14"
                        y="-8"
                        width="28"
                        height="16"
                        rx="4"
                        fill="#0F172A"
                        stroke="#22C55E"
                        strokeWidth="1"
                      />
                      <text
                        y="3.5"
                        fontSize="9"
                        fill="#4ADE80"
                        textAnchor="middle"
                        className="font-mono font-semibold"
                      >
                        {Math.round(edge.similarityScore * 100)}%
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Render Nodes with Clean Labels */}
            {visibleNodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNodeId === node.id;
              const isConnected = connectedNodeIds.has(node.id);
              const isDimmed =
                connectedNodeIds.size > 0 && !isConnected && !isSelected;
              const opacity = isDimmed ? 0.22 : 1.0;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onPointerDown={(e) => handleNodePointerDown(node.id, e)}
                  onClick={() => setSelectedNodeId(node.id)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  className="cursor-pointer"
                  style={{ opacity, transition: "opacity 0.2s ease" }}
                >
                  {/* Selection Pulsing Ring */}
                  {isSelected && (
                    <circle
                      r={node.radius + 6}
                      fill="none"
                      stroke={node.color}
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                  )}

                  {/* Outer Node Body */}
                  <circle
                    r={node.radius}
                    fill="#0B1120"
                    stroke={node.color}
                    strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.6}
                    filter={isSelected || isHovered ? "url(#softGlow)" : undefined}
                  />

                  {/* Inner Category Dot */}
                  <circle r={5.5} fill={node.color} />

                  {/* Clean Pill Label Below Node */}
                  <g transform={`translate(0, ${node.radius + 12})`}>
                    <rect
                      x="-42"
                      y="-7"
                      width="84"
                      height="15"
                      rx="3"
                      fill="rgba(11, 17, 32, 0.88)"
                      stroke={isSelected ? node.color : "rgba(148, 163, 184, 0.25)"}
                      strokeWidth="0.8"
                    />
                    <text
                      y="4"
                      fontSize="9"
                      fontWeight="600"
                      fill={isSelected ? "#FFFFFF" : "#E2E8F0"}
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                    >
                      {node.incident.title.length > 13
                        ? `${node.incident.title.slice(0, 12)}.`
                        : node.incident.title}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Category Island Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-muted-foreground">Category Islands:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveCategoryFilter("All")}
              className={`rounded-full px-2.5 py-0.5 transition-colors ${
                activeCategoryFilter === "All"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
              }`}
            >
              All Islands
            </button>
            {Object.entries(CATEGORY_COLORS).map(([cat, colors]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategoryFilter(cat)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 transition-colors ${
                  activeCategoryFilter === cat
                    ? "border border-primary font-semibold text-foreground bg-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: colors.border }}
                />
                <span>{cat}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Node Inspector Panel */}
      <div className="space-y-4">
        {selectedIncident ? (
          <Card className="border-border bg-card/60 shadow-sm backdrop-blur">
            <CardHeader className="p-5 pb-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className="border-primary/40 bg-primary/10 text-primary text-[10px]"
                  >
                    {selectedIncident.category}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedIncident.repository}
                  </span>
                </div>
                <CardTitle className="text-base font-semibold leading-snug text-foreground">
                  {selectedIncident.title}
                </CardTitle>
                <div className="flex flex-wrap gap-1">
                  {(selectedIncident.tags || []).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-5 pt-2 text-xs">
              <div>
                <p className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
                  Symptom
                </p>
                <p className="mt-1 leading-relaxed text-foreground">
                  {selectedIncident.symptom}
                </p>
              </div>

              {selectedIncident.rootCause && (
                <div>
                  <p className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
                    Root Cause
                  </p>
                  <p className="mt-1 leading-relaxed text-foreground">
                    {selectedIncident.rootCause}
                  </p>
                </div>
              )}

              {selectedIncident.resolution && (
                <div>
                  <p className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
                    Resolution
                  </p>
                  <p className="mt-1 leading-relaxed text-foreground">
                    {selectedIncident.resolution}
                  </p>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <Button size="sm" className="w-full gap-1.5 text-xs" asChild>
                  <Link to="/incidents/$id" params={{ id: selectedIncident.id }}>
                    View Full Incident & Evidence
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-xs text-muted-foreground">
            Select a node in the graph to view incident details.
          </div>
        )}
      </div>
    </div>
  );
}