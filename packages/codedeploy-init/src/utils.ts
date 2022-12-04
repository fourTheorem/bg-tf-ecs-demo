import { createHash } from 'node:crypto'
import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceUpdateEvent,
} from 'aws-lambda'
import {
  DescribeServicesCommand,
  DescribeServicesCommandOutput,
  DescribeTaskDefinitionCommand,
  DescribeTaskDefinitionCommandOutput,
  ECS,
} from '@aws-sdk/client-ecs'
import { GetParameterCommand, SSM } from '@aws-sdk/client-ssm'

/**
 * Creates a sha256 hash of a string
 *
 * @param {string} str
 * @returns {string}
 * @private
 */
export function hash(str: string): string {
  return createHash('sha256').update(str, 'utf8').digest('hex')
}

export enum StackReference {
  A = 'a',
  B = 'b',
}

const ecs = new ECS({})
const ssm = new SSM({})

function invertStackReference(ref: string): StackReference {
  return ref === StackReference.A ? StackReference.B : StackReference.A
}

const getServiceInfo = (
  taskFamily: string,
  cluster: string
): Promise<DescribeServicesCommandOutput> =>
  ecs.send(new DescribeServicesCommand({ services: [taskFamily], cluster }))

const getTaskDefinitionInfo = (
  taskDefinition: string
): Promise<DescribeTaskDefinitionCommandOutput> => {
  const params = {
    taskDefinition,
  }

  return ecs.send(new DescribeTaskDefinitionCommand(params))
}

async function getActiveStackFromSsm(
  paramName: string
): Promise<StackReference> {
  const res = await ssm.send(new GetParameterCommand({ Name: paramName }))

  return res.Parameter?.Value === 'a' ? StackReference.A : StackReference.B
}

async function getActiveStackFromTaskDefinition(
  taskFamily: string,
  cluster: string
): Promise<StackReference> {
  const serviceData = await getServiceInfo(taskFamily, cluster)
  if (serviceData && serviceData.services) {
    const service = serviceData.services.pop()
    if (service && service.taskSets) {
      const taskSet = service.taskSets.find((task) => task.status === 'PRIMARY')
      if (taskSet) {
        const { taskDefinition } = taskSet
        if (taskDefinition) {
          const taskDefinitionData = await getTaskDefinitionInfo(taskDefinition)
          if (
            taskDefinitionData &&
            taskDefinitionData.taskDefinition &&
            taskDefinitionData.taskDefinition.containerDefinitions
          ) {
            const containerDefinition =
              taskDefinitionData.taskDefinition.containerDefinitions.pop()
            if (containerDefinition && containerDefinition.environment) {
              const prop = containerDefinition.environment.find(
                ({ name }) => name === 'TARGET_STACK'
              )
              if (prop && prop.value) {
                console.log(`active stack is "${prop.value}"`)
                return prop.value === 'a' ? StackReference.A : StackReference.B
              }
            }
          }
        }
      }
    }
  }

  throw new Error('unable to identify active stack')
}

export async function getInactiveStack(
  event: CloudFormationCustomResourceEvent
): Promise<StackReference> {
  const { ResourceProperties, OldResourceProperties } =
    event as CloudFormationCustomResourceUpdateEvent
  const { activeStackSsmName } = ResourceProperties
  let activeStack = StackReference.A
  if (activeStackSsmName) {
    activeStack = await getActiveStackFromSsm(activeStackSsmName)
  } else if (OldResourceProperties) {
    const { taskFamily, cluster } = ResourceProperties
    activeStack = await getActiveStackFromTaskDefinition(taskFamily, cluster)
  }

  return invertStackReference(activeStack)
}
