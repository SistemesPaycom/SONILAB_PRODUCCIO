import React, {
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useLayoutEffect,
} from 'react';
import {
  parseScript,
  TakeBlock,
  ScriptLine,
} from '../../utils/EditorDeGuions/scriptParser';
import { MAX_SPEAKER_CHARS_PER_LINE } from '../../constants';
import { EditorStyles, EditorStyle } from '../../types';
import type { Match } from '../../utils/LectorDeGuions/search';

interface ColumnViewProps {
  content: string | undefined;              // pot arribar undefined
  setContent: (value: string) => void;
  isEditable: boolean;
  col1Width: number;
  editorStyles: EditorStyles;
  // New optional props for LectorDeGuions
  matches?: Match[];
  activeIndex?: number;
  secondaryMatches?: Match[];
  tertiaryMatches?: Match[];
  onTakeLayout?: (num: number, y: number) => void;
  /** Callback opcional cridat quan l'usuari clica la capçalera d'un TAKE (per seek extern) */
  onTakeClick?: (takeNum: number) => void;
}

/* ====== PARÀMETRES D’ESPAIAT EDITABLES ====== */
const INNER_BLOCK_GAP_PX = 2;
const BLOCK_GAP_PX = 10;
const BLANK_LINE_HEIGHT_PX = 2;
const TAKE_PADDING_TOP_PX = 4;
const TAKE_MARGIN_BOTTOM_PX = 6;
const TAKE_HEADER_MARGIN_BOTTOM_PX = 12;

/* =============== HELPERS =============== */
const getInlineStyle = (
  style: EditorStyle,
  highlightStyle?: React.CSSProperties
): React.CSSProperties => ({
  fontFamily: style.fontFamily,
  fontSize: `${style.fontSize}px`,
  color: style.color,
  fontWeight: style.bold ? 'bold' : 'normal',
  fontStyle: style.italic ? 'italic' : 'normal',
  lineHeight: '1.4',
  backgroundColor: highlightStyle?.backgroundColor,
  borderRadius: highlightStyle ? '2px' : undefined,
});

const renderDialogueText = (
  text: string,
  styles: EditorStyles,
  highlightStyle?: React.CSSProperties
) => {
  if (!text) return null;

  const regex = /(\([^)]+\))/g;
  const parts = text.split(regex);

  const tcOrNumInParensRegex =
    /^\(\s*((\d{2}:\d{2})|(\d{2}\.\d{2})|(\d{2}))\s*\)$/;

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        if (part.startsWith('(') && part.endsWith(')')) {
          let styleToApply = styles.dialogueParentheses;
          if (tcOrNumInParensRegex.test(part)) {
            styleToApply = styles.dialogueTimecodeParentheses;
          }
          return (
            <span
              key={index}
              style={getInlineStyle(styleToApply, highlightStyle)}
            >
              {part}
            </span>
          );
        }

        return (
          <span
            key={index}
            style={getInlineStyle(styles.dialogue, highlightStyle)}
          >
            {part}
          </span>
        );
      })}
    </>
  );
};

function splitLongToken(token: string): string[] {
  let remaining = token;
  const parts: string[] = [];
  while (remaining.length > MAX_SPEAKER_CHARS_PER_LINE) {
    const slice = remaining.slice(0, MAX_SPEAKER_CHARS_PER_LINE);
    let breakIdx = slice.lastIndexOf(' ');
    if (breakIdx <= 0) breakIdx = MAX_SPEAKER_CHARS_PER_LINE;
    parts.push(remaining.slice(0, breakIdx).trimEnd());
    remaining = remaining.slice(breakIdx).trimStart();
  }
  if (remaining.length) parts.push(remaining);
  return parts;
}

function wrapSpeakerLabel(raw: string): string {
  const tokenRegex = /\*[^*]+\*/g;
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(raw)) !== null) tokens.push(match[0]);
  if (!tokens.length) return splitLongToken(raw).join('\n');

  const lines: string[] = [];
  let current = '';
  const flush = () => {
    if (current) lines.push(current);
    current = '';
  };
  const handleToken = (tok: string) => {
    const segments =
      tok.length > MAX_SPEAKER_CHARS_PER_LINE ? splitLongToken(tok) : [tok];
    for (const seg of segments) {
      if (!current) current = seg;
      else if (current.length + seg.length <= MAX_SPEAKER_CHARS_PER_LINE)
        current += seg;
      else {
        flush();
        current = seg;
      }
    }
  };
  tokens.forEach(handleToken);
  flush();
  return lines.join('\n');
}

