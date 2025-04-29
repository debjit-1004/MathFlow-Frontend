declare module "react-mathjax2" {
    import { ReactNode } from "react";
  
    export interface MathComponentProps {
      tex?: string;
      children?: ReactNode;
    }
  
    export const MathComponent: React.FC<MathComponentProps>;
  
    export interface MathJaxContextProps {
      children: ReactNode;
    }
  
    export const MathJaxContext: React.FC<MathJaxContextProps>;
  }