const ATLASCODE_TOOLS_MODEL_PREFIX = 'MiniMax-M2.7';

const ATLASCODE_TOOLS_MASTER_REMINDER = [
  '<atlascode-tools-master-reminder>',
  'For all video, image, and audio understanding and generation tasks, use the atlascode-tools-master skill.',
  '</atlascode-tools-master-reminder>',
].join('\n');

export function withAtlasCodeToolsMasterReminder(input: {
  reminderText: string | undefined;
  modelID: string | undefined;
  enabled: boolean;
}): string | undefined {
  if (!input.enabled || !input.modelID?.startsWith(ATLASCODE_TOOLS_MODEL_PREFIX)) {
    return input.reminderText;
  }

  const existing = unwrapSystemReminder(input.reminderText);
  const body = existing
    ? `${existing}\n\n${ATLASCODE_TOOLS_MASTER_REMINDER}`
    : ATLASCODE_TOOLS_MASTER_REMINDER;
  return `<system-reminder>\n${body}\n</system-reminder>`;
}

function unwrapSystemReminder(text: string | undefined): string {
  const trimmed = text?.trim();
  if (!trimmed) return '';
  return trimmed
    .replace(/^<system-reminder>\s*/u, '')
    .replace(/\s*<\/system-reminder>$/u, '')
    .trim();
}
