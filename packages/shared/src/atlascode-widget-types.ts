/**
 * atlascode-widget DSL types — shared contract between daemon (persistence)
 * and UI (parsing + rendering).
 */

export type AtlasCodeWidgetKind =
  | 'chart'
  | 'map'
  | 'dashboard'
  | 'diagram'
  | 'interactive'
  | 'form'
  | 'mockup';

export type AtlasCodeWidgetStreamingMode = 'html-first' | 'complete' | 'static';

export type AtlasCodeWidgetThemeMode = 'app' | 'light' | 'dark' | 'isolated';

export type AtlasCodeWidgetCapability =
  | 'resize'
  | 'sendPrompt'
  | 'openLink'
  | 'download'
  | 'submitForm';

export type AtlasCodeWidgetPolicy = 'local-only' | 'inline-only' | 'trusted-cdn';

export interface AtlasCodeWidgetData {
  name: string;
  type: string;
  content: string;
}

export interface AtlasCodeWidgetEnvelope {
  version: string;
  kind: AtlasCodeWidgetKind;
  title: string;
  id?: string;
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  streaming: AtlasCodeWidgetStreamingMode;
  capabilities?: AtlasCodeWidgetCapability[];
  theme?: AtlasCodeWidgetThemeMode;
  tokenSet?: string;
  policy?: AtlasCodeWidgetPolicy;

  meta?: string;
  style?: string;
  html?: string;
  data?: AtlasCodeWidgetData[];
  script?: string;
  fallback?: string;
}

export type WidgetContentSegment =
  | { type: 'text'; content: string }
  | { type: 'widget'; envelope: AtlasCodeWidgetEnvelope }
  | { type: 'widget_incomplete'; raw: string };
