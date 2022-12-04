import { Context } from 'koa'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
} from '@aws-sdk/lib-dynamodb'

import { getActiveDynamoTableName } from './constants'

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

/**
 * Handler for the API.
 * Gets data from dynamo and returns as a response
 *
 * @export
 * @param {Context} ctx
 * @returns {Promise<void>}
 */
export async function handler(ctx: Context): Promise<void> {
  try {
    const req: GetCommandInput = {
      TableName: getActiveDynamoTableName(),
      Key: {
        id: 'demo-data',
      },
    }
    const { Item: data } = await dynamoClient.send(new GetCommand(req))

    ctx.body = { data }
  } catch (err) {
    ctx.body = { status: 'error', message: err.message }
    ctx.status = 500
  }
}
