import React, {
  useState,
  useMemo,
  useLayoutEffect,
  useRef,
  useEffect,
  useCallback,
} from 'react';

interface CsvViewProps {
  content: string | undefined;       // pot arribar undefined
  setContent: (value: string, source: 'csv') => void;
  isEditable: boolean;
  pageWidth: string;
}

const SEPARATOR = ' | ';
const MIN_COLUMN_WIDTH = 50;

interface CsvRow {
  id: number;
  take: string;
  speaker: string;
  text: string;
}

const canvas = document.createElement('canvas');
const measureTextWidth = (text: string, font: string): number => {
  const context = canvas.getContext('2d');
  if (!context) {
    return text.length * 8;
  }
  context.font = font;
  return context.measureText(text).width;
};

export const CsvView: React.FC<CsvViewProps> = ({
  content,
  setContent,
  isEditable,
  pageWidth,
}) => {
  const parsedRows = useMemo((): CsvRow[] => {
    if (!content) return [];
    return content.split('\n').map((line, index) => {
      const parts = line.split(SEPARATOR);
      return {
        id: index,
        take: parts[0] || '',
        speaker: parts[1] || '',
        text: parts.slice(2).join(SEPARATOR) || '',
      };
    });
  }, [content]);

  const [gridState, setGridState] = useState(parsedRows);
  const [columnWidths, setColumnWidths] = useState({ take: 120, speaker: 180 });

  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const tableRef = useRef<HTMLDivElement>(null);
  const hasAutoSized = useRef(false);
  const resizeInfo = useRef<{
    isResizing: boolean;
    column: 'take' | 'speaker' | null;
    startX: number;
    startWidth: number;
  }>({ isResizing: false, column: null, startX: 0, startWidth: 0 });

  useLayoutEffect(() => {
    setGridState(parsedRows);
  }, [parsedRows]);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  };

  const resizeAllTextareas = useCallback(() => {
    textareaRefs.current.forEach(autoResize);
    window.requestAnimationFrame(() => {
      textareaRefs.current.forEach(autoResize);
    });
  }, []);

  useLayoutEffect(() => {
    resizeAllTextareas();
    window.addEventListener('resize', resizeAllTextareas);
    return () => window.removeEventListener('resize', resizeAllTextareas);
  }, [gridState, resizeAllTextareas, columnWidths]);


  const autoSizeColumn = useCallback((key: 'take' | 'speaker') => {
    if (!tableRef.current) return;

    const PADDING = 24;
    const font = getComputedStyle(tableRef.current.querySelector('input, textarea')!).font;

    let maxWidth = 0;
    if (key === 'take') {
        const headerWidth = measureTextWidth('TAKE', font);
        const contentWidths = gridState.map(row => measureTextWidth(row.take, font));
        maxWidth = Math.max(headerWidth, ...contentWidths);
    } else { // speaker
        const headerWidth = measureTextWidth('PERSONATGE', font);
        const contentWidths = gridState.map(row => measureTextWidth(row.speaker, font));
        maxWidth = Math.max(headerWidth, ...contentWidths);
    }
    
    setColumnWidths(prev => ({
        ...prev,
        [key]: Math.ceil(maxWidth) + PADDING,
    }));
  }, [gridState]);


  useLayoutEffect(() => {
    if (hasAutoSized.current || gridState.length === 0 || !tableRef.current) return;
    
    requestAnimationFrame(() => {
        if (!tableRef.current) return;
        const PADDING = 24;
        const inputElement = tableRef.current.querySelector('input, textarea');
        if (!inputElement) return;

        const font = getComputedStyle(inputElement).font;
        const maxTakeWidth = Math.max(measureTextWidth('TAKE', font), ...gridState.map(row => measureTextWidth(row.take, font)));
        const maxSpeakerWidth = Math.max(measureTextWidth('PERSONATGE', font), ...gridState.map(row => measureTextWidth(row.speaker, font)));

        setColumnWidths({
            take: Math.ceil(maxTakeWidth) + PADDING,
            speaker: Math.ceil(maxSpeakerWidth) + PADDING,
        });
        hasAutoSized.current = true;
    });
  }, [gridState]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizeInfo.current.isResizing) return;
    const deltaX = e.clientX - resizeInfo.current.startX;
    const newWidth = resizeInfo.current.startWidth + deltaX;
    const finalWidth = Math.max(newWidth, MIN_COLUMN_WIDTH);
    setColumnWidths(prev => ({ ...prev, [resizeInfo.current.column!]: finalWidth }));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!resizeInfo.current.isResizing) return;
    resizeInfo.current.isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((column: 'take' | 'speaker') => (e: React.MouseEvent) => {
    e.preventDefault();
    resizeInfo.current = {
      isResizing: true,
      column,
      startX: e.clientX,
      startWidth: columnWidths[column],
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths, handleMouseMove, handleMouseUp]);
  
  const handleDoubleClick = useCallback((key: 'take' | 'speaker') => () => {
    autoSizeColumn(key);
  }, [autoSizeColumn]);

  const handleCellChange = (rowIndex: number, field: keyof Omit<CsvRow, 'id'>, value: string) => {
    setGridState(prev => {
      const newState = [...prev];
      newState[rowIndex] = { ...newState[rowIndex], [field]: value };
      return newState;
    });
  };

  const handleBlur = () => {
    const newContent = gridState.map(row => [row.take, row.speaker, row.text].join(SEPARATOR)).join('\n');
    if (newContent !== content) setContent(newContent, 'csv');
  };

  const commonInputClasses = 'bg-transparent w-full p-2 focus:outline-none text-[13px] leading-snug text-black';
  const editableInputClasses = isEditable ? 'focus:bg-gray-100' : 'cursor-default';
  const gridTemplateColumns = `${columnWidths.take}px ${columnWidths.speaker}px 1fr`;

  return (
    <div ref={tableRef} className="text-sm font-sans text-gray-900 overflow-x-auto">
      {/* Capçalera */}
      <div
        className="grid sticky top-0 bg-gray-200 z-10 font-bold text-left border-b-2 border-gray-400"
        style={{ gridTemplateColumns, minWidth: '100%' }}
      >
        <div className="p-2 border-r border-gray-300 relative flex items-center">
          <span>TAKE</span>
          <div
            onMouseDown={handleMouseDown('take')}
            onDoubleClick={handleDoubleClick('take')}
            className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-20"
            title="Arrossega per canviar l'amplada, doble clic per auto-ajustar"
          />
        </div>
        <div className="p-2 border-r border-gray-300 relative flex items-center">
          <span>PERSONATGE</span>
           <div
            onMouseDown={handleMouseDown('speaker')}
            onDoubleClick={handleDoubleClick('speaker')}
            className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-20"
            title="Arrossega per canviar l'amplada, doble clic per auto-ajustar"
          />
        </div>
        <div className="p-2">TEXT</div>
      </div>

      {/* Files */}
      <div className="grid" style={{ gridTemplateColumns, minWidth: '100%' }}>
        {gridState.map((row, rowIndex) => (
          <React.Fragment key={row.id}>
            <div className="border-r border-b border-gray-300 flex items-start">
              <input
                type="text"
                className={`${commonInputClasses} ${editableInputClasses}`}
                value={row.take}
                readOnly={!isEditable}
                onBlur={handleBlur}
                onChange={e => handleCellChange(rowIndex, 'take', e.target.value)}
              />
            </div>
            <div className="border-r border-b border-gray-300 flex items-start">
              <input
                type="text"
                className={`${commonInputClasses} ${editableInputClasses}`}
                value={row.speaker}
                readOnly={!isEditable}
                onBlur={handleBlur}
                onChange={e => handleCellChange(rowIndex, 'speaker', e.target.value)}
              />
            </div>
            <div className="border-b border-gray-300 flex">
              <textarea
                ref={el => { textareaRefs.current[rowIndex] = el; }}
                className={`${commonInputClasses} ${editableInputClasses} resize-none`}
                value={row.text}
                readOnly={!isEditable}
                onBlur={handleBlur}
                onChange={e => {
                  handleCellChange(rowIndex, 'text', e.target.value);
                  autoResize(e.target);
                }}
                rows={1}
              />
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
