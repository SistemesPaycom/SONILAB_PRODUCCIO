// components/LectorDeGuions/LectorView.tsx
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLibrary } from '../../context/Library/LibraryContext';
import * as Icons from '../icons';
import { LayerPanel } from './LayerPanel';
import { AnnotationCanvas } from './AnnotationCanvas';
import { TakesByCharacterPanel } from './TakesByCharacterPanel';
import { DirectorAnnotationsPanel } from './DirectorAnnotationsPanel';
import { findMatches, Match } from '../../utils/LectorDeGuions/search';
import type { Layer, Stroke, Tool, TextAnnotation, TextHighlightAnnotation, Point, AnnotationLink } from '../../types/LectorDeGuions/annotation';
import type { TakeStatus, CharacterNote, EditorStyles } from '../../types';
import { ColumnView } from '../EditorDeGuions/ColumnView';
import { A4_WIDTH_PX } from '../../constants';
import { parseScript } from '../../utils/EditorDeGuions/scriptParser';


interface LectorViewProps {
    documentId: string | null;
    onClose: () => void;
    onNavigateDocument: (documentId: string) => void;
    editorStyles: EditorStyles;
    col1Width: number;
}

const MAX_LAYERS = 99;

const ANNOTATION_TOOLS: { id: Tool; icon: React.FC<any> }[] = [
    { id: 'pencil', icon: Icons.Pencil },
    { id: 'freehand-highlighter', icon: Icons.Highlighter },
    { id: 'text-selector', icon: Icons.TextHighlighter },
    { id: 'tipex', icon: Icons.TipexIcon },
    { id: 'write-in-tipex', icon: Icons.WriteInTipexIcon },
    { id: 'link-annotation', icon: Icons.ArrowLeft },
    { id: 'text', icon: Icons.Type },
    { id: 'eraser', icon: Icons.Eraser },
];

const toolTitles: Record<Tool, string> = {
    'pencil': 'Llapis',
    'freehand-highlighter': 'Subratllador a mà alçada',
    'text-selector': 'Subratllador de text',
    'tipex': 'Tipex',
    'write-in-tipex': 'Escriure dins del Tipex',
    'link-annotation': 'Enllaçar Anotació',
    'text': 'Eina de text',
    'eraser': 'Goma d\'esborrar',
    'none': 'Cap'
};

const COLOR_PALETTE = [
  { name: 'Negre', hex: '#000000' },
  { name: 'Blau', hex: '#1F5AA7' },
  { name: 'Vermell', hex: '#D12C2C' },
  { name: 'Verd', hex: '#228B22' },
  { name: 'Porpra', hex: '#6A1B9A' },
  { name: 'Taronja', hex: '#E67E22' },
  { name: 'Rosa/Magenta', hex: '#D81B60' },
  { name: 'Turquesa/Cian', hex: '#0AA7B4' },
];

const BASE_ZOOM_LEVEL = 1.0; // Adjusted for ColumnView

const HIGHLIGHTERTEXT_CURSOR_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAcCAYAAAB2+A+pAAAErElEQVR4AbSWCyxkVxjHz5hqx6PbDRWJiUfQaNEKYr1CVe2oR1KP2KxHKgzBiMGKeESCxJJuQopdoXai1JBFBakoQhClsoloFVmJpJ71Dtaj9djp/0xyJzOWqefN+d9z7z3nO7/7nfud71wVcnvHO6WlpZ6dnZ2/iUSikqCgoA/kUbcCdnR01KqrqxN6eXmJeDzevZCQEEFkZGQ+4DoM/MbBAQEBhk9weHp6PjYxMeECxOJwOGxXV9fImJiYND8/v7t4Rm4UHB4ebpKcnCyCx5FaWlocCmCkrq7Osba2FgQHB/NtbW1VbwTs5ubGKS4u/io2NrbZ2dn5SzabzWKA8jVeRg3tmVFRUQ+uDQb0LrwU+Pr6/uDg4PAZi3UmU8bncrla+vr68dcCI3juJCYmZru7u+cYGxvrykZXcjE3N7c1MTHx5KpgVl5eHtfb27vaxcVFqKmp+b4SlrRJIpGQ5eXl9b6+vtSOjo6frwJWrays/ILH4zUZGRl9nZaWpjI/Py8dXNlpdXV1q7+/P7e8vFwM+PGlwFiHbARREKDPbGxs7tnb27MQrQTek4ODg3O5i4uLr1tbW5NgKxoeHpZ2vBQYUZkYGhr6vYGBwceIXBUdHR2SkZFBZmZmiEAgIHQ6T9OXlpZ2GxoaYrGGqxko7XMRMKuoqIjb2Nj4tLCwsEBbW1uDGlLt7OyQ2tpasrGxQaampkhKSor0mrZRYXpXh4aG0rq7u3+i9/L6X3B+fv5HTk5OhT4+PhEaGhrvMsYUWlBQQFpaWkhmZqb0BVZWVkhJSQnZ3t4mgB7gm+YgHqoRTP8ydkytFKynp6fv4eFRje8ZoKamps4YUQ/j4+NJc3Mzyc7OJkiDxNTUlOTm5hJzc3OC6X2N2fkmJydH1NXVtcfYyddngmlKS01N/Rw7y0s7OzsHVRyM0cLCgnRKx8bGpF4i0AjTjNwsQUJZgV080nXT5OTkIWN3un4LnJCQ8J5QKAyIi4t7bmlpqStvsL+/T+AFWVtbIzU1NQQvJd9M1+lCb29vFoKpSaHhjJvTYLaZmdkD7CzfGhoampzuz2KxCDYAAm+IlZWVQjMy0kZ9fX0q9mCxfPQqdJK7UQDje5qHhYU919XVNVRRUXkr6eI7Ez6fTywsLAjaZcMAuo7l5I+ofnERKDVUAMNoraqqiq0sGVAjRicnJ5LZ2dlXiOyo9vb2X5nnF6kVwHt7e8dYPgR/D+Tw8Ny4kI2LxPEKa/RRRUVFBx6+gS5cFMCw+hCBw05PTycDAwO4PbdIRkZG/gLwYXR0dKey6D1vBHkwG534EFlfXyf+/v5kenqanE6DmN7jlzgQ1feR0X5H/xPo0oUB0/o+rKMhadnd3ZVGMJaHDA7oyejo6C89PT2xZWVlM9KOVzxRII1eR9g/hu5AsrK5uUnwd0EGBwfJ0dHRG+wwdW1tbUnYGMbQSQJduVAwTRJPMYINRF8CFZnF6RFkNT4+/mlWVlM9IgIYWBgIB9bIPX0WlCMK/3LDMXFJxAtWzgVQ3QGvkP9B/QnAu2FWCx+husj6EYK9dgDI9G104Y6CUqH/oau7RXGOLdQsBitRRANrB9R/wPdevkPAAD///yfoRYAAAAGSURBVAMA8bHVPJ8Ew1YAAAAASUVORK5CYII=";


