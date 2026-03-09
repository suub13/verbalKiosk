/**
 * DocumentViewer - Displays parsed document sections.
 */

import { useStore } from '@/store';
import type { DocumentStructure } from '@shared/types/document';

interface Props {
  document: DocumentStructure;
}

export function DocumentViewer({ document }: Props) {
  const highlightedFieldId = useStore(s => s.highlightedFieldId);
  const translations = useStore(s => s.translations);

  return (
    <div className="document-viewer" role="document" aria-label={document.title}>
      <div className="document-viewer__header">
        <h2>{document.title}</h2>
        {document.metadata.issuingAgency && (
          <p className="document-viewer__agency">{document.metadata.issuingAgency}</p>
        )}
      </div>

      <div className="document-viewer__content">
        {document.sections.map(section => (
          <div
            key={section.id}
            className={`document-section document-section--${section.type}`}
          >
            {section.content}
          </div>
        ))}

        <div className="document-viewer__fields">
          {document.fields.map(field => (
            <div
              key={field.id}
              className={`document-field ${
                highlightedFieldId === field.id ? 'document-field--highlighted' : ''
              }`}
              id={`field-${field.id}`}
              role="row"
              aria-current={highlightedFieldId === field.id ? 'true' : undefined}
            >
              <span className="document-field__label">
                {field.label}
                {field.required && <span className="document-field__required">*</span>}
              </span>
              <span className="document-field__value">
                {field.value || <em className="document-field__empty">비어있음</em>}
              </span>
              {translations[field.id] && (
                <span className="document-field__translation">
                  {translations[field.id]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
