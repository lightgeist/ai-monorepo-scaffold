export type AtlasCodePluginMarketplace = 'official' | 'local';

export interface AtlasCodePluginCapabilities {
  readonly appCount: number;
  readonly mcpServerCount: number;
  readonly skillCount: number;
}

export interface AtlasCodePluginView {
  readonly pluginId: string;
  readonly name: string;
  readonly displayName: string;
  readonly marketplace: AtlasCodePluginMarketplace;
  readonly version?: string;
  readonly description?: string;
  readonly author?: string;
  readonly installed: boolean;
  readonly enabled: boolean;
  readonly capabilities: AtlasCodePluginCapabilities;
}

export interface AtlasCodePluginCatalog {
  readonly installed: readonly AtlasCodePluginView[];
  readonly available: readonly AtlasCodePluginView[];
}

export interface AtlasCodePluginRuntimeAccess {
  listInstalledPlugins(input?: {
    readonly marketplace?: AtlasCodePluginMarketplace;
  }): Promise<readonly AtlasCodePluginView[]>;
  listMarketplacePlugins(input: {
    readonly marketplace: AtlasCodePluginMarketplace;
  }): Promise<readonly AtlasCodePluginView[]>;
  mutatePlugin(input: {
    readonly action: 'install' | 'remove' | 'enable' | 'disable';
    readonly plugin: { readonly name: string; readonly marketplace: AtlasCodePluginMarketplace };
  }): Promise<{ readonly installed: boolean; readonly enabled: boolean }>;
  refreshPlugins(): Promise<void>;
}

export type AtlasCodePluginCliRequest =
  | {
      readonly action: 'list';
      readonly marketplace?: AtlasCodePluginMarketplace;
      readonly available?: boolean;
      readonly json?: boolean;
    }
  | {
      readonly action: 'add' | 'remove' | 'enable' | 'disable';
      readonly selector: string;
      readonly marketplace?: AtlasCodePluginMarketplace;
      readonly json?: boolean;
    }
  | { readonly action: 'marketplace-list'; readonly json?: boolean }
  | {
      readonly action: 'marketplace-upgrade';
      readonly json?: boolean;
    };
