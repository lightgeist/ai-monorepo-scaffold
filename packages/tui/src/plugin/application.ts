import type {
  AtlasCodePluginCatalog,
  AtlasCodePluginMarketplace,
  AtlasCodePluginRuntimeAccess,
  AtlasCodePluginView,
} from './contract.js';

export class AtlasCodePluginApplication {
  constructor(private readonly access: AtlasCodePluginRuntimeAccess) {}

  async catalog(input: {
    readonly includeAvailable: boolean;
    readonly marketplace?: AtlasCodePluginMarketplace;
  }): Promise<AtlasCodePluginCatalog> {
    if (!input.includeAvailable) {
      return {
        installed: await this.access.listInstalledPlugins({
          marketplace: input.marketplace,
        }),
        available: [],
      };
    }
    const marketplaces: readonly AtlasCodePluginMarketplace[] = input.marketplace
      ? [input.marketplace]
      : ['official', 'local'];
    const [installed, ...marketplaceCatalogs] = await Promise.all([
      this.access.listInstalledPlugins({ marketplace: input.marketplace }),
      ...marketplaces.map((marketplace) => this.access.listMarketplacePlugins({ marketplace })),
    ]);
    const merged = new Map(
      marketplaceCatalogs.flat().map((plugin) => [plugin.pluginId, plugin] as const),
    );
    for (const plugin of installed) merged.set(plugin.pluginId, plugin);
    return partitionCatalog([...merged.values()]);
  }

  install(plugin: AtlasCodePluginView): Promise<AtlasCodePluginView> {
    return this.mutate(plugin, 'install');
  }

  remove(plugin: AtlasCodePluginView): Promise<AtlasCodePluginView> {
    return this.mutate(plugin, 'remove');
  }

  setEnabled(plugin: AtlasCodePluginView, enabled: boolean): Promise<AtlasCodePluginView> {
    return this.mutate(plugin, enabled ? 'enable' : 'disable');
  }

  refresh(): Promise<void> {
    return this.access.refreshPlugins();
  }

  private async mutate(
    plugin: AtlasCodePluginView,
    action: 'install' | 'remove' | 'enable' | 'disable',
  ): Promise<AtlasCodePluginView> {
    const result = await this.access.mutatePlugin({
      action,
      plugin: { name: plugin.name, marketplace: plugin.marketplace },
    });
    return { ...plugin, ...result };
  }
}

function partitionCatalog(plugins: readonly AtlasCodePluginView[]): AtlasCodePluginCatalog {
  const installed: AtlasCodePluginView[] = [];
  const available: AtlasCodePluginView[] = [];
  for (const plugin of plugins) {
    (plugin.installed ? installed : available).push(plugin);
  }
  return { installed, available };
}
