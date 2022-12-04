import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  Context,
} from 'aws-lambda'
import {
  CodeDeploy,
  CreateDeploymentCommand,
  CreateDeploymentOutput,
} from '@aws-sdk/client-codedeploy'
import { TaskDefinition } from '@aws-sdk/client-ecs'
import delay from 'delay'

import { DeployOperationStatus, sendResponse } from './send-response'
import { hash } from './utils'
import { create } from './create-task-definition'

export interface BeforeInstallHook {
  BeforeInstall: string
}
export interface AfterInstallHook {
  AfterInstall: string
}
export interface AfterAllowTestTrafficHook {
  AfterAllowTestTraffic: string
}
export interface AfterAllowTrafficHook {
  AfterAllowTraffic: string
}
export type Hook =
  | BeforeInstallHook
  | AfterInstallHook
  | AfterAllowTestTrafficHook
  | AfterAllowTrafficHook
export type Hooks = Hook[]

const codedeploy = new CodeDeploy({})

function createEcsDeployment(
  applicationName: string,
  deploymentGroupName: string,
  taskArn: string,
  containerName: string,
  containerPort: string,
  hooks: Hooks
): Promise<CreateDeploymentOutput> {
  const appSpecContentString = JSON.stringify({
    version: 1,
    Resources: [
      {
        TargetService: {
          Type: 'AWS::ECS::Service',
          Properties: {
            TaskDefinition: taskArn,
            LoadBalancerInfo: {
              ContainerName: containerName,
              ContainerPort: Number.parseInt(containerPort, 10),
            },
          },
        },
      },
    ],
    Hooks: hooks,
  })
  const appSpecContentHash = hash(appSpecContentString)
  const params = {
    applicationName,
    deploymentGroupName,
    revision: {
      appSpecContent: {
        content: appSpecContentString,
        sha256: appSpecContentHash,
      },
      revisionType: 'AppSpecContent',
    },
  }
  return codedeploy.send(new CreateDeploymentCommand(params))
}

/**
 * Retry wrapper to repeatedly try to create the deployment for up to 15 mins
 *
 * @param {CloudFormationCustomResourceEvent} event - Cloudformation custom resource lambda event
 * @param {Context} context - Invoke context
 * @param {TaskDefinition} taskDefinition - Task definition created for this deployment
 * @returns {Promise<CloudFormationCustomResourceResponse>}
 * @private
 */
async function doDeploy(
  event: CloudFormationCustomResourceEvent,
  context: Context,
  taskDefinition: TaskDefinition
): Promise<CloudFormationCustomResourceResponse> {
  const {
    ResourceProperties: {
      build,
      appName,
      deploymentGroupName,
      containerName,
      containerPort,
      hooks,
    },
  } = event
  const endTime = Date.now() + 850e3
  let attempts = 0
  const complete = false
  let err = new Error('unknown error')

  while (!complete && Date.now() < endTime) {
    try {
      const { deploymentId } = await createEcsDeployment(
        appName,
        deploymentGroupName,
        taskDefinition.taskDefinitionArn as string,
        containerName,
        containerPort,
        JSON.parse(hooks)
      )
      console.log(`CodeDeploy Deployment ID: ${deploymentId}`)
      if (!deploymentId) throw new Error('missing deployment id')
      return sendResponse(event, context, DeployOperationStatus.ok, {
        deployment: deploymentId,
        build,
      })
    } catch (error) {
      err = error
      console.error(err.message)
      attempts += 1
      await delay(45e3)
      console.log(JSON.stringify({ complete, attempts }))
    }
  }
  throw err
}

export async function ecsHandler(
  event: CloudFormationCustomResourceEvent,
  context: Context
): Promise<CloudFormationCustomResourceResponse> {
  const {
    ResourceProperties: {
      build,
      cluster,
      containerDefinitions,
      taskFamily,
      taskRoleArn,
      taskExecutionRoleArn,
    },
    OldResourceProperties: { build: oldBuild } = { build: '0' },
  } = { OldResourceProperties: { build: '0' }, ...event }

  if (
    event.RequestType !== 'Delete' &&
    Number.parseInt(build, 10) > Number.parseInt(oldBuild, 10)
  ) {
    if (
      !(
        cluster &&
        containerDefinitions &&
        taskFamily &&
        taskRoleArn &&
        taskExecutionRoleArn
      )
    ) {
      return sendResponse(event, context, DeployOperationStatus.fail, {
        deployment: 'missing params on event',
        build,
      })
    }

    try {
      const { taskDefinition } = await create(event)
      console.log(JSON.stringify({ taskDefinition }))
      if (!taskDefinition || !taskDefinition.taskDefinitionArn)
        throw new Error('Failed to create task definition')

      const res = await doDeploy(event, context, taskDefinition)

      return res
    } catch (error) {
      console.error(error)
      return sendResponse(event, context, DeployOperationStatus.fail, {
        deployment: error.message,
        build,
      })
    }
  }

  return sendResponse(event, context, DeployOperationStatus.ok, {
    deployment: 'noop',
    build: build ?? '0',
  })
}
