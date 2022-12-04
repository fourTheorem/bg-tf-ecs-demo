import { ScheduledEvent } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'node:crypto'

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const { DYNAMO_DB_TABLE_NAME = '' } = process.env

/**
 * Adds demo data as an item to the dynamo table
 *
 * @export
 * @param {ScheduledEvent} event - CloudWatch scheduled event
 * @returns {Promise<void>}
 */
export async function handler(event: ScheduledEvent) {
  const req: PutCommandInput = {
    TableName: DYNAMO_DB_TABLE_NAME,
    Item: {
      id: 'demo-data',
      uuid: randomUUID(),
      timestamp: new Date().toISOString(),
    },
  }

  console.info('Adding demo data to dynamo table', req)
  await dynamoClient.send(new PutCommand(req))
  console.info('Demo data added to dynamo table')
}