const getBoundingBox = (rects: Array<{ x: number; y: number; width: number; height: number }>) => {
    if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    const minX = Math.min(...rects.map(r => r.x));
    const minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.x + r.width));
    const maxY = Math.max(...rects.map(r => r.y + r.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const mergeRects = (rects: Array<{ x: number; y: number; width: number; height: number }>) => {
    if (rects.length < 2) return rects;
    
    const lines = new Map<number, typeof rects>();
    rects.forEach(rect => {
        const lineY = Math.round(rect.y / 10) * 10;
        if (!lines.has(lineY)) lines.set(lineY, []);
        lines.get(lineY)!.push(rect);
    });

    const finalRects: typeof rects = [];
    
    Array.from(lines.values()).forEach(lineRects => {
        if (lineRects.length === 0) return;
        lineRects.sort((a, b) => a.x - b.x);
        
        let currentMerged = { ...lineRects[0] };
        
        for (let i = 1; i < lineRects.length; i++) {
            const nextRect = lineRects[i];
            const MERGE_GAP = 8;

            if (nextRect.x <= currentMerged.x + currentMerged.width + MERGE_GAP) {
                const newEndX = Math.max(currentMerged.x + currentMerged.width, nextRect.x + nextRect.width);
                currentMerged.width = newEndX - currentMerged.x;
                currentMerged.height = Math.max(currentMerged.height, nextRect.height);
                currentMerged.y = Math.min(currentMerged.y, nextRect.y);
            } else {
                finalRects.push(currentMerged);
                currentMerged = { ...nextRect };
            }
        }
        finalRects.push(currentMerged);
    });
    
    return finalRects.sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y);
};

const subtractRect = (minuend: { x: number, y: number, width: number, height: number }, subtrahend: { x: number, y: number, width: number, height: number }) => {
    const m = minuend;
    const s = subtrahend;
    const result: typeof m[] = [];

    const m_right = m.x + m.width;
    const m_bottom = m.y + m.height;
    const s_right = s.x + s.width;
    const s_bottom = s.y + s.height;

    // No overlap
    if (m_right <= s.x || m.x >= s_right || m_bottom <= s.y || m.y >= s_bottom) {
        return [m];
    }

    const ix1 = Math.max(m.x, s.x);
    const iy1 = Math.max(m.y, s.y);
    const ix2 = Math.min(m_right, s_right);
    const iy2 = Math.min(m_bottom, s_bottom);

    // Top rectangle
    if (iy1 > m.y) {
        result.push({ x: m.x, y: m.y, width: m.width, height: iy1 - m.y });
    }
    
    // Bottom rectangle
    if (iy2 < m_bottom) {
        result.push({ x: m.x, y: iy2, width: m.width, height: m_bottom - iy2 });
    }

    // Left rectangle
    if (ix1 > m.x) {
        result.push({ x: m.x, y: iy1, width: ix1 - m.x, height: iy2 - iy1 });
    }

    // Right rectangle
    if (ix2 < m_right) {
        result.push({ x: ix2, y: iy1, width: m_right - ix2, height: iy2 - iy1 });
    }

    return result.filter(r => r.width > 0.1 && r.height > 0.1);
};


// Groups rectangles into disjoint sets based on proximity.
const groupRects = (rects: Array<{ x: number; y: number; width: number; height: number }>): Array<typeof rects> => {
    if (rects.length === 0) return [];

    const sortedRects = [...rects].sort((a, b) => a.y - b.y || a.x - a.x);
    const groups: Array<typeof rects> = [];
    const visited = new Set<number>();
    const MERGE_GAP = 10; 

    const areRectsConnected = (r1: typeof rects[0], r2: typeof rects[0]) => {
        const horizontalProximity = r1.x < r2.x + r2.width + MERGE_GAP && r1.x + r1.width + MERGE_GAP > r2.x;
        const verticalProximity = r1.y < r2.y + r2.height + MERGE_GAP && r1.y + r1.height + MERGE_GAP > r2.y;
        return horizontalProximity && verticalProximity;
    };

    for (let i = 0; i < sortedRects.length; i++) {
        if (visited.has(i)) continue;

        const currentGroup: typeof rects = [];
        const queue = [i];
        visited.add(i);

        while (queue.length > 0) {
            const currentIndex = queue.shift()!;
            const currentRect = sortedRects[currentIndex];
            currentGroup.push(currentRect);

            for (let j = 0; j < sortedRects.length; j++) {
                if (visited.has(j)) continue;
                const otherRect = sortedRects[j];
                if (areRectsConnected(currentRect, otherRect)) {
                    visited.add(j);
                    queue.push(j);
                }
            }
        }
        groups.push(currentGroup);
    }
    return groups;
};

// Recalculates the text for a set of rectangles based on the original highlight, assuming a monospace font.
const recalculateTextForRects = (
    newRects: Array<{ x: number; y: number; width: number; height: number }>,
    originalHighlight: TextHighlightAnnotation
): string => {
    if (!originalHighlight?.text || newRects.length === 0) {
        return '';
    }

    const originalRects = [...originalHighlight.rects].sort((a, b) => a.y - b.y || a.x - b.x);
    
    // Create a virtual "unwrapped" coordinate space for the original text to calculate average character width.
    let totalWidth = 0;
    const rectStartOffsets = new Map<typeof originalRects[0], number>();
    originalRects.forEach(r => {
        rectStartOffsets.set(r, totalWidth);
        totalWidth += r.width;
    });

    if (totalWidth === 0 || !originalHighlight.text) return '';
    const avgCharWidth = totalWidth / originalHighlight.text.length;
    if (avgCharWidth === 0) return '';

    const sortedNewRects = [...newRects].sort((a, b) => a.y - b.y || a.x - b.x);

    let resultText = '';
    let lastRectY = -Infinity;

    sortedNewRects.forEach(newRect => {
        const originalParent = originalRects.find(orig => 
            newRect.x < orig.x + orig.width &&
            newRect.x + newRect.width > orig.x &&
            newRect.y < orig.y + orig.height &&
            newRect.y + newRect.height > orig.y
        );

        if (originalParent) {
            // Heuristic to add a space for what is likely a line break.
            if (newRect.y > lastRectY + originalParent.height * 0.8 && resultText.length > 0) {
                 resultText += ' ';
            }

            const parentStartOffset = rectStartOffsets.get(originalParent) || 0;
            // The new rect's position relative to the start of its original parent rect.
            const newRectRelativeOffset = Math.max(0, newRect.x - originalParent.x);
            const totalOffset = parentStartOffset + newRectRelativeOffset;

            const startCharIndex = Math.round(totalOffset / avgCharWidth);
            const numChars = Math.round(newRect.width / avgCharWidth);
            
            resultText += originalHighlight.text.substring(startCharIndex, startCharIndex + numChars);
            lastRectY = newRect.y;
        }
    });

    return resultText;
};

export const LectorView: React.FC<LectorViewProps> = ({ documentId, onClose, onNavigateDocument, editorStyles, col1Width }) => {
    const { state, dispatch } = useLibrary();
    const activeDocument = useMemo(() => state.documents.find(d => d.id === documentId), [state.documents, documentId]);

    // Annotation state
    const [tool, setTool] = useState<Tool>('none');
    const [tipexAction, setTipexAction] = useState<'add' | 'subtract'>('add');
    const [layers, setLayers] = useState<Layer[]>(activeDocument?.layers || []);
    const [strokes, setStrokes] = useState<Stroke[]>(activeDocument?.strokes || []);
    const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>(activeDocument?.textAnnotations || []);
    const [textHighlights, setTextHighlights] = useState<TextHighlightAnnotation[]>(activeDocument?.textHighlights || []);
    const [annotationLinks, setAnnotationLinks] = useState<AnnotationLink[]>(activeDocument?.annotationLinks || []);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(activeDocument?.layers?.[0]?.id || null);
    const [penColor, setPenColor] = useState<string>('#D12C2C');
    
    // Text annotation editing state
    const [editingText, setEditingText] = useState<TextAnnotation | null>(null);
    const [editingTipex, setEditingTipex] = useState<TextHighlightAnnotation | null>(null);
    const [defaultTextFormat, setDefaultTextFormat] = useState<Omit<TextAnnotation, 'id' | 'type' | 'layerId' | 'x' | 'y' | 'text'>>({
        color: '#000000',
        fontSize: 4,
        textAlign: 'left',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: 'none',
    });


    // Search state
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchMatches, setSearchMatches] = useState<Match[]>([]);
    const [activeMatch, setActiveMatch] = useState(-1);
    
    // Actor, Character and Take state
    const [selectedActor, setSelectedActor] = useState<string | null>(null);
    const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
    const [charMatches, setCharMatches] = useState<Match[]>([]);
    const [jumpMode, setJumpMode] = useState(true);
    const takeSelectRef = useRef<HTMLSelectElement>(null);
    const [takeStatuses, setTakeStatuses] = useState<Record<string, Record<string, TakeStatus>>>(activeDocument?.takeStatuses || {});
    const [takeNotes, setTakeNotes] = useState<Record<string, string>>(activeDocument?.takeNotes || {});
    const [characterNotes, setCharacterNotes] = useState<CharacterNote[]>(activeDocument?.characterNotes || []);

    // Panel Visibility State
    const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(true);
    const [activeLeftPanelTab, setActiveLeftPanelTab] = useState<'layers' | 'director_notes'>('layers');
    const [isTakesPanelOpen, setIsTakesPanelOpen] = useState(true);
    const [isPanning, setIsPanning] = useState(false);
    const [isAbsoluteViewerOn, setIsAbsoluteViewerOn] = useState(true);
    const [showAnnotationIds, setShowAnnotationIds] = useState(false);

    // Zoom state
    const [zoom, setZoom] = useState(1);
    
    // Custom cursor state for text selector
    const [textCursorPosition, setTextCursorPosition] = useState({ x: -100, y: -100 });
    const [isTextCursorVisible, setIsTextCursorVisible] = useState(false);
    const [isTextCursorFading, setIsTextCursorFading] = useState(false);
    const idleTimerRef = useRef<number | null>(null);

    
    // FIX: Retrieve the script content from the multilingual content object.
    const SCRIPT_TEXT = useMemo(() => {
        if (!activeDocument) return "Document text not available.";
        const langToUse = activeDocument.sourceLang || Object.keys(activeDocument.contentByLang)[0];
        if (!langToUse) {
            return "Document text not available.";
        }
        const content = activeDocument.contentByLang[langToUse];
        return content !== undefined ? content : "Document text not available.";
    }, [activeDocument]);
    // ── Derive takes & unique characters from script text using parseScript ──
    // Same extraction logic the Editor de Guions DADES mode uses.
    const parsedScript = useMemo(() => {
        if (!SCRIPT_TEXT || SCRIPT_TEXT === 'Document text not available.') return { preamble: '', takes: [] };
        return parseScript(SCRIPT_TEXT);
    }, [SCRIPT_TEXT]);

    // Extract unique character names using the same *NAME* splitting as csvConverter's splitSpeakers
    const parsedCharacters = useMemo(() => {
        const speakerRegex = /\*([^*]+)\*/g;
        const nameSet = new Set<string>();
        for (const take of parsedScript.takes) {
            for (const line of take.lines) {
                if (!line.speaker) continue;
                let m: RegExpExecArray | null;
                speakerRegex.lastIndex = 0;
                while ((m = speakerRegex.exec(line.speaker)) !== null) {
                    nameSet.add(m[1].trim());
                }
            }
        }
        return Array.from(nameSet).sort();
    }, [parsedScript]);

    // Build take list for selector — uses parsed takes or falls back to document takes.
    // IMPORTANT: `num` must match the real TAKE number from the label (e.g. "TAKE #5" → 5),
    // because ColumnView populates takeYRef using that same regex-extracted number.
    const parsedTakes = useMemo(() => {
        if (parsedScript.takes.length > 0) {
            return parsedScript.takes.map(t => {
                const m = t.takeLabel.match(/TAKE\s*#?\s*(\d+)/i);
                const realNum = m ? parseInt(m[1], 10) : t.id;
                return { num: realNum, label: t.takeLabel };
            });
        }
        // Fallback to existing document takes if parseScript found nothing
        return (activeDocument?.takes || []).map((t: any) => ({ num: t.num, label: `TAKE #${t.num}` }));
    }, [parsedScript, activeDocument]);

    // Keep backward compatibility — components that read activeDocument.characters
    const characters = parsedCharacters.length > 0
        ? parsedCharacters.map(name => ({ name }))
        : (activeDocument?.characters || []);
    
    // Refs for scrolling
    const scrollRef = useRef<HTMLDivElement>(null);
    const matchYRef = useRef<Map<number, number>>(new Map());
    const takeYRef = useRef<Map<number, number>>(new Map());
    const inputRef = useRef<HTMLInputElement>(null);
    const panStartRef = useRef<{ startY: number; scrollTop: number } | null>(null);
    const formatBarRef = useRef<HTMLDivElement>(null);

    // Navigation Logic
    const siblingDocuments = useMemo(() => {
        if (!activeDocument) return [];
        return state.documents
            .filter(d => d.parentId === activeDocument.parentId && !d.isDeleted)
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    }, [activeDocument, state.documents]);

    const currentIndex = useMemo(() => {
        if (!activeDocument) return -1;
        return siblingDocuments.findIndex(d => d.id === activeDocument.id);
    }, [activeDocument, siblingDocuments]);

    const prevDocument = currentIndex > 0 ? siblingDocuments[currentIndex - 1] : null;
    const nextDocument = currentIndex > -1 && currentIndex < siblingDocuments.length - 1 ? siblingDocuments[currentIndex + 1] : null;

    const absoluteViewerMatches = useMemo(() => {
        if (!isAbsoluteViewerOn || !activeDocument || !activeDocument.takes?.length) return [];
    
        const matches: Match[] = [];
        const charNameRegex = /\*([^\*\n]+?)\*/g;
        
        const charMentions: { name: string, index: number }[] = [];
        let match;
        while((match = charNameRegex.exec(SCRIPT_TEXT)) !== null) {
            charMentions.push({
                name: match[1].trim().toUpperCase(),
                index: match.index,
            });
        }
    
        if (charMentions.length === 0) return [];
        
        const takeRanges = activeDocument.takes;
    
        for (let i = 0; i < charMentions.length; i++) {
            const currentMention = charMentions[i];
            
            const take = takeRanges.find(t => currentMention.index >= t.start && currentMention.index < t.end);
            
            if (take) {
                const takeNum = String(take.num);
                const isDone = takeStatuses[takeNum] && takeStatuses[takeNum][currentMention.name] === 'done';
                
                if (isDone) {
                    const nextMentionIndexInTake = charMentions.slice(i + 1).find(m => m.index < take.end)?.index;
                    const endOfIntervention = nextMentionIndexInTake !== undefined ? nextMentionIndexInTake : take.end;
                    
                    matches.push({ start: currentMention.index, end: endOfIntervention });
                }
            }
        }
    
        return matches;
    
    }, [isAbsoluteViewerOn, activeDocument, takeStatuses, SCRIPT_TEXT]);

    // Auto-focus search input when it opens
    useEffect(() => {
        if (searchOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [searchOpen]);

    // Update context when layers, strokes, or text annotations change locally
    useEffect(() => {
        const handler = setTimeout(() => {
            if (!documentId) return;
            const doc = state.documents.find(d => d.id === documentId);
            if (!doc) return;

            const hasChanges = JSON.stringify(layers) !== JSON.stringify(doc.layers || []) ||
                               JSON.stringify(strokes) !== JSON.stringify(doc.strokes || []) ||
                               JSON.stringify(textAnnotations) !== JSON.stringify(doc.textAnnotations || []) ||
                               JSON.stringify(textHighlights) !== JSON.stringify(doc.textHighlights || []) ||
                               JSON.stringify(annotationLinks) !== JSON.stringify(doc.annotationLinks || []) ||
                               JSON.stringify(takeStatuses) !== JSON.stringify(doc.takeStatuses || {}) ||
                               JSON.stringify(takeNotes) !== JSON.stringify(doc.takeNotes || {}) ||
                               JSON.stringify(characterNotes) !== JSON.stringify(doc.characterNotes || []);

            if (hasChanges) {
                dispatch({ type: 'UPDATE_DOCUMENT_DATA', payload: { documentId, data: { layers, strokes, textAnnotations, textHighlights, annotationLinks, takeStatuses, takeNotes, characterNotes } } });
            }
        }, 500); // 500ms debounce
        return () => clearTimeout(handler);
    }, [layers, strokes, textAnnotations, textHighlights, annotationLinks, takeStatuses, takeNotes, characterNotes, documentId, state.documents, dispatch]);

    // When a tool is selected, deselect any text.
    useEffect(() => {
        if (tool !== 'text-selector' && tool !== 'tipex' && window.getSelection) {
            window.getSelection()?.removeAllRanges();
        }
        if (tool !== 'text') {
            setEditingText(null);
        }
        if (tool !== 'write-in-tipex') {
            setEditingTipex(null);
        }
    }, [tool]);
    
    // Reset jump mode when character changes
    useEffect(() => {
        if (selectedCharacter) {
            setJumpMode(true);
        }
    }, [selectedCharacter]);

    // Effect for handling the custom text-selector cursor
    useEffect(() => {
        const scriptContainer = scrollRef.current;
        if (!scriptContainer || (tool !== 'text-selector' && tool !== 'tipex')) {
            setIsTextCursorVisible(false);
            return;
        }
    
        const resetIdleTimer = () => {
            setIsTextCursorFading(false);
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
            }
            idleTimerRef.current = window.setTimeout(() => {
                setIsTextCursorFading(true);
            }, 5000);
        };
    
        const handleMouseMove = (e: MouseEvent) => {
            const rect = scriptContainer.getBoundingClientRect();
            setTextCursorPosition({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top + scriptContainer.scrollTop
            });
            resetIdleTimer();
        };
    
        const handleMouseEnter = () => {
            setIsTextCursorVisible(true);
            resetIdleTimer();
        };
    
        const handleMouseLeave = () => {
            setIsTextCursorVisible(false);
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
            }
        };
    
        scriptContainer.addEventListener('mousemove', handleMouseMove);
        scriptContainer.addEventListener('mouseenter', handleMouseEnter);
        scriptContainer.addEventListener('mouseleave',handleMouseLeave);
        
        resetIdleTimer();
    
        return () => {
            scriptContainer.removeEventListener('mousemove', handleMouseMove);
            scriptContainer.removeEventListener('mouseenter', handleMouseEnter);
            scriptContainer.removeEventListener('mouseleave',handleMouseLeave);
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
            }
            setIsTextCursorVisible(false);
        };
    }, [tool]);

    // Layer Management
    const genLayerId = () => `L${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    const handleCreateLayer = () => {
        if (layers.length >= MAX_LAYERS) return;
        const maxOrder = layers.length > 0 ? Math.max(...layers.map(l => l.order)) : 0;
        const newLayer: Layer = { id: genLayerId(), name: `Capa ${layers.length + 1}`, visible: true, locked: false, order: maxOrder + 1 };
        setLayers(prev => [newLayer, ...prev]);
        setActiveLayerId(newLayer.id);
    };
    
    const handleRenameLayer = (id: string, name: string) => setLayers(p => p.map(l => l.id === id ? { ...l, name } : l));
    const handleToggleVisible = (id: string) => setLayers(p => p.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
    
    const handleToggleLocked = (id: string) => {
        setLayers(p => p.map(l => {
            if (l.id !== id) return l;
            return { ...l, locked: !l.locked };
        }));
    };

    const handleMoveUp = (id: string) => {
        setLayers(prev => {
            const arr = [...prev].sort((a, b) => a.order - b.order);
            const i = arr.findIndex(l => l.id === id);
            if (i <= 0) return prev;
            [arr[i].order, arr[i - 1].order] = [arr[i - 1].order, arr[i].order];
            return arr;
        });
    };
    const handleMoveDown = (id: string) => {
        setLayers(prev => {
            const arr = [...prev].sort((a, b) => a.order - b.order);
            const i = arr.findIndex(l => l.id === id);
            if (i === -1 || i >= arr.length - 1) return prev;
            [arr[i].order, arr[i + 1].order] = [arr[i + 1].order, arr[i].order];
            return arr;
        });
    };
    
    const handleDeleteLayer = (idOrIds: string) => {
        const idsToDelete = idOrIds.split(',');
    
        let layersAfterDelete = layers.filter(l => !idsToDelete.includes(l.id));

        if (layersAfterDelete.length === 0) {
            const newLayer: Layer = { id: genLayerId(), name: `Capa 1`, visible: true, locked: false, order: 1 };
            layersAfterDelete = [newLayer];
        }
        
        setLayers(layersAfterDelete);

        if (activeLayerId && idsToDelete.includes(activeLayerId)) {
            const remaining = layersAfterDelete.sort((a, b) => b.order - a.order);
            setActiveLayerId(remaining[0]?.id ?? null);
        }
        
        setStrokes(prev => prev.filter(s => !idsToDelete.includes(s.layerId)));
        setTextAnnotations(prev => prev.filter(a => !idsToDelete.includes(a.layerId)));
    };

     const handleToggleAllVisible = () => {
        setLayers(prev => {
            const shouldMakeAllInvisible = prev.some(l => l.visible);
            return prev.map(l => ({ ...l, visible: !shouldMakeAllInvisible }));
        });
    };
    
    const handleToggleAllLocked = () => {
        setLayers(prev => {
            const shouldLockAll = prev.some(l => !l.locked);
            if (shouldLockAll) {
                return prev.map(l => ({ ...l, locked: true }));
            }
            // Only unlock layers that are not password protected
            return prev.map(l => l.password ? l : { ...l, locked: false });
        });
    };
    
    const handleSetLayerPassword = (id: string, password: string | null) => {
        setLayers(p => p.map(l => {
            if (l.id !== id) return l;
            if (password) {
                return { ...l, password, locked: true };
            }
            const { password: _, ...rest } = l;
            return { ...rest, locked: false };
        }));
    };

    // Text Annotation Handlers
    const handleCreateTextAnnotation = (point: Point) => {
      if (!activeLayerId) return;
      const newAnnotation: TextAnnotation = {
        id: `text_${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: 'text',
        layerId: activeLayerId,
        x: point.x,
        y: point.y,
        text: '',
        ...defaultTextFormat,
        color: penColor, // Override color with the selected one
      };
      setTextAnnotations(prev => [...prev, newAnnotation]);
      setEditingText(newAnnotation);
    };

    const handleUpdateEditingText = (annotation: TextAnnotation) => {
        setEditingText(annotation);
        setTextAnnotations(prev => prev.map(a => a.id === annotation.id ? annotation : a));
    };

    const handleFinishEditingText = (e?: React.FocusEvent<HTMLDivElement>) => {
        if (e && formatBarRef.current?.contains(e.relatedTarget as Node)) {
            return;
        }

        if (editingText && editingText.text.trim() === '') {
            setTextAnnotations(prev => prev.filter(a => a.id !== editingText.id));
        }
        setEditingText(null);
    };

    // Tipex in-place editing handlers
    const handleStartEditingTipex = (id: string) => {
        const isLinked = annotationLinks.some(link => (link.startId === id || link.endId === id));
        if (isLinked) {
            alert("Aquesta anotació ja està enllaçada a un text. No es pot editar directament.");
            return;
        }
        const tipexToEdit = textHighlights.find(h => h.id === id);
        if (tipexToEdit) {
            setEditingTipex(tipexToEdit);
        }
    };
    
    const handleUpdateTipexAnnotation = (annotation: TextHighlightAnnotation) => {
        setEditingTipex(annotation); 
        setTextHighlights(prev => prev.map(h => h.id === annotation.id ? annotation : h));
    };

    const handleFinishEditingTipex = () => {
        if (editingTipex && (editingTipex.replacementText || '').trim() === '') {
            const { replacementText, replacementFontSize, ...rest } = editingTipex;
            setTextHighlights(prev => prev.map(h => h.id === editingTipex.id ? rest : h));
        }
        setEditingTipex(null);
    };

    const handleDeleteTextAnnotation = (id: string) => {
        setTextAnnotations(p => p.filter(a => a.id !== id));
        setAnnotationLinks(p => p.filter(l => l.startId !== id && l.endId !== id));
    };

    const handleDeleteTextHighlight = (id: string) => {
        setTextHighlights(p => p.filter(h => h.id !== id));
        setAnnotationLinks(p => p.filter(l => l.startId !== id && l.endId !== id));
    };

    const handleAddOrMergeTipexHighlight = (newHighlight: TextHighlightAnnotation) => {
        const paddedNewHighlight = newHighlight;
        const MERGE_THRESHOLD = 5;
        const newBoundingBox = getBoundingBox(paddedNewHighlight.rects);

        const overlappingHighlights = textHighlights.filter(h => {
            if (h.type !== 'tipex' || h.layerId !== paddedNewHighlight.layerId) return false;
            
            const existingBoundingBox = getBoundingBox(h.rects);
            return (
                newBoundingBox.x < existingBoundingBox.x + existingBoundingBox.width + MERGE_THRESHOLD &&
                newBoundingBox.x + newBoundingBox.width + MERGE_THRESHOLD > existingBoundingBox.x &&
                newBoundingBox.y < existingBoundingBox.y + existingBoundingBox.height + MERGE_THRESHOLD &&
                newBoundingBox.y + newBoundingBox.height + MERGE_THRESHOLD > existingBoundingBox.y
            );
        });

        if (overlappingHighlights.length === 0) {
            setTextHighlights(prev => [...prev, { ...paddedNewHighlight, id: `highlight_${Date.now()}` }]);
            return;
        }

        const highlightsToMerge = [paddedNewHighlight, ...overlappingHighlights];
        const oldIdsToRemove = overlappingHighlights.map(h => h.id);

        const sortedHighlights = [...highlightsToMerge].sort((a, b) => {
            const yA = a.rects[0]?.y ?? 0;
            const yB = b.rects[0]?.y ?? 0;
            if (Math.abs(yA - yB) > 10) return yA - yB;
            return (a.rects[0]?.x ?? 0) - (b.rects[0]?.x ?? 0);
        });
        
        const combinedText = sortedHighlights
            .map(h => h.text)
            .reduce((acc, currentText) => {
                if (!acc) return currentText;
                const cleanAcc = acc.replace(/\s+/g, '');
                const cleanCurrent = currentText.replace(/\s+/g, '');
                if (cleanAcc.includes(cleanCurrent)) return acc;
                if (cleanCurrent.includes(cleanAcc)) return currentText;
                for (let i = Math.min(acc.length, currentText.length); i > 0; i--) {
                    if (acc.endsWith(currentText.substring(0, i))) {
                        return acc + currentText.substring(i);
                    }
                }
                return acc + ' ' + currentText;
            }, '');


        const allRects = highlightsToMerge.flatMap(h => h.rects);
        const mergedRectsResult = mergeRects(allRects);

        const mergedHighlight: TextHighlightAnnotation = {
            id: `highlight_${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            layerId: paddedNewHighlight.layerId,
            rects: mergedRectsResult,
            color: '#FFFFFF',
            text: combinedText,
            type: 'tipex',
        };

        setTextHighlights(prev => [
            ...prev.filter(h => !oldIdsToRemove.includes(h.id)),
            mergedHighlight,
        ]);

        setAnnotationLinks(prev => {
            const idsToUpdateFrom = new Set(oldIdsToRemove);
            const linksToUpdate = prev.filter(l => idsToUpdateFrom.has(l.startId) || idsToUpdateFrom.has(l.endId));
            if (linksToUpdate.length === 0) return prev;
            const otherEndIds = new Set<string>();
            linksToUpdate.forEach(link => {
                if (idsToUpdateFrom.has(link.startId)) otherEndIds.add(link.endId);
                else otherEndIds.add(link.startId);
            });
            const oldLinkIds = new Set(linksToUpdate.map(l => l.id));
            const newLinks: AnnotationLink[] = Array.from(otherEndIds).map(endId => ({
                id: `link_${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                type: 'link',
                startId: mergedHighlight.id,
                endId: endId,
                layerId: paddedNewHighlight.layerId,
            }));
            return [ ...prev.filter(l => !oldLinkIds.has(l.id)), ...newLinks ];
        });
    };

    const handleSubtractTipexHighlight = (subtractionRects: Array<{ x: number; y: number; width: number; height: number }>) => {
        if (subtractionRects.length === 0) return;
        const subtractionBoundingBox = getBoundingBox(subtractionRects);

        const candidateHighlights = textHighlights.filter(h => {
            if (h.type !== 'tipex') return false;
            const existingBoundingBox = getBoundingBox(h.rects);
            const horizontalOverlap = subtractionBoundingBox.x < existingBoundingBox.x + existingBoundingBox.width && subtractionBoundingBox.x + subtractionBoundingBox.width > existingBoundingBox.x;
            if (!horizontalOverlap) return false;
            const verticalOverlapAmount = Math.max(0, Math.min(subtractionBoundingBox.y + subtractionBoundingBox.height, existingBoundingBox.y + existingBoundingBox.height) - Math.max(subtractionBoundingBox.y, existingBoundingBox.y));
            const overlapThreshold = subtractionBoundingBox.height * 0.5;
            return verticalOverlapAmount >= overlapThreshold;
        });

        if (candidateHighlights.length === 0) return;

        let targetHighlight: TextHighlightAnnotation;
        if (candidateHighlights.length === 1) {
            targetHighlight = candidateHighlights[0];
        } else {
            const selectionCenterY = subtractionBoundingBox.y + subtractionBoundingBox.height / 2;
            targetHighlight = candidateHighlights.reduce((closest, current) => {
                const closestCenterY = getBoundingBox(closest.rects).y + getBoundingBox(closest.rects).height / 2;
                const currentCenterY = getBoundingBox(current.rects).y + getBoundingBox(current.rects).height / 2;
                return Math.abs(selectionCenterY - currentCenterY) < Math.abs(selectionCenterY - closestCenterY) ? current : closest;
            });
        }
        
        let remainingRects: typeof targetHighlight.rects = [];
        targetHighlight.rects.forEach(mRect => {
            let rectPieces = [mRect];
            subtractionRects.forEach(sRect => {
                let nextPieces: typeof rectPieces = [];
                rectPieces.forEach(p => nextPieces.push(...subtractRect(p, sRect)));
                rectPieces = nextPieces;
            });
            remainingRects.push(...rectPieces);
        });

        const rectGroups = groupRects(remainingRects);
        const newHighlights: TextHighlightAnnotation[] = rectGroups.flatMap(group => {
            if (group.length === 0) return [];
            const newRects = mergeRects(group);
            const newText = recalculateTextForRects(newRects, targetHighlight);
            return {
                id: `highlight_${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                layerId: targetHighlight.layerId,
                rects: newRects,
                color: '#FFFFFF',
                text: newText,
                type: 'tipex',
            };
        });

        setTextHighlights(prev => [ ...prev.filter(h => h.id !== targetHighlight.id), ...newHighlights ]);
        setAnnotationLinks(prev => prev.filter(l => l.startId !== targetHighlight.id && l.endId !== targetHighlight.id));
    };

    // Search functionality
    useEffect(() => {
        matchYRef.current.clear();
        setActiveMatch(searchQuery ? 0 : -1);
        setSearchMatches(findMatches(SCRIPT_TEXT, searchQuery));
    }, [searchQuery, SCRIPT_TEXT]);

    useEffect(() => {
        if (activeMatch < 0) return;
        const y = matchYRef.current.get(activeMatch);
        if (y == null) return;
        const paddingTop = 32;
        const topMargin = 20;
        scrollRef.current?.scrollTo({ top: Math.max(0, y + paddingTop - topMargin), behavior: 'smooth' });
    }, [activeMatch]);

    const nextMatch = useCallback(() => {
        if (!searchMatches.length) return;
        setActiveMatch(prev => (prev + 1) % searchMatches.length);
    }, [searchMatches.length]);

    const prevMatch = useCallback(() => {
        if (!searchMatches.length) return;
        setActiveMatch(prev => (prev - 1 + searchMatches.length) % searchMatches.length);
    }, [searchMatches.length]);

    const handleMatchLayout = useCallback((idx: number, y: number) => matchYRef.current.set(idx, y), []);
    const handleTakeLayout = useCallback((num: number, y: number) => takeYRef.current.set(num, y), []);

    // Character selection — selector only sets shared state;
    // highlight logic is decoupled into the useEffect below.
    const onSelectCharacter = (name: string | null) => {
        setSelectedCharacter(name);
    };

    // Derive character highlight matches reactively from selectedCharacter
    useEffect(() => {
        if (!selectedCharacter) {
            setCharMatches([]);
            return;
        }
        const needle = `*${selectedCharacter}*`;
        setCharMatches(findMatches(SCRIPT_TEXT, needle));
    }, [selectedCharacter, SCRIPT_TEXT]);
    
    const takesForSelectedCharacter = useMemo(() => {
        if (!selectedCharacter) return [];
        // Use parsed script data (DADES-equivalent logic) when available
        if (parsedScript.takes.length > 0) {
            const speakerRegex = /\*([^*]+)\*/g;
            return parsedScript.takes
                .filter(take => {
                    return take.lines.some(line => {
                        if (!line.speaker) return false;
                        speakerRegex.lastIndex = 0;
                        let m: RegExpExecArray | null;
                        while ((m = speakerRegex.exec(line.speaker)) !== null) {
                            if (m[1].trim() === selectedCharacter) return true;
                        }
                        return false;
                    });
                })
                .map(take => {
                    // Extract real TAKE number from label, matching ColumnView's takeYRef keys
                    const m = take.takeLabel.match(/TAKE\s*#?\s*(\d+)/i);
                    return m ? parseInt(m[1], 10) : take.id;
                })
                .sort((a, b) => a - b);
        }
        // Fallback to document takes with text search
        if (!activeDocument?.takes) return [];
        const needle = `*${selectedCharacter}*`;
        return activeDocument.takes
            .filter((take: any) => {
                const slice = SCRIPT_TEXT.slice(take.start, take.end);
                return findMatches(slice, needle).length > 0;
            })
            .map((take: any) => take.num)
            .sort((a: number, b: number) => a - b);
    }, [selectedCharacter, parsedScript, activeDocument, SCRIPT_TEXT]);

    const handleJumpToTake = (num: number) => {
        const y = takeYRef.current.get(num);
        if (y !== undefined) {
            const paddingTop = 32;
            const topMargin = 20;
            scrollRef.current?.scrollTo({ top: Math.max(0, y + paddingTop - topMargin), behavior: 'smooth' });
        }
        // Reset the selector to show "TAKE" — navigation is temporal, no persistent state
        if (takeSelectRef.current) takeSelectRef.current.value = '';
    };
    
    // Zoom handlers
    const handleZoomIn = () => setZoom(z => Math.min(2, z + 0.1));
    const handleZoomOut = () => setZoom(z => Math.max(0.5, z - 0.1));
    const handleResetZoom = () => setZoom(1);

    const activeLayer = useMemo(() => layers.find(l => l.id === activeLayerId), [layers, activeLayerId]);
    const visibleLayerIds = useMemo(() => layers.filter(l => l.visible).map(l => l.id), [layers]);
    
    const isPaletteVisible = tool === 'pencil' || tool === 'text' || tool === 'text-selector' || tool === 'freehand-highlighter';

    const handlePanMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (tool !== 'none' || target.closest('button, input, textarea, a, select, [contenteditable]')) return;
        if (target.closest('.text-annotation-container, [data-tipex-editor-id]')) return;

        e.preventDefault();
        setIsPanning(true);
        if (scrollRef.current) {
            panStartRef.current = {
                startY: e.clientY,
                scrollTop: scrollRef.current.scrollTop,
            };
            document.body.style.cursor = 'grabbing';
        }
    };

    useEffect(() => {
        const handlePanMouseMove = (e: MouseEvent) => {
            if (!isPanning || !panStartRef.current || !scrollRef.current) return;
            const deltaY = e.clientY - panStartRef.current.startY;
            scrollRef.current.scrollTop = panStartRef.current.scrollTop - deltaY;
        };
        const handlePanMouseUp = () => {
            if (isPanning) {
                setIsPanning(false);
                panStartRef.current = null;
                document.body.style.cursor = '';
            }
        };
        if (isPanning) {
            window.addEventListener('mousemove', handlePanMouseMove);
            window.addEventListener('mouseup', handlePanMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handlePanMouseMove);
            window.removeEventListener('mouseup', handlePanMouseUp);
        };
    }, [isPanning]);
    
    const textFormatContext = editingText || defaultTextFormat;
    
    const handleTextFormatChange = (updates: Partial<Omit<TextAnnotation, 'id' | 'type' | 'layerId' | 'x' | 'y' | 'text'>>) => {
        setDefaultTextFormat(prev => ({ ...prev, ...updates }));
        if (editingText) {
            handleUpdateEditingText({ ...editingText, ...updates });
        }
    };
    
    const handleToolChange = (id: Tool) => {
        const newTool = tool === id ? 'none' : id;
        setTool(newTool);
        if (tool === 'tipex' && newTool !== 'tipex') {
            setTipexAction('add');
        }
    };


    if (!activeDocument) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900">
                <p>Document not found.</p>
                <button onClick={onClose} className="mt-4 px-4 py-2 text-white rounded-lg" style={{ backgroundColor: 'var(--th-btn-primary-bg)', color: 'var(--th-btn-primary-text)' }}>
                    Back to Library
                </button>
            </div>
        );
    }

    return (
        <div className="w-full h-screen bg-gray-900 flex flex-col font-sans text-gray-200">
            <div className="flex-grow flex overflow-hidden">
                {isLayerPanelOpen && (
                    <aside className="w-[280px] flex-shrink-0 bg-gray-800 border-r border-gray-700 flex flex-col">
                        <div className="flex-shrink-0 border-b border-gray-700">
                           <div className="flex">
                               <button
                                   onClick={() => setActiveLeftPanelTab('layers')}
                                   className={`w-1/2 py-2 text-sm font-medium text-center transition-colors ${
                                       activeLeftPanelTab === 'layers'
                                           ? 'border-b-2 bg-gray-900'
                                           : 'text-gray-400 hover:bg-gray-700'
                                   }`}
                                   style={activeLeftPanelTab === 'layers' ? { borderColor: 'var(--th-accent)', color: 'var(--th-accent-text)' } : undefined}
                               >
                                   Capes
                               </button>
                               <button
                                   onClick={() => setActiveLeftPanelTab('director_notes')}
                                   className={`w-1/2 py-2 text-sm font-medium text-center transition-colors ${
                                       activeLeftPanelTab === 'director_notes'
                                           ? 'border-b-2 bg-gray-900'
                                           : 'text-gray-400 hover:bg-gray-700'
                                   }`}
                                   style={activeLeftPanelTab === 'director_notes' ? { borderColor: 'var(--th-accent)', color: 'var(--th-accent-text)' } : undefined}
                               >
                                   Anotacions direcció
                               </button>
                           </div>
                       </div>
                       
                        {activeLeftPanelTab === 'layers' && (
                           <LayerPanel 
                               layers={layers}
                               activeLayerId={activeLayerId || ''}
                               onSelect={setActiveLayerId}
                               onCreate={handleCreateLayer}
                               onRename={handleRenameLayer}
                               onToggleVisible={handleToggleVisible}
                               onToggleLocked={handleToggleLocked}
                               onDelete={handleDeleteLayer}
                               onMoveUp={handleMoveUp}
                               onMoveDown={handleMoveDown}
                               maxLayers={MAX_LAYERS}
                               onToggleAllVisible={handleToggleAllVisible}
                               onToggleAllLocked={handleToggleAllLocked}
                               onSetLayerPassword={handleSetLayerPassword}
                           />
                        )}
                        {activeLeftPanelTab === 'director_notes' && (
                           <DirectorAnnotationsPanel
                                textHighlights={textHighlights}
                                textAnnotations={textAnnotations}
                                annotationLinks={annotationLinks}
                           />
                        )}
                    </aside>
                )}

                <main className="flex-grow flex flex-col bg-gray-900 overflow-hidden">
                    <div
                        className="flex-grow overflow-y-auto flex flex-col items-center p-4 md:p-8"
                        style={{ 
                            userSelect: tool === 'text-selector' || tool === 'tipex' ? 'auto' : 'none',
                            cursor: (tool === 'text-selector' || tool === 'tipex') ? 'none' : (isPanning ? 'grabbing' : 'grab'),
                        }}
                        ref={scrollRef}
                        onMouseDown={handlePanMouseDown}
                    >
                         <div
                            id="lector-page-content-area"
                            className="page-a4 bg-white text-gray-900 shadow-lg rounded-sm transition-all duration-300"
                            style={{ width: `${A4_WIDTH_PX}px`, maxWidth: '100%', transform: `scale(${zoom * BASE_ZOOM_LEVEL})`, transformOrigin: 'top' }}
                         >
                            <div className="relative p-8">
                                <ColumnView
                                    content={SCRIPT_TEXT}
                                    setContent={() => {}} // Read-only
                                    isEditable={false}
                                    col1Width={col1Width}
                                    editorStyles={editorStyles}
                                    matches={searchMatches}
                                    activeIndex={activeMatch}
                                    secondaryMatches={charMatches}
                                    tertiaryMatches={absoluteViewerMatches}
                                    onTakeLayout={handleTakeLayout}
                                />
                                <AnnotationCanvas
                                    tool={tool}
                                    tipexAction={tipexAction}
                                    strokes={strokes}
                                    textAnnotations={textAnnotations}
                                    textHighlights={textHighlights}
                                    annotationLinks={annotationLinks}
                                    drawingEnabled={!!activeLayer && !activeLayer.locked}
                                    activeLayerId={activeLayerId || ''}
                                    visibleLayerIds={visibleLayerIds}
                                    layers={layers}
                                    penColor={penColor}
                                    zoom={zoom * BASE_ZOOM_LEVEL}
                                    showAnnotationIds={showAnnotationIds}
                                    onAddStroke={(s) => setStrokes(p => [...p, s])}
                                    onEraseStroke={(id) => setStrokes(p => p.filter(s => s.id !== id))}
                                    onCreateTextAnnotation={handleCreateTextAnnotation}
                                    editingText={editingText}
                                    onStartEditingText={setEditingText}
                                    onUpdateEditingText={handleUpdateEditingText}
                                    onFinishEditingText={handleFinishEditingText}
                                    editingTipex={editingTipex}
                                    onStartEditingTipex={handleStartEditingTipex}
                                    onUpdateTipexAnnotation={handleUpdateTipexAnnotation}
                                    onFinishTipex={handleFinishEditingTipex}
                                    onDeleteTextAnnotation={handleDeleteTextAnnotation}
                                    onAddTextHighlight={(h) => setTextHighlights(p => [...p, h])}
                                    onAddOrMergeTipexHighlight={handleAddOrMergeTipexHighlight}
                                    onSubtractTipexHighlight={handleSubtractTipexHighlight}
                                    onDeleteTextHighlight={handleDeleteTextHighlight}
                                    onAddAnnotationLink={(l) => setAnnotationLinks(p => [...p, l])}
                                    onDeleteAnnotationLink={(id) => setAnnotationLinks(p => p.filter(l => l.id !== id))}
                                />
                            </div>
                        </div>
                    </div>
                </main>

                {isTakesPanelOpen && (
                    <aside className="w-[280px] flex-shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col">
                       <TakesByCharacterPanel
                            allTakes={activeDocument.takes}
                            character={selectedCharacter}
                            characterTakes={takesForSelectedCharacter}
                            onJumpToTake={handleJumpToTake}
                            takeStatuses={takeStatuses}
                            onSetStatus={(takeNum: number, status: TakeStatus) => {
                                if (!selectedCharacter) return;
                                setTakeStatuses(prev => {
                                    const newStatuses = JSON.parse(JSON.stringify(prev));
                                    if (status === 'pending') { // 'none' was changed to 'pending'
                                        if (newStatuses[String(takeNum)]) {
                                            delete newStatuses[String(takeNum)][selectedCharacter];
                                            if (Object.keys(newStatuses[String(takeNum)]).length === 0) {
                                                delete newStatuses[String(takeNum)];
                                            }
                                        }
                                    } else {
                                        if (!newStatuses[String(takeNum)]) {
                                            newStatuses[String(takeNum)] = {};
                                        }
                                        newStatuses[String(takeNum)][selectedCharacter] = status;
                                    }
                                    return newStatuses;
                                });
                            }}
                            takeNotes={takeNotes}
                            onUpdateNote={(takeNum: number, text: string) => {
                                if (!selectedCharacter) return;
                                setTakeNotes(prev => ({
                                    ...prev,
                                    [`${takeNum}_${selectedCharacter}`]: text,
                                }));
                            }}
                            characterNotes={characterNotes}
                            onAddCharacterNote={(text: string) => {
                                if (!selectedCharacter) return;
                                const newNote: CharacterNote = {
                                    id: `cnote_${Date.now()}`,
                                    characterName: selectedCharacter,
                                    text,
                                };
                                setCharacterNotes(prev => [...prev, newNote]);
                            }}
                            onUpdateCharacterNote={(id: string, text: string) => {
                                setCharacterNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
                            }}
                            onDeleteCharacterNote={(id: string) => {
                                setCharacterNotes(prev => prev.filter(n => n.id !== id));
                            }}
                            jumpMode={jumpMode}
                            setJumpMode={setJumpMode}
                       />
                    </aside>
                )}
            </div>

            <footer className="relative flex-shrink-0 bg-gray-800 border-t border-gray-700 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
                 <div className={`absolute bottom-full left-1/2 -translate-x-1/2 w-auto mb-2 transition-all duration-300 ease-in-out ${searchOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
                    <div className="flex items-center gap-2 bg-gray-700 text-white p-2 rounded-lg shadow-lg border border-gray-600">
                        <Icons.SearchIcon className="w-5 h-5 text-gray-400" />
                        <input 
                            ref={inputRef} 
                            type="text" 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            placeholder="Buscar en el guión..." 
                            className="w-48 text-sm bg-gray-600 px-2 py-1 rounded-md border border-gray-500 focus:outline-none focus:ring-1 text-white"
                            style={{ '--tw-ring-color': 'var(--th-focus-ring)' } as React.CSSProperties} 
                        />
                        <span className="text-xs text-gray-400 font-mono w-14 text-center">{searchMatches.length > 0 ? `${activeMatch + 1}/${searchMatches.length}` : '0/0'}</span>
                        <button onClick={prevMatch} className="p-1.5 rounded-md hover:bg-gray-600"><Icons.ArrowUp className="w-4 h-4" /></button>
                        <button onClick={nextMatch} className="p-1.5 rounded-md hover:bg-gray-600"><Icons.ArrowDown className="w-4 h-4" /></button>
                        <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }} className="p-1.5 rounded-md hover:bg-gray-600">
                            <Icons.Close className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                
                <div
                    ref={formatBarRef}
                    className={`absolute bottom-full left-1/2 -translate-x-1/2 w-auto mb-2 transition-all duration-300 ease-in-out ${editingText ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}
                >
                    <div className="flex items-center gap-2 bg-gray-700 text-white p-2 rounded-lg shadow-lg border border-gray-600">
                        <button onClick={() => handleTextFormatChange({ textAlign: 'left' })} className={`p-1.5 rounded-md ${textFormatContext.textAlign === 'left' ? 'bg-gray-600' : 'hover:bg-gray-600'}`}><Icons.AlignLeft className="w-4 h-4" /></button>
                        <button onClick={() => handleTextFormatChange({ textAlign: 'center' })} className={`p-1.5 rounded-md ${textFormatContext.textAlign === 'center' ? 'bg-gray-600' : 'hover:bg-gray-600'}`}><Icons.AlignCenter className="w-4 h-4" /></button>
                        <button onClick={() => handleTextFormatChange({ textAlign: 'right' })} className={`p-1.5 rounded-md ${textFormatContext.textAlign === 'right' ? 'bg-gray-600' : 'hover:bg-gray-600'}`}><Icons.AlignRight className="w-4 h-4" /></button>
                        <div className="w-px h-5 bg-gray-600 mx-1"></div>
                        <input
                            type="number"
                            value={textFormatContext.fontSize}
                            onChange={(e) => handleTextFormatChange({ fontSize: parseInt(e.target.value, 10) || 14 })}
                            className="w-20 text-sm bg-gray-600 px-2 py-0.5 rounded-md border border-gray-500 focus:outline-none focus:ring-1 text-white"
                            style={{ '--tw-ring-color': 'var(--th-focus-ring)' } as React.CSSProperties}
                        />
                         <div className="w-px h-5 bg-gray-600 mx-1"></div>
                        <button onClick={() => handleTextFormatChange({ fontWeight: textFormatContext.fontWeight === 'bold' ? 'normal' : 'bold' })} className={`p-1.5 rounded-md ${textFormatContext.fontWeight === 'bold' ? 'bg-gray-500' : 'hover:bg-gray-600'}`}><Icons.Bold className="w-4 h-4" /></button>
                        <button onClick={() => handleTextFormatChange({ fontStyle: textFormatContext.fontStyle === 'italic' ? 'normal' : 'italic' })} className={`p-1.5 rounded-md ${textFormatContext.fontStyle === 'italic' ? 'bg-gray-500' : 'hover:bg-gray-600'}`}><Icons.Italic className="w-4 h-4" /></button>
                        <button onClick={() => handleTextFormatChange({ textDecoration: textFormatContext.textDecoration === 'underline' ? 'none' : 'underline' })} className={`p-1.5 rounded-md ${textFormatContext.textDecoration === 'underline' ? 'bg-gray-500' : 'hover:bg-gray-600'}`}><Icons.Underline className="w-4 h-4" /></button>
                    </div>
                </div>

                <div className="flex items-stretch">
                    <div className="flex-shrink-0 flex flex-col justify-start border-r border-gray-700">
                        <div className="h-[50px] flex items-center justify-between px-4" style={{ width: isLayerPanelOpen ? '280px' : 'auto' }}>
                            {isLayerPanelOpen ? (
                                <>
                                    <h2 className="text-md font-semibold">
                                        {activeLeftPanelTab === 'layers' ? 'Capes' : 'Anotacions direcció'}
                                    </h2>
                                    <button onClick={() => setIsLayerPanelOpen(false)} className="p-2 rounded-md hover:bg-gray-700" aria-label="Tancar panell de capes">
                                        <Icons.Close className="w-4 h-4" />
                                    </button>
                                </>
                            ) : (
                                <button onClick={() => setIsLayerPanelOpen(true)} className="text-md font-semibold p-2 rounded-md hover:bg-gray-700">
                                    Capes
                                </button>
                            )}
                        </div>
                        <div className="h-[50px] flex items-center px-4 border-t border-gray-700">
                           <button onClick={onClose} className="flex items-center gap-2 text-sm font-semibold hover:bg-white/5 p-2 rounded-lg" style={{ color: 'var(--th-accent-text)' }}>
                                <Icons.ArrowLeft className="w-5 h-5" />
                                Sortir del guió
                            </button>
                        </div>
                    </div>

                    <div className="flex-grow flex flex-col min-w-0">
                        <div className="h-[50px] flex items-center justify-between px-4">
                            <div className="flex items-center">
                                <button onClick={() => setSearchOpen(p => !p)} className={`p-2 rounded-md ${searchOpen ? '' : 'hover:bg-gray-700'}`} style={searchOpen ? { backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)' } : undefined}>
                                    <Icons.SearchIcon className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center h-[50px]">
                                <div className="flex items-center gap-x-2">
                                    <div className="flex items-center gap-2">
                                        {ANNOTATION_TOOLS.map(({ id, icon: Icon }) => (
                                            <React.Fragment key={id}>
                                                <button
                                                    onClick={() => handleToolChange(id)}
                                                    className={`p-2 rounded-md ${tool === id ? '' : 'hover:bg-gray-700'}`}
                                                    style={tool === id ? { backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)' } : undefined}
                                                    aria-label={toolTitles[id]}
                                                    title={toolTitles[id]}
                                                >
                                                    <Icon className="w-5 h-5" />
                                                </button>
                                                {id === 'tipex' && tool === 'tipex' && (
                                                    <div className="flex items-center gap-1 bg-gray-700 rounded-md p-0.5 ml-[-4px] border border-gray-600">
                                                        <button
                                                            onClick={() => setTipexAction('add')}
                                                            className={`p-1.5 rounded ${tipexAction === 'add' ? 'bg-gray-800 shadow-sm' : 'text-gray-400 hover:bg-gray-600'}`}
                                                            style={tipexAction === 'add' ? { color: 'var(--th-accent-text)' } : undefined}
                                                            title="Afegir Tipex (+)"
                                                        >
                                                            <Icons.Plus size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => setTipexAction('subtract')}
                                                            className={`p-1.5 rounded ${tipexAction === 'subtract' ? 'bg-gray-800 shadow-sm' : 'text-gray-400 hover:bg-gray-600'}`}
                                                            style={tipexAction === 'subtract' ? { color: 'var(--th-accent-text)' } : undefined}
                                                            title="Treure Tipex (-)"
                                                        >
                                                            <Icons.Minus size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        ))}
                                        <button
                                            onClick={() => setIsAbsoluteViewerOn(v => !v)}
                                            className={`p-2 rounded-md ${isAbsoluteViewerOn ? '' : 'hover:bg-gray-700'}`}
                                            style={isAbsoluteViewerOn ? { backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)' } : undefined}
                                            aria-label="Visualitzador absolut"
                                            title="Visualitzador absolut"
                                        >
                                            <Icons.EyeIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setShowAnnotationIds(prev => !prev)}
                                            className={`p-2 rounded-md ${showAnnotationIds ? '' : 'hover:bg-gray-700'}`}
                                            style={showAnnotationIds ? { backgroundColor: 'var(--th-accent-muted)', color: 'var(--th-accent-text)' } : undefined}
                                            aria-label="Mostrar/Ocultar IDs d'anotació"
                                            title="Mostrar/Ocultar IDs d'anotació"
                                        >
                                            <Icons.Hash className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="w-px h-6 bg-gray-700 mx-2"></div>
                                    <div className="flex items-center gap-2">
                                        {COLOR_PALETTE.map((color, index) => {
                                            const isActive = penColor === color.hex && isPaletteVisible;
                                            return (
                                                <button
                                                    key={color.hex}
                                                    onClick={() => {
                                                        if (isPaletteVisible) setPenColor(color.hex);
                                                        if(tool === 'text') handleTextFormatChange({ color: color.hex });
                                                    }}
                                                    className={`w-6 h-6 rounded-full border-2 transition-all duration-300 ease-in-out ${
                                                        isPaletteVisible
                                                            ? 'translate-x-0 opacity-100'
                                                            : '-translate-x-5 opacity-0 pointer-events-none'
                                                    } ${
                                                        isActive ? 'scale-110' : 'border-transparent hover:scale-110'
                                                    }`}
                                                    style={{
                                                        backgroundColor: color.hex,
                                                        transitionDelay: `${index * 50}ms`,
                                                        ...(isActive ? { borderColor: 'var(--th-accent)' } : {}),
                                                    }}
                                                    aria-label={`Select color ${color.name}`}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <button onClick={handleZoomOut} className="p-2 rounded-md hover:bg-gray-700" aria-label="Zoom out"><Icons.Minus className="w-5 h-5" /></button>
                                <button onClick={handleResetZoom} className="text-sm font-semibold w-16 text-center p-2 rounded-md hover:bg-gray-700" aria-label="Reset zoom">{`${Math.round(zoom * 100)}%`}</button>
                                <button onClick={handleZoomIn} className="p-2 rounded-md hover:bg-gray-700" aria-label="Zoom in"><Icons.Plus className="w-5 h-5" /></button>
                            </div>
                        </div>

                        <div className="h-[50px] flex items-center justify-between px-4 border-t border-gray-700">
                            <h1 className="text-md font-semibold text-gray-200 truncate">{activeDocument.name}</h1>
                            <div className="flex items-center gap-2">
                                {/* Actor selector — prepared for future data source */}
                                <div className="relative">
                                    <select
                                        value={selectedActor || ''}
                                        onChange={(e) => setSelectedActor(e.target.value || null)}
                                        disabled
                                        className="text-sm appearance-none cursor-pointer bg-gray-700 border border-gray-600 rounded-md py-1 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Actor</option>
                                    </select>
                                </div>
                                {/* Character selector — sets shared state only */}
                                <div className="relative">
                                    <select
                                        value={selectedCharacter || ''}
                                        onChange={(e) => onSelectCharacter(e.target.value || null)}
                                        className="text-sm appearance-none cursor-pointer bg-gray-700 border border-gray-600 rounded-md py-1 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    >
                                        <option value="">Personatges</option>
                                        {characters.map(char => (
                                            <option key={char.name} value={char.name}>{char.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Take selector — temporal navigation, resets after jump */}
                                <div className="relative">
                                    <select
                                        ref={takeSelectRef}
                                        onChange={(e) => { if (e.target.value) handleJumpToTake(Number(e.target.value)); }}
                                        className="text-sm appearance-none cursor-pointer bg-gray-700 border border-gray-600 rounded-md py-1 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    >
                                        <option value="">TAKE</option>
                                        {parsedTakes.map(take => (
                                            <option key={take.num} value={take.num}>{take.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-shrink-0 flex flex-col justify-start border-l border-gray-700">
                        <div className="h-[50px] flex items-center justify-between px-4" style={{ width: isTakesPanelOpen ? '280px' : 'auto' }}>
                             {isTakesPanelOpen ? (
                                <>
                                    <h2 className="text-md font-semibold">T. Personatge</h2>
                                    <button onClick={() => setIsTakesPanelOpen(false)} className="p-2 rounded-md hover:bg-gray-700" aria-label="Tancar panell de T. Personatge">
                                        <Icons.Close className="w-4 h-4" />
                                    </button>
                                </>
                             ) : (
                                <button onClick={() => setIsTakesPanelOpen(true)} className="text-md font-semibold p-2 rounded-md hover:bg-gray-700">
                                    T. Personatge
                                </button>
                             )}
                        </div>
                        <div className="h-[50px] flex items-center justify-center px-4 border-t border-gray-700">
                            <div className="flex items-center gap-2 text-sm">
                                <button
                                    onClick={() => prevDocument && onNavigateDocument(prevDocument.id)}
                                    disabled={!prevDocument}
                                    className="font-semibold p-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Episodi anterior"
                                >
                                    Ant.
                                </button>
                                <span className="font-semibold text-gray-500 select-none px-2">Episodi</span>
                                <button
                                    onClick={() => nextDocument && onNavigateDocument(nextDocument.id)}
                                    disabled={!nextDocument}
                                    className="font-semibold p-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Episodi següent"
                                >
                                    Seg.
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};