import {
  CodeDeployClient,
  GetDeploymentCommand,
  waitUntilDeploymentSuccessful,
} from '@aws-sdk/client-codedeploy'
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation'
import yargs from 'yargs'
import delay from 'delay'

const { argv } = yargs(process.argv.slice(2))
  .option('env', {
    alias: 'e',
    demandOption: true,
    string: true,
    requiresArg: true,
    describe: 'The env we are deploying to',
  })
  .option('build', {
    alias: 'b',
    demandOption: false,
    string: true,
    requiresArg: true,
    describe: 'The build number that is being deployed',
  })
  .option('stack-name', {
    alias: 's',
    demandOption: true,
    string: true,
    requiresArg: true,
    describe:
      'The name of the CloudFormation stack to retrieve deploy ref outputs from',
  })
  .help()

const envConfig = {
  dev: {
    env: 'dev',
    regions: ['eu-west-1'],
  }
}

/**
 * Retrieves the latest CodeDeploy deployment id
 * from the deployment CloudFormation stack
 * output values
 *
 * @param cfStackName
 * @param build
 */
export async function getDeploymentRefs(cfStackName, build) {
  const { regions } = envConfig[argv.env.toLowerCase()]

  const cfOutputs = await Promise.all(
    regions.map(async (region) => {
      const cf = new CloudFormationClient({ region })

      let StackStatus = ''
      while (StackStatus !== 'UPDATE_COMPLETE') {
        const { Stacks = [] } = await cf.send(
          new DescribeStacksCommand({
            StackName: cfStackName,
          })
        )
        console.log(JSON.stringify(Stacks, null, 2))

        if (
          Stacks[0]?.StackStatus &&
          ['UPDATE_COMPLETE', 'CREATE_COMPLETE'].includes(Stacks[0].StackStatus)
        ) {
          const buildOutput = Stacks[0]?.Outputs?.find(
            (e) => e.OutputKey === 'build'
          )

          if (buildOutput && buildOutput.OutputValue === build) {
            StackStatus = Stacks[0] ? Stacks[0].StackStatus : ''
            const deploymentOutput = Stacks[0]?.Outputs?.find(
              (e) => e.OutputKey === 'deployment'
            )

            if (deploymentOutput) {
              if (deploymentOutput.OutputValue === 'noop') {
                return { deploymentId: deploymentOutput.OutputValue, region }
              }

              return {
                deploymentId: deploymentOutput.OutputValue,
                region,
              }
            }
          }
        }

        if (StackStatus === '') {
          console.log('unable to find deployment for this build, waiting')
          await delay(10e3)
        }
      }
    })
  )

  return cfOutputs
}

/**
 * Poll and wait for the CodeDeploy deployments to complete
 *
 * @param deployRefs
 */
const waitForDeploy = async (deployRefs) => {
  const { env } = envConfig[argv.env.toLowerCase()]

  await Promise.all(
    deployRefs.map(async ({ region, deploymentId }) => {
      if (deploymentId === 'noop') {
        console.log(
          `SKIPPED 'noop' action => Deployment ID: ${deploymentId}, Region: ${region}, Environment: ${env}`
        )
        return
      }

      const cd = new CodeDeployClient({ region })
      const { deploymentInfo } = await cd.send(
        new GetDeploymentCommand({ deploymentId })
      )

      console.log(
        `STARTING => Application: ${deploymentInfo?.applicationName}, Deployment Group: ${deploymentInfo?.deploymentGroupName}, Region: ${region}, Environment: ${env}`
      )

      console.log(
        `waiting for CodeDeploy deployment ${deploymentId} to complete, current status is: ${deploymentInfo?.status}`
      )
      await waitUntilDeploymentSuccessful(
        {
          maxWaitTime: 3600,
          minDelay: 15,
          maxDelay: 120,
          client: cd,
        },
        { deploymentId }
      )

      console.log(
        `FINISHED => Application: ${deploymentInfo?.applicationName}, Deployment Group: ${deploymentInfo?.deploymentGroupName}, Region: ${region}, Environment: ${env}`
      )
    })
  )
}

let tries = 0
const maxRety = 10
const exitTime = Date.now() + 45 * 60e3

const retry = async () => {
  const deployRefs = await getDeploymentRefs(argv['stack-name'], argv.build)

  waitForDeploy(deployRefs).catch((err) => {
    if (
      err.message === 'Resource is not in the state servicesStable' &&
      tries < maxRety
    ) {
      console.error('timed out waiting for service stable - will retry', err)
      tries++
      if (Date.now() < exitTime) setTimeout(retry, 60e3)
    } else if (
      // sometimes during codedeploy, this error state will be returned before the deployment is complete
      // if the retryable flag is true, we should check again to see if the deployment has finished
      // unlimited retries
      err.message === 'Resource is not in the state deploymentSuccessful' &&
      err.retryable
    ) {
      console.log('service not ready..')
      if (Date.now() < exitTime) setTimeout(retry, 60e3)
    } else if (
      // when a codedeploy fails because for example it did not pass a hook handler,
      // codedeploy will fail and enter this state with retryable set to false
      err.message === 'Resource is not in the state deploymentSuccessful' &&
      !err.retryable
    ) {
      console.error('service has failed to deploy', err)
      process.exit(1)
    } else if (tries >= maxRety) {
      console.error(`service not stable after ${tries} attempts`, err)
      process.exit(1)
    } else {
      console.error('unknown error - retrying', err)
      if (Date.now() < exitTime) setTimeout(retry, 60e3)
    }
  })
}

retry()