function isSameLogicalBlock(
  current: { speaker?: string; text: string },
  next?: { speaker?: string; text: string }
): boolean {
  if (!next) return false;
  if (current.speaker && next.speaker && !next.text) return true;
  return false;
}

/* =============== COMPONENT =============== */

export const ColumnView: React.FC<ColumnViewProps> = ({
  content,
  setContent,
  isEditable,
  col1Width,
  editorStyles,
  matches,
  activeIndex,
  secondaryMatches,
  tertiaryMatches,
  onTakeLayout,
  onTakeClick,
}) => {
  // Normalitzem: mai passem undefined a parseScript ni a indexOf
  const safeContent = content ?? '';

  const { preamble, takes } = useMemo(() => {
    return parseScript(safeContent);
  }, [safeContent]);

  const timeoutRef = useRef<number | null>(null);
  const takeRefs = useRef<Map<number, HTMLElement | null>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const serializeScript = useCallback(
    (preamble: string, takes: TakeBlock[]): string => {
      const takeSeparator =
        '\n------------------------------------------------------------------------------------\n';
      let preamblePart = preamble.trim() ? preamble.trim() + takeSeparator : '';
      const takesPart = takes
        .map((take) => {
          let takeContent: string[] = [];
          take.takeLabel && takeContent.push(take.takeLabel);
          take.timecode && takeContent.push(take.timecode);
          const linesContent = take.lines
            .map((line) => {
              if (!line.speaker && !line.text) return '';
              if (!line.speaker) return line.text;
              if (!line.text) return line.speaker;
              return `${line.speaker}\t${line.text}`;
            })
            .join('\n');
          takeContent.push(linesContent);
          take.finalTimecode && takeContent.push(take.finalTimecode);
          return takeContent.join('\n');
        })
        .join(takeSeparator);
      return preamblePart + takesPart;
    },
    []
  );

  useEffect(() => {
    if (!isEditable) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      let wasChanged = false;
      const newTakes: TakeBlock[] = JSON.parse(JSON.stringify(takes));

      for (const take of newTakes) {
        if (!take.lines || take.lines.length < 2) continue;

        const mergedLines: ScriptLine[] = [];
        let i = 0;
        while (i < take.lines.length) {
          const currentLine = take.lines[i];

          if (currentLine.speaker && currentLine.text) {
            let j = i + 1;
            while (
              j < take.lines.length &&
              take.lines[j].speaker &&
              take.lines[j].text === currentLine.text
            ) {
              j++;
            }

            if (j > i + 1) {
              wasChanged = true;
              const group = take.lines.slice(i, j);
              const combinedSpeaker = group
                .map((l) => l.speaker || '')
                .join('');

              const mergedLine: ScriptLine = {
                raw: `${combinedSpeaker}\t${currentLine.text}`,
                speaker: combinedSpeaker,
                text: currentLine.text,
              };
              mergedLines.push(mergedLine);
              i = j;
            } else {
              mergedLines.push(currentLine);
              i++;
            }
          } else {
            mergedLines.push(currentLine);
            i++;
          }
        }
        take.lines = mergedLines;
      }

      if (wasChanged) {
        const newContent = serializeScript(preamble, newTakes);
        if (newContent !== safeContent) {
          setContent(newContent);
        }
      }
    }, 5000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [safeContent, preamble, takes, isEditable, setContent, serializeScript]);

    useLayoutEffect(() => {
    if (!onTakeLayout) return;

    const reportLayouts = () => {
      if (!containerRef.current) return;

      // Busquem el contenidor de scroll marcat al VideoEditorView
      const scrollContainer = containerRef.current.closest(
        '[data-script-scroll-container="true"]'
      ) as HTMLElement | null;

      let scrollTop = 0;
      let containerTop = 0;

      if (scrollContainer) {
        scrollTop = scrollContainer.scrollTop;
        containerTop = scrollContainer.getBoundingClientRect().top;
      } else {
        // Fallback: per si ColumnView s'usa fora del vídeo-editor
        containerTop = containerRef.current.getBoundingClientRect().top;
      }

      takeRefs.current.forEach((node, num) => {
        if (!node) return;

        const rect = node.getBoundingClientRect();
        // y mesurats en coordenades del contenidor de scroll,
        // de manera que scrollTop = y fa que la barra grisa quedi a dalt
        const y = rect.top - containerTop + scrollTop;
        onTakeLayout(num, y);
      });
    };

    reportLayouts();
    const observer = new ResizeObserver(reportLayouts);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [takes, onTakeLayout]);

  const handleUpdate = useCallback(
    (
      field:
        | 'preamble'
        | 'takeLabel'
        | 'timecode'
        | 'speaker'
        | 'text'
        | 'finalTimecode',
      takeIndex: number | null,
      lineIndex: number | null,
      newValue: string
    ) => {
      let newPreamble = preamble;
      const newTakes: TakeBlock[] = JSON.parse(JSON.stringify(takes));
      if (field === 'preamble') newPreamble = newValue;
      else if (takeIndex !== null) {
        const take = newTakes[takeIndex];
        if (field === 'takeLabel') take.takeLabel = newValue;
        else if (field === 'timecode') take.timecode = newValue;
        else if (field === 'finalTimecode') take.finalTimecode = newValue;
        else if (lineIndex !== null) {
          const line = take.lines[lineIndex];
          if (field === 'speaker') line.speaker = newValue.replace(/\n/g, '');
          else if (field === 'text') line.text = newValue;
        }
      }
      const newContent = serializeScript(newPreamble, newTakes);
      setContent(newContent);
    },
    [preamble, takes, serializeScript, setContent]
  );

  const allHighlights = useMemo(() => {
    if (isEditable) return [];
    const result: any[] = [];
    if (tertiaryMatches)
      result.push(
        ...tertiaryMatches.map((m) => ({ ...m, type: 'tertiary' as const }))
      );
    if (secondaryMatches)
      result.push(
        ...secondaryMatches.map((m) => ({ ...m, type: 'secondary' as const }))
      );
    if (matches)
      result.push(
        ...matches.map((m, i) => ({
          ...m,
          type: 'primary' as const,
          active: i === activeIndex,
        }))
      );
    return result;
  }, [isEditable, matches, activeIndex, secondaryMatches, tertiaryMatches]);

  const renderHighlightedContent = useCallback(
    (
      textToRender: string | undefined,
      offset: number,
      styleKey: keyof EditorStyles,
      isDialogue: boolean
    ) => {
      if (!textToRender) return null;
      if (allHighlights.length === 0) {
        return isDialogue
          ? renderDialogueText(textToRender, editorStyles)
          : textToRender;
      }

      const textEnd = offset + textToRender.length;
      const relevantHighlights = allHighlights.filter(
        (h) => h.start < textEnd && h.end > offset
      );

      if (relevantHighlights.length === 0) {
        return isDialogue
          ? renderDialogueText(textToRender, editorStyles)
          : textToRender;
      }

      const cuts = new Set([0, textToRender.length]);
      relevantHighlights.forEach((h) => {
        cuts.add(Math.max(0, h.start - offset));
        cuts.add(Math.min(textToRender.length, h.end - offset));
      });

      const sortedCuts = Array.from(cuts).sort((a, b) => a - b);

      return sortedCuts
        .map((start, i) => {
          const end = sortedCuts[i + 1];
          if (start >= end) return null;

          const segmentText = textToRender.substring(start, end);
          const segmentMidpoint = offset + start;

          let highlightStyle: React.CSSProperties | undefined;
          const activeHighlight = relevantHighlights.find(
            (h) => segmentMidpoint >= h.start && segmentMidpoint < h.end
          );

          if (activeHighlight) {
            if (activeHighlight.type === 'primary') {
              highlightStyle = {
                backgroundColor: activeHighlight.active
                  ? 'rgba(255,165,0,0.55)'
                  : 'rgba(255,235,59,0.55)',
              };
            } else if (activeHighlight.type === 'secondary') {
              highlightStyle = { backgroundColor: 'rgba(255, 242, 0, 0.75)' };
            } else if (activeHighlight.type === 'tertiary') {
              highlightStyle = { backgroundColor: '#E8F5E9' };
            }
          }

          if (isDialogue) {
            return (
              <React.Fragment key={start}>
                {renderDialogueText(segmentText, editorStyles, highlightStyle)}
              </React.Fragment>
            );
          }

          return (
            <span
              key={start}
              style={getInlineStyle(editorStyles[styleKey], highlightStyle)}
            >
              {segmentText}
            </span>
          );
        })
        .filter(Boolean);
    },
    [allHighlights, editorStyles]
  );

  // IMPORTANT: usem sempre safeContent per buscar posicions
  let searchOffset = 0;
  const findOffset = (textToFind: string | undefined) => {
    if (!textToFind) return -1;
    const foundAt = safeContent.indexOf(textToFind, searchOffset);
    if (foundAt !== -1) {
      const nextLineMatch = safeContent
        .substring(foundAt + textToFind.length)
        .match(/\r?\n/);
      if (nextLineMatch) {
        searchOffset =
          foundAt +
          textToFind.length +
          (nextLineMatch.index ?? 0) +
          nextLineMatch[0].length;
      } else {
        searchOffset = foundAt + textToFind.length;
      }
    }
    return foundAt;
  };

  const speakerColWidth = `${col1Width}px`;
  const textColWidth = '1fr';
  const editableClasses = isEditable
    ? 'cursor-text outline-none focus:ring-1 focus:ring-blue-500 focus:bg-blue-50 rounded-sm'
    : '';

  return (
    <div className="relative flex flex-col text-gray-900" ref={containerRef}>
      {preamble && (
        <pre
          className={`whitespace-pre-wrap font-mono text-sm mb-4 ${editableClasses}`}
          contentEditable={isEditable}
          suppressContentEditableWarning={true}
          onBlur={(e) =>
            handleUpdate('preamble', null, null, e.currentTarget.innerText)
          }
        >
          {renderHighlightedContent(preamble, 0, 'dialogue', false)}
        </pre>
      )}

      {takes.map((take, takeIndex) => {
        const takeNumMatch = take.takeLabel.match(/TAKE\s*#?\s*(\d+)/i);
        const takeNum = takeNumMatch ? parseInt(takeNumMatch[1], 10) : -1;

        const setTakeRef = (node: HTMLElement | null) => {
          if (node && takeNum > -1) takeRefs.current.set(takeNum, node);
          else if (takeNum > -1) takeRefs.current.delete(takeNum);
        };

        const takeLabelOffset = findOffset(take.takeLabel);
        const timecodeOffset = take.timecode
          ? findOffset(take.timecode)
          : -1;

        return (
          <section
            ref={setTakeRef}
            key={take.id}
            className="take-block border-t border-gray-300"
            data-page-break-anchor="true"
            style={{
              paddingTop: `${TAKE_PADDING_TOP_PX}px`,
              marginBottom: `${TAKE_MARGIN_BOTTOM_PX}px`,
            }}
          >
            <div
              className={`flex items-baseline justify-between${onTakeClick && takeNum > -1 ? ' cursor-pointer hover:bg-blue-50/60 rounded transition-colors' : ''}`}
              style={{ marginBottom: `${TAKE_HEADER_MARGIN_BOTTOM_PX}px` }}
              onClick={onTakeClick && takeNum > -1 ? () => onTakeClick(takeNum) : undefined}
            >
              <h2
                className={`uppercase tracking-wide ${editableClasses}`}
                style={getInlineStyle(editorStyles.take)}
                contentEditable={isEditable}
                suppressContentEditableWarning={true}
                onBlur={(e) =>
                  handleUpdate(
                    'takeLabel',
                    takeIndex,
                    null,
                    e.currentTarget.innerText
                  )
                }
              >
                {renderHighlightedContent(
                  take.takeLabel,
                  takeLabelOffset,
                  'take',
                  false
                )}
              </h2>
              {take.timecode && (
                <span
                  className={`${editableClasses}`}
                  style={getInlineStyle(editorStyles.timecode)}
                  contentEditable={isEditable}
                  suppressContentEditableWarning={true}
                  onBlur={(e) =>
                    handleUpdate(
                      'timecode',
                      takeIndex,
                      null,
                      e.currentTarget.innerText
                    )
                  }
                >
                  {renderHighlightedContent(
                    take.timecode,
                    timecodeOffset,
                    'timecode',
                    false
                  )}
                </span>
              )}
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: `${speakerColWidth} ${textColWidth}` }}
            >
              {take.lines.map((line, idx) => {
                const lineOffset = findOffset(line.raw);
                let speakerOffset = -1;
                let textOffset = -1;
                if (lineOffset !== -1) {
                  if (line.speaker)
                    speakerOffset = safeContent.indexOf(
                      line.speaker,
                      lineOffset
                    );
                  if (line.text)
                    textOffset = safeContent.indexOf(line.text, lineOffset);
                }

                const next = take.lines[idx + 1];
                const sameBlockAsNext = isSameLogicalBlock(line, next);
                const gapHeight = sameBlockAsNext
                  ? INNER_BLOCK_GAP_PX
                  : BLOCK_GAP_PX;
                const isLastLine = idx === take.lines.length - 1;

                if (!line.text && !line.speaker) {
                  return (
                    <div
                      key={idx}
                      className="col-span-2"
                      style={{ height: `${BLANK_LINE_HEIGHT_PX}px` }}
                    />
                  );
                }

                if (!line.speaker) {
                  return (
                    <React.Fragment key={idx}>
                      <div />
                      <div
                        className={`whitespace-pre-wrap ${editableClasses}`}
                        contentEditable={isEditable}
                        suppressContentEditableWarning={true}
                        onBlur={(e) =>
                          handleUpdate(
                            'text',
                            takeIndex,
                            idx,
                            e.currentTarget.innerText
                          )
                        }
                      >
                        {renderHighlightedContent(
                          line.text,
                          textOffset,
                          'dialogue',
                          true
                        )}
                      </div>
                      {!isLastLine && (
                        <div
                          className="col-span-2"
                          style={{ height: `${gapHeight}px` }}
                        />
                      )}
                    </React.Fragment>
                  );
                }

                const speakerLabel = wrapSpeakerLabel(line.speaker);

                return (
                  <React.Fragment key={idx}>
                    <div
                      className={`pr-4 whitespace-pre-line text-right self-start ${editableClasses}`}
                      style={getInlineStyle(editorStyles.speaker)}
                      contentEditable={isEditable}
                      suppressContentEditableWarning={true}
                      onBlur={(e) =>
                        handleUpdate(
                          'speaker',
                          takeIndex,
                          idx,
                          e.currentTarget.innerText
                        )
                      }
                    >
                      {renderHighlightedContent(
                        speakerLabel,
                        speakerOffset,
                        'speaker',
                        false
                      )}
                    </div>
                    <div
                      className={`whitespace-pre-wrap ${editableClasses}`}
                      contentEditable={isEditable}
                      suppressContentEditableWarning={true}
                      onBlur={(e) =>
                        handleUpdate(
                          'text',
                          takeIndex,
                          idx,
                          e.currentTarget.innerText
                        )
                      }
                    >
                      {renderHighlightedContent(
                        line.text,
                        textOffset,
                        'dialogue',
                        true
                      )}
                    </div>
                    {!isLastLine && (
                      <div
                        className="col-span-2"
                        style={{ height: `${gapHeight}px` }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {take.finalTimecode && (
              <div className="flex justify-end mt-2">
                <span
                  className={`${editableClasses}`}
                  style={getInlineStyle(editorStyles.timecode)}
                  contentEditable={isEditable}
                  suppressContentEditableWarning={true}
                  onBlur={(e) =>
                    handleUpdate(
                      'finalTimecode',
                      takeIndex,
                      null,
                      e.currentTarget.innerText
                    )
                  }
                >
                  {renderHighlightedContent(
                    take.finalTimecode,
                    findOffset(take.finalTimecode),
                    'timecode',
                    false
                  )}
                </span>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
