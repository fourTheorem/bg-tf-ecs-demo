export const {
  ACTIVE_STACK_SSM_NAME = '',
  DYNAMO_DB_TABLE_NAME_A = '',
  DYNAMO_DB_TABLE_NAME_B = '',
  CW_EVENT_RULE_NAME_A = '',
  CW_EVENT_RULE_NAME_B = '',
  ALB_DNS_NAME = '',
  LIVE_PORT = '',
  TEST_PORT = '',
} = process.env

export enum LifecycleEventName {
  AfterAllowTestTraffic = 'AfterAllowTestTraffic',
  AfterAllowTraffic = 'AfterAllowTraffic',
  AfterInstall = 'AfterInstall',
  BeforeAllowTraffic = 'BeforeAllowTraffic',
  BeforeInstall = 'BeforeInstall',
}

export const LIFECYCLE_EVENT = process.env.LIFECYCLE_EVENT as LifecycleEventName
