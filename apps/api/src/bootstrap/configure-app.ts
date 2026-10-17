import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter';
import { AppConfigService } from '../config/app-config.service';
import { APP_VERSION } from '../version';

export const API_PREFIX = 'api';

/**
 * Cross-cutting HTTP setup shared by `main.ts` and the e2e tests, so tests run
 * against exactly the same pipeline as production.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(AppConfigService);

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGINS'),
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  app.useGlobalFilters(new AllExceptionsFilter(!config.isProduction));
  app.enableShutdownHooks();

  if (!config.isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('VYRA API')
        .setDescription('AI personal stylist — Ton dressing. Ton style. Ton IA.')
        .setVersion(APP_VERSION)
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, cleanupOpenApiDoc(document));
  }

  return app;
}
