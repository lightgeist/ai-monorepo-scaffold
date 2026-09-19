import type { AtlasCodeAuthApplication } from '../auth/application.js';
import { markTuiAuthorizationUrl } from '../auth/authorization-url.js';
import { createDefaultAtlasCodeAuthApplication } from '../auth/factory.js';
import {
  createTuiExternalTargetOpener,
  type TuiExternalTargetOpener,
} from '../host/open-external.js';
import { prepareTuiDataDir } from '../runtime/data-dir.js';
import type { AtlasCodeRegion } from '@atlascode/config';

interface TuiAuthCommandApplication {
  login: AtlasCodeAuthApplication['login'];
  logout: AtlasCodeAuthApplication['logout'];
}

export interface RunTuiAuthCommandOptions {
  readonly region?: AtlasCodeRegion;
  readonly lane?: string;
  readonly createApplication?: (region?: AtlasCodeRegion) => TuiAuthCommandApplication;
  readonly writeError?: (value: string) => void;
  readonly prepareDataDir?: typeof prepareTuiDataDir;
  readonly openBrowser?: boolean;
  readonly openExternalTarget?: TuiExternalTargetOpener;
}

export async function runTuiLogin(options: RunTuiAuthCommandOptions = {}): Promise<string> {
  const application = options.createApplication
    ? options.createApplication(options.region)
    : await createAuthApplication(options.region, options.prepareDataDir);
  const writeError = options.writeError ?? ((value: string) => process.stderr.write(value));
  const result = await application.login((progress) => {
    const authorizationUrl = markTuiAuthorizationUrl(
      progress.verificationUriComplete ?? progress.verificationUri,
    );
    writeError(
      `Open: ${authorizationUrl}\nCode: ${progress.userCode}\nWaiting for authorization…\n`,
    );
    if (options.openBrowser === false) return;
    const openExternalTarget =
      options.openExternalTarget ?? createTuiExternalTargetOpener(process.cwd());
    void openExternalTarget(authorizationUrl).catch(() => {
      writeError("Couldn't open the default browser. Open the authorization URL above manually.\n");
    });
  });
  return result.message;
}

export async function runTuiLogout(options: RunTuiAuthCommandOptions = {}): Promise<string> {
  const application = options.createApplication
    ? options.createApplication(options.region)
    : await createAuthApplication(options.region, options.prepareDataDir);
  const result = await application.logout();
  if (result.logoutUrl) {
    const writeError = options.writeError ?? ((value: string) => process.stderr.write(value));
    writeError(`Finish signing out in your browser:\n${result.logoutUrl}\n`);
    if (options.openBrowser !== false) {
      const reportOpenFailure = () =>
        writeError("Couldn't open the default browser. Open the sign-out URL above manually.\n");
      try {
        const openExternalTarget =
          options.openExternalTarget ?? createTuiExternalTargetOpener(process.cwd());
        void openExternalTarget(result.logoutUrl).catch(reportOpenFailure);
      } catch {
        reportOpenFailure();
      }
    }
  }
  return result.message;
}

async function createAuthApplication(
  region?: AtlasCodeRegion,
  prepareDataDirFn: typeof prepareTuiDataDir = prepareTuiDataDir,
): Promise<AtlasCodeAuthApplication> {
  return createDefaultAtlasCodeAuthApplication({
    dataDir: await prepareDataDirFn(),
    ...(region ? { region } : {}),
  });
}
