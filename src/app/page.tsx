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
  const [steps, setSteps] = useState<{math: string, explanation: string}[]>([]);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [substeps, setSubsteps] = useState<{math: string, explanation: string}[]>([]);

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
    try {
      const res = await axios.post("http://localhost:8000/split-solution", {
        solution: solutionInput,
      });

      const stepsData = res.data.steps;
      setSteps(stepsData);
      setSelectedStep(null);
      setSubsteps([]);

      // Create nodes for visualization
      const newNodes = stepsData.map((step: {math: string, explanation: string}, idx: number) => ({
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
        position: { x: 200, y: idx * 100 },
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
      
      // Create edges connecting nodes in sequence
      const newEdges = stepsData.slice(0, -1).map((_, idx: number) => ({
        id: `e-${idx}`,
        source: `${idx}`,
        target: `${idx + 1}`,
        animated: true,
        style: { stroke: '#888' },
      }));
      
      setEdges(newEdges);
      setNodeStates({});
    } catch (error) {
      console.error("Error analyzing solution:", error);
    }
  };

  const handleStepClick = async (index: number) => {
    setSelectedStep(index);
    
    try {
      const res = await axios.post("http://localhost:8000/split-step", {
        step: steps[index].math,
      });

      setSubsteps(res.data.substeps);
    } catch (error) {
      console.error("Error fetching substeps:", error);
      setSubsteps([]);
    }
  };

  const onNodeClick = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      const stepIndex = parseInt(node.id);
      if (!isNaN(stepIndex)) {
        handleStepClick(stepIndex);
      }
    },
    [steps]
  );

  const renderNodeTree = (parentId: string | null = null) => {
    const childNodes = nodes.filter((node) =>
      parentId ? node.id.startsWith(`${parentId}-`) : !node.id.includes("-")
    );

    return (
      // <Accordion type="single" collapsible>
      //   {childNodes.map((node) => (
      //     <AccordionItem key={node.id} value={node.id}>
      //       <AccordionTrigger className="flex flex-col text-left">
      //         <div className="text-blue-400 text-sm font-mono">
      //           <MathJax dynamic inline>{node.data.label?.props?.children[0]?.props?.children}</MathJax>
      //         </div>
      //         <div className="text-white text-xs italic">
      //           {node.data.label?.props?.children[1]?.props?.children}
      //         </div>
      //       </AccordionTrigger>
      //       <AccordionContent>
      //         {nodeStates[node.id] && renderNodeTree(node.id)}
      //       </AccordionContent>
      //     </AccordionItem>
      //   ))}
      // </Accordion>
      5
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
          .step-card {
            background-color: #1e1e1e;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
            transition: all 0.3s ease;
          }
          .step-card:hover {
            border-color: #555;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          }
          .step-card.selected {
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
          }
          .substep-card {
            background-color: #252525;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
            margin-left: 24px;
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
          <h2 className="font-bold text-lg mb-4">Solution Steps</h2>
          {renderNodeTree()}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Input Area */}
          <div className="p-4 border-b border-gray-800">
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
          
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* Vertical Steps View */}
            <div className="md:w-1/2 p-4 overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Solution Steps</h2>
              {steps.length === 0 ? (
                <p className="text-gray-400">Enter a solution and click "Analyze Solution" to see the steps.</p>
              ) : (
                <div className="space-y-4">
                  {steps.map((step, idx) => (
                    <div 
                      key={idx} 
                      className={`step-card ${selectedStep === idx ? 'selected' : ''}`}
                      onClick={() => handleStepClick(idx)}
                    >
                      <div className="text-white text-sm font-mono mb-2">
                        <span className="text-blue-400 mr-2">Step {idx + 1}:</span>
                        <MathJax dynamic>{step.math}</MathJax>
                      </div>
                      {step.explanation && (
                        <div className="text-gray-300 text-sm mt-2">
                          {step.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Visual Flow or Substeps */}
            <div className="md:w-1/2 border-t md:border-t-0 md:border-l border-gray-800">
              {selectedStep !== null ? (
                <div className="p-4 h-full overflow-y-auto">
                  <h2 className="text-xl font-bold mb-4">Substeps Breakdown</h2>
                  {substeps.length > 0 ? (
                    <div className="space-y-3">
                      {substeps.map((substep, idx) => (
                        <div key={idx} className="substep-card">
                          <div className="text-white text-sm font-mono mb-2">
                            <span className="text-blue-300 mr-2">{idx + 1}.</span>
                            <MathJax dynamic>{substep.math}</MathJax>
                          </div>
                          {substep.explanation && (
                            <div className="text-gray-300 text-sm mt-2">
                              {substep.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400">Select a step to see its breakdown.</p>
                  )}
                </div>
              ) : (
                <div className="h-full" style={{ backgroundColor: "#000000" }}>
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
                    <Background color="#333" gap={16} />
                    <Controls />
                  </ReactFlow>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MathJaxContext>
  );
}