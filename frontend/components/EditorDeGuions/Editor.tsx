import React from 'react';

interface EditorProps {
  content: string | undefined;          // permet que arribi undefined
  setContent: (value: string) => void;
  isEditable: boolean;
  tabSize: number;
}

const Editor: React.FC<EditorProps> = ({
  content,
  setContent,
  isEditable,
  tabSize,
}) => {
  // Normalitzem el contingut: mai passem undefined al textarea
  const safeContent = content ?? '';

  return (
    <textarea
      value={safeContent}
      onChange={(e) => setContent(e.target.value)}
      readOnly={!isEditable}
      className="w-full h-full min-h-[1050px] p-2 bg-transparent resize-none focus:outline-none font-mono text-sm text-gray-900 caret-gray-900"
      style={{ tabSize: tabSize, MozTabSize: tabSize, OTabSize: tabSize }}
      spellCheck="false"
    />
  );
};

export default Editor;
