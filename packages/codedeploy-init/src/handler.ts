import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  Context,
} from 'aws-lambda'

import { ecsHandler } from './ecs'
import { lambdaHandler } from './lambda'

/**
 * Creates a CodeDeploy ECS deployment
 *
 * @export
 * @param {CloudFormationCustomResourceEvent} event - Cloudformation custom resource lambda event
 * @param {Context} context - Invoke context
 * @returns {Promise<CloudFormationCustomResourceResponse>}
 */
export async function handler(
  event: CloudFormationCustomResourceEvent,
  context: Context
): Promise<CloudFormationCustomResourceResponse> {
  console.log(JSON.stringify(event))

  if (event.ResourceProperties.type === 'lambda') {
    return lambdaHandler(event, context)
  } else if (event.ResourceProperties.type === 'ecs') {
    return ecsHandler(event, context)
  }

  throw new Error('unknown event payload received')
}
