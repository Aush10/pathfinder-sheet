import { config } from 'dotenv';
import { join } from 'node:path';

/** Local development settings take precedence; deployed hosting settings do not. */
export function loadServerEnvironment(
  root: string,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  config({ path: join(root, '.env'), processEnv: environment, override: false, quiet: true });
  config({
    path: join(root, '.env.local'),
    processEnv: environment,
    override: environment.NODE_ENV !== 'production',
    quiet: true,
  });
}
