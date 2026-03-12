/** Parsed document structure */
export interface DocumentStructure {
  id: string;
  fileName: string;
  pageCount: number;
  title: string;
  sections: DocumentSection[];
  fields: DocumentField[];
  metadata: DocumentMetadata;
}

/** A section in the document (e.g., header, table, paragraph) */
export interface DocumentSection {
  id: string;
  type: 'header' | 'table' | 'paragraph' | 'list' | 'form_field' | 'signature';
  pageNumber: number;
  boundingBox?: BoundingBox;
  content: string;
  children?: DocumentSection[];
}

/** A fillable or readable field in the document */
export interface DocumentField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'number' | 'date' | 'checkbox' | 'address' | 'name' | 'phone';
  pageNumber: number;
  boundingBox?: BoundingBox;
  required: boolean;
  translation?: Record<string, string>;
}

/** Bounding box for field highlighting */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Document metadata */
export interface DocumentMetadata {
  language: string;
  documentType: string;
  issuingAgency?: string;
  dateIssued?: string;
  ocrConfidence: number;
}

/** Reading mode for document voice guide */
export type ReadingMode = 'full' | 'highlights' | 'field_select';

/** Reading state for document guide */
export interface ReadingState {
  mode: ReadingMode;
  currentFieldIndex: number;
  isPlaying: boolean;
  speed: number; // 0.5 - 2.0
  totalFields: number;
}
