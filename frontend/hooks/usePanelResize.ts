import { useRef, useState, useCallback } from 'react';

/**
 * Hook per gestionar el redimensionament vertical d'un panell.
 * Extret del patró duplicat a VideoSubtitlesEditorView i VideoEditorView.
 */
export function useVerticalPanelResize(initial: number, min = 100) {
  const [height, setHeight] = useState(initial);
  const isResizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    setHeight(Math.max(min, startHeightRef.current + (e.clientY - startYRef.current)));
  }, [min]);

  const handleMouseUp = useCallback(() => {
    isResizingRef.current = false;
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    document.body.style.cursor = 'row-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [height, handleMouseMove, handleMouseUp]);

  return { height, setHeight, handleMouseDown };
}

/**
 * Hook per gestionar el redimensionament horitzontal d'un panell (en %).
 * El containerRef ha d'apuntar al contenidor pare dels dos panells.
 */
export function useHorizontalPanelResize(
  containerRef: React.RefObject<HTMLElement>,
  initial = 50,
  min = 20,
  max = 80,
) {
  const [widthPercent, setWidthPercent] = useState(initial);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !containerRef.current) return;
    const delta = e.clientX - startXRef.current;
    const containerWidth = containerRef.current.offsetWidth;
    const newPercent = ((startWidthRef.current + delta) / containerWidth) * 100;
    setWidthPercent(Math.max(min, Math.min(max, newPercent)));
  }, [containerRef, min, max]);

  const handleMouseUp = useCallback(() => {
    isResizingRef.current = false;
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = (containerRef.current.children[0] as HTMLElement).clientWidth;
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [containerRef, handleMouseMove, handleMouseUp]);

  return { widthPercent, setWidthPercent, handleMouseDown };
}
