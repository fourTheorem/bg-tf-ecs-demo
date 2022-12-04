import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceUpdateEvent,
} from 'aws-lambda'
import {
  ECS,
  ContainerDefinition,
  RegisterTaskDefinitionCommand,
  RegisterTaskDefinitionCommandOutput,
} from '@aws-sdk/client-ecs'

import { getInactiveStack, StackReference } from './utils'

const ecs = new ECS({})

/**
 * Sets or replaces the TARGET_STACK environment variable
 *
 * @param {ContainerDefinition[]} containerDefinitions
 * @param {StackReference} targetStack
 * @returns {ContainerDefinition[]}
 */
function updateEnvVars(
  containerDefinitions: ContainerDefinition[],
  targetStack: StackReference
): ContainerDefinition[] {
  if (!containerDefinitions[0]) return containerDefinitions
  const definition = { ...containerDefinitions[0] }
  const environment = [
    ...(definition.environment?.filter(({ name }) => name !== 'TARGET_STACK') ||
      []),
    {
      name: 'TARGET_STACK',
      value: targetStack,
    },
  ]
  return [{ ...definition, environment }]
}

export async function create(
  event: CloudFormationCustomResourceEvent
): Promise<RegisterTaskDefinitionCommandOutput> {
  const {
    ResourceProperties: {
      containerDefinitions: originalContainerDefinitions,
      networkMode = 'awsvpc',
      requiresCompatibilities = ['FARGATE'],
      taskFamily,
      taskRoleArn,
      taskExecutionRoleArn,
    },
  } = event as CloudFormationCustomResourceUpdateEvent
  const targetStack = await getInactiveStack(event)
  const containerDefinitions = updateEnvVars(
    JSON.parse(originalContainerDefinitions) as ContainerDefinition[],
    targetStack
  )

  const params = {
    containerDefinitions,
    family: taskFamily,
    executionRoleArn: taskExecutionRoleArn,
    networkMode,
    placementConstraints: [],
    requiresCompatibilities,
    taskRoleArn,
    volumes: [],
  }

  if (
    containerDefinitions &&
    containerDefinitions[0] &&
    containerDefinitions[0].cpu &&
    containerDefinitions[0].memory
  ) {
    return ecs.send(
      new RegisterTaskDefinitionCommand({
        ...params,
        cpu: containerDefinitions[0].cpu.toString(),
        memory: containerDefinitions[0].memory.toString(),
      })
    )
  }

  throw new Error('invalid container definition for task definition received')
}
