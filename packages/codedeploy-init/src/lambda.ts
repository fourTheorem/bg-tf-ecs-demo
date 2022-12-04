import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  Context,
} from 'aws-lambda'
import { GetAliasCommand, Lambda } from '@aws-sdk/client-lambda'
import {
  CodeDeploy,
  CreateDeploymentCommand,
  CreateDeploymentOutput,
} from '@aws-sdk/client-codedeploy'
import delay from 'delay'

import { DeployOperationStatus, sendResponse } from './send-response'
import { hash } from './utils'

const lambda = new Lambda({})
const codedeploy = new CodeDeploy({})

/**
 * Create a CodeDeploy deployment
 *
 * @param {Record<string, any> } config - Deployment config
 * @param {string} TargetVersion - Version to deploy
 * @returns {Promise<CreateDeploymentOutput>}
 * @private
 */
async function createLambdaDeployment(
  config: Record<string, any>,
  TargetVersion: string
): Promise<CreateDeploymentOutput> {
  const { FunctionVersion: CurrentVersion } = await lambda.send(
    new GetAliasCommand({
      FunctionName: config.functionName,
      Name: config.functionAlias,
    })
  )

  const appSpecContentString = JSON.stringify({
    version: 1,
    Resources: [
      {
        [config.functionName]: {
          Type: 'AWS::Lambda::Function',
          Properties: {
            Name: config.functionName,
            Alias: config.functionAlias,
            CurrentVersion,
            TargetVersion,
          },
        },
      },
    ],
    Hooks: config.hooks,
  })

  const appSpecContentHash = hash(appSpecContentString)
  const params = {
    applicationName: config.appName,
    deploymentGroupName: config.deploymentGroupName,
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
 * @param {Record<string, any> } config - Deployment config
 * @returns {Promise<CloudFormationCustomResourceResponse>}
 * @private
 */
async function doDeploy(
  event: CloudFormationCustomResourceEvent,
  context: Context,
  config: Record<string, any>
): Promise<CloudFormationCustomResourceResponse> {
  const {
    ResourceProperties: { TargetVersion, build },
  } = event
  const endTime = Date.now() + 850e3
  let attempts = 0
  const complete = false
  let err = new Error('unknown error')

  while (!complete && Date.now() < endTime) {
    try {
      const deployment = await createLambdaDeployment(config, TargetVersion)
      console.log(JSON.stringify(deployment))

      if (!deployment.deploymentId)
        throw new Error('CodeDeploy deployment id not returned')

      return sendResponse(event, context, DeployOperationStatus.ok, {
        deployment: JSON.stringify(deployment),
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

/**
 * Creates a CodeDeploy lambda deployment
 *
 * @export
 * @param {CloudFormationCustomResourceEvent} event - Cloudformation custom resource lambda event
 * @param {Context} context - Lambda context
 * @returns {Promise<CloudFormationCustomResourceResponse>}
 */
export async function lambdaHandler(
  event: CloudFormationCustomResourceEvent,
  context: Context
): Promise<CloudFormationCustomResourceResponse> {
  const {
    ResourceProperties: {
      TargetVersion,
      build,
      functionAlias,
      appName,
      deploymentGroupName,
      functionName,
      hooks = '[]',
    },
    OldResourceProperties: { build: oldBuild } = { build: '0' },
  } = { OldResourceProperties: { build: '0' }, ...event }
  if (
    event.RequestType !== 'Delete' &&
    Number.parseInt(build, 10) > Number.parseInt(oldBuild, 10)
  ) {
    try {
      const params = {
        functionName,
        functionAlias,
        appName,
        deploymentGroupName,
        hooks: JSON.parse(hooks),
      }

      const { FunctionVersion: CurrentVersion } = await lambda.send(
        new GetAliasCommand({
          FunctionName: params.functionName,
          Name: params.functionAlias,
        })
      )
      if (`${CurrentVersion}` === `${TargetVersion}`) {
        console.log(
          `Current version ${CurrentVersion} matches Target version ${TargetVersion}, no deployment needed`
        )
        return sendResponse(event, context, DeployOperationStatus.ok, {
          deployment: 'noop',
          build,
        })
      }

      return await doDeploy(event, context, params)
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
    build,
  })
}
