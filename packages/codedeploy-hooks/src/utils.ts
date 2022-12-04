import {
  GetParameterCommand,
  PutParameterCommand,
  SSM,
} from '@aws-sdk/client-ssm'
import { ACTIVE_STACK_SSM_NAME } from './constants'

export enum StackReference {
  A = 'a',
  B = 'b',
}

const ssm = new SSM({})

function invertStackReference(ref: string): StackReference {
  return ref === StackReference.A ? StackReference.B : StackReference.A
}

export async function getActiveStackFromSsm(): Promise<StackReference> {
  const res = await ssm.send(
    new GetParameterCommand({ Name: ACTIVE_STACK_SSM_NAME })
  )

  return res.Parameter?.Value === 'a' ? StackReference.A : StackReference.B
}

export async function getNextStackRef(): Promise<StackReference> {
  const activeStack = await getActiveStackFromSsm()
  return invertStackReference(activeStack)
}

export async function setActiveStackRef(ref: StackReference): Promise<void> {
  const paramValue = ref === StackReference.A ? 'a' : 'b'
  await ssm.send(
    new PutParameterCommand({
      Name: ACTIVE_STACK_SSM_NAME,
      Value: paramValue,
      Overwrite: true,
    })
  )
}
