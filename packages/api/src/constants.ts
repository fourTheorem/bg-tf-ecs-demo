export const {
  ENVIRONMENT = 'dev',
  DYNAMO_DB_TABLE_NAME_A = '',
  DYNAMO_DB_TABLE_NAME_B = '',
  HEALTHCHECK_PATH = '/health',
  BG_TARGET_STACK = 'a',
} = process.env

export const SERVICE_NAME = `bg-tf-ecs-demo-api-${ENVIRONMENT}`
export const VERSION = process.env.VERSION || 'local'

export enum BgTargetStack {
  A = 'a',
  B = 'b',
}
/**
 * Gets the blue/green target stack as an enum
 *
 * @returns {BgTargetStack}
 */
export function getTargetStack(): BgTargetStack {
  return BG_TARGET_STACK === 'a' ? BgTargetStack.A : BgTargetStack.B
}

export function getActiveDynamoTableName(): string {
  return BG_TARGET_STACK === 'a' ? DYNAMO_DB_TABLE_NAME_A : DYNAMO_DB_TABLE_NAME_B
}
