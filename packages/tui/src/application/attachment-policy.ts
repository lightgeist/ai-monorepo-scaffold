export const ATLASCODE_MAX_ATTACHMENT_COUNT = 10;
export const ATLASCODE_MAX_TOTAL_ATTACHMENT_BYTES = 100 * 1024 * 1024;

export type TuiAttachmentLimitViolation = 'count' | 'total-bytes';

export function findTuiAttachmentLimitViolation(
  attachments: readonly { readonly sizeBytes: number }[],
): TuiAttachmentLimitViolation | undefined {
  if (attachments.length > ATLASCODE_MAX_ATTACHMENT_COUNT) return 'count';
  const totalBytes = attachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);
  return totalBytes > ATLASCODE_MAX_TOTAL_ATTACHMENT_BYTES ? 'total-bytes' : undefined;
}
