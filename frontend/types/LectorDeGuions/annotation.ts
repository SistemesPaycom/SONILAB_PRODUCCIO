// types/LectorDeGuions/annotation.ts

export type Point = {
  x: number;
  y: number;
  t: number;
};

export type Stroke = {
  id: string;
  tool: 'pencil';
  width: number;
  opacity: number;
  points: Point[];
  layerId: string;
  color: string;
};

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
  // FIX: Add optional password property to the Layer type.
  password?: string;
};

export type Tool = 
  | 'none' 
  | 'pencil' 
  | 'freehand-highlighter' 
  | 'eraser' 
  | 'text' 
  | 'text-selector' 
  | 'tipex' 
  | 'write-in-tipex' 
  | 'link-annotation';

export interface TextAnnotation {
  id: string;
  type: 'text';
  layerId: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: 'left' | 'center' | 'right';
}

export interface TextHighlightAnnotation {
  id: string;
  layerId: string;
  rects: Array<{ x: number; y: number; width: number; height: number; }>;
  color: string;
  text: string;
  type: 'highlight' | 'tipex';
  replacementText?: string;
  replacementFontSize?: number;
}

export interface AnnotationLink {
  id: string;
  type: 'link';
  startId: string;
  endId: string;
  layerId: string;
}