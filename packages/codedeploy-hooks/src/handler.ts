import {
  CodeDeploy,
  PutLifecycleEventHookExecutionStatusCommand,
} from '@aws-sdk/client-codedeploy'
import {
  CloudWatchEventsClient,
  DisableRuleCommand,
} from '@aws-sdk/client-cloudwatch-events'
import {
  DynamoDBClient,
  DeleteTableCommand,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb'
import { Context } from 'aws-lambda'
import delay from 'delay'

import {
  ALB_DNS_NAME,
  CW_EVENT_RULE_NAME_A,
  CW_EVENT_RULE_NAME_B,
  DYNAMO_DB_TABLE_NAME_A,
  DYNAMO_DB_TABLE_NAME_B,
  LIFECYCLE_EVENT as lifecycleEvent,
  LifecycleEventName,
  TEST_PORT,
} from './constants'
import {
  getActiveStackFromSsm,
  getNextStackRef,
  setActiveStackRef,
  StackReference,
} from './utils'

export interface InvokeEvent {
  DeploymentId: string
  LifecycleEventHookExecutionId: string
}

const codedeploy = new CodeDeploy({})
const dynamo = new DynamoDBClient({})
const cwEvents = new CloudWatchEventsClient({})

export const updateCdDeployment = async (
  event: InvokeEvent,
  status: 'Failed' | 'Succeeded'
): Promise<void> => {
  await codedeploy.send(
    new PutLifecycleEventHookExecutionStatusCommand({
      deploymentId: event.DeploymentId,
      lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
      status,
    })
  )
}

/**
 * Runs CodeDeploy lifecycle event hooks
 *
 * @export
 * @param {InvokeEvent} event - CodeDeploy hook event
 * @returns {Promise<void>}
 */
export async function handler(event: InvokeEvent, ctx: Context) {
  try {
    console.log(JSON.stringify({ ...event, lifecycleEvent }))

    if (lifecycleEvent === LifecycleEventName.BeforeAllowTraffic) {
      // This is where you will perform all validation on the next stack
      // that is about to be deployed to ensure that the next stack
      // is ready to receive traffic eg - send traffic to make
      // sure it responds to requests successfully. Remember
      // to complete within the timeout period otherwise
      // perform a lambda retry via a manual invoke.
      // CodeDeploy deployments last 60 mins max!
      console.log('some pre stack switch validation logic here')

      // poll the ALB to ensure it is healthy on the testing port
      // before allowing traffic to be switched
      const testingEndpoint = `${ALB_DNS_NAME}:${TEST_PORT}/health`
      let lastResponseCode
      while (ctx.getRemainingTimeInMillis() > 30e3) {
        const { status } = await fetch(testingEndpoint)
        lastResponseCode = status
        if (lastResponseCode === 200) {
          break
        } else {
          await delay(10e3)
        }
      }

      if (lastResponseCode !== 200) {
        throw new Error(`health endpoint returned ${lastResponseCode}`)
      }
    }

    if (lifecycleEvent === LifecycleEventName.AfterAllowTraffic) {
      // This is where you will perform all cleanup tasks

      // get the current active stack
      // this is the stack that was live before CodeDeploy shifted traffic
      // to the next stack as we are now in the AfterAllowTraffic hook
      const activeStackRef = await getActiveStackFromSsm()

      // disable the cron job on the stack that is no longer active
      const ruleToDisable =
        activeStackRef === StackReference.A
          ? CW_EVENT_RULE_NAME_A
          : CW_EVENT_RULE_NAME_B

      await cwEvents.send(new DisableRuleCommand({ Name: ruleToDisable }))

      // delete dynamo table on the stack that is no longer active,
      // so it can be recreated on the next deployment
      const tableToDelete =
        activeStackRef === StackReference.A
          ? DYNAMO_DB_TABLE_NAME_A
          : DYNAMO_DB_TABLE_NAME_B

      await dynamo.send(
        new DeleteTableCommand({
          TableName: tableToDelete,
        })
      )

      await waitUntilTableNotExists(
        {
          client: dynamo,
          maxWaitTime: 300,
        },
        { TableName: tableToDelete }
      )

      // update the active stack reference so the next deployment will be
      // deployed to the alternate stack reference
      const nextStackRef = await getNextStackRef()

      console.log(
        `setting active stack ssm param ref value to: ${nextStackRef}`
      )
      await setActiveStackRef(nextStackRef)
    }

    await updateCdDeployment(event, 'Succeeded')
  } catch (err) {
    await updateCdDeployment(event, 'Failed')

    throw err
  }
}
