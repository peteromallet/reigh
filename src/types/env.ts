export const AppEnv = {
  DEV: 'dev',
  LOCAL: 'local',
  WEB: 'web',
} as const;

export type AppEnvValue = typeof AppEnv[keyof typeof AppEnv];

export const ALL_ENVS: AppEnvValue[] = [AppEnv.DEV, AppEnv.LOCAL, AppEnv.WEB];
export const LOCAL_ENVS: AppEnvValue[] = [AppEnv.LOCAL];
export const WEB_ENVS: AppEnvValue[] = [AppEnv.WEB]; 