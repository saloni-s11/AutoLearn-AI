import { useState, useCallback, useEffect } from "react";
import ReactFlow, { 
  Background, 
  useNodesState, 
  useEdgesState, 
  Node, 
  Edge, 
  useReactFlow, 
  ReactFlowProvider,
  MarkerType
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { generateMindMap } from "@/api";
import { Loader2, RefreshCcw, Sparkles, Download, MessageSquare, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { toPng } from "html-to-image";

interface MindMapTabProps {
  content: string;
  onImageCapture?: (imageUrl: string) => void;
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 180;
const nodeHeight = 60;

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: "TB", ranksep: 60, nodesep: 40 });
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);
  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = { x: nodeWithPosition.x - nodeWidth / 2, y: nodeWithPosition.y - nodeHeight / 2 };
  });
  return { nodes, edges };
};

function MindMapFlow({ content }: MindMapTabProps) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const transformToFlow = (mapData: any) => {
    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];
    
    initialNodes.push({
      id: "root",
      data: { label: mapData.topic },
      position: { x: 0, y: 0 },
      type: 'input',
      style: { backgroundColor: '#1e293b', color: '#FFFFFF', fontWeight: 'bold', fontSize: '14px', padding: '12px', borderRadius: '12px', border: 'none', width: nodeWidth, textAlign: 'center', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }
    });

    mapData.nodes.forEach((sub: any, subIdx: number) => {
      const subId = `sub-${subIdx}`;
      initialNodes.push({
        id: subId,
        data: { label: sub.title },
        position: { x: 0, y: 0 },
        style: { backgroundColor: '#8b5cf6', color: '#FFFFFF', fontWeight: 'bold', fontSize: '12px', padding: '10px', borderRadius: '10px', border: 'none', width: nodeWidth - 20, textAlign: 'center' }
      });
      initialEdges.push({
        id: `e-root-${subId}`,
        source: "root",
        target: subId,
        style: { stroke: "#8b5cf6", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" }
      });

      sub.children?.forEach((child: any, childIdx: number) => {
        const childId = `child-${subIdx}-${childIdx}`;
        initialNodes.push({
          id: childId,
          data: { label: child.title },
          position: { x: 0, y: 0 },
          style: { backgroundColor: '#f8fafc', color: '#334155', fontWeight: '600', fontSize: '11px', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', width: nodeWidth - 40, textAlign: 'center' }
        });
        initialEdges.push({ id: `e-${subId}-${childId}`, source: subId, target: childId, style: { stroke: "#cbd5e1", strokeWidth: 1.5 } });
      });
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
    setTimeout(() => {
      fitView({ duration: 500, padding: 0.1 });
      // Auto-capture for PDF export
      setTimeout(() => {
        const el = document.querySelector(".react-flow") as HTMLElement;
        if (el && onImageCapture) {
          toPng(el, { backgroundColor: "#ffffff", quality: 0.8 }).then(onImageCapture);
        }
      }, 600);
    }, 50);
  };

  const [asking, setAsking] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  const handleAskAI = async () => {
    if (!selectedNode) return;
    setAsking(true);
    setExplanation(null);
    try {
      const formData = new FormData();
      formData.append("message", `Briefly explain this concept in the context of my study material: ${selectedNode.data.label}`);
      
      // Get context from session
      let context = "";
      if (content) context = content; // Using the 'content' prop passed to MindMapTab
      formData.append("context", context);

      const r = await fetch("http://localhost:8000/chat", {
        method: "POST",
        body: formData
      });
      const res = await r.json();
      setExplanation(res.response);
    } catch (e) {
      toast.error("AI deep-dive failed");
    } finally {
      setAsking(false);
    }
  };

  const onExport = useCallback(() => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;
    toPng(el, { backgroundColor: "#ffffff", quality: 1 }).then((url) => {
      const link = document.createElement("a");
      link.download = `mindmap_${Date.now()}.png`;
      link.href = url;
      link.click();
      toast.success("Mind Map Downloaded!");
    });
  }, []);

  const onNodeClick = (_: any, node: Node) => {
    setSelectedNode(node);
    setExplanation(null);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generateMindMap(content);
      transformToFlow(res);
    } catch (e) {
      toast.error("Summary failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (content && nodes.length === 0) handleGenerate();
  }, [content]);

  if (loading) {
    return (
      <div className="h-[450px] bg-slate-50 flex flex-col items-center justify-center space-y-3 rounded-2xl border border-slate-100">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-30" />
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Generating Visual Summary</p>
      </div>
    );
  }

  return (
    <div className="h-[500px] w-full border border-slate-100 rounded-2xl overflow-hidden relative bg-white shadow-inner">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnScroll={false}
        panOnScroll={true}
        panOnDrag={true}
      >
        <Background color="#f1f5f9" gap={20} size={1} />
        
        <div className="absolute top-4 right-4 z-10 flex gap-2">
            <Button onClick={() => fitView({ duration: 500, padding: 0.2 })} variant="outline" size="sm" className="h-8 rounded-lg bg-white/80 backdrop-blur-sm text-[10px] font-bold border-slate-200 shadow-sm">
               <RefreshCcw className="h-3 w-3 mr-2" /> Reset
            </Button>
            <Button onClick={onExport} variant="outline" size="sm" className="h-8 rounded-lg bg-white/80 backdrop-blur-sm text-[10px] font-bold border-slate-200 shadow-sm">
               <Download className="h-3 w-3 mr-2 text-primary" /> Download
            </Button>
            <Button onClick={handleGenerate} variant="outline" size="sm" className="h-8 rounded-lg bg-white/80 backdrop-blur-sm text-[10px] font-bold border-slate-200 shadow-sm">
               <Sparkles className="h-3 w-3 mr-2 text-primary" /> Regenerate
            </Button>
        </div>

        {selectedNode && (
          <div className="absolute bottom-4 right-4 z-20 w-80 bg-slate-900 text-white p-5 rounded-3xl shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                 <Zap className="h-3 w-3 text-primary" />
                 <p className="text-[10px] font-black uppercase tracking-widest text-primary">Intelligence</p>
              </div>
              <button onClick={() => setSelectedNode(null)} className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
            <h4 className="font-bold text-sm mb-4 leading-tight">{selectedNode.data.label}</h4>
            
            {explanation ? (
              <div className="max-h-40 overflow-y-auto mb-4 pr-2 custom-scrollbar">
                <p className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-primary/30 pl-3">
                  {explanation}
                </p>
              </div>
            ) : (
              <Button 
                onClick={handleAskAI} 
                disabled={asking}
                className="w-full h-10 rounded-xl gap-2 font-bold bg-primary text-white hover:bg-primary/90 transition-all active:scale-95"
              >
                {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                {asking ? "Deep-diving..." : "Ask AI about this"}
              </Button>
            )}
            
            {explanation && (
               <Button 
                onClick={() => setExplanation(null)} 
                variant="ghost" 
                size="sm" 
                className="w-full text-[10px] h-8 text-slate-500 hover:text-white"
              >
                Reset Explanation
              </Button>
            )}
          </div>
        )}

        <div className="absolute bottom-4 left-4 z-10">
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Quick Concept Map</p>
        </div>
      </ReactFlow>
    </div>
  );
}

export default function MindMapTab(props: MindMapTabProps) {
  return (
    <ReactFlowProvider>
      <MindMapFlow {...props} />
    </ReactFlowProvider>
  );
}
