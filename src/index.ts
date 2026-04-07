import 'dotenv/config'

import fastifySwagger from '@fastify/swagger'
import ScalarApiReference from '@scalar/fastify-api-reference'
import Fastify from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod'
import z from 'zod'
const app = Fastify({
  logger: true,
})

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Fit AI API',
      description: 'API para gerenciamento de treinos e exercícios',
      version: '1.0.0',
    },
    servers: [
      {
        description: 'Local development server',
        url: 'http://localhost:8080',
      },
    ],
  },
  transform: jsonSchemaTransform,
})

await app.register(ScalarApiReference, {
  routePrefix: '/docs',
  configuration: {
    theme: 'elysiajs',
    sources: [
      {
        title: 'Fit AI API',
        slug: 'fit-ai-api',
        url: '/swagger.json',
      },
    ],
  },
})

app.withTypeProvider<ZodTypeProvider>().route({
  method: 'GET',
  url: '/swagger.json',
  schema: {
    hide: true,
  },
  handler: async () => {
    return app.swagger()
  },
})

app.withTypeProvider<ZodTypeProvider>().route({
  method: 'GET',
  url: '/',
  schema: {
    description: 'Hello World',
    tags: ['Bem-vindo'],
    response: {
      200: z.object({
        message: z.string(),
      }),
    },
  },
  handler: () => {
    return {
      message: 'Hello World',
    }
  },
})

try {
  await app.listen({ port: Number(process.env.PORT) })
  console.log(`Server is running on port ${process.env.PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
