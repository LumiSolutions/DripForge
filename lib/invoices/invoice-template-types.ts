export {
  DOCUMENT_TEMPLATE_DOC_ID as INVOICE_TEMPLATE_DOC_ID,
  DOCUMENT_TEMPLATE_DOC_TYPE as INVOICE_TEMPLATE_DOC_TYPE,
  DEFAULT_DOCUMENT_TEMPLATE as DEFAULT_INVOICE_TEMPLATE,
  applyDocumentTemplatePlaceholders as applyInvoiceTemplatePlaceholders,
  mergeDocumentTemplateSettings as mergeInvoiceTemplateSettings,
  sanitizeDocumentTemplateInput as sanitizeInvoiceTemplateInput,
} from "@/lib/documents/document-template-types"
export type {
  DocumentTemplateSettings as InvoiceTemplateSettings,
  DocumentTemplateType as InvoiceDocumentTemplateType,
  DocumentTypeTextSettings as InvoiceDocumentTypeTextSettings,
} from "@/lib/documents/document-template-types"
