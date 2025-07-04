"use client";

// To use plotly for graphing, install these packages:
// npm install react-plotly.js plotly.js @types/plotly.js

import { useCallback, useState, useEffect } from "react";
import ReactFlow, {
  Controls,
  Background,
  Node,
  Edge,
  applyNodeChanges,
  applyEdgeChanges,
} from "reactflow";
import "reactflow/dist/style.css";
import axios from "axios";
import { MathJaxContext, MathJax } from "better-react-mathjax";
import dynamic from 'next/dynamic';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

// SafeMathJax component to handle errors in MathJax rendering
const SafeMathJax = ({ children }: { children: React.ReactNode }) => {
  try {
    return <MathJax>{children}</MathJax>;
  } catch (error) {
    console.error("MathJax rendering error:", error);
    return <span className="text-red-500">Failed to render math: {String(children)}</span>;
  }
};

export default function HomePage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [solutionInput, setSolutionInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [steps, setSteps] = useState<{math: string, explanation: string}[]>([]);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [substeps, setSubsteps] = useState<{math: string, explanation: string}[]>([]);
  const [savedQuestions, setSavedQuestions] = useState<{id: string, question: string, timestamp: number, solution: {math: string, explanation: string}[]}[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

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

  // Load saved questions from localStorage on component mount
  useEffect(() => {
    const savedQuestionsFromStorage = localStorage.getItem('mathflow-saved-questions');
    if (savedQuestionsFromStorage) {
      try {
        const parsedQuestions = JSON.parse(savedQuestionsFromStorage);
        setSavedQuestions(parsedQuestions);
      } catch (error) {
        console.error("Error parsing saved questions", error);
      }
    }
  }, []);

  // Save questions to localStorage whenever they change
  useEffect(() => {
    if (savedQuestions.length > 0) {
      localStorage.setItem('mathflow-saved-questions', JSON.stringify(savedQuestions));
    }
  }, [savedQuestions]);

  const handleSubmit = async () => {
    try {
      // Only proceed if there's actual input
      if (!solutionInput.trim()) return;
      
      const res = await axios.post("https://mathflow-backend.onrender.com/split-solution", {
        solution: solutionInput,
      });

      const stepsData = res.data.steps;
      setSteps(stepsData);
      setSelectedStep(null);
      setSubsteps([]);

      // Save this question to history
      const newQuestionId = Date.now().toString();
      const newQuestion = {
        id: newQuestionId,
        question: solutionInput,
        timestamp: Date.now(),
        solution: stepsData
      };
      
      setSavedQuestions(prevQuestions => {
        // Remove duplicates and keep only most recent 20 questions
        const filteredQuestions = prevQuestions
          .filter(q => q.question !== solutionInput)
          .slice(0, 19);
        return [newQuestion, ...filteredQuestions];
      });

      // Create nodes for visualization
      const newNodes = stepsData.map((step: {math: string, explanation: string}, idx: number) => ({
        id: `${idx}`,
        type: "default",
        data: {
          label: (
            <div className="node-content">
              <div className="text-black text-sm font-mono math-container">
                <SafeMathJax>{step.math}</SafeMathJax>
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
      const newEdges: Edge[] = stepsData.slice(0, -1).map((_: {math: string, explanation: string}, idx: number): Edge => ({
        id: `e-${idx}`,
        source: `${idx}`,
        target: `${idx + 1}`,
        animated: true,
        style: { stroke: '#888' },
      }));
      
      setEdges(newEdges);
    } catch (error) {
      console.error("Error analyzing solution:", error);
    }
  };

  const handleStepClick = useCallback(async (index: number) => {
    setSelectedStep(index);

    try {
      const res = await axios.post(
        "https://mathflow-backend.onrender.com/split-step",
        {
          step: steps[index].math,
        }
      );

      const processedSubsteps = res.data.substeps.map(
        (sub: { math: string; explanation: string }) => {
          // Clean up math part - remove markdown headers and any **asterisks**
          const cleanMath = sub.math
            .replace(/## \d+\.\s*Math Step:[\s\*]*/i, "")
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .trim();
          
          // Clean up explanation - remove markdown headers and any **asterisks**
          const cleanExplanation = sub.explanation
            .replace(/## \d+\.\s*Deep Explanation:[\s\*]*/i, "")
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .trim();
            
          return {
            math: cleanMath,
            explanation: cleanExplanation
          };
        }
      );

      setSubsteps(processedSubsteps);
    } catch (error) {
      console.error("Error fetching substeps:", error);
      setSubsteps([]);
    }
  }, [steps]);

  const onNodeClick = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      const stepIndex = parseInt(node.id);
      if (!isNaN(stepIndex)) {
        handleStepClick(stepIndex);
      }
    },
    [handleStepClick]
  );

  return (
    <MathJaxContext config={{
        tex: {
          inlineMath: [['$', '$'], ['\\(', '\\)']],
          displayMath: [['$$', '$$'], ['\\[', '\\]']],
          processEscapes: true,
          processEnvironments: true
        },
        options: {
          enableMenu: false,
          skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
        },
        startup: {
          typeset: false // Don't typeset initially to avoid race conditions
        },
        svg: {
          fontCache: 'global'
        }
      }}>
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
          <h2 className="font-bold text-lg mb-4">Previous Questions</h2>
          {savedQuestions.length > 0 ? (
            <div className="space-y-2">
              {savedQuestions.map((question) => (
                <div 
                  key={question.id} 
                  className={`p-2 border border-gray-700 rounded hover:bg-gray-900 cursor-pointer ${
                    selectedQuestionId === question.id ? 'bg-gray-800 border-blue-500' : ''
                  }`}
                  onClick={() => {
                    setSelectedQuestionId(question.id);
                    setSolutionInput(question.question);
                    setSteps(question.solution);
                    setSelectedStep(null);
                    setSubsteps([]);
                    
                    // Create nodes for the saved solution
                    const newNodes = question.solution.map((step: {math: string, explanation: string}, idx: number) => ({
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
                    const newEdges: Edge[] = question.solution.slice(0, -1).map((_: {math: string, explanation: string}, idx: number): Edge => ({
                      id: `e-${idx}`,
                      source: `${idx}`,
                      target: `${idx + 1}`,
                      animated: true,
                      style: { stroke: '#888' },
                    }));
                    
                    setEdges(newEdges);
                  }}
                >
                  <div className="text-sm truncate">{question.question}</div>
                  <div className="text-xs text-gray-400">{new Date(question.timestamp).toLocaleString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No previous questions</p>
          )}
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
            {/* Graph Area - Showing integration of 1/x from 1 to 2 */}
            <div className="md:w-1/2 p-4 overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Integration: 1/x from 1 to 2</h2>
              <div className="step-card" style={{ height: "400px" }}>
                <Plot
                  data={[
                    // Original function 1/x
                    {
                      x: Array.from({ length: 100 }, (_, i) => 0.5 + (i * 2.5) / 99),
                      y: Array.from({ length: 100 }, (_, i) => 1 / (0.5 + (i * 2.5) / 99)),
                      type: 'scatter',
                      mode: 'lines',
                      name: 'f(x) = 1/x',
                      line: { color: '#3b82f6' }
                    },
                    // Fill representing the integral area
                    {
                      x: Array.from({ length: 100 }, (_, i) => 1 + (i * 1) / 99).concat([2, 1]),
                      y: Array.from({ length: 100 }, (_, i) => 1 / (1 + (i * 1) / 99)).concat([0, 0]),
                      fill: 'toself',
                      fillcolor: 'rgba(59, 130, 246, 0.2)',
                      type: 'scatter',
                      mode: 'none',
                      name: 'Area ∫(1/x) from 1 to 2',
                      hoverinfo: 'name',
                      showlegend: true
                    },
                    // Points highlighting the bounds
                    {
                      x: [1, 2],
                      y: [1, 0.5],
                      type: 'scatter',
                      mode: 'markers',
                      marker: { size: 8, color: '#ef4444' },
                      name: 'Integration bounds'
                    }
                  ]}
                  layout={{
                    title: { text: 'Integration of 1/x from 1 to 2 = ln(2) ≈ 0.693' },
                    plot_bgcolor: "#111",
                    paper_bgcolor: "#111",
                    font: { color: "#fff" },
                    xaxis: {
                      range: [0.5, 3],
                      title: { text: 'x' },
                      gridcolor: '#333',
                      zerolinecolor: '#666'
                    },
                    yaxis: {
                      range: [0, 2],
                      title: { text: 'y' },
                      gridcolor: '#333',
                      zerolinecolor: '#666'
                    },
                    annotations: [
                      {
                        x: 1.5,
                        y: 0.3,
                        text: 'Result = ln(2) ≈ 0.693',
                        showarrow: false,
                        font: { color: '#3b82f6', size: 14 }
                      }
                    ]
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-300">
                  The graph shows the function f(x) = 1/x with the area under the curve highlighted between x=1 and x=2.
                  The definite integral ∫(1/x)dx from x=1 to x=2 is equal to ln(2) ≈ 0.693.
                </p>
              </div>
            </div>
            
            {/* Vertical Steps View */}
            <div className="md:w-1/2 p-4 overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Solution Steps</h2>
              {steps.length === 0 ? (
                <p className="text-gray-400">Enter a solution and click &quot;Analyze Solution&quot; to see the steps.</p>
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
                        <div className="math-container">
                          <MathJax dynamic>{step.math}</MathJax>
                        </div>
                      </div>
                      {step.explanation && (
                        <div className="text-gray-300 text-sm mt-2">
                          <SafeMathJax>{step.explanation}</SafeMathJax>
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
                            <div className="math-container">
                            <SafeMathJax>{substep.math}</SafeMathJax>
                          </div>
                          </div>
                          {substep.explanation && (
                            <div className="text-gray-300 text-sm mt-2">
                              <SafeMathJax>{substep.explanation}</SafeMathJax>
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