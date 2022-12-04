import Koa from 'koa'
import koaBunyanLogger from 'koa-bunyan-logger'

import {
  HEALTHCHECK_PATH,
  SERVICE_NAME,
  VERSION,
  getTargetStack,
} from './constants'
import { handler } from './handler'

const app = new Koa()

app.use(koaBunyanLogger({ name: SERVICE_NAME } as never))
app.use(koaBunyanLogger.requestLogger())
app.use((ctx, next) => {
  ctx.set('x-api-version', VERSION)
  ctx.set('x-service-name', SERVICE_NAME)
  ctx.set('x-stack', getTargetStack())

  if (ctx.path === HEALTHCHECK_PATH) {
    ctx.body = 'OK'
    return
  }

  if (ctx.path === '/get-demo-data') {
    return next()
  }

  ctx.status = 404
  ctx.body = { message: 'Not found' }
})
app.use(handler)

app.listen(8080)
