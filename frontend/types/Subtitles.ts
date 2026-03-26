
// types/Subtitles.ts

export type Id = number;
export type SegmentStatus = 'ok' | 'warning' | 'error';

export interface Segment {
	id: Id;
	startTime: number; // segons
	endTime: number; // segons
	originalText: string; // text en pla del subtítol
	// Fix: Added translatedText to Segment interface
	translatedText?: string;
	richText?: string; // HTML intern per a contentEditable
	status?: SegmentStatus;
    hasDiff?: boolean; // Indica si hi ha discrepància amb el guió original
    
    /** @deprecated Use primaryTakeNum instead */
    takeNum?: number; 
    
    primaryTakeNum?: number; // TAKE principal vinculat (darrer inici >= startTime)
    candidateTakeNums?: number[]; // Llista de TAKES candidats ordenats per proximitat/prioritat
}

export interface GeneralConfig {
	maxCharsPerLine: number;
	maxLinesPerSubtitle: number;
	/** Marge mínim entre subtítols consecutius (ms). Default: 160 */
	minGapMs?: number;
}
