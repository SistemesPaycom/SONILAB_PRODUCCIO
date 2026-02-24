import React, { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from "react";
import type { Point, Stroke, Layer, Tool, TextAnnotation, TextHighlightAnnotation, AnnotationLink } from "../../types/LectorDeGuions/annotation";
import { hitStrokeId } from "../../utils/LectorDeGuions/hitTest";

const PENCIL_CURSOR_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAbCAYAAAB836/YAAAB9klEQVR4AazVSchNYRzH8WsswwIJKTIUNiKKJGUoZUGKlSTJUsnCwsKWCAsrpUwrNqYVWVEyZFjIAkWhDMnCAsU7fH637q3z3ve9957zvrfft995znn+v55znuGOro3Mb5SYE7g/EoHJ2CRsG76nwSsrI1uh+hye4+BwA+cIOYvpuIGvwwlMyBkhy3AVd9BbNXCS4gNYj3dI8G9eqxI4XuEW7EIPjuAD+lA6cIyiVTiMebiMp/iHusqMMDO6RFXC8t0eur6En2iqTOBsVfuxDh9xDG9Rf1VeV7eBU/Xeie1IzRX+Ev9RUB4WbgzSmOBedsIenlHe49fxAy3qFJhJyMffqHI+XuMCslRYqzoFLlSyF4vwBOcRb86qdkHtAmfqmbW2jy/GY9xGYVa1CxoqcLJem7Eb05BZfcS/oa0GCxyrYjmytRbwz7iGjLBlVt0vaGBgFm++11G9VuIPMqs3+S901MDAWSoOYQPy7AXPbsgoXXZWihq9JrrYgSzgcfw9LuIZetGVGoFZb2tVZJ9O4TmKHvBb+Iuu1QicoeI45iJ78xU/hbZLxPMWJTCs8SQnCKvlbEv4G42Es+6VsLzuaiXxL/wk7iKHJyunBC5VklMkh2WOp3ip76a+qQRmN2SNnXY3I6scpr7+F/DJxVbkJKn0mmqb6gcAAP//z0/ZfAAAAAZJREFUAwC69VfBbjtNHgAAAABJRU5ErkJggg==";

const ERASER_CURSOR_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAACGklEQVR4AayTyUuVURTAX3OLhkXQoqKiopmotkWL1kU0UK0iImjRJmilK0WcUEEUBUVFXangwvEPcOVSXLhwxIUbRRDEefz9LrzvffqeEyjn985wzz3fufdcTyaO+e8oBU/w7VvQA09BH7VTDlvQvBds7Ya30AmvwTgqJWmB1FJknca6Cy1wH+zsOroVnsMZiOSggq7fIbsd1LPofzAJV6ENnsEpCOKGYGT4sRM78JiPWbfIe3QDvIMhuA1d8ArMT+xV0MWbJDWDg5hBf4VBWIVx+AITcAUaIQwqU0FjyQHcI3EKvsMArIGyzs8o+JER9DXogDduRkcSH8BDotPwEfpgA+KyieNHvqHn4AbUxwtqe/EOwM686H6ShiGTeC2XWMiGy7ACtRZBJ1xMDuAJAX35gF0CFyAurl0kUAyfYRnKoNyCLjqAJgJ2aAwziG/sF1YRnANzxWLV+D/BqyhEm7Pq5pc4Pg3vzGPiRuLm83i/oRQ8mu/Prj/hL0EuVIFdhmfju3pAwIGg0sSiZ4n+gTwogB/gUMrRFbAAQeywF8tnsIXeTzz+XxI8pvk52BYPnWEHsaBfrcNbhIPEbudJcgB2ZmHclFjQQlmEKsHRo/YU78yuwgDISjuVBYknvAOfgHeivTtR38frMaMBuHE3yYLG3eDxa3D8t5KxmO2UPaYfJJxZ4gXNMPk/xiPwGTl9tX4+sR0DwE+TbQAAAP//auz0PwAAAAZJREFUAwA30Gc4VKnbuAAAAABJRU5ErkJggg==";

const HIGHLIGHTER_CURSOR_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAWCAYAAAArdgcFAAACOElEQVR4AaSTOUhdQRSGn9lMAkmVpAqJgZBAinSBEKwCSYpAErJpYSPuhYKFoNhY2VkI2qmNiNopiGIhiqKtjQgqVqKVCgrivnzfkyv3ep++58L5PDNnzvzv3DMztxI3/7uHxHsYhln4BA8gcRPxLAQUeYfvgc/wBprgCWRfV9x9DxHIByt+i78Dt+EDtEGOSfiMzWoVeMSOGmiBpxDWcd2vqA8HyUlr5j8jqwNqwer9QYYRMy/Xf5HoJZO7rL2GLvgBHiQuZkdElqE4E3Eru0/yRxiAXLC/xhlGTOEVInkwlU7cdW/EH5I74RX4BbiYWfEm0Z8wCDtw4T1X+DEJDeC1sr/GmMZM4Q2iRWDFe/ikparc6p6z2gqVkIlwGXmeh8K2h2kiUnkWEfvp67K/f5lng3FczBSxFQWsKLyL9ytwpxau3BtgX/tZ8kZcJqyIwtXkjsI2xCwQt7qXrI6Az9fWMExpVrzFijeoG588PHzMwuK+tvNP+fwGK14lWApTsA/+GC5ugbgrJoXnxsIcMlkHD68Pb8X+GMPUFojZhhxSgjnDiCmyROQ/DIHCFsPwYgvEfCz/SPO24CKm8CKREpgEhXHpTXGfdzmpvkRcws/3vtpPr5fCv1gYB2O4zEzxr6TWgVdxHl8P3+ELFIPCC3iF07aCvDNTvJGZmybw36AZxsDb0IufgysLsyf5QmcYVEAheGj29ICxgmKbmF7dTgAAAP//y42ApwAAAAZJREFUAwAfFmlKhIWLBQAAAABJRU5ErkJggg=="

const LINK_CURSOR_BASE64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI4IiBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjEuNSI+PGxpbmUgeDE9IjEyIiB5MT0iNSIgeDI9IjEyIiB5Mj0iMTkiLz48bGluZSB4MT0iNSIgeTE9IjEyIiB4Mj0iMTkiIHkyPSIxMiIvPjwvc3ZnPg==";


type Props = {
  tool: Tool;
  tipexAction: 'add' | 'subtract';
  strokes: Stroke[];
  textAnnotations: TextAnnotation[];
  textHighlights: TextHighlightAnnotation[];
  annotationLinks: AnnotationLink[];
  drawingEnabled: boolean;
  activeLayerId: string;
  visibleLayerIds: string[];
  layers: Layer[];
  penColor: string;
  penWidth?: number;
  highlighterWidth?: number;
  eraserRadius?: number;
  zoom: number;
  showAnnotationIds: boolean;
  onAddStroke: (s: Stroke) => void;
  onEraseStroke: (id: string) => void;
  onDeleteTextAnnotation: (id: string) => void;
  onAddTextHighlight: (h: TextHighlightAnnotation) => void;
  onAddOrMergeTipexHighlight: (h: TextHighlightAnnotation) => void;
  onSubtractTipexHighlight: (rects: Array<{ x: number; y: number; width: number; height: number; }>) => void;
  onDeleteTextHighlight: (id: string) => void;
  onAddAnnotationLink: (l: AnnotationLink) => void;
  onDeleteAnnotationLink: (id: string) => void;
  editingText: TextAnnotation | null;
  onStartEditingText: (annotation: TextAnnotation) => void;
  onUpdateEditingText: (annotation: TextAnnotation) => void;
  onFinishEditingText: (e?: React.FocusEvent<HTMLDivElement>) => void;
  onCreateTextAnnotation: (point: Point) => void;
  editingTipex: TextHighlightAnnotation | null;
  onStartEditingTipex: (id: string) => void;
  onUpdateTipexAnnotation: (annotation: TextHighlightAnnotation) => void;
  onFinishTipex: () => void;
};

// ... helper functions ...
const getBoundingBox = (rects: Array<{ x: number; y: number; width: number; height: number }>) => {
    if (!rects || rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    const minX = Math.min(...rects.map(r => r.x));
    const minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.x + r.width));
    const maxY = Math.max(...rects.map(r => r.y + r.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

function dFrom(points: Point[]) {
  if (!points.length) return "";
  const [p0, ...rest] = points;
  return `M${p0.x},${p0.y} ` + rest.map((p) => `L${p.x},${p.y}`).join(" ");
}

const TipexEditor: React.FC<{
    annotation: TextHighlightAnnotation;
    boundingBox: { x: number; y: number; width: number; height: number };
    onUpdate: (annotation: TextHighlightAnnotation) => void;
    onFinish: () => void;
}> = ({ annotation, boundingBox, onUpdate, onFinish }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const measurementRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        if (!measurementRef.current) {
            measurementRef.current = document.createElement('div');
            measurementRef.current.style.position = 'absolute';
            measurementRef.current.style.visibility = 'hidden';
            measurementRef.current.style.height = 'auto';
            measurementRef.current.style.width = 'auto';
            measurementRef.current.style.whiteSpace = 'nowrap';
            measurementRef.current.style.fontFamily = "'Courier Prime', monospace";
            document.body.appendChild(measurementRef.current);
        }
        return () => {
            if (measurementRef.current) {
                document.body.removeChild(measurementRef.current);
                measurementRef.current = null;
            }
        };
    }, []);

    const calculateOptimalFontSize = useCallback((text: string) => {
        if (!text.trim()) return 14;
        if (!measurementRef.current) return 8;

        const PADDING = 4; // Internal padding of the editor
        const targetWidth = boundingBox.width - PADDING * 2;
        const targetHeight = boundingBox.height - PADDING * 2;
        if (targetWidth <= 0 || targetHeight <= 0) return 7;

        for (let size = 14; size >= 10; size--) {
            measurementRef.current.innerText = text;
            measurementRef.current.style.fontSize = `${size}px`;
            const textWidth = measurementRef.current.scrollWidth;
            const textHeight = measurementRef.current.scrollHeight;
            if (textWidth <= targetWidth && textHeight <= targetHeight) {
                return size;
            }
        }
        return 7; // Return a value below the minimum to signify overflow
    }, [boundingBox.width, boundingBox.height]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const newText = e.currentTarget.innerText;
        const newSize = calculateOptimalFontSize(newText);

        if (newSize < 8) {
            // Revert to the previous state if the new text overflows
            e.currentTarget.innerText = annotation.replacementText || '';
            
            const range = document.createRange();
            const sel = window.getSelection();
            if(sel){
                range.selectNodeContents(e.currentTarget);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        } else {
            onUpdate({
                ...annotation,
                replacementText: newText,
                replacementFontSize: newSize,
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onFinish();
        } else if (e.key === 'Escape') {
            onFinish();
        }
    };
    
    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.innerText = annotation.replacementText || '';
            editorRef.current.focus();
             const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(editorRef.current);
            range.collapse(false); // to end
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
    }, [annotation.id]);

    return (
        <div
            data-tipex-editor-id={annotation.id}
            style={{
                position: 'absolute',
                left: boundingBox.x,
                top: boundingBox.y,
                width: boundingBox.width,
                height: boundingBox.height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed #007aff',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                zIndex: 20,
                padding: '4px',
                boxSizing: 'border-box'
            }}
        >
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onBlur={onFinish}
                style={{
                    width: '100%',
                    height: '100%',
                    outline: 'none',
                    textAlign: 'center',
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: `${annotation.replacementFontSize || 14}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                }}
            />
        </div>
    );
};


export const AnnotationCanvas: React.FC<Props> = (props) => {
  const {
    tool,
    tipexAction,
    strokes,
    textAnnotations,
    textHighlights,
    annotationLinks,
    drawingEnabled,
    activeLayerId,
    visibleLayerIds,
    layers,
    penColor,
    penWidth = 3,
    highlighterWidth = 12,
    eraserRadius = 7,
    zoom,
    showAnnotationIds,
    onAddStroke,
    onEraseStroke,
    onDeleteTextAnnotation,
    onAddTextHighlight,
    onAddOrMergeTipexHighlight,
    onSubtractTipexHighlight,
    onDeleteTextHighlight,
    onAddAnnotationLink,
    onDeleteAnnotationLink,
    editingText,
    onStartEditingText,
    onUpdateEditingText,
    onFinishEditingText,
    onCreateTextAnnotation,
    editingTipex,
    onStartEditingTipex,
    onUpdateTipexAnnotation,
    onFinishTipex,
  } = props;

  const [live, setLive] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [liveLink, setLiveLink] = useState<{ start: Point; end: Point } | null>(null);
  const [linkStartInfo, setLinkStartInfo] = useState<{ id: string; layerId: string } | null>(null);

  const isDrawingRef = useRef(isDrawing);
  isDrawingRef.current = isDrawing;

  const editingTextRef = useRef<HTMLDivElement>(null);

  const erasedThisDrag = useRef<Set<string>>(new Set());
  const canvasRef = useRef<HTMLDivElement>(null);

  const [cursorPosition, setCursorPosition] = useState({ x: -100, y: -100 });
  const [isCursorHovering, setIsCursorHovering] = useState(false);
  const [isCursorFading, setIsCursorFading] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  const resetIdleTimer = () => {
    setIsCursorFading(false);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    if (tool !== 'none' && drawingEnabled) {
      idleTimerRef.current = window.setTimeout(() => {
        setIsCursorFading(true);
      }, 5000);
    }
  };

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, []);

  const getCoords = useCallback((e: MouseEvent | React.MouseEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0, t: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
      t: Date.now()
    };
  }, [zoom]);

  const getAnnotationAnchor = useCallback((id: string, side: 'top' | 'bottom' | 'left' | 'right' = 'bottom'): Point | null => {
    let annotation: TextAnnotation | TextHighlightAnnotation | undefined = textAnnotations.find(a => a.id === id);
    if (!annotation) {
      annotation = textHighlights.find(h => h.id === id);
    }
    if (!annotation) return null;

    let x, y, width, height;

    if ('rects' in annotation) { // It's a TextHighlightAnnotation
        const bbox = getBoundingBox(annotation.rects);
        x = bbox.x;
        y = bbox.y;
        width = bbox.width;
        height = bbox.height;
    } else { // It's a TextAnnotation
        const el = document.querySelector(`[data-annotation-id="${id}"]`);
        if (el) {
            const rect = el.getBoundingClientRect();
            const canvasRect = canvasRef.current!.getBoundingClientRect();
            x = (rect.left - canvasRect.left) / zoom;
            y = (rect.top - canvasRect.top) / zoom;
            width = rect.width / zoom;
            height = rect.height / zoom;
        } else {
            // Fallback for text annotations without a rendered element yet
            x = annotation.x;
            y = annotation.y;
            width = 100; // arbitrary
            height = annotation.fontSize;
        }
    }
    
    switch (side) {
        case 'top': return { x: x + width / 2, y: y, t: 0 };
        case 'bottom': return { x: x + width / 2, y: y + height, t: 0 };
        case 'left': return { x: x, y: y + height / 2, t: 0 };
        case 'right': return { x: x + width, y: y + height / 2, t: 0 };
    }
  }, [textAnnotations, textHighlights, zoom]);
  
  const eraseAtPoint = useCallback(({ point, clientX, clientY }: { point: Point; clientX: number; clientY: number; }) => {
    const element = document.elementFromPoint(clientX, clientY);
    if (!element) return;

    const highlightEl = element.closest('[data-highlight-id]');
    if (highlightEl) {
        const id = highlightEl.getAttribute('data-highlight-id');
        const layerId = highlightEl.getAttribute('data-layer-id');
        if (id && layerId === activeLayerId && !erasedThisDrag.current.has(id)) {
            erasedThisDrag.current.add(id);
            onDeleteTextHighlight(id);
            return;
        }
    }

    const targetEl = element.closest('.text-annotation-container');
    if (targetEl) {
        const id = targetEl.getAttribute('data-annotation-id');
        const layerId = targetEl.getAttribute('data-layer-id');
        
        if (id && layerId === activeLayerId && !erasedThisDrag.current.has(id)) {
            erasedThisDrag.current.add(id);
            onDeleteTextAnnotation(id);
            return;
        }
    }
    
    const visibleLinks = annotationLinks.filter(l => visibleLayerIds.includes(l.layerId));
    for (const link of visibleLinks) {
        if (link.layerId === activeLayerId && !erasedThisDrag.current.has(link.id)) {
            const start = getAnnotationAnchor(link.startId);
            const end = getAnnotationAnchor(link.endId);
            if (start && end) {
                const distSq = (p1: {x:number, y:number}, p2: {x:number, y:number}) => (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
                const distToSegmentSq = (p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) => {
                    const l2 = distSq(v, w);
                    if (l2 === 0) return distSq(p, v);
                    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
                    t = Math.max(0, Math.min(1, t));
                    return distSq(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
                };
                if (distToSegmentSq(point, start, end) < (eraserRadius / zoom) ** 2) {
                    erasedThisDrag.current.add(link.id);
                    onDeleteAnnotationLink(link.id);
                    return;
                }
            }
        }
    }

    const candidates = strokes.filter((s) => s.layerId === activeLayerId);
    const strokeId = hitStrokeId(point.x, point.y, candidates, eraserRadius, zoom);
    if (strokeId && !erasedThisDrag.current.has(strokeId)) {
      erasedThisDrag.current.add(strokeId);
      onEraseStroke(strokeId);
    }
  }, [strokes, activeLayerId, eraserRadius, onDeleteTextHighlight, onDeleteTextAnnotation, onEraseStroke, zoom, annotationLinks, visibleLayerIds, getAnnotationAnchor, onDeleteAnnotationLink]);
  
  const finalizeLiveStroke = useCallback(() => {
    setLive(livePoints => {
        if (livePoints.length > 1 && (tool === "pencil" || tool === 'freehand-highlighter')) {
            const isFreehandHighlight = tool === 'freehand-highlighter';
            onAddStroke({
              id: `stroke_${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              tool: "pencil", // The stroke data structure is the same
              width: isFreehandHighlight ? highlighterWidth : penWidth,
              opacity: isFreehandHighlight ? 0.4 : 1,
              points: livePoints,
              layerId: activeLayerId,
              color: penColor,
            });
        }
        return [];
    });
  }, [tool, onAddStroke, penWidth, highlighterWidth, activeLayerId, penColor]);
  
  // Focus and move cursor to end when editingText.id changes
  useEffect(() => {
    if (editingText && editingTextRef.current) {
      if (editingTextRef.current.innerText !== editingText.text) {
        editingTextRef.current.innerText = editingText.text;
      }

      editingTextRef.current.focus();

      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editingTextRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editingText?.id]);

  useEffect(() => {
    const handleMouseUpForHighlight = (e: MouseEvent) => {
      if (isDrawingRef.current || !drawingEnabled || !canvasRef.current) {
        return;
      }
      
      const isTextSelectorTool = tool === 'text-selector';
      const isTipexAdd = tool === 'tipex' && tipexAction === 'add';
      const isTipexSubtract = tool === 'tipex' && tipexAction === 'subtract';

      if (!isTextSelectorTool && !isTipexAdd && !isTipexSubtract) {
          return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
          return;
      }

      const range = selection.getRangeAt(0);
      const scriptContent = canvasRef.current.parentElement?.querySelector('.whitespace-pre-wrap');
      
      if (!scriptContent || !range.intersectsNode(scriptContent)) {
          selection.removeAllRanges();
          return;
      }

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const clientRects = range.getClientRects();
      const rects = Array.from(clientRects).map(rect => ({
          x: (rect.left - canvasRect.left) / zoom,
          y: (rect.top - canvasRect.top) / zoom,
          width: rect.width / zoom,
          height: rect.height / zoom,
      }));

      if (rects.length > 0) {
        if (isTipexAdd) {
            const newTipexHighlight: TextHighlightAnnotation = {
                id: `temp_highlight_${Date.now()}`,
                layerId: activeLayerId,
                rects,
                color: '#FFFFFF',
                text: selection.toString(),
                type: 'tipex',
            };
            onAddOrMergeTipexHighlight(newTipexHighlight);
        } else if (isTipexSubtract) {
            onSubtractTipexHighlight(rects);
        } else { // isTextSelectorTool
            const newHighlight: TextHighlightAnnotation = {
                id: `highlight_${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                layerId: activeLayerId,
                rects,
                color: penColor,
                text: selection.toString(),
                type: 'highlight',
            };
            onAddTextHighlight(newHighlight);
        }
    }

      selection.removeAllRanges();
    };
    
    document.addEventListener('mouseup', handleMouseUpForHighlight);
    return () => {
      document.removeEventListener('mouseup', handleMouseUpForHighlight);
    };
  }, [tool, tipexAction, drawingEnabled, zoom, activeLayerId, penColor, onAddTextHighlight, onAddOrMergeTipexHighlight, onSubtractTipexHighlight]);
  
  useEffect(() => {
    const handleWindowMouseUp = (e: MouseEvent) => {
        if (isDrawingRef.current) {
            if (tool === 'link-annotation' && linkStartInfo) {
                const endTargetEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-annotation-id], [data-highlight-id]');
                if (endTargetEl) {
                    const endId = endTargetEl.getAttribute('data-annotation-id') || endTargetEl.getAttribute('data-highlight-id');
                    const endLayerId = endTargetEl.getAttribute('data-layer-id');
                    if (endId && endId !== linkStartInfo.id && endLayerId === activeLayerId) {
                        const startIsText = !!textAnnotations.find(a => a.id === linkStartInfo.id);
                        const startIsTipex = !!textHighlights.find(h => h.id === linkStartInfo.id && h.type === 'tipex');
                        const endIsText = !!textAnnotations.find(a => a.id === endId);
                        const endIsTipex = !!textHighlights.find(h => h.id === endId && h.type === 'tipex');

                        if ((startIsText && endIsTipex) || (startIsTipex && endIsText)) {
                            const newLink: AnnotationLink = {
                                id: `link_${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                                type: 'link',
                                startId: linkStartInfo.id,
                                endId: endId,
                                layerId: activeLayerId,
                            };
                            onAddAnnotationLink(newLink);
                        }
                    }
                }
                setLinkStartInfo(null);
                setLiveLink(null);
            }

            finalizeLiveStroke();
            setIsDrawing(false);
            erasedThisDrag.current.clear();
        }
    };
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
        window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [finalizeLiveStroke, tool, linkStartInfo, activeLayerId, onAddAnnotationLink, textAnnotations, textHighlights]);

  const handleDragMouseDown = (e: React.MouseEvent) => {
      if (!editingText || e.button !== 0) return;
  
      e.preventDefault();
      e.stopPropagation();
  
      const startInfo = {
          startX: e.clientX,
          startY: e.clientY,
          initialAnnX: editingText.x,
          initialAnnY: editingText.y,
      };
  
      const handleMouseMove = (moveEvent: MouseEvent) => {
          const dx = moveEvent.clientX - startInfo.startX;
          const dy = moveEvent.clientY - startInfo.startY;
  
          onUpdateEditingText({
              ...editingText,
              x: startInfo.initialAnnX + dx / zoom,
              y: startInfo.initialAnnY + dy / zoom,
          });
      };
  
      const handleMouseUp = () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('.text-annotation-container, [data-tipex-editor-id]') && tool !== 'link-annotation') return;

    resetIdleTimer();
    if (!drawingEnabled) return;

    if (editingText) onFinishEditingText();
    if (editingTipex) onFinishTipex();

    e.preventDefault();
    const point = getCoords(e);

    if (tool === 'write-in-tipex') {
        const tipexTarget = targetEl.closest('[data-highlight-id][data-tipex="true"]');
        if (tipexTarget) {
            const id = tipexTarget.getAttribute('data-highlight-id');
            if (id) onStartEditingTipex(id);
        }
        return;
    }
    
    if (tool === 'link-annotation') {
        const annotationTarget = targetEl.closest('[data-annotation-id], [data-highlight-id]');
        if (annotationTarget) {
            const id = annotationTarget.getAttribute('data-annotation-id') || annotationTarget.getAttribute('data-highlight-id');
            const layerId = annotationTarget.getAttribute('data-layer-id');
            if (id && layerId && layerId === activeLayerId) {
                setIsDrawing(true);
                setLinkStartInfo({ id, layerId });
                const startPoint = getAnnotationAnchor(id);
                if (startPoint) {
                    setLiveLink({ start: startPoint, end: startPoint });
                }
            }
        }
        return;
    }

    if (tool === "pencil" || tool === 'freehand-highlighter') {
      setIsDrawing(true);
      setLive([point]);
    } else if (tool === "eraser") {
      setIsDrawing(true);
      erasedThisDrag.current.clear();
      eraseAtPoint({ point, clientX: e.clientX, clientY: e.clientY });
    } else if (tool === "text") {
      onCreateTextAnnotation(point);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    resetIdleTimer();
    const point = getCoords(e);
    setCursorPosition({ x: point.x, y: point.y });
  
    if (isDrawingRef.current) {
        if (tool === 'link-annotation' && linkStartInfo) {
            setLiveLink(prev => prev ? { ...prev, end: point } : null);
        } else if (tool === "pencil" || tool === 'freehand-highlighter') {
            setLive((p) => [...p, point]);
        } else if (tool === "eraser") {
            eraseAtPoint({ point, clientX: e.clientX, clientY: e.clientY });
        }
    }
  };
  
  const handleMouseEnter = (e: React.MouseEvent) => {
    setIsCursorHovering(true);
    resetIdleTimer();
    if (isDrawing && (tool === "pencil" || tool === 'freehand-highlighter')) {
        const point = getCoords(e);
        setLive([point]);
    }
  };

  const handleMouseLeave = () => {
    setIsCursorHovering(false);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if(isDrawing) {
        finalizeLiveStroke();
    }
  };
  
  const handleTextDoubleClick = (annotation: TextAnnotation) => {
      if (!drawingEnabled || tool === 'eraser' || layers.find(l => l.id === annotation.layerId)?.locked) return;
      if (editingText?.id !== annotation.id) {
          onFinishEditingText();
          onStartEditingText(annotation);
      }
  };
  
  const orderByLayer = useMemo(
    () => Object.fromEntries(layers.map((l) => [l.id, l.order])),
    [layers]
  );

  const renderedStrokes = useMemo(
    () =>
      strokes
        .filter((s) => visibleLayerIds.includes(s.layerId))
        .sort((a, b) => (orderByLayer[a.layerId] ?? 0) - (orderByLayer[b.layerId] ?? 0))
        .map((s) => (
          <path
            key={s.id}
            d={dFrom(s.points)}
            stroke={s.color || "black"}
            strokeWidth={s.width}
            strokeOpacity={s.opacity}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ mixBlendMode: s.opacity < 1 ? 'multiply' : 'normal' }}
          />
        )),
    [strokes, visibleLayerIds, orderByLayer]
  );

  const livePath = useMemo(() => dFrom(live), [live]);

  const renderCustomCursor = () => {
    if (!isCursorHovering || tool === 'none' || tool === 'text' || tool === 'tipex' || tool === 'text-selector' || tool === 'write-in-tipex' || !drawingEnabled) {
      return null;
    }

    let style: React.CSSProperties = {
      position: 'absolute',
      left: cursorPosition.x,
      top: cursorPosition.y,
      pointerEvents: 'none',
      opacity: isCursorFading ? 0 : 1,
      transition: 'opacity 1s ease-out',
      zIndex: 100,
    };
    
    let content: React.ReactNode = null;

    switch (tool) {
      case 'pencil':
        style.transform = 'translateY(-28px)';
        content = <img src={PENCIL_CURSOR_BASE64} alt="pencil cursor" />;
        break;
      case 'freehand-highlighter':
        style.transform = 'translate(-4px, -24px)';
        content = <img src={HIGHLIGHTER_CURSOR_BASE64} alt="highlighter cursor" />;
        break;
      case 'eraser':
        style.transform = 'translate(-50%, -50%)';
        content = <img src={ERASER_CURSOR_BASE64} alt="eraser cursor" />
        break;
      case 'link-annotation':
         style.transform = 'translate(-10px, -10px)';
         content = <img src={LINK_CURSOR_BASE64} alt="link cursor" />;
        break;
      default:
        return null;
    }
    
    return <div style={style}>{content}</div>;
  };

  const isLinkToolActive = tool === 'link-annotation';
  const isWriteInTipexToolActive = tool === 'write-in-tipex';

  return (
    <div
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full z-10"
      style={{
        touchAction: "none",
        pointerEvents: (tool === 'text-selector' || tool === 'tipex') ? 'none' : 'auto',
        cursor: (tool === 'text' && drawingEnabled) ? 'text' : 
                (isWriteInTipexToolActive && drawingEnabled) ? 'text' :
                (tool !== 'none' && drawingEnabled && isCursorHovering && !(tool === 'text-selector' || tool === 'tipex' || tool === 'write-in-tipex')) ? 'none' : 
                'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {renderCustomCursor()}

      {textHighlights.filter(h => visibleLayerIds.includes(h.layerId) && h.id !== editingTipex?.id).map(highlight => {
          const isTipexHighlight = highlight.type === 'tipex';
          const firstRect = highlight.rects[0];
          if (!firstRect) return null;

          const boundingBox = getBoundingBox(highlight.rects);

          return (
              <React.Fragment key={highlight.id}>
                  {highlight.rects.map((rect, i) => {
                      const style: React.CSSProperties = {
                          position: 'absolute',
                          left: rect.x,
                          top: rect.y,
                          width: rect.width,
                          height: rect.height,
                          backgroundColor: highlight.color,
                          opacity: isTipexHighlight ? 1 : 0.4,
                          mixBlendMode: isTipexHighlight ? 'normal' : 'multiply',
                          pointerEvents: (tool === 'eraser' || isLinkToolActive || isWriteInTipexToolActive) ? 'auto' : 'none',
                          cursor: isWriteInTipexToolActive && isTipexHighlight ? 'text' : isLinkToolActive ? 'pointer' : 'default',
                      };

                      if (isTipexHighlight) {
                          style.border = '1px dashed #cccccc';
                          style.boxSizing = 'border-box';
                      }

                      return (
                          <div
                              key={`${highlight.id}-${i}`}
                              data-highlight-id={highlight.id}
                              data-layer-id={highlight.layerId}
                              data-tipex={isTipexHighlight}
                              style={style}
                          />
                      );
                  })}

                  {isTipexHighlight && highlight.replacementText && (
                    <div style={{
                        position: 'absolute',
                        left: boundingBox.x,
                        top: boundingBox.y,
                        width: boundingBox.width,
                        height: boundingBox.height,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: `${highlight.replacementFontSize || 12}px`,
                        fontFamily: "'Courier Prime', monospace",
                        color: 'black',
                        textAlign: 'center',
                        padding: '2px',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                    }}>
                        <span style={{position: 'relative', top: '2px'}}>
                            {highlight.replacementText}
                        </span>
                    </div>
                  )}

                  {showAnnotationIds && (
                      <div
                          style={{
                              position: 'absolute',
                              left: firstRect.x + firstRect.width,
                              top: firstRect.y,
                              transform: 'translate(4px, -50%)',
                              backgroundColor: 'rgba(229, 231, 235, 0.75)',
                              color: '#6b7280',
                              fontSize: '0.65rem',
                              padding: '1px 3px',
                              borderRadius: '3px',
                              pointerEvents: 'none',
                              whiteSpace: 'nowrap',
                          }}
                      >
                          {highlight.id}
                      </div>
                  )}
              </React.Fragment>
          );
      })}

      {editingTipex && (() => {
          const originalBBox = getBoundingBox(editingTipex.rects);
          const PADDING = 8; // Add vertical padding for editor usability
          const paddedBBox = {
              ...originalBBox,
              y: originalBBox.y - PADDING,
              height: originalBBox.height + 2 * PADDING,
          };
          return (
              <TipexEditor
                  annotation={editingTipex}
                  boundingBox={paddedBBox}
                  onUpdate={onUpdateTipexAnnotation}
                  onFinish={onFinishTipex}
              />
          );
      })()}

      {textAnnotations.filter(a => visibleLayerIds.includes(a.layerId) && a.id !== editingText?.id).map(ann => {
           return (
                <div
                    key={ann.id}
                    data-annotation-id={ann.id}
                    data-layer-id={ann.layerId}
                    className="text-annotation-container absolute p-1 select-text"
                    style={{
                        left: ann.x,
                        top: ann.y,
                        width: 'auto',
                        color: ann.color,
                        fontSize: ann.fontSize,
                        fontWeight: ann.fontWeight,
                        fontStyle: ann.fontStyle,
                        textDecoration: ann.textDecoration,
                        textAlign: ann.textAlign,
                        lineHeight: 1.2,
                        pointerEvents: (drawingEnabled && (tool !== 'text-selector' && tool !=='tipex')) ? 'auto' : 'none',
                        display: 'inline-block',
                        whiteSpace: 'pre',
                        cursor: isLinkToolActive ? 'pointer' : 'default',
                    }}
                    onDoubleClick={() => handleTextDoubleClick(ann)}
                >
                    {ann.text}
                    {showAnnotationIds && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                transform: 'translate(100%, -50%)',
                                backgroundColor: 'rgba(229, 231, 235, 0.75)',
                                color: '#6b7280',
                                fontSize: '0.65rem',
                                padding: '1px 3px',
                                borderRadius: '3px',
                                pointerEvents: 'none',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {ann.id}
                        </div>
                    )}
                </div>
            )
        })}

      {editingText && (
          <div
              className="absolute z-20 text-annotation-container"
              style={{
                  left: editingText.x,
                  top: editingText.y,
                  width: 'auto',
                  cursor: 'move',
                  padding: '5px',
                  border: '1px dashed #007aff',
                  display: 'inline-block',
              }}
              onMouseDown={handleDragMouseDown}
          >
              {showAnnotationIds && (
                  <div
                      style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          transform: 'translate(100%, -50%)',
                          backgroundColor: 'rgba(229, 231, 235, 0.75)',
                          color: '#6b7280',
                          fontSize: '0.65rem',
                          padding: '1px 3px',
                          borderRadius: '3px',
                          pointerEvents: 'none',
                          whiteSpace: 'nowrap',
                          zIndex: 1,
                      }}
                  >
                      {editingText.id}
                  </div>
              )}
              <div
                  ref={editingTextRef}
                  key={editingText.id}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="whitespace-pre p-1 select-text"
                  style={{
                      color: editingText.color,
                      fontSize: editingText.fontSize,
                      fontWeight: editingText.fontWeight,
                      fontStyle: editingText.fontStyle,
                      textDecoration: editingText.textDecoration,
                      textAlign: editingText.textAlign,
                      lineHeight: 1.2,
                      minWidth: 50,
                      outline: 'none',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      cursor: 'text',
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onBlur={onFinishEditingText}
                  onInput={(e) => {
                      onUpdateEditingText({ ...editingText, text: e.currentTarget.innerText });
                  }}
                  onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          (e.target as HTMLElement).blur();
                      } else if (e.key === 'Escape') {
                           (e.target as HTMLElement).blur();
                      }
                  }}
              />
          </div>
      )}

      <svg className="absolute top-0 left-0 w-full h-full" pointerEvents="none">
        {renderedStrokes}

        {annotationLinks.filter(l => visibleLayerIds.includes(l.layerId)).map(link => {
            const startIsText = !!textAnnotations.find(a => a.id === link.startId);
            const startIsTipex = !!textHighlights.find(h => h.id === link.startId && h.type === 'tipex');

            const startSide = startIsTipex ? 'top' : 'bottom';
            const endSide = startIsText ? 'top' : 'bottom';

            const startCenter = getAnnotationAnchor(link.startId, startSide);
            const endCenter = getAnnotationAnchor(link.endId, endSide);
            if (!startCenter || !endCenter) return null;
            return (
                <line
                    key={link.id}
                    data-link-id={link.id}
                    data-layer-id={link.layerId}
                    x1={startCenter.x}
                    y1={startCenter.y}
                    x2={endCenter.x}
                    y2={endCenter.y}
                    stroke="rgba(107, 114, 128, 0.8)"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                />
            )
        })}

        {liveLink && (
            <line
                x1={liveLink.start.x}
                y1={liveLink.start.y}
                x2={liveLink.end.x}
                y2={liveLink.end.y}
                stroke="#007aff"
                strokeWidth="2"
                strokeDasharray="5 3"
            />
        )}

        {live.length > 0 && (tool === 'pencil' || tool === 'freehand-highlighter') && (
            (() => {
                const isLiveHighlighter = tool === 'freehand-highlighter';
                return (
                    <path
                        d={livePath}
                        stroke={penColor}
                        strokeWidth={isLiveHighlighter ? highlighterWidth : penWidth}
                        strokeOpacity={isLiveHighlighter ? 0.4 : 1}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ mixBlendMode: isLiveHighlighter ? 'multiply' : 'normal' }}
                    />
                );
            })()
        )}
      </svg>
    </div>
  );
};