import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  Context,
} from 'aws-lambda'
import https from 'https'
import url from 'url'

export enum DeployOperationStatus {
  ok = 'SUCCESS',
  fail = 'FAILED',
}

interface SendOptions {
  hostname: string
  port: string
  path: string
  method: string
  headers: Record<string, string | number>
}

const send = (options: SendOptions, data: string): Promise<void> => {
  console.log('sending cloudformation response:', data)
  return new Promise((resolve, reject) => {
    const request = https.request(options, () => resolve())
    request.on('error', (error) => reject(error))
    request.write(data)
    request.end()
  })
}

/**
 * Sends the status report back to cloudformation about whether the deployment
 * was created successfully
 *
 * @export
 * @param {CloudFormationCustomResourceEvent} event - Cloudformation custom resource lambda event
 * @param {Context} context - Invoke context
 * @param {DeployOperationStatus} responseStatus - Whether the deployment was successfully created
 * @param {Record<string, any>} responseData - Information about the result of the operation
 * @returns {Promise<CloudFormationCustomResourceResponse>}
 */
export async function sendResponse(
  event: CloudFormationCustomResourceEvent,
  context: Context,
  responseStatus: DeployOperationStatus,
  responseData: Record<string, unknown>
): Promise<CloudFormationCustomResourceResponse> {
  const parsedUrl = url.parse(event.ResponseURL)
  if (
    !event.LogicalResourceId ||
    parsedUrl.hostname == null ||
    parsedUrl.path == null
  )
    throw new Error('Missing return url')

  const payload = {
    Status: responseStatus,
    Reason: `See the details in CloudWatch Log Stream: ${context.logStreamName}`,
    PhysicalResourceId: context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData,
  }
  const responseBody = JSON.stringify(payload)

  const options = {
    hostname: parsedUrl.hostname,
    port: '443',
    path: parsedUrl.path,
    method: 'PUT',
    headers: {
      'content-type': '',
      'content-length': responseBody.length,
    },
  }
  await send(options, responseBody)

  return payload
}
