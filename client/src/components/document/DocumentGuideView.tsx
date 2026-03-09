/**
 * DocumentGuideView - Main view for Service 2 (Document Voice Guide).
 * Layout: Document viewer on left, reading controls on right.
 */

import { useCallback } from 'react';
import { useStore } from '@/store';
import { DocumentViewer } from './DocumentViewer';
import { ReadingControls } from './ReadingControls';
import { FieldHighlighter } from './FieldHighlighter';
import { getErrorMessage } from '@shared/utils/errors';

export function DocumentGuideView() {
  const document = useStore(s => s.document);
  const readingState = useStore(s => s.readingState);
  const isUploading = useStore(s => s.isUploading);
  const uploadError = useStore(s => s.uploadError);
  const setDocument = useStore(s => s.setDocument);
  const setUploading = useStore(s => s.setUploading);
  const setUploadError = useStore(s => s.setUploadError);

  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/document/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.data) {
        setDocument(data.data.structure);
      } else {
        setUploadError(data.error?.message || '업로드에 실패했습니다');
      }
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }, [setDocument, setUploading, setUploadError]);

  if (!document) {
    return (
      <div className="document-guide document-guide--empty">
        <div className="document-upload-area">
          <div className="document-upload-icon" aria-hidden="true">
            {isUploading ? '...' : '📄'}
          </div>
          <h2>{isUploading ? '문서를 분석하고 있습니다...' : '문서를 올려주세요'}</h2>
          <p>PDF 또는 이미지 파일을 선택하세요</p>

          <label className="document-upload-button" role="button" tabIndex={0}>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              disabled={isUploading}
              style={{ display: 'none' }}
            />
            {isUploading ? '분석 중...' : '파일 선택'}
          </label>

          {uploadError && (
            <p className="document-upload-error" role="alert">{uploadError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="document-guide">
      <div className="document-guide__viewer">
        <DocumentViewer document={document} />
        <FieldHighlighter />
      </div>
      <div className="document-guide__controls">
        <h3>{document.title}</h3>
        <p className="document-guide__meta">
          {document.metadata.documentType} | {document.fields.length}개 항목
        </p>
        <ReadingControls />
        <div className="document-guide__field-list">
          {document.fields.map((field, index) => (
            <button
              key={field.id}
              className={`document-field-item ${
                index === readingState.currentFieldIndex ? 'document-field-item--active' : ''
              }`}
              onClick={() => useStore.getState().setCurrentFieldIndex(index)}
            >
              <span className="document-field-item__label">{field.label}</span>
              <span className="document-field-item__value">{field.value || '-'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
