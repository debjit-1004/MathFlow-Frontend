"use client";

import { useCallback, useState, useEffect } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  Node,
  Edge,
  applyNodeChanges,
  applyEdgeChanges,
} from "reactflow";
import "reactflow/dist/style.css";
import axios from "axios";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { MathJaxContext, MathJax} from "better-react-mathjax";

export default function HomePage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [solutionInput, setSolutionInput] = useState("");
  const [nodeStates, setNodeStates] = useState<Record<string, boolean>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleMouseMove = (e: MouseEvent) => {
    if (e.clientX < 50) {
      setIsSidebarOpen(true);
    } else if (e.clientX > 300) {
      setIsSidebarOpen(false);
    }
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const handleSubmit = async () => {
    const res = await axios.post("http://localhost:8000/split-solution", {
      solution: solutionInput,
    });

    const steps = res.data.steps;

    interface Step {
      math: string;
      explanation: string;
    }

    const newNodes = steps.map((step: Step, idx: number) => ({
      id: `${idx}`,
      type: "default",
      data: {
        label: (
          <div className="node-content">
            <div className="text-black text-sm font-mono math-container">
              <MathJax dynamic>{step.math}</MathJax>
            </div>
            <div className="text-black text-xs italic">{step.explanation}</div>
          </div>
        ),
      },
      position: { x: idx * 200, y: 50 },
      style: {
        background: "#f0f0f0",
        padding: 10,
        borderRadius: 10,
        width: 250,
        maxWidth: 300,
        color: "#000000",
      },
    }));

    setNodes(newNodes);
    setEdges([]);
    setNodeStates({});
  };

  const onNodeClick = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (nodeStates[node.id]) {
        setNodes((nds) => nds.filter((n) => !n.id.startsWith(`${node.id}-`)));
        setEdges((eds) => eds.filter((e) => !e.source.startsWith(node.id)));
        setNodeStates((states) => ({ ...states, [node.id]: false }));
      } else {
        const res = await axios.post("http://localhost:8000/split-step", {
          step: solutionInput,
        });

        const substeps = res.data.substeps;

        interface Substep {
          math: string;
          explanation: string;
        }

        const newSubNodes = substeps.map((sub: Substep, idx: number) => ({
          id: `${node.id}-${idx}`,
          type: "default",
          data: {
            label: (
              <div className="node-content">
                <div className="text-black text-sm font-mono math-container">
                  <MathJax dynamic>{sub.math}</MathJax>
                </div>
                <div className="text-black text-xs italic">{sub.explanation}</div>
              </div>
            ),
          },
          position: {
            x: Number(node.position.x) + idx * 150,
            y: Number(node.position.y) + 150,
          },
          style: {
            background: "#c0ffee",
            padding: 10,
            borderRadius: 10,
            width: 250,
            maxWidth: 300,
            color: "#000000",
          },
        }));
        setNodes((nds) => [...nds, ...newSubNodes]);

        const newEdges = substeps.map((_: unknown, idx: number) => ({
          id: `e-${node.id}-${idx}-${Date.now()}`,
          source: node.id,
          target: `${node.id}-${idx}`,
          animated: true,
        }));

        setEdges((eds) => [...eds, ...newEdges]);
        setNodeStates((states) => ({ ...states, [node.id]: true }));
      }
    },
    [nodeStates, solutionInput]
  );

  const renderNodeTree = (parentId: string | null = null) => {
    const childNodes = nodes.filter((node) =>
      parentId ? node.id.startsWith(`${parentId}-`) : !node.id.includes("-")
    );

    return (
      <Accordion type="single" collapsible>
        {childNodes.map((node) => (
          <AccordionItem key={node.id} value={node.id}>
            <AccordionTrigger className="flex flex-col text-left">
  <div className="text-blue-400 text-sm font-mono">
    <MathJax dynamic inline>{node.data.label?.props?.children[0]?.props?.children}</MathJax>
  </div>
  <div className="text-white text-xs italic">
    {node.data.label?.props?.children[1]?.props?.children}
  </div>
</AccordionTrigger>

            <AccordionContent>
              {nodeStates[node.id] && renderNodeTree(node.id)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <MathJaxContext>
      <div className="flex w-screen h-screen bg-black text-white">
        {/* Global styles for math containers */}
        <style jsx global>{`
          .node-content {
            color: black;
            word-wrap: break-word;
            width: 100%;
            overflow-wrap: break-word;
          }
          .math-container {
            width: 100%;
            overflow-x: auto;
            max-width: 100%;
            scrollbar-width: thin;
          }
          .math-container::-webkit-scrollbar {
            height: 4px;
          }
          .math-container::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, 0.3);
            border-radius: 4px;
          }
        `}</style>

        {/* Sidebar */}
        <div
          className={`fixed top-0 left-0 h-full w-64 bg-black border-r border-gray-800 p-4 overflow-y-auto transition-transform duration-300 z-50 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{
            backgroundColor: "#000000",
            boxShadow: "4px 0 10px rgba(0, 0, 0, 0.8)",
            pointerEvents: isSidebarOpen ? "auto" : "none",
          }}
        >
          <h2 className="font-bold text-lg mb-4">Node Tree</h2>
          {renderNodeTree()}
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="p-4">
            <textarea
              className="border border-gray-600 bg-black text-white p-2 w-full"
              rows={4}
              value={solutionInput}
              onChange={(e) => setSolutionInput(e.target.value)}
              placeholder="Paste your solution here..."
              style={{ backgroundColor: "#000000", color: "white" }}
            />
            <button
              onClick={handleSubmit}
              className="bg-blue-500 text-white p-2 rounded mt-2"
            >
              Analyze Solution
            </button>
          </div>
          <div style={{ height: "80vh", backgroundColor: "#000000" }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodeClick={onNodeClick}
              onNodesChange={(changes) =>
                setNodes((nds) => applyNodeChanges(changes, nds))
              }
              onEdgesChange={(changes) =>
                setEdges((eds) => applyEdgeChanges(changes, eds))
              }
              fitView
            >
              <MiniMap
                nodeColor={(node) =>
                  node.type === "default" ? "#007bff" : "#ff5722"
                }
                nodeStrokeColor={(node) =>
                  node.type === "default" ? "#0056b3" : "#bf360c"
                }
                nodeBorderRadius={5}
              />
              <Controls />
              <Background />
            </ReactFlow>
          </div>
        </div>
      </div>
    </MathJaxContext>
  );
}