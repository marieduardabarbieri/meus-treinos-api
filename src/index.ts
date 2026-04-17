import 'dotenv/config'

import fastifyCors from '@fastify/cors'
import fastifySwagger from '@fastify/swagger'
import ScalarApiReference from '@scalar/fastify-api-reference'
import { fromNodeHeaders } from 'better-auth/node'
import Fastify from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod'
import z from 'zod'

import { auth } from './lib/auth.js'
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
      {
        title: 'Auth API',
        slug: 'auth-api',
        url: '/api/auth/open-api/generate-schema',
      },
    ],
  },
})

await app.register(fastifyCors, {
  origin: ['http://localhost:3000'],
  credentials: true,
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

app.withTypeProvider<ZodTypeProvider>().route({
  method: 'POST',
  url: '/workout-plans',
  schema: {
    body: z.object({
      name: z.string().trim().min(1, 'Nome é obrigatório'),
      workoutDays: z.array(
        z.object({
          name: z.string().trim().min(1, 'Nome é obrigatório'),
          weekDay: z.enum(WeekDay),
          isRest: z.boolean().default(false),
          estimatedDurationInSeconds: z.number().min(1, 'Duração estimada deve ser maior que 0'),
          exercises: z.array(
            z.object({
              order: z.number().min(0, 'Ordem deve ser não negativa'),
              name: z.string().trim().min(1, 'Nome é obrigatório'),
              sets: z.number().min(1, 'Séries devem ser maiores que 0'),
              reps: z.number().min(1, 'Repetições devem ser maiores que 0'),
              restTimeInSeconds: z.number().min(0, 'Tempo de descanso não pode ser negativo'),
            })
          ),
        })
      ),
    }),
    response: {
      201: z.object({
        id: z.uuid(),
        name: z.string().trim().min(1, 'Nome é obrigatório'),
        workoutDays: z.array(
          z.object({
            name: z.string().trim().min(1, 'Nome é obrigatório'),
            weekDay: z.enum(WeekDay),
            isRest: z.boolean().default(false),
            estimatedDurationInSeconds: z.number().min(1, 'Duração estimada deve ser maior que 0'),
            exercises: z.array(
              z.object({
                order: z.number().min(0, 'Ordem deve ser não negativa'),
                name: z.string().trim().min(1, 'Nome é obrigatório'),
                sets: z.number().min(1, 'Sets devem ser maiores que 0'),
                reps: z.number().min(1, 'Reps devem ser maiores que 0'),
                restTimeInSeconds: z.number().min(0, 'Tempo de descanso não pode ser negativo'),
              })
            ),
          })
        ),
      }),
      400: z.object({
        error: z.string(),
        code: z.string(),
      }),
      401: z.object({
        error: z.string(),
        code: z.string(),
      }),
    },
  },
  handler: async (request, reply) => {},
})

app.route({
  method: ['GET', 'POST'],
  url: '/api/auth/*',
  async handler(request, reply) {
    try {
      // Construct request URL
      const url = new URL(request.url, `http://${request.headers.host}`)

      // Convert Fastify headers to standard Headers object
      const headers = fromNodeHeaders(request.headers)
      // Create Fetch API-compatible request
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      })
      // Process authentication request
      const response = await auth.handler(req)
      // Forward response to client
      reply.status(response.status)
      response.headers.forEach((value, key) => reply.header(key, value))
      reply.send(response.body ? await response.text() : null)
    } catch (error) {
      app.log.error(error)
      reply.status(500).send({
        error: 'Internal authentication error',
        code: 'AUTH_FAILURE',
      })
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
